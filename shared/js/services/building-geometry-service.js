'use strict';

(function initEnergyToolsBuildingGeometryService(global) {
  const QUERY_URL =
    'https://services3.arcgis.com/hG7UfxX49PQ8XkXh/' +
    'arcgis/rest/services/Gebaeude/FeatureServer/0/query';

  const BUILDING_FIELDS = [
    'OBJECTID',
    'GEMNR',
    'STAND',
    'GEB_HOEHE_MAX',
    'GEB_HOEHE_MEDIAN',
    'DOM_MAX',
    'DOM_MEDIAN',
    'UPDATETIMESTAMP',
    'Shape__Area',
    'Shape__Length',
  ].join(',');

  const DEFAULT_TIMEOUT_MS = 15000;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function coordinate(address, key) {
    return finite(address?.[key]);
  }

  function pointForAddress(address) {
    const latitude = coordinate(address, 'latitude');
    const longitude = coordinate(address, 'longitude');
    if (latitude === null || longitude === null) {
      throw new Error('Für die Gebäudezuordnung fehlen gültige Koordinaten.');
    }
    return { latitude, longitude };
  }

  function buildQueryUrl(address, radiusM = null) {
    const point = pointForAddress(address);
    const geometry = {
      x: point.longitude,
      y: point.latitude,
      spatialReference: { wkid: 4326 },
    };

    const params = new URLSearchParams({
      f: 'json',
      where: '1=1',
      geometry: JSON.stringify(geometry),
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: BUILDING_FIELDS,
      returnGeometry: 'true',
      outSR: '4326',
      returnZ: 'false',
      returnM: 'false',
    });

    if (radiusM !== null && Number(radiusM) > 0) {
      params.set('distance', String(Number(radiusM)));
      params.set('units', 'esriSRUnit_Meter');
    }

    return `${QUERY_URL}?${params.toString()}`;
  }

  async function fetchJson(url, {
    fetchImpl = global.fetch?.bind(global),
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {}) {
    if (!fetchImpl) throw new Error('Fetch ist in diesem Browser nicht verfügbar.');
    const controller = new AbortController();
    const timer = global.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`TIRIS Gebäude HTTP ${response.status}`);
      const payload = await response.json();
      if (payload?.error) throw new Error(payload.error.message || 'TIRIS meldet einen Fehler.');
      return payload;
    } finally {
      global.clearTimeout(timer);
    }
  }

  function ringPoints(feature) {
    return (feature?.geometry?.rings ?? [])
      .flat()
      .filter((point) => Array.isArray(point) && point.length >= 2)
      .map((point) => ({ longitude: finite(point[0]), latitude: finite(point[1]) }))
      .filter((point) => point.longitude !== null && point.latitude !== null);
  }

  function approximateDistanceM(feature, address) {
    const point = pointForAddress(address);
    const points = ringPoints(feature);
    if (!points.length) return Number.POSITIVE_INFINITY;

    const latScale = 111320;
    const lonScale = Math.cos((point.latitude * Math.PI) / 180) * 111320;
    let minimum = Number.POSITIVE_INFINITY;
    points.forEach((candidate) => {
      const dx = (candidate.longitude - point.longitude) * lonScale;
      const dy = (candidate.latitude - point.latitude) * latScale;
      minimum = Math.min(minimum, Math.hypot(dx, dy));
    });
    return minimum;
  }

  function prepareFeatures(features, address) {
    return (Array.isArray(features) ? features : [])
      .map((feature) => ({
        ...feature,
        _distance: approximateDistanceM(feature, address),
      }))
      .sort((a, b) => a._distance - b._distance);
  }

  async function query(address, { radiusM = null, ...options } = {}) {
    const requestUrl = buildQueryUrl(address, radiusM);
    const payload = await fetchJson(requestUrl, options);
    return {
      radiusM,
      requestUrl,
      payload,
      features: prepareFeatures(payload.features, address),
    };
  }

  async function findCandidates(address, { maxRadiusM = 30, ...options } = {}) {
    const attempts = [];
    const exact = await query(address, { radiusM: null, ...options });
    attempts.push(exact);
    if (exact.features.length) {
      return {
        mode: exact.features.length === 1 ? 'exact-single' : 'exact-multiple',
        attempts,
        features: exact.features,
        automaticallySelected: exact.features.length === 1 ? exact.features[0] : null,
      };
    }

    const near = await query(address, { radiusM: 15, ...options });
    attempts.push(near);
    if (near.features.length) {
      return {
        mode: 'near-15',
        attempts,
        features: near.features,
        automaticallySelected: null,
      };
    }

    if (Number(maxRadiusM) > 15) {
      const wider = await query(address, { radiusM: Number(maxRadiusM), ...options });
      attempts.push(wider);
      if (wider.features.length) {
        return {
          mode: 'near-maximum',
          attempts,
          features: wider.features,
          automaticallySelected: null,
        };
      }
    }

    return { mode: 'none', attempts, features: [], automaticallySelected: null };
  }

  function toProjectBuilding(feature, selectionMode = 'manual') {
    const model = global.EnergyToolsDataModel;
    if (!model || !feature) return null;
    const attrs = feature.attributes || {};
    const perimeter = finite(attrs.Shape__Length);
    const medianHeight = finite(attrs.GEB_HOEHE_MEDIAN);
    const footprintArea = finite(attrs.Shape__Area);
    const wallRaw = perimeter !== null && medianHeight !== null
      ? perimeter * medianHeight
      : null;

    const storeys = medianHeight !== null ? Math.max(1, Math.round(medianHeight / 3.2)) : null;
    const grossFloorArea = footprintArea !== null && storeys !== null
      ? Math.round((footprintArea * storeys) / 10) * 10
      : null;
    const usableFloorArea = grossFloorArea !== null
      ? Math.round((grossFloorArea * 0.75) / 5) * 5
      : null;
    const windowArea = wallRaw !== null ? Math.round((wallRaw * 0.25) / 5) * 5 : null;
    const opaqueWallArea = wallRaw !== null && windowArea !== null
      ? Math.max(0, wallRaw - windowArea)
      : null;
    const grossVolume = footprintArea !== null && medianHeight !== null
      ? Math.round((footprintArea * medianHeight) / 10) * 10
      : null;

    return {
      identity: {
        objectId: attrs.OBJECTID ?? null,
        municipalityCode: attrs.GEMNR ?? null,
        source: 'TIRIS Gebäude',
        dataDate: attrs.STAND ?? null,
        updatedAtSource: attrs.UPDATETIMESTAMP ?? null,
        selectionMode,
      },
      sourceSnapshot: {
        feature: clone(feature),
        selectionMode,
        savedAt: new Date().toISOString(),
      },
      geometry: {
        geometryWgs84: feature.geometry ? clone(feature.geometry) : null,
        footprintArea: model.field(footprintArea, {
          unit: 'm²', origin: model.ORIGIN.OFFICIAL, source: 'TIRIS Gebäude', method: 'Shape__Area',
        }),
        perimeter: model.field(perimeter, {
          unit: 'm', origin: model.ORIGIN.OFFICIAL, source: 'TIRIS Gebäude', method: 'Shape__Length',
        }),
        heightMedian: model.field(medianHeight, {
          unit: 'm', origin: model.ORIGIN.OFFICIAL, source: 'TIRIS Gebäude', method: 'GEB_HOEHE_MEDIAN',
        }),
        heightMaximum: model.field(finite(attrs.GEB_HOEHE_MAX), {
          unit: 'm', origin: model.ORIGIN.OFFICIAL, source: 'TIRIS Gebäude', method: 'GEB_HOEHE_MAX',
        }),
        storeyHeightModule: model.field(3.2, {
          unit: 'm', origin: model.ORIGIN.FALLBACK, source: 'Gemeinsame Gebäudegeometrie',
          method: 'sichtbare Standardannahme',
        }),
        usableFloorAreaFactor: model.field(75, {
          unit: '%', origin: model.ORIGIN.FALLBACK, source: 'Gemeinsame Gebäudegeometrie',
          method: 'sichtbare Standardannahme',
        }),
        windowSharePercent: model.field(25, {
          unit: '%', origin: model.ORIGIN.FALLBACK, source: 'Gemeinsame Gebäudegeometrie',
          method: 'sichtbare Standardannahme',
        }),
        storeysAboveGround: model.field(storeys, {
          unit: 'Geschoße', origin: model.ORIGIN.DERIVED, source: 'Gemeinsame Gebäudegeometrie',
          method: 'Medianhöhe / 3,2 m, ganzzahlig gerundet', quality: 'Orientierungswert',
        }),
        grossFloorArea: model.field(grossFloorArea, {
          unit: 'm²', origin: model.ORIGIN.DERIVED, source: 'Gemeinsame Gebäudegeometrie',
          method: 'Dachprojektion × Geschoße', quality: 'Orientierungswert',
        }),
        usableFloorArea: model.field(usableFloorArea, {
          unit: 'm²', origin: model.ORIGIN.DERIVED, source: 'Gemeinsame Gebäudegeometrie',
          method: 'BGF × 0,75', quality: 'Orientierungswert',
        }),
        heatedFloorArea: model.field(usableFloorArea, {
          unit: 'm²', origin: model.ORIGIN.DERIVED, source: 'Gemeinsame Gebäudegeometrie',
          method: 'NFL als erste beheizte Flächenannahme', quality: 'Orientierungswert',
        }),
        exteriorWallGrossArea: model.field(wallRaw, {
          unit: 'm²', origin: model.ORIGIN.DERIVED, source: 'Gemeinsame Gebäudegeometrie',
          method: 'Gebäudeumfang × Medianhöhe', quality: 'Orientierungswert',
        }),
        windowArea: model.field(windowArea, {
          unit: 'm²', origin: model.ORIGIN.DERIVED, source: 'Gemeinsame Gebäudegeometrie',
          method: 'Außenwand brutto × 25 %', quality: 'Orientierungswert',
        }),
        opaqueExteriorWallArea: model.field(opaqueWallArea, {
          unit: 'm²', origin: model.ORIGIN.DERIVED, source: 'Gemeinsame Gebäudegeometrie',
          method: 'Außenwand brutto − Fenster', quality: 'Orientierungswert',
        }),
        topFloorArea: model.field(footprintArea, {
          unit: 'm²', origin: model.ORIGIN.DERIVED, source: 'Gemeinsame Gebäudegeometrie',
          method: 'Dachprojektion', quality: 'Orientierungswert',
        }),
        basementCeilingArea: model.field(footprintArea, {
          unit: 'm²', origin: model.ORIGIN.DERIVED, source: 'Gemeinsame Gebäudegeometrie',
          method: 'Dachprojektion', quality: 'Orientierungswert',
        }),
        groundFloorArea: model.field(footprintArea, {
          unit: 'm²', origin: model.ORIGIN.DERIVED, source: 'Gemeinsame Gebäudegeometrie',
          method: 'Dachprojektion', quality: 'Orientierungswert',
        }),
        roofSlopeArea: model.field(footprintArea, {
          unit: 'm²', origin: model.ORIGIN.FALLBACK, source: 'Gemeinsame Gebäudegeometrie',
          method: 'Dachprojektion ohne bekannte Dachneigung', quality: 'Fallback',
        }),
        grossVolume: model.field(grossVolume, {
          unit: 'm³', origin: model.ORIGIN.DERIVED, source: 'Gemeinsame Gebäudegeometrie',
          method: 'Dachprojektion × Medianhöhe', quality: 'Orientierungswert',
        }),
      },
    };
  }

  function candidateSummary(feature, index = 0) {
    const attrs = feature?.attributes ?? {};
    return {
      id: attrs.OBJECTID ?? `candidate-${index + 1}`,
      label: `Gebäude ${index + 1}${attrs.OBJECTID ? ` · ID ${attrs.OBJECTID}` : ''}`,
      areaM2: finite(attrs.Shape__Area),
      medianHeightM: finite(attrs.GEB_HOEHE_MEDIAN),
      maximumHeightM: finite(attrs.GEB_HOEHE_MAX),
      distanceM: finite(feature?._distance),
    };
  }

  global.EnergyToolsBuildingGeometryService = Object.freeze({
    QUERY_URL,
    BUILDING_FIELDS,
    buildQueryUrl,
    query,
    findCandidates,
    prepareFeatures,
    approximateDistanceM,
    toProjectBuilding,
    candidateSummary,
  });
})(window);
