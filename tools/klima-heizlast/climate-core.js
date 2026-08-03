'use strict';

(function initClimateCore(global) {
  const NORMALIZED_HOURS = 8760;
  const HEATING_LIMIT_C = 15;

  /*
    1-Kelvin-Temperaturklassen für die Stundenhäufigkeit.
    Der Wert 0 steht z. B. für den Bereich -0,5 bis +0,5 °C.
  */
  const FREQUENCY_MIN_C = -35;
  const FREQUENCY_MAX_C = 40;
  const FREQUENCY_BINS = Array.from(
    { length: FREQUENCY_MAX_C - FREQUENCY_MIN_C + 1 },
    (_, index) => FREQUENCY_MIN_C + index
  );

  const HOT_DAY_THRESHOLD_C = 30;
  const EXTREME_HOT_DAY_THRESHOLD_C = 35;
  const TROPICAL_NIGHT_THRESHOLD_C = 20;

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function expectedHours(year) {
    return isLeapYear(year) ? 8784 : 8760;
  }

  function quantile(values, probability) {
    const sorted = values.filter(isFiniteNumber).sort((a, b) => a - b);

    if (sorted.length === 0) return null;
    if (sorted.length === 1) return sorted[0];

    const index = (sorted.length - 1) * probability;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  function mean(values) {
    const clean = values.filter(isFiniteNumber);
    if (clean.length === 0) return null;
    return clean.reduce((sum, value) => sum + value, 0) / clean.length;
  }

  function minimum24HourMean(temperatures) {
    if (temperatures.length < 24) return null;

    let runningSum = 0;
    let validCount = 0;
    let minimum = Infinity;

    for (let index = 0; index < temperatures.length; index += 1) {
      const value = temperatures[index];

      if (isFiniteNumber(value)) {
        runningSum += value;
        validCount += 1;
      }

      if (index >= 24) {
        const oldValue = temperatures[index - 24];
        if (isFiniteNumber(oldValue)) {
          runningSum -= oldValue;
          validCount -= 1;
        }
      }

      if (index >= 23 && validCount === 24) {
        minimum = Math.min(minimum, runningSum / 24);
      }
    }

    return Number.isFinite(minimum) ? minimum : null;
  }

  function interpolateSorted(sortedValues, targetLength = NORMALIZED_HOURS) {
    const values = sortedValues.filter(isFiniteNumber).sort((a, b) => a - b);

    if (values.length < 2) {
      throw new Error(
        'Für eine Dauerlinie werden mindestens zwei Temperaturwerte benötigt.'
      );
    }

    if (targetLength === 1) return [values[0]];

    const result = new Array(targetLength);
    const sourceLast = values.length - 1;
    const targetLast = targetLength - 1;

    for (let targetIndex = 0; targetIndex < targetLength; targetIndex += 1) {
      const sourcePosition = (targetIndex / targetLast) * sourceLast;
      const lower = Math.floor(sourcePosition);
      const upper = Math.ceil(sourcePosition);
      const weight = sourcePosition - lower;

      result[targetIndex] =
        values[lower] * (1 - weight) + values[upper] * weight;
    }

    return result;
  }

  function buildFrequencyHours(validTemperatures) {
    const counts = new Array(FREQUENCY_BINS.length).fill(0);

    validTemperatures.forEach((temperature) => {
      const roundedTemperature = Math.round(temperature);
      const index = roundedTemperature - FREQUENCY_MIN_C;

      if (index >= 0 && index < counts.length) {
        counts[index] += 1;
      }
    });

    /*
      Schaltjahre und wenige fehlende Werte werden auf 8.760 Stunden
      normalisiert. Dadurch sind die Einzeljahre direkt vergleichbar.
    */
    const scale = validTemperatures.length > 0
      ? NORMALIZED_HOURS / validTemperatures.length
      : 1;

    return counts.map((value) => value * scale);
  }

  function analyzeHotDays(yearData) {
    const days = new Map();

    yearData.timestamps.forEach((timestamp, index) => {
      const temperature = Number(yearData.temperatures[index]);
      if (!isFiniteNumber(temperature)) return;

      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) return;

      const key = date.toISOString().slice(0, 10);
      if (!days.has(key)) days.set(key, []);
      days.get(key).push(temperature);
    });

    let hotDays = 0;
    let extremeHotDays = 0;
    let validDays = 0;
    let incompleteDays = 0;
    let maximumHourly = -Infinity;

    days.forEach((values) => {
      /*
        Mit mindestens 20 gültigen Stundenwerten wird der Tag ausgewertet.
        Das Ergebnis bleibt dennoch eine Ableitung aus Stundenwerten.
      */
      if (values.length < 20) {
        incompleteDays += 1;
        return;
      }

      validDays += 1;
      const dailyMaximum = Math.max(...values);
      maximumHourly = Math.max(maximumHourly, dailyMaximum);

      if (dailyMaximum >= HOT_DAY_THRESHOLD_C) hotDays += 1;
      if (dailyMaximum >= EXTREME_HOT_DAY_THRESHOLD_C) extremeHotDays += 1;
    });

    return {
      hot_days: hotDays,
      extreme_hot_days: extremeHotDays,
      valid_heat_days: validDays,
      incomplete_heat_days: incompleteDays,
      maximum_hourly_c: Number.isFinite(maximumHourly) ? maximumHourly : null,
    };
  }

  function nextUtcDateKey(date) {
    const next = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + 1
      )
    );
    return next.toISOString().slice(0, 10);
  }

  function analyzeTropicalNights(yearlyData) {
    /*
      Eine Nacht wird dem Morgen zugeordnet:
      18–23 UTC des Vortags plus 00–06 UTC des Folgetags.
      Damit werden 13 stündliche Werte je Nacht betrachtet.
    */
    const nights = new Map();

    yearlyData.forEach((yearData) => {
      yearData.timestamps.forEach((timestamp, index) => {
        const temperature = Number(yearData.temperatures[index]);
        if (!isFiniteNumber(temperature)) return;

        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return;

        const hour = date.getUTCHours();
        let nightKey = null;

        if (hour >= 18) {
          nightKey = nextUtcDateKey(date);
        } else if (hour <= 6) {
          nightKey = date.toISOString().slice(0, 10);
        }

        if (!nightKey) return;

        if (!nights.has(nightKey)) nights.set(nightKey, []);
        nights.get(nightKey).push(temperature);
      });
    });

    const byYear = new Map();

    nights.forEach((values, nightKey) => {
      const year = Number(nightKey.slice(0, 4));
      if (!byYear.has(year)) {
        byYear.set(year, {
          tropical_nights: 0,
          valid_nights: 0,
          incomplete_nights: 0,
          warmest_night_minimum_c: -Infinity,
        });
      }

      const result = byYear.get(year);

      if (values.length !== 13) {
        result.incomplete_nights += 1;
        return;
      }

      result.valid_nights += 1;
      const nightMinimum = Math.min(...values);
      result.warmest_night_minimum_c = Math.max(
        result.warmest_night_minimum_c,
        nightMinimum
      );

      if (nightMinimum >= TROPICAL_NIGHT_THRESHOLD_C) {
        result.tropical_nights += 1;
      }
    });

    byYear.forEach((result) => {
      if (!Number.isFinite(result.warmest_night_minimum_c)) {
        result.warmest_night_minimum_c = null;
      }
    });

    return byYear;
  }

  function analyzeYear(yearData, natC, tropicalNightMetrics) {
    const temperatures = yearData.temperatures.map((value) =>
      value === null || value === undefined ? null : Number(value)
    );
    const valid = temperatures.filter(isFiniteNumber);

    if (valid.length < 8000) {
      throw new Error(
        `${yearData.year}: Nur ${valid.length} gültige Stundenwerte vorhanden.`
      );
    }

    const denominator = HEATING_LIMIT_C - natC;
    if (!(denominator > 0)) {
      throw new Error('Die Normaußentemperatur muss unter 15 °C liegen.');
    }

    const fullLoadHours = valid.reduce((sum, temperature) => {
      const relativeLoad = Math.max(
        0,
        (HEATING_LIMIT_C - temperature) / denominator
      );
      return sum + relativeLoad;
    }, 0);

    const hotDayMetrics = analyzeHotDays(yearData);
    const nightMetrics = tropicalNightMetrics ?? {
      tropical_nights: 0,
      valid_nights: 0,
      incomplete_nights: 0,
      warmest_night_minimum_c: null,
    };

    return {
      year: yearData.year,
      received_hours: temperatures.length,
      expected_hours: expectedHours(yearData.year),
      valid_hours: valid.length,
      missing_values: temperatures.length - valid.length,
      minimum_hourly_c: Math.min(...valid),
      minimum_24h_mean_c: minimum24HourMean(temperatures),
      maximum_hourly_c: hotDayMetrics.maximum_hourly_c,
      hours_below_0: valid.filter((value) => value < 0).length,
      hours_below_minus_5: valid.filter((value) => value < -5).length,
      hours_below_minus_10: valid.filter((value) => value < -10).length,
      hours_at_or_below_nat: valid.filter((value) => value <= natC).length,
      heating_demand_hours: valid.filter(
        (value) => value < HEATING_LIMIT_C
      ).length,
      full_load_hours: fullLoadHours,
      hot_days: hotDayMetrics.hot_days,
      extreme_hot_days: hotDayMetrics.extreme_hot_days,
      valid_heat_days: hotDayMetrics.valid_heat_days,
      incomplete_heat_days: hotDayMetrics.incomplete_heat_days,
      tropical_nights: nightMetrics.tropical_nights,
      valid_nights: nightMetrics.valid_nights,
      incomplete_nights: nightMetrics.incomplete_nights,
      warmest_night_minimum_c: nightMetrics.warmest_night_minimum_c,
      normalized_curve: interpolateSorted(valid),
      frequency_hours: buildFrequencyHours(valid),
    };
  }

  function aggregateCurves(annualAnalyses) {
    const p10 = new Array(NORMALIZED_HOURS);
    const median = new Array(NORMALIZED_HOURS);
    const p90 = new Array(NORMALIZED_HOURS);

    for (let index = 0; index < NORMALIZED_HOURS; index += 1) {
      const values = annualAnalyses.map((year) => year.normalized_curve[index]);
      p10[index] = quantile(values, 0.1);
      median[index] = quantile(values, 0.5);
      p90[index] = quantile(values, 0.9);
    }

    return { p10, median, p90 };
  }

  function aggregateFrequency(annualAnalyses) {
    const median = new Array(FREQUENCY_BINS.length);
    const meanValues = new Array(FREQUENCY_BINS.length);

    for (let index = 0; index < FREQUENCY_BINS.length; index += 1) {
      const values = annualAnalyses.map(
        (year) => year.frequency_hours[index]
      );
      median[index] = quantile(values, 0.5);
      meanValues[index] = mean(values);
    }

    return {
      temperature_c: [...FREQUENCY_BINS],
      median_hours: median,
      mean_hours: meanValues,
      annual: annualAnalyses.map((item) => ({
        year: item.year,
        hours: item.frequency_hours,
      })),
    };
  }

  function analyzeYearlyData(config, yearlyData) {
    if (!Array.isArray(yearlyData) || yearlyData.length === 0) {
      throw new Error('Es wurden keine Jahresdaten übergeben.');
    }

    const tropicalNightsByYear = analyzeTropicalNights(yearlyData);

    return yearlyData
      .map((yearData) =>
        analyzeYear(
          yearData,
          config.nat_c,
          tropicalNightsByYear.get(yearData.year)
        )
      )
      .sort((a, b) => a.year - b.year);
  }

  function buildResultFromAnnualAnalyses(
    config,
    annualAnalyses,
    options = {}
  ) {
    if (!Array.isArray(annualAnalyses) || annualAnalyses.length === 0) {
      throw new Error('Es wurden keine auswertbaren Jahreskennwerte übergeben.');
    }

    const annual = [...annualAnalyses].sort(
      (a, b) => a.year - b.year
    );
    const durationCurve = aggregateCurves(annual);
    const frequencyDistribution = aggregateFrequency(annual);

    const summary = {
      average_hours_below_0: mean(annual.map((item) => item.hours_below_0)),
      average_hours_below_minus_5: mean(
        annual.map((item) => item.hours_below_minus_5)
      ),
      average_hours_below_minus_10: mean(
        annual.map((item) => item.hours_below_minus_10)
      ),
      average_hours_at_or_below_nat: mean(
        annual.map((item) => item.hours_at_or_below_nat)
      ),
      average_heating_demand_hours: mean(
        annual.map((item) => item.heating_demand_hours)
      ),
      average_full_load_hours: mean(
        annual.map((item) => item.full_load_hours)
      ),
      average_hot_days: mean(annual.map((item) => item.hot_days)),
      average_extreme_hot_days: mean(
        annual.map((item) => item.extreme_hot_days)
      ),
      average_tropical_nights: mean(
        annual.map((item) => item.tropical_nights)
      ),
      maximum_hot_days_in_year: Math.max(
        ...annual.map((item) => item.hot_days)
      ),
      maximum_tropical_nights_in_year: Math.max(
        ...annual.map((item) => item.tropical_nights)
      ),
      absolute_minimum_hourly_c: Math.min(
        ...annual.map((item) => item.minimum_hourly_c)
      ),
      absolute_minimum_24h_mean_c: Math.min(
        ...annual
          .map((item) => item.minimum_24h_mean_c)
          .filter(isFiniteNumber)
      ),
      absolute_maximum_hourly_c: Math.max(
        ...annual
          .map((item) => item.maximum_hourly_c)
          .filter(isFiniteNumber)
      ),
      warmest_night_minimum_c: Math.max(
        ...annual
          .map((item) => item.warmest_night_minimum_c)
          .filter(isFiniteNumber)
      ),
      average_annual_minimum_hourly_c: mean(
        annual.map((item) => item.minimum_hourly_c)
      ),
      average_annual_minimum_24h_mean_c: mean(
        annual.map((item) => item.minimum_24h_mean_c)
      ),
      total_missing_values: annual.reduce(
        (sum, item) => sum + item.missing_values,
        0
      ),
      total_incomplete_heat_days: annual.reduce(
        (sum, item) => sum + item.incomplete_heat_days,
        0
      ),
      total_incomplete_nights: annual.reduce(
        (sum, item) => sum + item.incomplete_nights,
        0
      ),
    };

    return {
      schema_version: Number(options.schema_version ?? 4),
      generated_at:
        options.generated_at ?? new Date().toISOString(),
      location: config,
      assumptions: {
        heating_limit_c: HEATING_LIMIT_C,
        duration_curve_hours: NORMALIZED_HOURS,
        frequency_bin_width_c: 1,
        hot_day_definition:
          'Tagesmaximum aus Stundenwerten mindestens 30 °C',
        extreme_hot_day_definition:
          'Tagesmaximum aus Stundenwerten mindestens 35 °C',
        tropical_night_definition:
          'Minimum der Stundenwerte 18–06 UTC mindestens 20 °C',
        full_load_hours_formula:
          'Σ max(0, (15 - Außentemperatur) / (15 - NAT))',
        note:
          options.note ??
          'Hitze- und Nachtkennzahlen sind aus stündlichen INCA-Rasterwerten abgeleitet.',
      },
      data: {
        source:
          options.source ??
          'GeoSphere Austria, INCA-v1-1h-1km, T2M',
        license: options.license ?? 'CC BY 4.0',
        years: annual.map((item) => item.year),
        year_count: annual.length,
        ...(options.data_extra ?? {}),
      },
      metrics: summary,
      annual_metrics: annual.map(
        ({ normalized_curve, frequency_hours, ...item }) => item
      ),
      temperature_frequency: frequencyDistribution,
      duration_curve: {
        hour_rank: Array.from(
          { length: NORMALIZED_HOURS },
          (_, index) => index + 1
        ),
        p10_c: durationCurve.p10,
        median_c: durationCurve.median,
        p90_c: durationCurve.p90,
      },
    };
  }

  function analyzeLocation(config, yearlyData) {
    return buildResultFromAnnualAnalyses(
      config,
      analyzeYearlyData(config, yearlyData)
    );
  }

  global.ClimateCore = {
    HEATING_LIMIT_C,
    NORMALIZED_HOURS,
    FREQUENCY_MIN_C,
    FREQUENCY_MAX_C,
    analyzeLocation,
    analyzeYearlyData,
    buildResultFromAnnualAnalyses,
    analyzeYear,
    interpolateSorted,
    quantile,
  };
})(window);
