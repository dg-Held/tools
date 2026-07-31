'use strict';

(function initLocationCore(global) {
  const TIRIS_TERRAIN_IDENTIFY_URL =
    'https://gis.tirol.gv.at/arcgis/rest/services/' +
    'Service_Public/terrain/MapServer/identify';

  const DEFAULT_TIMEOUT_MS = 18000;

  function finiteNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value !== 'string') return null;

    const normalized = value
      .trim()
      .replace(',', '.')
      .replace(/[^\d+\-.eE]/g, '');

    if (!normalized) return null;

    const number = Number(normalized);

    if (!Number.isFinite(number)) return null;
    if (number <= -9990 || number >= 99999) return null;

    return number;
  }

  function buildIdentifyUrl(latitude, longitude, layerId = 4) {
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error('Für die Höhenabfrage fehlen gültige Koordinaten.');
    }

    const delta = 0.01;
    const geometry = {
      x: lon,
      y: lat,
      spatialReference: { wkid: 4326 },
    };

    const parameters = new URLSearchParams({
      f: 'json',
      geometry: JSON.stringify(geometry),
      geometryType: 'esriGeometryPoint',
      sr: '4326',
      layers: `all:${layerId}`,
      tolerance: '2',
      mapExtent:
        `${lon - delta},${lat - delta},` +
        `${lon + delta},${lat + delta}`,
      imageDisplay: '800,600,96',
      returnGeometry: 'false',
      returnUnformattedValues: 'true',
      returnFieldName: 'true',
    });

    return `${TIRIS_TERRAIN_IDENTIFY_URL}?${parameters.toString()}`;
  }

  function collectCandidateValues(result) {
    const candidates = [];

    if (!result || typeof result !== 'object') return candidates;

    candidates.push(result.value);

    const attributes = result.attributes ?? {};

    const preferredNames = [
      'Pixel Value',
      'PixelValue',
      'Stretched value',
      'Stretched Value',
      'Value',
      'VALUE',
      'Raster.Value',
      'Band_1',
      'Elevation',
      'Hoehe',
      'Höhe',
    ];

    preferredNames.forEach((name) => {
      if (Object.prototype.hasOwnProperty.call(attributes, name)) {
        candidates.push(attributes[name]);
      }
    });

    Object.entries(attributes).forEach(([name, value]) => {
      if (
        /pixel|value|elev|höhe|hoehe|band/i.test(name)
      ) {
        candidates.push(value);
      }
    });

    return candidates;
  }

  function parseElevationPayload(payload) {
    if (payload?.error) {
      throw new Error(
        payload.error.message ??
        'Der TIRIS-Dienst meldet einen Fehler.'
      );
    }

    const results = Array.isArray(payload?.results)
      ? payload.results
      : [];

    for (const result of results) {
      for (const candidate of collectCandidateValues(result)) {
        const number = finiteNumber(candidate);

        if (number !== null && number > 0 && number < 5000) {
          return {
            elevation_m: number,
            layer_id: result.layerId ?? null,
            layer_name: result.layerName ?? null,
            raw_value: candidate,
          };
        }
      }
    }

    throw new Error(
      'Der TIRIS-Dienst hat für diesen Punkt keinen auswertbaren Höhenwert geliefert.'
    );
  }

  async function fetchJsonWithTimeout(
    url,
    {
      fetchImpl = global.fetch.bind(global),
      timeoutMs = DEFAULT_TIMEOUT_MS,
    } = {}
  ) {
    const controller = new AbortController();
    const timeout = global.setTimeout(
      () => controller.abort(),
      timeoutMs
    );

    try {
      const response = await fetchImpl(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`TIRIS HTTP ${response.status}`);
      }

      return await response.json();
    } finally {
      global.clearTimeout(timeout);
    }
  }

  async function fetchElevation(
    latitude,
    longitude,
    options = {}
  ) {
    /*
      Zuerst wird die eigentliche 5-m-DGM-Rasterebene 4 abgefragt.
      Manche ArcGIS-Konfigurationen liefern den Pixelwert verlässlicher
      über die übergeordnete Mosaic-Layer 1; sie dient als Rückfallebene.
    */
    const layerIds = [4, 1];
    let lastError = null;

    for (const layerId of layerIds) {
      try {
        const url = buildIdentifyUrl(
          latitude,
          longitude,
          layerId
        );
        const payload = await fetchJsonWithTimeout(url, options);
        const parsed = parseElevationPayload(payload);

        return {
          ...parsed,
          latitude: Number(latitude),
          longitude: Number(longitude),
          request_layer_id: layerId,
          source:
            'TIRIS Gelände Tirol · DGM 5 m · ArcGIS REST Identify',
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error(
      'Die TIRIS-Höhenabfrage ist fehlgeschlagen.'
    );
  }

  function classifyDifference(differenceM) {
    if (!Number.isFinite(differenceM)) {
      return {
        level: 'unknown',
        label: 'Höhenvergleich nicht verfügbar',
        text:
          'Die Höhen konnten nicht vollständig geladen werden.',
      };
    }

    const absolute = Math.abs(differenceM);

    if (absolute < 50) {
      return {
        level: 'good',
        label: 'Gute Höhenübereinstimmung',
        text:
          'Gebäudestandort und Klimaraster liegen höhenmäßig nahe beieinander.',
      };
    }

    if (absolute <= 150) {
      return {
        level: 'notice',
        label: 'Höhenunterschied beachten',
        text:
          'Örtliche Temperaturabweichungen vom 1-km-Klimaraster sind möglich.',
      };
    }

    return {
      level: 'warning',
      label: 'Deutlicher Höhenunterschied',
      text:
        'Der Gebäudestandort und das verwendete Klimaraster unterscheiden sich deutlich in der Höhe. Lokale Temperaturabweichungen sind wahrscheinlich.',
    };
  }

  async function enrichLocation(
    location,
    options = {}
  ) {
    const buildingPromise = fetchElevation(
      location.latitude,
      location.longitude,
      options
    );

    const gridPromise =
      Number.isFinite(location.grid_latitude) &&
      Number.isFinite(location.grid_longitude)
        ? fetchElevation(
            location.grid_latitude,
            location.grid_longitude,
            options
          )
        : Promise.reject(
            new Error('INCA-Rasterkoordinaten fehlen.')
          );

    const [buildingResult, gridResult] =
      await Promise.allSettled([
        buildingPromise,
        gridPromise,
      ]);

    const building =
      buildingResult.status === 'fulfilled'
        ? buildingResult.value
        : null;

    const grid =
      gridResult.status === 'fulfilled'
        ? gridResult.value
        : null;

    const buildingElevation = building?.elevation_m ?? null;
    const gridElevation = grid?.elevation_m ?? null;

    const buildingGridDifference =
      Number.isFinite(buildingElevation) &&
      Number.isFinite(gridElevation)
        ? buildingElevation - gridElevation
        : null;

    const buildingNatReferenceDifference =
      Number.isFinite(buildingElevation) &&
      Number.isFinite(location.nat_reference_height_m)
        ? buildingElevation -
          location.nat_reference_height_m
        : null;

    return {
      schema_version: 1,
      queried_at: new Date().toISOString(),
      building,
      inca_grid: grid,
      difference_building_grid_m:
        buildingGridDifference,
      difference_building_nat_reference_m:
        buildingNatReferenceDifference,
      height_assessment:
        classifyDifference(buildingGridDifference),
      automatic_temperature_correction: false,
      note:
        'Die Höhenunterschiede werden transparent ausgewiesen. Es wird keine automatische Temperatur- oder NAT-Korrektur angewendet.',
      errors: {
        building:
          buildingResult.status === 'rejected'
            ? buildingResult.reason?.message ??
              String(buildingResult.reason)
            : null,
        inca_grid:
          gridResult.status === 'rejected'
            ? gridResult.reason?.message ??
              String(gridResult.reason)
            : null,
      },
    };
  }

  global.LocationCore = {
    TIRIS_TERRAIN_IDENTIFY_URL,
    buildIdentifyUrl,
    parseElevationPayload,
    fetchElevation,
    enrichLocation,
    classifyDifference,
  };
})(window);
