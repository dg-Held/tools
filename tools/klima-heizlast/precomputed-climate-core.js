'use strict';

(function initPrecomputedClimateCore(global) {
  const BASE_URL = 'data/climate-precomputed';
  const HEATING_LIMIT_C = 15;
  const NORMALIZED_HOURS = 8760;

  let manifestPromise = null;
  let yearlyIndexPromise = null;
  const tileCache = new Map();
  const jsonCache = new Map();

  function finite(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function mean(values) {
    const clean = values.filter(finite);
    if (clean.length === 0) return null;
    return clean.reduce((sum, value) => sum + value, 0) / clean.length;
  }

  function quantile(values, probability) {
    const sorted = values
      .filter(finite)
      .sort((a, b) => a - b);

    if (sorted.length === 0) return null;
    if (sorted.length === 1) return sorted[0];

    const position = (sorted.length - 1) * probability;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const weight = position - lower;

    return (
      sorted[lower] * (1 - weight) +
      sorted[upper] * weight
    );
  }

  function haversineMeters(lat1, lon1, lat2, lon2) {
    const radius = 6371000;
    const toRad = Math.PI / 180;
    const phi1 = lat1 * toRad;
    const phi2 = lat2 * toRad;
    const dPhi = (lat2 - lat1) * toRad;
    const dLambda = (lon2 - lon1) * toRad;

    const a =
      Math.sin(dPhi / 2) ** 2 +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(dLambda / 2) ** 2;

    return 2 * radius * Math.asin(Math.sqrt(a));
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(
        `Vorberechnete Klimadaten HTTP ${response.status}`
      );
    }

    return response.json();
  }

  async function loadManifest() {
    if (!manifestPromise) {
      manifestPromise = fetchJson(`${BASE_URL}/manifest.json`);
    }

    return manifestPromise;
  }

  function getAvailableYears(manifest) {
    const yearly = manifest?.yearly_packages;
    if (yearly?.enabled && Array.isArray(yearly.years) && yearly.years.length) {
      return [...yearly.years].map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    }
    return [...(manifest?.years ?? [])].map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  }

  function periodInfo(manifest) {
    const years = getAvailableYears(manifest);
    return {
      years,
      start_year: years[0] ?? null,
      end_year: years[years.length - 1] ?? null,
      year_count: years.length,
      mode: manifest?.yearly_packages?.enabled ? 'yearly-packages' : 'baseline',
    };
  }

  async function loadCachedJson(relativePath) {
    if (jsonCache.has(relativePath)) return jsonCache.get(relativePath);
    const promise = fetchJson(`${BASE_URL}/${relativePath}`);
    jsonCache.set(relativePath, promise);
    try {
      return await promise;
    } catch (error) {
      jsonCache.delete(relativePath);
      throw error;
    }
  }

  async function loadTile(manifest, tileId) {
    if (tileCache.has(tileId)) {
      return tileCache.get(tileId);
    }

    const relativePath = manifest.tiles?.[tileId];

    if (!relativePath) {
      throw new Error(
        `Klimakachel ${tileId} ist nicht im Manifest eingetragen.`
      );
    }

    const tile = await fetchJson(
      `${BASE_URL}/${relativePath}`
    );

    tileCache.set(tileId, tile);
    return tile;
  }

  function findProfileReference(
    manifest,
    location
  ) {
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);

    if (!finite(latitude) || !finite(longitude)) {
      return null;
    }

    let best = null;

    for (const entry of manifest.index ?? []) {
      const [
        profileId,
        gridLatitude,
        gridLongitude,
        tileId,
        sourceLocationIds = [],
      ] = entry;

      /*
        Der kleine Stufe-15-Demoindex darf nur die drei bekannten
        technischen Referenzorte beschleunigen. So wird bei realen
        Adressen niemals versehentlich ein benachbartes Demo-Profil
        verwendet.
      */
      if (
        manifest.coverage_mode === 'demo' &&
        !sourceLocationIds.includes(location.id)
      ) {
        continue;
      }

      const distance = haversineMeters(
        latitude,
        longitude,
        gridLatitude,
        gridLongitude
      );

      if (!best || distance < best.distance_m) {
        best = {
          profile_id: profileId,
          tile_id: tileId,
          grid_latitude: gridLatitude,
          grid_longitude: gridLongitude,
          distance_m: distance,
        };
      }
    }

    if (
      !best ||
      best.distance_m >
        Number(manifest.lookup_max_distance_m ?? 850)
    ) {
      return null;
    }

    return best;
  }

  function expandDurationCurve(
    sampleIndices,
    sampleTemperatures,
    targetLength = NORMALIZED_HOURS
  ) {
    if (
      !Array.isArray(sampleIndices) ||
      !Array.isArray(sampleTemperatures) ||
      sampleIndices.length !== sampleTemperatures.length ||
      sampleIndices.length < 2
    ) {
      throw new Error(
        'Das vorberechnete Klimaprofil enthält keine gültige Dauerlinie.'
      );
    }

    const output = new Array(targetLength);
    let sampleIndex = 0;

    for (let hour = 0; hour < targetLength; hour += 1) {
      while (
        sampleIndex < sampleIndices.length - 2 &&
        hour > sampleIndices[sampleIndex + 1]
      ) {
        sampleIndex += 1;
      }

      const leftHour = sampleIndices[sampleIndex];
      const rightHour = sampleIndices[sampleIndex + 1];
      const leftValue = sampleTemperatures[sampleIndex];
      const rightValue = sampleTemperatures[sampleIndex + 1];

      if (hour <= leftHour) {
        output[hour] = leftValue;
        continue;
      }

      if (hour >= rightHour && sampleIndex === sampleIndices.length - 2) {
        output[hour] = rightValue;
        continue;
      }

      const span = rightHour - leftHour;
      const weight = span > 0
        ? (hour - leftHour) / span
        : 0;

      output[hour] =
        leftValue * (1 - weight) +
        rightValue * weight;
    }

    return output;
  }

  function approximateNatHours(
    frequencyHours,
    temperatureBins,
    natC
  ) {
    let total = 0;

    for (
      let index = 0;
      index < temperatureBins.length;
      index += 1
    ) {
      const center = temperatureBins[index];
      const lower = center - 0.5;
      const upper = center + 0.5;
      const hours = frequencyHours[index] ?? 0;

      if (natC >= upper) {
        total += hours;
      } else if (natC <= lower) {
        continue;
      } else {
        const fraction =
          (natC - lower) / (upper - lower);
        total += hours * Math.max(
          0,
          Math.min(1, fraction)
        );
      }
    }

    return total;
  }

  function unpackAnnual(
    manifest,
    row,
    natC,
    temperatureBins
  ) {
    const schema = manifest.annual_schema ?? [];
    const at = (name) => row[schema.indexOf(name)];

    const frequencyScale =
      Number(manifest.frequency_scale ?? 10);
    const frequencyHours =
      (at('frequency_q10') ?? []).map(
        (value) => value / frequencyScale
      );

    const thresholds = manifest.nat_thresholds_c ?? [];
    const natCounts = at('nat_counts') ?? [];
    const thresholdIndex = thresholds.findIndex(
      (value) =>
        Math.abs(Number(value) - natC) < 0.0001
    );

    const hoursAtOrBelowNat =
      thresholdIndex >= 0 &&
      Number.isFinite(natCounts[thresholdIndex])
        ? natCounts[thresholdIndex]
        : approximateNatHours(
            frequencyHours,
            temperatureBins,
            natC
          );

    const heatingDegreeHours =
      Number(at('heating_degree_hours_q100')) / 100;

    const denominator = HEATING_LIMIT_C - natC;

    if (!(denominator > 0)) {
      throw new Error(
        'Die Normaußentemperatur muss unter 15 °C liegen.'
      );
    }

    const temperatureFromQ100 = (value) =>
      Number.isFinite(value)
        ? value / 100
        : null;

    return {
      year: Number(at('year')),
      received_hours: Number(at('received_hours')),
      expected_hours: Number(at('expected_hours')),
      valid_hours: Number(at('valid_hours')),
      missing_values: Number(at('missing_values')),
      minimum_hourly_c:
        temperatureFromQ100(
          at('minimum_hourly_c_q100')
        ),
      minimum_24h_mean_c:
        temperatureFromQ100(
          at('minimum_24h_mean_c_q100')
        ),
      maximum_hourly_c:
        temperatureFromQ100(
          at('maximum_hourly_c_q100')
        ),
      hours_below_0: Number(at('hours_below_0')),
      hours_below_minus_5:
        Number(at('hours_below_minus_5')),
      hours_below_minus_10:
        Number(at('hours_below_minus_10')),
      hours_at_or_below_nat: hoursAtOrBelowNat,
      heating_demand_hours:
        Number(at('heating_demand_hours')),
      full_load_hours:
        heatingDegreeHours / denominator,
      hot_days: Number(at('hot_days')),
      extreme_hot_days:
        Number(at('extreme_hot_days')),
      valid_heat_days:
        Number(at('valid_heat_days')),
      incomplete_heat_days:
        Number(at('incomplete_heat_days')),
      tropical_nights:
        Number(at('tropical_nights')),
      valid_nights: Number(at('valid_nights')),
      incomplete_nights:
        Number(at('incomplete_nights')),
      warmest_night_minimum_c:
        temperatureFromQ100(
          at('warmest_night_minimum_c_q100')
        ),
      _frequency_hours: frequencyHours,
    };
  }

  function aggregateFrequency(
    annual,
    temperatureBins
  ) {
    const median = new Array(
      temperatureBins.length
    );
    const meanValues = new Array(
      temperatureBins.length
    );

    for (
      let index = 0;
      index < temperatureBins.length;
      index += 1
    ) {
      const values = annual.map(
        (item) => item._frequency_hours[index]
      );

      median[index] = quantile(values, 0.5);
      meanValues[index] = mean(values);
    }

    return {
      temperature_c: [...temperatureBins],
      median_hours: median,
      mean_hours: meanValues,
      annual: annual.map((item) => ({
        year: item.year,
        hours: [...item._frequency_hours],
      })),
    };
  }

  function buildSummary(annual) {
    return {
      average_hours_below_0:
        mean(annual.map((item) => item.hours_below_0)),
      average_hours_below_minus_5:
        mean(
          annual.map(
            (item) => item.hours_below_minus_5
          )
        ),
      average_hours_below_minus_10:
        mean(
          annual.map(
            (item) => item.hours_below_minus_10
          )
        ),
      average_hours_at_or_below_nat:
        mean(
          annual.map(
            (item) => item.hours_at_or_below_nat
          )
        ),
      average_heating_demand_hours:
        mean(
          annual.map(
            (item) => item.heating_demand_hours
          )
        ),
      average_full_load_hours:
        mean(
          annual.map(
            (item) => item.full_load_hours
          )
        ),
      average_hot_days:
        mean(annual.map((item) => item.hot_days)),
      average_extreme_hot_days:
        mean(
          annual.map(
            (item) => item.extreme_hot_days
          )
        ),
      average_tropical_nights:
        mean(
          annual.map(
            (item) => item.tropical_nights
          )
        ),
      maximum_hot_days_in_year:
        Math.max(...annual.map((item) => item.hot_days)),
      maximum_tropical_nights_in_year:
        Math.max(
          ...annual.map(
            (item) => item.tropical_nights
          )
        ),
      absolute_minimum_hourly_c:
        Math.min(
          ...annual.map(
            (item) => item.minimum_hourly_c
          )
        ),
      absolute_minimum_24h_mean_c:
        Math.min(
          ...annual
            .map(
              (item) => item.minimum_24h_mean_c
            )
            .filter(finite)
        ),
      absolute_maximum_hourly_c:
        Math.max(
          ...annual
            .map(
              (item) => item.maximum_hourly_c
            )
            .filter(finite)
        ),
      warmest_night_minimum_c:
        Math.max(
          ...annual
            .map(
              (item) =>
                item.warmest_night_minimum_c
            )
            .filter(finite)
        ),
      average_annual_minimum_hourly_c:
        mean(
          annual.map(
            (item) => item.minimum_hourly_c
          )
        ),
      average_annual_minimum_24h_mean_c:
        mean(
          annual.map(
            (item) => item.minimum_24h_mean_c
          )
        ),
      total_missing_values:
        annual.reduce(
          (sum, item) =>
            sum + item.missing_values,
          0
        ),
      total_incomplete_heat_days:
        annual.reduce(
          (sum, item) =>
            sum + item.incomplete_heat_days,
          0
        ),
      total_incomplete_nights:
        annual.reduce(
          (sum, item) =>
            sum + item.incomplete_nights,
          0
        ),
    };
  }

  async function loadYearlyIndex(manifest) {
    const path = manifest?.yearly_packages?.index_path;
    if (!path) throw new Error('Jahrespakete sind aktiviert, aber index_path fehlt.');
    if (!yearlyIndexPromise) yearlyIndexPromise = loadCachedJson(path);
    return yearlyIndexPromise;
  }

  function findYearlyProfileReference(manifest, indexPayload, location) {
    return findProfileReference({
      ...manifest,
      coverage_mode: 'full',
      index: indexPayload?.index ?? [],
      lookup_max_distance_m:
        indexPayload?.lookup_max_distance_m ?? manifest.lookup_max_distance_m,
    }, location);
  }

  function yearManifestPath(manifest, year) {
    const pattern = manifest?.yearly_packages?.year_manifest_pattern ?? 'yearly/{year}.json';
    return pattern.replace('{year}', String(year));
  }

  async function loadYearPackage(manifest, year, tileId, profileId) {
    const yearManifest = await loadCachedJson(yearManifestPath(manifest, year));
    const tilePath = yearManifest?.tiles?.[tileId];
    if (!tilePath) {
      throw new Error(`Jahrespaket ${year}: Klimakachel ${tileId} fehlt.`);
    }
    const tile = await loadCachedJson(tilePath);
    const profile = tile?.[profileId];
    if (!profile) {
      throw new Error(`Jahrespaket ${year}: Profil ${profileId} fehlt.`);
    }
    return { yearManifest, profile };
  }

  function aggregateDurationSamples(manifest, samplesByYear) {
    const sampleIndices = manifest.duration_sample_indices ?? [];
    if (!sampleIndices.length || !samplesByYear.length) {
      throw new Error('Jahrespakete enthalten keine gültigen Dauerlinien-Stützstellen.');
    }

    const scale = Number(manifest.duration_temperature_scale ?? 100);
    const p10 = new Array(sampleIndices.length);
    const median = new Array(sampleIndices.length);
    const p90 = new Array(sampleIndices.length);

    for (let index = 0; index < sampleIndices.length; index += 1) {
      const values = samplesByYear
        .map((entry) => Number(entry.duration_q100?.[index]))
        .filter(Number.isFinite)
        .map((value) => value / scale);
      p10[index] = quantile(values, 0.1);
      median[index] = quantile(values, 0.5);
      p90[index] = quantile(values, 0.9);
    }

    return {
      p10_c: expandDurationCurve(sampleIndices, p10, NORMALIZED_HOURS),
      median_c: expandDurationCurve(sampleIndices, median, NORMALIZED_HOURS),
      p90_c: expandDurationCurve(sampleIndices, p90, NORMALIZED_HOURS),
    };
  }

  async function buildYearlyClimateResult(manifest, location) {
    const period = periodInfo(manifest);
    if (!period.years.length) return null;

    const indexPayload = await loadYearlyIndex(manifest);
    const reference = findYearlyProfileReference(manifest, indexPayload, location);
    if (!reference) return null;

    const loadedYears = [];
    for (const year of period.years) {
      const loaded = await loadYearPackage(
        manifest,
        year,
        reference.tile_id,
        reference.profile_id
      );
      loadedYears.push({ year, ...loaded });
    }

    const natC = Number(location.nat_c);
    if (!finite(natC)) throw new Error('Für das vorberechnete Klimaprofil fehlt die NAT.');

    const temperatureBins = Array.from(
      { length: Number(manifest.frequency_max_c) - Number(manifest.frequency_min_c) + 1 },
      (_, index) => Number(manifest.frequency_min_c) + index
    );

    const annual = loadedYears
      .map(({ profile }) => unpackAnnual(manifest, profile.annual_row, natC, temperatureBins))
      .sort((a, b) => a.year - b.year);

    const annualPublic = annual.map(({ _frequency_hours, ...item }) => item);
    const curves = aggregateDurationSamples(
      manifest,
      loadedYears.map(({ year, profile }) => ({ year, duration_q100: profile.duration_q100 }))
    );

    const firstProfile = loadedYears[0]?.profile ?? {};
    const latestGenerated = loadedYears
      .map(({ yearManifest }) => yearManifest.generated_at)
      .filter(Boolean)
      .sort()
      .at(-1) ?? new Date().toISOString();

    return {
      manifest,
      reference,
      profile: null,
      result: {
        schema_version: 5,
        generated_at: latestGenerated,
        location: {
          ...location,
          grid_longitude: firstProfile.grid_longitude ?? reference.grid_longitude,
          grid_latitude: firstProfile.grid_latitude ?? reference.grid_latitude,
          start_year: period.start_year,
          end_year: period.end_year,
          climate_load_source: 'precomputed-yearly',
          precomputed_profile_id: reference.profile_id,
          precomputed_distance_m: reference.distance_m ?? null,
        },
        assumptions: {
          heating_limit_c: HEATING_LIMIT_C,
          duration_curve_hours: NORMALIZED_HOURS,
          frequency_bin_width_c: Number(manifest.frequency_bin_width_c ?? 1),
          hot_day_definition: 'Tagesmaximum aus Stundenwerten mindestens 30 °C',
          extreme_hot_day_definition: 'Tagesmaximum aus Stundenwerten mindestens 35 °C',
          tropical_night_definition: 'Minimum der Stundenwerte 18–06 UTC mindestens 20 °C',
          full_load_hours_formula: 'Σ max(0, (15 - Außentemperatur) / (15 - NAT))',
          note: 'Jahresweise vorberechnete INCA-Pakete. NAT-abhängige Kennzahlen werden beim Seitenaufruf für die konkrete Katastralgemeinde neu berechnet.',
        },
        data: {
          source: 'GeoSphere Austria, INCA-v1-1h-1km, T2M · jahresweise vorberechnete Klimaprofile',
          license: 'CC BY 4.0',
          years: [...period.years],
          year_count: period.year_count,
          precomputed: true,
          yearly_packages: true,
        },
        metrics: buildSummary(annualPublic),
        annual_metrics: annualPublic,
        temperature_frequency: aggregateFrequency(annual, temperatureBins),
        duration_curve: {
          hour_rank: Array.from({ length: NORMALIZED_HOURS }, (_, index) => index + 1),
          p10_c: curves.p10_c,
          median_c: curves.median_c,
          p90_c: curves.p90_c,
        },
      },
    };
  }

  function buildClimateResult(
    manifest,
    profile,
    location,
    reference
  ) {
    const natC = Number(location.nat_c);

    if (!finite(natC)) {
      throw new Error(
        'Für das vorberechnete Klimaprofil fehlt die NAT.'
      );
    }

    const temperatureBins = Array.from(
      {
        length:
          Number(manifest.frequency_max_c) -
          Number(manifest.frequency_min_c) +
          1,
      },
      (_, index) =>
        Number(manifest.frequency_min_c) + index
    );

    const annual = profile.annual
      .map((row) =>
        unpackAnnual(
          manifest,
          row,
          natC,
          temperatureBins
        )
      )
      .sort((a, b) => a.year - b.year);

    const durationScale =
      Number(
        manifest.duration_temperature_scale ?? 100
      );

    const sampleTemperatures =
      profile.duration_median_q100.map(
        (value) => value / durationScale
      );

    const medianCurve = expandDurationCurve(
      manifest.duration_sample_indices,
      sampleTemperatures,
      NORMALIZED_HOURS
    );

    const annualPublic = annual.map(
      ({ _frequency_hours, ...item }) => item
    );

    return {
      schema_version: 4,
      generated_at:
        profile.generated_at ??
        new Date().toISOString(),
      location: {
        ...location,
        grid_longitude:
          profile.grid_longitude,
        grid_latitude:
          profile.grid_latitude,
        start_year:
          Number(manifest.years?.[0] ?? 2012),
        end_year:
          Number(
            manifest.years?.[
              manifest.years.length - 1
            ] ?? 2025
          ),
        climate_load_source: 'precomputed',
        precomputed_profile_id: profile.id,
        precomputed_distance_m:
          reference?.distance_m ?? null,
      },
      assumptions: {
        heating_limit_c: HEATING_LIMIT_C,
        duration_curve_hours: NORMALIZED_HOURS,
        frequency_bin_width_c:
          Number(
            manifest.frequency_bin_width_c ?? 1
          ),
        hot_day_definition:
          'Tagesmaximum aus Stundenwerten mindestens 30 °C',
        extreme_hot_day_definition:
          'Tagesmaximum aus Stundenwerten mindestens 35 °C',
        tropical_night_definition:
          'Minimum der Stundenwerte 18–06 UTC mindestens 20 °C',
        full_load_hours_formula:
          'Σ max(0, (15 - Außentemperatur) / (15 - NAT))',
        note:
          'Aus vorberechneten INCA-Stundenwerten. NAT-abhängige Kennzahlen werden beim Seitenaufruf für die konkrete Katastralgemeinde neu berechnet.',
      },
      data: {
        source:
          'GeoSphere Austria, INCA-v1-1h-1km, T2M · vorberechnetes Klimaprofil',
        license: 'CC BY 4.0',
        years: annualPublic.map(
          (item) => item.year
        ),
        year_count: annualPublic.length,
        precomputed: true,
      },
      metrics: buildSummary(annualPublic),
      annual_metrics: annualPublic,
      temperature_frequency:
        aggregateFrequency(
          annual,
          temperatureBins
        ),
      duration_curve: {
        hour_rank: Array.from(
          { length: NORMALIZED_HOURS },
          (_, index) => index + 1
        ),
        p10_c: null,
        median_c: medianCurve,
        p90_c: null,
      },
    };
  }

  async function loadForLocation(location) {
    const manifest = await loadManifest();

    if (manifest?.yearly_packages?.enabled) {
      return buildYearlyClimateResult(manifest, location);
    }

    const reference = findProfileReference(manifest, location);
    if (!reference) return null;

    const tile = await loadTile(manifest, reference.tile_id);
    const profile = tile?.[reference.profile_id] ?? null;
    if (!profile) return null;

    return {
      manifest,
      profile,
      reference,
      result: buildClimateResult(manifest, profile, location, reference),
    };
  }

  global.PrecomputedClimateCore = {
    loadManifest,
    getAvailableYears,
    periodInfo,
    findProfileReference,
    buildClimateResult,
    buildYearlyClimateResult,
    loadForLocation,
    expandDurationCurve,
  };
})(window);
