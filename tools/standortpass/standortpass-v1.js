'use strict';

(function initStandortpassV1() {
  const store = window.EnergyToolsProjectStore;
  const model = window.EnergyToolsDataModel;
  const core = window.StandortpassCore;
  const valueResolver = window.EnergyToolsValueResolver;
  if (!store || !model || !core || !valueResolver) return;

  const $ = (id) => document.getElementById(id);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const STOREY_HEIGHT_MODULE_M = 3.2;
  const USABLE_TO_GROSS_FACTOR = 0.75;
  const DEFAULT_WINDOW_SHARE_PERCENT = 25;
  const DEFAULT_HEATED_SHARE_PERCENT = 100;

  let lastUiSignature = '';
  let reportRunning = false;
  let reportHasRun = false;
  let hydrationRunning = false;

  const reportSteps = [
    { key: 'building', label: 'Gebäude zuordnen', run: () => core.loadBuildings(), statusId: 'buildingStatus', retryId: 'buildingManualAction' },
    { key: 'terrain', label: 'Höhenlage prüfen', run: () => core.loadTerrain(), statusId: 'terrainStatus', retryId: 'terrainManualAction' },
    { key: 'solar', label: 'Sonnenbahn & Verschattung laden', run: () => core.loadSolar(), statusId: 'solarStatus', retryId: 'loadSolarButton', retryButton: true },
    { key: 'solarMap', label: 'Solarstrahlung im Umfeld laden', run: () => core.testSolarMap(), statusId: 'solarMapStatus', retryId: 'solarMapManualAction' },
    { key: 'environmentalHeat', label: 'Umweltwärme prüfen', run: () => core.testEnvironmentalHeat(), statusId: 'environmentalHeatStatus', retryId: 'environmentalHeatManualAction' },
    { key: 'hazards', label: 'Hochwasser & Naturgefahren prüfen', run: () => core.testHazards(), statusId: 'hazardStatus', retryId: 'hazardManualAction' },
    { key: 'heritage', label: 'Kultur & Schutzstatus prüfen', run: () => core.testHeritage(), statusId: 'heritageStatus', retryId: 'heritageManualAction' },
    { key: 'radon', label: 'Radonstatus prüfen', run: () => Promise.resolve(core.testRadon()), statusId: 'radonStatus', retryId: 'radonManualAction' },
  ];

  function text(id) {
    return $(id)?.textContent?.trim() || '';
  }

  function statusText(id) {
    return text(id).toLowerCase();
  }

  function field(value, options = {}) {
    return model.field(value ?? null, options);
  }

  function safeJson(id) {
    const raw = $(id)?.textContent?.trim();
    if (!raw || raw === '–') return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function compactAddressRecord(record) {
    if (!record) return null;
    const keys = [
      'label', 'postal_code', 'municipality', 'municipality_code', 'locality', 'street', 'house_number',
      'latitude', 'longitude', 'coordinate_kind', 'dataset_date', 'updated_at', 'address_code', 'subcode',
      'object_number', 'property', 'cadastral_municipality_number', 'cadastral_municipality_numbers',
      'source', 'fallback_source', 'source_id', 'tiris_layer_id', 'tiris_layer_label', 'license',
    ];
    const out = {};
    keys.forEach((key) => {
      if (record[key] !== undefined && record[key] !== null) out[key] = clone(record[key]);
    });
    return out;
  }

  function selectedBuildingShared(feature, selectionMode = core.getSelectedBuildingSelectionMode?.() || 'manual') {
    if (!feature) return null;
    const geometryService = window.EnergyToolsBuildingGeometryService;
    if (geometryService?.toProjectBuilding) {
      return geometryService.toProjectBuilding(feature, selectionMode);
    }
    const attrs = feature.attributes || {};
    const perimeter = Number(attrs.Shape__Length);
    const medianHeight = Number(attrs.GEB_HOEHE_MEDIAN);
    const footprintArea = Number(attrs.Shape__Area);
    const wallRaw = Number.isFinite(perimeter) && Number.isFinite(medianHeight)
      ? perimeter * medianHeight
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
        footprintArea: field(Number.isFinite(footprintArea) ? footprintArea : null, {
          unit: 'm²', origin: model.ORIGIN.OFFICIAL, source: 'TIRIS Gebäude', method: 'Shape__Area',
        }),
        perimeter: field(Number.isFinite(perimeter) ? perimeter : null, {
          unit: 'm', origin: model.ORIGIN.OFFICIAL, source: 'TIRIS Gebäude', method: 'Shape__Length',
        }),
        heightMedian: field(Number.isFinite(medianHeight) ? medianHeight : null, {
          unit: 'm', origin: model.ORIGIN.OFFICIAL, source: 'TIRIS Gebäude', method: 'GEB_HOEHE_MEDIAN',
        }),
        heightMaximum: field(Number.isFinite(Number(attrs.GEB_HOEHE_MAX)) ? Number(attrs.GEB_HOEHE_MAX) : null, {
          unit: 'm', origin: model.ORIGIN.OFFICIAL, source: 'TIRIS Gebäude', method: 'GEB_HOEHE_MAX',
        }),
        exteriorWallGrossArea: field(wallRaw, {
          unit: 'm²', origin: model.ORIGIN.DERIVED, source: 'Standortpass',
          method: 'TIRIS-Umfang × Medianhöhe; bei geänderter Grundfläche geometrisch skaliert', quality: 'Orientierungswert',
        }),
      },
    };
  }

  function preserveManualFields(next, previous) {
    if (Array.isArray(next)) return clone(next);
    if (!next || typeof next !== 'object') return clone(next);
    const output = clone(next);
    Object.entries(previous ?? {}).forEach(([key, oldValue]) => {
      if (valueResolver.isField(oldValue)) {
        const manual = oldValue.candidates?.[model.ORIGIN.MANUAL];
        if (!manual) return;
        const base = valueResolver.isField(output[key])
          ? output[key]
          : model.field(null, { unit: oldValue.unit ?? null });
        base.candidates = { ...(base.candidates ?? {}), [model.ORIGIN.MANUAL]: clone(manual) };
        output[key] = model.finalizeField(base);
      } else if (oldValue && typeof oldValue === 'object' && !Array.isArray(oldValue)) {
        output[key] = preserveManualFields(output[key] ?? {}, oldValue);
      }
    });
    return output;
  }

  function mergeSelectedBuilding(feature, selectionMode) {
    const previous = store.get().building || {};
    const selected = selectedBuildingShared(feature, selectionMode) || { identity: {}, geometry: {} };
    const merged = preserveManualFields(selected, previous);
    // Die thermische Bestandsbeschreibung gehört nicht der Gebäudezuordnung.
    // Sie bleibt deshalb bei einer anderen TIRIS-Auswahl vollständig erhalten.
    merged.thermal = clone(previous.thermal || merged.thermal || { envelope: {} });
    return merged;
  }

  function clearSelectedBuildingPreservingProjectValues() {
    const previous = store.get().building || {};
    const cleared = preserveManualFields({ identity: {}, geometry: {} }, previous);
    cleared.thermal = clone(previous.thermal || { envelope: {} });
    return cleared;
  }

  function compactSolarShared() {
    const raw = safeJson('rawSolar');
    const response = raw?.response;
    if (!response) return null;
    const monthly = response['sonnenstunden pro tag im monatsmittel'] || {};
    return {
      observerHeightM: Number(raw?.observer?.height) || null,
      observerMode: raw?.observer?.mode || raw?.observer?.source || null,
      dataBasis: response.datengrundlage ?? null,
      flightYear: response.flugjahr ?? null,
      serviceVersion: response.voibos ?? null,
      horizonCount: Array.isArray(response.horizont) ? response.horizont.length : null,
      monthlySunHours: {
        january: monthly.januar ?? null,
        march: monthly.maerz ?? null,
        june: monthly.juni ?? null,
        september: monthly.september ?? null,
        december: monthly.dezember ?? null,
      },
    };
  }


  const number0 = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 0 });

  function finiteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function roundToStep(value, step) {
    return Math.round(value / step) * step;
  }

  function parseInputValue(id) {
    const el = $(id);
    if (!el) return null;
    const raw = String(el.value ?? '').replace(',', '.').trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function setInputValue(id, value) {
    const el = $(id);
    if (!el) return;
    el.value = value === null || value === undefined || value === '' ? '' : String(value);
  }

  function formatArea(value) {
    return value === null ? '–' : `${number0.format(value)} m²`;
  }

  function formatVolume(value) {
    return value === null ? '–' : `${number0.format(value)} m³`;
  }

  function formatPitch(value) {
    return value === null ? '–' : `${number0.format(value)}°`;
  }

  function formatCount(value) {
    return value === null ? '–' : `${Math.round(value)}`;
  }

  function estimateFieldConfig() {
    return [
      { key: 'storeys', autoId: 'autoStoreysValue', manualId: 'manualStoreysValue', effectiveId: 'effectiveStoreysValue', unit: 'Geschoße', format: formatCount },
      { key: 'grossFloorArea', autoId: 'autoGrossFloorAreaValue', manualId: 'manualGrossFloorAreaValue', effectiveId: 'effectiveGrossFloorAreaValue', unit: 'm²', format: formatArea },
      { key: 'usableFloorArea', autoId: 'autoUsableFloorAreaValue', manualId: 'manualUsableFloorAreaValue', effectiveId: 'effectiveUsableFloorAreaValue', unit: 'm²', format: formatArea },
      { key: 'heatedFloorArea', autoId: 'autoHeatedFloorAreaValue', manualId: 'manualHeatedFloorAreaValue', effectiveId: 'effectiveHeatedFloorAreaValue', unit: 'm²', format: formatArea },
      { key: 'exteriorWall', autoId: 'autoExteriorWallValue', manualId: 'manualExteriorWallValue', effectiveId: 'effectiveExteriorWallValue', unit: 'm²', format: formatArea },
      { key: 'windowArea', autoId: 'autoWindowAreaValue', manualId: 'manualWindowAreaValue', effectiveId: 'effectiveWindowAreaValue', unit: 'm²', format: formatArea },
      { key: 'topFloorArea', autoId: 'autoTopFloorAreaValue', manualId: 'manualTopFloorAreaValue', effectiveId: 'effectiveTopFloorAreaValue', unit: 'm²', format: formatArea },
      { key: 'basementArea', autoId: 'autoBasementAreaValue', manualId: 'manualBasementAreaValue', effectiveId: 'effectiveBasementAreaValue', unit: 'm²', format: formatArea },
      { key: 'roofPitch', autoId: 'autoRoofPitchValue', manualId: 'manualRoofPitchValue', effectiveId: 'effectiveRoofPitchValue', unit: '°', format: formatPitch },
      { key: 'roofSlopeArea', autoId: 'autoRoofSlopeAreaValue', manualId: 'manualRoofSlopeAreaValue', effectiveId: 'effectiveRoofSlopeAreaValue', unit: 'm²', format: formatArea },
      { key: 'volume', autoId: 'autoVolumeValue', manualId: 'manualVolumeValue', effectiveId: 'effectiveVolumeValue', unit: 'm³', format: formatVolume },
    ];
  }

  function currentGeometryEstimates() {
    const feature = core.getSelectedBuilding();
    const attrs = feature?.attributes || {};
    const roofArea = finiteNumber(attrs.Shape__Area);
    const perimeter = finiteNumber(attrs.Shape__Length);
    const medianHeight = finiteNumber(attrs.GEB_HOEHE_MEDIAN);
    const windowShare = Math.max(10, Math.min(50, parseInputValue('windowSharePercent') ?? DEFAULT_WINDOW_SHARE_PERCENT));
    const heatedShare = Math.max(0, Math.min(100, parseInputValue('heatedSharePercent') ?? DEFAULT_HEATED_SHARE_PERCENT));

    const manuals = {};
    estimateFieldConfig().forEach((config) => {
      let manual = parseInputValue(config.manualId);
      if (config.key === 'storeys' && manual !== null) {
        manual = Math.max(1, Math.round(manual));
        setInputValue(config.manualId, manual);
      }
      if (config.key === 'heatedFloorArea') manual = null;
      if (config.key !== 'roofPitch' && manual !== null && manual <= 0) manual = null;
      manuals[config.key] = manual;
    });

    const automaticStoreys = medianHeight !== null
      ? Math.max(1, Math.round(medianHeight / STOREY_HEIGHT_MODULE_M))
      : null;
    const automaticGrossFloorArea = roofArea !== null && automaticStoreys !== null
      ? roundToStep(roofArea * automaticStoreys, 10)
      : null;
    const automaticUsableFloorArea = automaticGrossFloorArea !== null
      ? roundToStep(automaticGrossFloorArea * USABLE_TO_GROSS_FACTOR, 5)
      : null;
    const automaticHeatedFloorArea = automaticUsableFloorArea !== null
      ? roundToStep(automaticUsableFloorArea * heatedShare / 100, 5)
      : null;
    const automaticExteriorWall = perimeter !== null && medianHeight !== null
      ? roundToStep(perimeter * medianHeight, 10)
      : null;
    const automaticWindowArea = automaticExteriorWall !== null
      ? roundToStep(automaticExteriorWall * windowShare / 100, 5)
      : null;
    const automaticTopFloor = roofArea !== null ? roundToStep(roofArea, 10) : null;
    const automaticBasement = automaticTopFloor;
    const automaticRoofPitch = 0;
    const automaticRoofSlopeArea = automaticTopFloor;
    const automaticVolume = roofArea !== null && medianHeight !== null
      ? roundToStep(roofArea * medianHeight, 10)
      : null;

    const effectiveStoreys = manuals.storeys ?? automaticStoreys;
    const grossFromStoreys = roofArea !== null && effectiveStoreys !== null
      ? roundToStep(roofArea * effectiveStoreys, 10)
      : null;
    const grossFromUsable = manuals.usableFloorArea !== null
      ? roundToStep(manuals.usableFloorArea / USABLE_TO_GROSS_FACTOR, 10)
      : null;
    const derivedGrossFloorArea = grossFromUsable ?? grossFromStoreys;
    const effectiveGrossFloorArea = manuals.grossFloorArea ?? derivedGrossFloorArea;

    const derivedUsableFloorArea = effectiveGrossFloorArea !== null
      ? roundToStep(effectiveGrossFloorArea * USABLE_TO_GROSS_FACTOR, 5)
      : null;
    const effectiveUsableFloorArea = manuals.usableFloorArea ?? derivedUsableFloorArea;
    const derivedHeatedFloorArea = effectiveUsableFloorArea !== null
      ? roundToStep(effectiveUsableFloorArea * heatedShare / 100, 5)
      : null;
    const effectiveHeatedFloorArea = derivedHeatedFloorArea;

    const effectiveFootprint = effectiveGrossFloorArea !== null && effectiveStoreys !== null && effectiveStoreys > 0
      ? effectiveGrossFloorArea / effectiveStoreys
      : roofArea;
    const footprintScale = roofArea !== null && roofArea > 0 && effectiveFootprint !== null && effectiveFootprint > 0
      ? Math.sqrt(effectiveFootprint / roofArea)
      : 1;
    const derivedExteriorWall = perimeter !== null && medianHeight !== null
      ? roundToStep(perimeter * footprintScale * medianHeight, 10)
      : null;
    const effectiveExteriorWall = manuals.exteriorWall ?? derivedExteriorWall;
    const derivedWindowArea = effectiveExteriorWall !== null
      ? roundToStep(effectiveExteriorWall * windowShare / 100, 5)
      : null;
    const effectiveWindowArea = manuals.windowArea ?? derivedWindowArea;

    const derivedTopFloor = effectiveFootprint !== null ? roundToStep(effectiveFootprint, 10) : null;
    const derivedBasement = derivedTopFloor;
    const effectiveTopFloor = manuals.topFloorArea ?? derivedTopFloor;
    const effectiveBasement = manuals.basementArea ?? derivedBasement;
    const effectiveRoofPitch = manuals.roofPitch ?? 0;
    // Die Dachfläche bleibt an das amtliche TIRIS-Dachpolygon gebunden.
    // Änderungen an NFL, BGF oder Geschoßzahl führen nur die Geschoßflächen nach.
    const roofProjectionForSlope = roofArea;
    const derivedRoofSlopeArea = roofProjectionForSlope !== null && effectiveRoofPitch >= 0 && effectiveRoofPitch < 89
      ? roundToStep(roofProjectionForSlope / Math.cos((effectiveRoofPitch * Math.PI) / 180), 10)
      : null;
    const effectiveRoofSlopeArea = manuals.roofSlopeArea ?? derivedRoofSlopeArea;
    const derivedVolume = effectiveFootprint !== null && medianHeight !== null
      ? roundToStep(effectiveFootprint * medianHeight, 10)
      : null;
    const effectiveVolume = manuals.volume ?? derivedVolume;

    const ratioConflict = manuals.grossFloorArea !== null && manuals.usableFloorArea !== null
      ? Math.abs((manuals.usableFloorArea / manuals.grossFloorArea) - USABLE_TO_GROSS_FACTOR) > 0.08
      : false;

    const definitions = {
      storeys: { automatic: automaticStoreys, derived: automaticStoreys, effective: effectiveStoreys },
      grossFloorArea: { automatic: automaticGrossFloorArea, derived: derivedGrossFloorArea, effective: effectiveGrossFloorArea },
      usableFloorArea: { automatic: automaticUsableFloorArea, derived: derivedUsableFloorArea, effective: effectiveUsableFloorArea },
      heatedFloorArea: { automatic: automaticHeatedFloorArea, derived: derivedHeatedFloorArea, effective: effectiveHeatedFloorArea },
      exteriorWall: { automatic: automaticExteriorWall, derived: derivedExteriorWall, effective: effectiveExteriorWall },
      windowArea: { automatic: automaticWindowArea, derived: derivedWindowArea, effective: effectiveWindowArea },
      topFloorArea: { automatic: automaticTopFloor, derived: derivedTopFloor, effective: effectiveTopFloor },
      basementArea: { automatic: automaticBasement, derived: derivedBasement, effective: effectiveBasement },
      roofPitch: { automatic: automaticRoofPitch, derived: effectiveRoofPitch, effective: effectiveRoofPitch },
      roofSlopeArea: { automatic: automaticRoofSlopeArea, derived: derivedRoofSlopeArea, effective: effectiveRoofSlopeArea },
      volume: { automatic: automaticVolume, derived: derivedVolume, effective: effectiveVolume },
    };

    const result = {
      storeyHeightModule: STOREY_HEIGHT_MODULE_M,
      usableFloorAreaFactor: USABLE_TO_GROSS_FACTOR * 100,
      windowSharePercent: windowShare,
      heatedSharePercent: heatedShare,
      heatedFloorAreaWasLimited: false,
      ratioConflict,
      fields: {},
    };

    estimateFieldConfig().forEach((config) => {
      const definition = definitions[config.key] ?? { automatic: null, derived: null, effective: null };
      const manual = manuals[config.key];
      let source = manual !== null ? 'manual' : 'automatic';
      if (config.key === 'grossFloorArea' && manual === null && manuals.usableFloorArea !== null) source = 'derived-manual-basis';
      if (config.key === 'heatedFloorArea') source = heatedShare === DEFAULT_HEATED_SHARE_PERCENT ? 'automatic' : 'derived-manual-basis';
      if (['exteriorWall', 'windowArea', 'topFloorArea', 'basementArea', 'volume'].includes(config.key)
          && manual === null && (manuals.usableFloorArea !== null || manuals.grossFloorArea !== null || manuals.storeys !== null)) {
        source = 'derived-manual-basis';
      }
      if (config.key === 'roofSlopeArea' && manual === null && manuals.roofPitch !== null) {
        source = 'derived-manual-basis';
      }
      result.fields[config.key] = {
        automatic: definition.automatic,
        derived: definition.derived,
        manual,
        effective: definition.effective,
        unit: config.unit,
        source,
      };
    });
    return result;
  }

  function renderGeometryEstimates() {
    const data = currentGeometryEstimates();
    estimateFieldConfig().forEach((config) => {
      const item = data.fields[config.key];
      if ($(config.autoId)) $(config.autoId).textContent = config.format(item.automatic);
      const effective = $(config.effectiveId);
      if (effective) {
        effective.textContent = config.format(item.effective);
        effective.classList.remove('estimate-used', 'is-manual', 'is-auto');
        if (item.effective !== null) effective.classList.add('estimate-used', item.source.includes('manual') ? 'is-manual' : 'is-auto');
      }
    });
    if ($('heatedShareOutput')) $('heatedShareOutput').textContent = `${number0.format(data.heatedSharePercent)} %`;
    if ($('windowShareOutput')) $('windowShareOutput').textContent = `${number0.format(data.windowSharePercent)} %`;
    const constraintNote = $('heatedFloorAreaConstraintNote');
    if (constraintNote) {
      constraintNote.hidden = true;
      constraintNote.textContent = '';
    }
    const consistencyNote = $('geometryConsistencyNote');
    if (consistencyNote) {
      consistencyNote.hidden = !data.ratioConflict;
      consistencyNote.textContent = data.ratioConflict
        ? 'BGF und NFL wurden beide manuell eingetragen und weichen deutlich vom 0,75-Faktor ab. Das ist zulässig; bitte prüfen, ob beide Flächen nach derselben Definition ermittelt wurden.'
        : '';
    }

    const quickSummary = $('geometryQuickSummary');
    if (quickSummary) {
      const storeys = data.fields.storeys?.effective;
      const usable = data.fields.usableFloorArea?.effective;
      const complete = storeys !== null && usable !== null;
      const plausible = complete && !data.ratioConflict;
      quickSummary.classList.toggle('is-complete', plausible);
      quickSummary.classList.toggle('is-warning', complete && !plausible);
      if (!complete) {
        quickSummary.textContent = 'Gebäudegeometrie noch nicht verfügbar.';
      } else {
        const roundedStoreys = Math.round(storeys);
        const storeyText = `${number0.format(roundedStoreys)} ${roundedStoreys === 1 ? 'Geschoß' : 'Geschoße'}`;
        const usableText = `${number0.format(usable)} m² NFL`;
        const heatedText = `${number0.format(data.heatedSharePercent)} % beheizt`;
        const statusText = plausible ? 'Geometrie plausibel' : 'BGF/NFL prüfen';
        quickSummary.textContent = `${storeyText} · ${usableText} · ${heatedText} · ${statusText}`;
      }
    }
  }

  function geometryEstimatesShared() {
    const data = currentGeometryEstimates();
    const fieldMap = {
      storeys: ['storeysAboveGround', 'Geschoße', 'TIRIS-Medianhöhe / 3,2 m, ganzzahlig gerundet'],
      grossFloorArea: ['grossFloorArea', 'm²', 'Dachprojektion × Geschoße; bei manueller NFL ersatzweise NFL / 0,75'],
      usableFloorArea: ['usableFloorArea', 'm²', 'verwendete BGF × 0,75 oder manuelle Nutzfläche'],
      heatedFloorArea: ['heatedFloorArea', 'm²', 'verwendete Nutzfläche × beheizter Anteil'],
      exteriorWall: ['exteriorWallGrossArea', 'm²', 'TIRIS-Umfang × Medianhöhe; bei geänderter Grundfläche geometrisch skaliert'],
      windowArea: ['windowArea', 'm²', 'Außenwandfläche × Fensteranteil'],
      topFloorArea: ['topFloorArea', 'm²', 'verwendete BGF / Geschoße'],
      basementArea: ['basementCeilingArea', 'm²', 'verwendete BGF / Geschoße'],
      roofPitch: ['roofPitch', '°', 'Standard 0° oder manuelle Eingabe'],
      roofSlopeArea: ['roofSlopeArea', 'm²', 'TIRIS-Dachprojektion / cos(Dachneigung)'],
      volume: ['grossVolume', 'm³', 'verwendete Grundfläche × Medianhöhe; äußeres geometrisches Bruttovolumen'],
    };

    const geometry = {
      storeyHeightModule: field(STOREY_HEIGHT_MODULE_M, {
        unit: 'm', origin: model.ORIGIN.FALLBACK, source: 'Standortpass feste Erstannahme',
        method: 'OIB-Referenz 3,0 m plus Zuschlag für äußere Gebäude-/Dachhöhe',
      }),
      usableFloorAreaFactor: field(USABLE_TO_GROSS_FACTOR * 100, {
        unit: '%', origin: model.ORIGIN.FALLBACK, source: 'Standortpass feste Erstannahme',
        method: 'vereinfachter Beratungsfaktor; kein allgemeiner Normwert',
      }),
      windowSharePercent: field(DEFAULT_WINDOW_SHARE_PERCENT, {
        unit: '%', origin: model.ORIGIN.FALLBACK, source: 'Standortpass Standardannahme',
        manualValue: Math.abs(data.windowSharePercent - DEFAULT_WINDOW_SHARE_PERCENT) > 0.001 ? data.windowSharePercent : null,
        manualSource: 'Nutzereingabe Standortpass',
      }),
      heatedSharePercent: field(DEFAULT_HEATED_SHARE_PERCENT, {
        unit: '%', origin: model.ORIGIN.FALLBACK, source: 'Standortpass Standardannahme',
        manualValue: Math.abs(data.heatedSharePercent - DEFAULT_HEATED_SHARE_PERCENT) > 0.001 ? data.heatedSharePercent : null,
        manualSource: 'Nutzereingabe Standortpass',
      }),
    };

    geometry.reference = {};
    Object.entries(data.fields).forEach(([key, item]) => {
      const [targetKey, unit, method] = fieldMap[key];
      geometry[targetKey] = field(item.derived, {
        unit,
        origin: model.ORIGIN.DERIVED,
        source: 'Standortpass',
        method,
        quality: 'Orientierungswert',
        manualValue: item.manual,
        manualSource: 'Nutzereingabe Standortpass',
      });
      geometry.reference[targetKey] = field(item.automatic, {
        unit,
        origin: model.ORIGIN.DERIVED,
        source: 'Standortpass Automatikreferenz',
        method: `${method} · ohne manuelle Korrekturen`,
        quality: 'Automatische Referenz',
      });
    });

    const exteriorAuto = data.fields.exteriorWall?.automatic;
    const windowAuto = data.fields.windowArea?.automatic;
    const exteriorManual = data.fields.exteriorWall?.manual;
    const windowManual = data.fields.windowArea?.manual;
    const opaqueAuto = exteriorAuto !== null && windowAuto !== null
      ? Math.max(0, exteriorAuto - windowAuto)
      : null;
    const opaqueManual = exteriorManual !== null || windowManual !== null
      ? Math.max(0, (data.fields.exteriorWall?.effective ?? 0) - (data.fields.windowArea?.effective ?? 0))
      : null;

    geometry.opaqueExteriorWallArea = field(opaqueAuto, {
      unit: 'm²',
      origin: model.ORIGIN.DERIVED,
      source: 'Standortpass',
      method: 'Außenwandfläche brutto − Fensterfläche',
      manualValue: opaqueManual,
      manualSource: 'aus manuellen Geometriekorrekturen',
    });

    return geometry;
  }

  function restoreGeometryEstimates(savedGeometry) {
    if (!savedGeometry) return;
    setInputValue('storeyHeightModule', STOREY_HEIGHT_MODULE_M);
    setInputValue('usableFloorAreaFactor', USABLE_TO_GROSS_FACTOR * 100);
    setInputValue('windowSharePercent', valueResolver.value(savedGeometry.windowSharePercent, DEFAULT_WINDOW_SHARE_PERCENT));
    setInputValue('heatedSharePercent', valueResolver.value(savedGeometry.heatedSharePercent, DEFAULT_HEATED_SHARE_PERCENT));
    const mapping = {
      storeysAboveGround: 'manualStoreysValue',
      grossFloorArea: 'manualGrossFloorAreaValue',
      usableFloorArea: 'manualUsableFloorAreaValue',
      exteriorWallGrossArea: 'manualExteriorWallValue',
      windowArea: 'manualWindowAreaValue',
      topFloorArea: 'manualTopFloorAreaValue',
      basementCeilingArea: 'manualBasementAreaValue',
      roofPitch: 'manualRoofPitchValue',
      roofSlopeArea: 'manualRoofSlopeAreaValue',
      grossVolume: 'manualVolumeValue',
    };
    Object.entries(mapping).forEach(([key, id]) => {
      setInputValue(id, valueResolver.manualValue(savedGeometry[key], null));
    });
    if (!savedGeometry.heatedSharePercent) {
      const savedUsable = Number(valueResolver.value(savedGeometry.usableFloorArea, 0));
      const savedHeated = Number(valueResolver.value(savedGeometry.heatedFloorArea, 0));
      if (savedUsable > 0 && savedHeated >= 0) {
        setInputValue('heatedSharePercent', Math.max(0, Math.min(100, Math.round(savedHeated / savedUsable * 100))));
      }
    }
    renderGeometryEstimates();
  }

  function resetGeometryEstimatesInputs() {
    setInputValue('storeyHeightModule', STOREY_HEIGHT_MODULE_M);
    setInputValue('usableFloorAreaFactor', USABLE_TO_GROSS_FACTOR * 100);
    setInputValue('windowSharePercent', DEFAULT_WINDOW_SHARE_PERCENT);
    setInputValue('heatedSharePercent', DEFAULT_HEATED_SHARE_PERCENT);
    ['manualStoreysValue', 'manualGrossFloorAreaValue', 'manualUsableFloorAreaValue', 'manualExteriorWallValue', 'manualWindowAreaValue', 'manualTopFloorAreaValue', 'manualBasementAreaValue', 'manualRoofPitchValue', 'manualRoofSlopeAreaValue', 'manualVolumeValue']
      .forEach((id) => setInputValue(id, null));
    renderGeometryEstimates();
  }

  function effectiveEstimateText(key, fallback = '–') {
    const ids = {
      storeys: 'effectiveStoreysValue',
      grossFloorArea: 'effectiveGrossFloorAreaValue',
      usableFloorArea: 'effectiveUsableFloorAreaValue',
      heatedFloorArea: 'effectiveHeatedFloorAreaValue',
      exteriorWall: 'effectiveExteriorWallValue',
      windowArea: 'effectiveWindowAreaValue',
      topFloorArea: 'effectiveTopFloorAreaValue',
      basementArea: 'effectiveBasementAreaValue',
      roofPitch: 'effectiveRoofPitchValue',
      roofSlopeArea: 'effectiveRoofSlopeAreaValue',
      volume: 'effectiveVolumeValue',
    };
    const value = text(ids[key]);
    return value && value !== '–' ? value : fallback;
  }

  function printEstimateText(key, fallback = '–') {
    const data = currentGeometryEstimates();
    const config = estimateFieldConfig().find((item) => item.key === key);
    const item = data.fields[key];
    if (!config || !item || item.effective === null) return fallback;
    const formatted = config.format(item.effective);
    return item.manual !== null ? `${formatted} · manuell` : `ca. ${formatted}`;
  }

  function syncProjectFromUi() {
    if (hydrationRunning) return;
    const addressRecord = core.getSelectedAddress();
    const buildingFeature = core.getSelectedBuilding();
    const terrainRaw = safeJson('rawTerrain');
    const addressLabel = addressRecord?.label || '';

    const uiSignature = JSON.stringify({
      addressLabel,
      buildingId: buildingFeature?.attributes?.OBJECTID ?? null,
      addressStatus: statusText('tirisLiveAddressStatus'),
      buildingStatus: statusText('buildingStatus'),
      terrainStatus: statusText('terrainStatus'),
      solarStatus: statusText('solarStatus'),
      solarMapStatus: statusText('solarMapStatus'),
      environmentalHeatStatus: statusText('environmentalHeatStatus'),
      hazardsStatus: statusText('hazardStatus'),
      heritageStatus: statusText('heritageStatus'),
      radonStatus: statusText('radonStatus'),
      terrainHeight: terrainRaw?.elevation_m ?? null,
      reportStatus: statusText('reportRunStatus'),
      storeyHeightModule: STOREY_HEIGHT_MODULE_M,
      usableFloorAreaFactor: USABLE_TO_GROSS_FACTOR * 100,
      windowSharePercent: parseInputValue('windowSharePercent') ?? DEFAULT_WINDOW_SHARE_PERCENT,
      heatedSharePercent: parseInputValue('heatedSharePercent') ?? DEFAULT_HEATED_SHARE_PERCENT,
      geometryEstimateManuals: estimateFieldConfig().map((config) => parseInputValue(config.manualId)),
    });
    if (uiSignature === lastUiSignature) return;
    lastUiSignature = uiSignature;

    const locationPatch = addressRecord ? {
      address: field(addressLabel, {
        origin: model.ORIGIN.OFFICIAL,
        source: addressRecord.source || 'Gemeinsame Adresssuche',
        dataDate: addressRecord.dataset_date ?? null,
      }),
      latitude: field(Number(addressRecord.latitude), { unit: '°', origin: model.ORIGIN.OFFICIAL, source: addressRecord.source || 'Gemeinsame Adresssuche' }),
      longitude: field(Number(addressRecord.longitude), { unit: '°', origin: model.ORIGIN.OFFICIAL, source: addressRecord.source || 'Gemeinsame Adresssuche' }),
      municipality: field(addressRecord.municipality ?? null, { origin: model.ORIGIN.OFFICIAL, source: addressRecord.source || 'Gemeinsame Adresssuche' }),
      municipalityCode: field(addressRecord.municipality_code ?? null, { origin: model.ORIGIN.OFFICIAL, source: addressRecord.source || 'Gemeinsame Adresssuche' }),
      cadastralMunicipalityNumber: field(addressRecord.cadastral_municipality_number ?? null, { origin: model.ORIGIN.OFFICIAL, source: 'TIRIS ogd_basis' }),
      addressRecord: compactAddressRecord(addressRecord),
      metadataText: text('selectedAddressMeta'),
    } : {};

    if (terrainRaw && Number.isFinite(Number(terrainRaw.elevation_m))) {
      locationPatch.elevation = field(Number(terrainRaw.elevation_m), {
        unit: 'm ü. A.', origin: model.ORIGIN.OFFICIAL,
        source: terrainRaw.source || 'TIRIS DGM', method: terrainRaw.layer_name || terrainRaw.layer_id || null,
      });
    }

    const modulePatch = {
      addressStatus: statusText('tirisLiveAddressStatus'),
      buildingStatus: statusText('buildingStatus'),
      terrainStatus: statusText('terrainStatus'),
      solarStatus: statusText('solarStatus'),
      solarMapStatus: statusText('solarMapStatus'),
      environmentalHeatStatus: statusText('environmentalHeatStatus'),
      hazardsStatus: statusText('hazardStatus'),
      heritageStatus: statusText('heritageStatus'),
      radonStatus: statusText('radonStatus'),
      reportStatus: statusText('reportRunStatus'),
      solar: compactSolarShared(),
      version: '1.1.1',
      sharedArchitecture: '1.0',
      updatedAt: new Date().toISOString(),
    };

    const sharedBuilding = buildingFeature ? selectedBuildingShared(buildingFeature) : { geometry: {} };
    sharedBuilding.geometry = {
      ...(sharedBuilding.geometry || {}),
      ...geometryEstimatesShared(),
    };
    sharedBuilding.thermal = {
      ...(store.get().building?.thermal || {}),
    };

    store.patch({
      project: addressRecord ? { addressLabel } : {},
      location: locationPatch,
      building: sharedBuilding,
      modules: { standortpass: modulePatch },
    });

    const geometryEstimate = currentGeometryEstimates();
    const manual = model.ORIGIN.MANUAL;
    const manualUpdates = [
      ['building.geometry.storeyHeightModule', null, 'm'],
      ['building.geometry.usableFloorAreaFactor', null, '%'],
      ['building.geometry.storeysAboveGround', parseInputValue('manualStoreysValue'), 'Geschoße'],
      ['building.geometry.grossFloorArea', parseInputValue('manualGrossFloorAreaValue'), 'm²'],
      ['building.geometry.usableFloorArea', parseInputValue('manualUsableFloorAreaValue'), 'm²'],
      ['building.geometry.heatedFloorArea', Math.abs(geometryEstimate.heatedSharePercent - DEFAULT_HEATED_SHARE_PERCENT) > 0.001 ? geometryEstimate.fields.heatedFloorArea.effective : null, 'm²'],
      ['building.thermal.heatedSharePercent', Math.abs(geometryEstimate.heatedSharePercent - DEFAULT_HEATED_SHARE_PERCENT) > 0.001 ? geometryEstimate.heatedSharePercent : null, '%'],
      ['building.geometry.exteriorWallGrossArea', parseInputValue('manualExteriorWallValue'), 'm²'],
      ['building.geometry.windowArea', parseInputValue('manualWindowAreaValue'), 'm²'],
      ['building.geometry.topFloorArea', parseInputValue('manualTopFloorAreaValue'), 'm²'],
      ['building.geometry.basementCeilingArea', parseInputValue('manualBasementAreaValue'), 'm²'],
      ['building.geometry.roofPitch', parseInputValue('manualRoofPitchValue'), '°'],
      ['building.geometry.roofSlopeArea', parseInputValue('manualRoofSlopeAreaValue'), 'm²'],
      ['building.geometry.grossVolume', parseInputValue('manualVolumeValue'), 'm³'],
      ['building.geometry.windowSharePercent', Math.abs(geometryEstimate.windowSharePercent - DEFAULT_WINDOW_SHARE_PERCENT) > 0.001 ? geometryEstimate.windowSharePercent : null, '%'],
    ].map(([path, value, unit]) => ({
      path,
      origin: manual,
      value,
      options: { unit, source: 'Nutzereingabe Standortpass' },
    }));
    store.setFieldCandidates(manualUpdates);

    renderOverview();
  }

  function resultCard(label, status, detail, tone = 'neutral') {
    const safeLabel = escapeHtml(label);
    const safeStatus = escapeHtml(status);
    const safeDetail = escapeHtml(detail);
    return `<article class="overview-result overview-result--${tone}">
      <div class="compact-card-heading"><span>${safeLabel}</span><button aria-label="Info zu ${safeLabel}" class="info-tip overview-info-tip" data-tooltip="${safeDetail}" type="button">i</button></div>
      <strong>${safeStatus}</strong>
    </article>`;
  }

  function toneFromStatus(status) {
    if (/fehler|fehlgeschlagen|nicht verfügbar|offen/.test(status)) return 'warning';
    if (/erfolgreich|fertig|gefunden|geprüft|bereit|ja|raster/.test(status)) return 'success';
    return 'neutral';
  }

  function solarOverviewStatus() {
    const profile = text('solarStatus') || 'offen';
    const map = text('solarMapStatus') || 'offen';
    if (/fehler/i.test(profile) || /fehler/i.test(map)) return 'teilweise';
    if (/erfolgreich/i.test(profile) && /raster bereit|erfolgreich/i.test(map)) return 'erfolgreich';
    return profile;
  }

  function renderOverview() {
    const overview = $('projectOverviewGrid');
    if (!overview) return;
    const reportItem = ['Bericht', text('reportRunStatus') || 'offen', reportHasRun ? 'Automatischer Prüflauf wurde ausgeführt.' : 'Nach Adressauswahl mit einem Klick erstellen.'];
    const items = reportHasRun ? [
      reportItem,
      ['Standort', text('tirisLiveAddressStatus') || 'offen', text('selectedAddressLabel') || 'Adresse noch nicht gewählt'],
      ['Gebäude', text('buildingStatus') || 'offen', text('buildingMatchInfo') || 'Gebäude noch nicht geprüft'],
      ['Solar', solarOverviewStatus(), 'Sonnenbahn, Verschattung und Jahressolarstrahlung'],
      ['Umweltwärme', text('environmentalHeatStatus') || 'offen', 'Erdsonden, Grundwasser und wasserrechtliche Hinweise'],
      ['Naturgefahren', text('hazardStatus') || 'offen', 'HQ30/HQ100/HQ300 und TIRIS-Gefahrenhinweise'],
      ['Schutz & Radon', `${text('heritageStatus') || 'offen'} · ${text('radonStatus') || 'offen'}`, 'Denkmalschutz, Kulturkontext und Radonstatus'],
      ['Wärmenetz', 'TIRIS-Check', 'Die Prüfung wird direkt für die Projektadresse in TIRIS geöffnet.', 'berry'],
    ] : [reportItem];
    overview.innerHTML = items.map(([label, status, detail, tone]) => resultCard(label, status, detail, tone || toneFromStatus(status.toLowerCase()))).join('');
  }

  function setMainToolAreasVisible(visible) {
    ['area-building', 'area-heat', 'area-solar', 'area-risks'].forEach((id) => {
      const area = $(id);
      if (area) area.hidden = !visible;
    });
  }

  function setReportStatus(label, state = 'muted') {
    const chip = $('reportRunStatus');
    if (!chip) return;
    chip.textContent = label;
    chip.classList.remove('is-working', 'is-error', 'is-success', 'status-chip--muted');
    if (state === 'working') chip.classList.add('is-working');
    else if (state === 'error') chip.classList.add('is-error');
    else if (state === 'success') chip.classList.add('is-success');
    else chip.classList.add('status-chip--muted');
  }

  function setProgress(index, total, label) {
    const box = $('reportProgress');
    if (!box) return;
    box.hidden = false;
    const pct = total ? Math.max(0, Math.min(100, (index / total) * 100)) : 0;
    $('reportProgressBar').style.width = `${pct}%`;
    $('reportProgressText').textContent = label;
  }

  function setRetry(step, show) {
    const element = $(step.retryId);
    if (!element) return;
    element.classList.toggle('is-retry', Boolean(show));
  }

  function stepFailed(step) {
    const status = statusText(step.statusId);
    return /fehler|fehlgeschlagen|gkz fehlt/.test(status);
  }

  function buildingNeedsManualChoice() {
    return !core.getSelectedBuilding() && document.querySelectorAll('#buildingCandidateList .candidate-button').length > 0;
  }

  async function updateLocationLinks() {
    const heatLink = $('heatTirisLink');
    if (!heatLink || !core.getSelectedAddress()) return;
    heatLink.href = await core.getTirisMapUrl(500);
  }

  async function runFullReport(options = {}) {
    if (reportRunning || !core.getSelectedAddress()) return;
    reportRunning = true;
    setMainToolAreasVisible(true);
    const button = $('runReportButton');
    button.disabled = true;
    button.textContent = 'Standort wird analysiert …';
    setReportStatus('läuft …', 'working');
    $('reportRunMessage').textContent = 'Die Standortprüfungen werden nacheinander ausgeführt. Fehlgeschlagene Einzelprüfungen können anschließend direkt im jeweiligen Block wiederholt werden.';
    reportSteps.forEach((step) => setRetry(step, false));
    const activeSteps = reportSteps.filter((step) => !(
      step.key === 'building' && (options.skipBuilding || core.getSelectedBuilding())
    ));

    let errors = 0;
    for (let index = 0; index < activeSteps.length; index += 1) {
      const step = activeSteps[index];
      setProgress(index, activeSteps.length, `${index + 1}/${activeSteps.length} · ${step.label} …`);
      try {
        await step.run();
      } catch (error) {
        console.warn(`Standortpass-Schritt ${step.key} fehlgeschlagen.`, error);
        errors += 1;
      }
      if (stepFailed(step)) {
        errors += 1;
        setRetry(step, true);
      }
      if (step.key === 'building' && buildingNeedsManualChoice()) {
        setRetry(step, true);
      }
      syncProjectFromUi();
    }

    await updateLocationLinks();
    setProgress(activeSteps.length, activeSteps.length, 'Prüflauf abgeschlossen.');

    const manualBuilding = buildingNeedsManualChoice();
    reportHasRun = true;
    if (errors || manualBuilding) {
      setReportStatus('teilweise fertig', 'muted');
      $('reportRunMessage').textContent = manualBuilding
        ? 'Bericht erstellt. Die Gebäudeauswahl ist noch offen; nach der Auswahl bitte „Bericht aktualisieren“ verwenden.'
        : 'Bericht erstellt. Mindestens eine Einzelprüfung konnte nicht abgeschlossen werden; dort ist „erneut prüfen“ eingeblendet.';
    } else {
      setReportStatus('fertig', 'success');
      $('reportRunMessage').textContent = 'Alle automatisch verfügbaren Standortprüfungen wurden abgeschlossen.';
    }

    button.disabled = false;
    button.textContent = 'Standort aktualisieren';
    reportRunning = false;

    store.patch({ modules: { standortpass: {
      reportGeneratedAt: new Date().toISOString(),
      reportStatus: text('reportRunStatus'),
      reportNeedsBuildingChoice: manualBuilding,
    } } });
    buildPrintSummary();
    renderOverview();
  }

  function compactCards(containerId, maxItems = 4) {
    const root = $(containerId);
    if (!root || root.hidden) return [];
    return [...root.querySelectorAll('.environment-card')]
      .slice(0, maxItems)
      .map((card) => {
        const label = card.querySelector('span')?.textContent?.trim() || '';
        const value = card.querySelector('strong')?.textContent?.trim() || '';
        return label && value ? `${label}: ${value}` : value || label;
      })
      .filter(Boolean);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('\"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function listHtml(items, fallback = 'Noch nicht geprüft.') {
    if (!items.length) return `<p>${escapeHtml(fallback)}</p>`;
    return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  function compactCardsDetailed(containerId, maxItems = 4) {
    const root = $(containerId);
    if (!root || root.hidden) return [];
    return [...root.querySelectorAll('.environment-card')]
      .slice(0, maxItems)
      .map((card) => ({
        label: card.querySelector('span')?.textContent?.trim() || '',
        value: card.querySelector('strong')?.textContent?.trim() || '',
        note: card.querySelector('small')?.textContent?.trim() || '',
        hit: card.classList.contains('hazard-card--hit'),
        notice: card.classList.contains('environment-card--notice'),
      }))
      .filter((item) => item.label || item.value || item.note);
  }

  function compactHeatHtml(items) {
    if (!items.length) return '<p>Noch nicht geprüft.</p>';
    return `<div class="print-heat-list">${items.map((item) => {
      let value = item.value;
      const nearest = item.note.match(/nächster Treffer ca\. ([0-9.,]+) m/i)?.[1];
      if (nearest && !/nächster/i.test(value)) value += ` · nächster ca. ${nearest} m`;
      value = value.replace(/\s*\(.*?\)\s*$/g, '');
      return `<div><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(value)}</span></div>`;
    }).join('')}</div>`;
  }

  function printBuildingGridHtml(items) {
    const rows = items.filter((item) => item.value && item.value !== '–' && item.value !== '');
    return `<div class="print-building-grid">${rows.map((item) => `<div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join('')}</div>`;
  }

  function printSolarDurationTable(items) {
    const rows = items.filter((item) => item.value);
    if (!rows.length) return '';
    return `<div class="print-sun-duration"><strong>Sonnenscheindauer</strong><div>${rows.map((item) => `<span><b>${escapeHtml(item.label)}</b><em>${escapeHtml(item.value)}</em></span>`).join('')}</div></div>`;
  }

  function simplifiedRiskLabel(label) {
    const normalized = String(label || '');
    if (/HQ300/i.test(normalized)) return 'Hochwasser HQ300';
    if (/HQ100/i.test(normalized)) return 'Hochwasser HQ100';
    if (/HQ30(?!0)/i.test(normalized)) return 'Hochwasser HQ30';
    if (/Bundesdenkmalamt/i.test(normalized)) return 'Denkmalschutz (BDA)';
    if (/TIRIS Kultur/i.test(normalized)) return 'Baukultureller Kontext';
    if (/GZW|Wildbach|Lawinenverbauung/i.test(normalized)) return 'WLV-Planungsbereich';
    if (/Weitere Naturgefahren/i.test(normalized)) return 'Weitere Naturgefahren';
    if (/Radonvorsorge/i.test(normalized)) return 'Radonvorsorgegebiet';
    if (/Radonschutz/i.test(normalized)) return 'Radonschutzgebiet';
    return normalized;
  }

  function simplifiedRiskValue(label, value) {
    const combined = `${label} ${value}`;
    if (/abfrage fehlgeschlagen|operation was aborted|fehler/i.test(combined)) return 'Prüfung offen';
    if (/kein exakter adresstreffer/i.test(value)) return 'Kein Eintrag gefunden';
    if (/kein Treffer/i.test(value)) return 'Kein Treffer';
    const hitMatch = value.match(/([0-9]+)\s+Flächentreffer/i);
    if (hitMatch) return `${hitMatch[1]} Flächentreffer`;
    if (/^ja$/i.test(value) || /^nein$/i.test(value)) return value.toLowerCase();
    return value;
  }

  function riskTone(label, value, card) {
    const combined = `${label} ${value}`;
    if (/abfrage fehlgeschlagen|operation was aborted|fehler|offen/i.test(combined)) return 'warning';
    if (card.hit) return 'hit';
    if (/Radonschutzgebiet/i.test(label) && /^ja$/i.test(value)) return 'hit';
    if (/kein Treffer|kein Eintrag|^nein$/i.test(value)) return 'clear';
    if (/Radonvorsorgegebiet/i.test(label)) return 'info';
    if (card.notice && !/Radonvorsorgegebiet/i.test(label)) return 'hit';
    return 'info';
  }

  function cloneOrthophotoCompositeForPrint() {
    const stage = $('geometryStage');
    if (!stage || $('orthophotoImage')?.hidden) return '';
    const clone = stage.cloneNode(true);
    clone.removeAttribute('id');
    clone.classList.add('print-map-stage');
    clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    clone.querySelectorAll('button, select, label').forEach((el) => el.remove());
    return clone.outerHTML;
  }

  function buildPrintSummary() {
    renderGeometryEstimates();
    const grid = $('printReportGrid');
    if (!grid) return;

    const buildingMetrics = [
      { label: 'Höhenlage', value: text('terrainHeight') },
      { label: 'Dachprojektion', value: text('metricAreaRounded') },
      { label: 'Gebäudehöhe Median', value: text('metricHeightMedian') },
      { label: 'Oberirdische Geschoße', value: printEstimateText('storeys') },
      { label: 'Bruttogeschoßfläche', value: printEstimateText('grossFloorArea') },
      { label: 'Nutzfläche', value: printEstimateText('usableFloorArea') },
      { label: 'Beheizte Nutzfläche', value: printEstimateText('heatedFloorArea') },
      { label: 'Außenwandfläche', value: effectiveEstimateText('exteriorWall') },
      { label: 'Fensterfläche', value: effectiveEstimateText('windowArea') },
      { label: 'Oberste Geschoßfläche', value: effectiveEstimateText('topFloorArea') },
      { label: 'Kellerdecke / UG-Fläche', value: effectiveEstimateText('basementArea') },
      { label: 'Dachneigung', value: effectiveEstimateText('roofPitch', '') },
      { label: 'Dachschrägefläche', value: effectiveEstimateText('roofSlopeArea', '') },
      { label: 'Gebäudevolumen', value: effectiveEstimateText('volume', '') },
    ];

    const heat = compactCardsDetailed('environmentalHeatResult', 7);
    heat.unshift({ label: 'Wärmenetz', value: 'Direkter TIRIS-Check am Projektstandort', note: '' });

    const observerHeight = text('solarChartHeight');
    const solarMonths = [...document.querySelectorAll('#solarResult .solar-month-grid > div')].map((item) => ({
      label: (item.querySelector('span')?.textContent?.trim() || '').replace('Jänner', 'Jän').replace('September', 'Sept'),
      value: item.querySelector('strong')?.textContent?.trim() || '',
    }));
    const solarShared = compactSolarShared();
    const solarSource = [
      'GeoLand / voibos',
      solarShared?.dataBasis || null,
      solarShared?.flightYear ? `Befliegungsjahr ${solarShared.flightYear}` : null,
    ].filter(Boolean).join(' · ');

    const chart = !$('solarChartCard')?.hidden && $('solarChart')?.childElementCount
      ? `<div class="print-solar-chart">${$('solarChart').outerHTML.replace('id="solarChart"', '')}</div><div class="print-solar-legend">${$('solarChartCard')?.querySelector('.solar-legend')?.innerHTML || ''}</div>`
      : '';

    const orthophotoComposite = cloneOrthophotoCompositeForPrint();
    const solarSrc = document.querySelector('#solarMapResult .solar-map-preview')?.getAttribute('src') || '';
    const scaleText = $('orthophotoScale')?.selectedOptions?.[0]?.textContent?.trim() || 'ca. 1:500';
    const maps = [];
    if (orthophotoComposite) maps.push(`<div class="print-map-card">${orthophotoComposite}<div><strong>Gebäudeübersicht</strong><small>Quelle: TIRIS Orthofoto + Gebäude · ${escapeHtml(scaleText)}</small></div></div>`);
    if (solarSrc) maps.push(`<div class="print-map-card"><img src="${escapeHtml(solarSrc)}" alt="Solarstrahlung im Standortumfeld"><div><strong>Solarstrahlung im Standortumfeld</strong><small>Quelle: Land Tirol · Energiequellen WMS · Image Jahressumme · Ausschnitt ca. 125 m</small></div></div>`);

    const heritageCards = compactCardsDetailed('heritageResult', 3);
    const hazardCards = compactCardsDetailed('hazardResult', 10);
    const radonCards = compactCardsDetailed('radonResult', 3)
      .filter((card) => !/Radonvorsorgegebiet/i.test(card.label));
    const orderedRisks = [...heritageCards, ...hazardCards, ...radonCards];
    const riskHtml = orderedRisks.length ? `<div class="print-risk-grid">${orderedRisks.map((card) => {
      const label = simplifiedRiskLabel(card.label);
      const value = simplifiedRiskValue(label, card.value);
      const tone = riskTone(label, value, card);
      return `<div class="print-risk-card print-risk-card--${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
    }).join('')}</div>` : '<p>Noch nicht geprüft.</p>';

    grid.innerHTML = `
      <div class="print-page print-page--first">
        <section class="print-section print-section--maps">
          <h2>Karten</h2>
          <div class="print-map-grid">${maps.join('')}</div>
        </section>
        <div class="print-two-column">
          <section class="print-section">
            <h2>Gebäude & Standort</h2>
            ${printBuildingGridHtml(buildingMetrics)}
            <p class="print-source">Quelle: Land Tirol / TIRIS. Abgeleitete Bauteilgrößen sind Orientierungswerte; manuelle Korrekturen werden bevorzugt.</p>
          </section>
          <section class="print-section">
            <h2>Wärmeversorgung</h2>
            ${compactHeatHtml(heat)}
            <p class="print-source">Quelle: TIRIS WASSER; Wärmenetz derzeit direkter TIRIS-Check. Keine Eignungszusage.</p>
          </section>
        </div>
      </div>
      <div class="print-page print-page--second">
        <section class="print-section print-section--solar">
          <h2>Sonnenbahn & Verschattung</h2>
          <div class="print-solar-meta"><span><b>Bezugshöhe</b>${escapeHtml(observerHeight || '–')}</span>${printSolarDurationTable(solarMonths)}</div>
          ${chart}
          <p class="print-source">Quelle: ${escapeHtml(solarSource || 'GeoLand / voibos')}. Grau = Gelände, Türkis = zusätzliche Gebäude-/Vegetationsverschattung.</p>
        </section>
        <section class="print-section print-section--risks">
          <h2>Standort & Risiken</h2>
          ${riskHtml}
          <p class="print-source">Quellen: Bundesdenkmalamt, TIRIS Naturgefahren/Kultur, Radonschutzverordnung. Kein Treffer ist keine Sicherheitsbestätigung.</p>
        </section>
      </div>`;
  }

  function resetReportUi() {
    reportHasRun = false;
    reportRunning = false;
    setReportStatus('Adresse fehlt');
    const button = $('runReportButton');
    button.disabled = true;
    button.textContent = 'Standort analysieren';
    $('reportRunMessage').textContent = 'Nach der Adressauswahl werden Gebäude, Höhenlage, Solar, Umweltwärme, Naturgefahren, Schutzstatus und Radon nacheinander geprüft.';
    $('reportProgress').hidden = true;
    $('reportProgressBar').style.width = '0%';
    reportSteps.forEach((step) => setRetry(step, false));
    $('printReportGrid').innerHTML = '';
    setMainToolAreasVisible(false);
    resetGeometryEstimatesInputs();
    renderOverview();
  }

  async function hydrateProject(projectState, options = {}) {
    if (hydrationRunning || !projectState) return;
    hydrationRunning = true;
    try {
      const buildingSnapshot = projectState.building?.sourceSnapshot || null;
      core.clearAddress();
      const record = projectState.location?.addressRecord;
      const label = projectState.project?.addressLabel || projectState.location?.address?.value || '';
      let restored = false;
      let restoredBuilding = false;
      if (record?.latitude !== undefined && record?.longitude !== undefined) {
        restored = core.selectAddressRecord(record, 'tiris-project-import');
      } else if (label) {
        restored = await core.searchAndSelectAddress(label);
      }
      if (!restored && label) {
        $('tirisLiveAddressInput').value = label;
        $('reportRunMessage').textContent = 'Projektadresse übernommen. Bitte die Adresse einmal suchen und bestätigen, da im älteren Projekt keine Koordinate gespeichert war.';
      }
      if (restored && buildingSnapshot?.feature) {
        restoredBuilding = core.restoreBuildingSnapshot(buildingSnapshot);
      }
      restoreGeometryEstimates(projectState.building?.geometry || projectState.modules?.standortpass?.geometryEstimates);
      if (restored && options.autoRun) {
        await runFullReport({ source: 'import', skipBuilding: restoredBuilding });
      }
    } finally {
      hydrationRunning = false;
    }
  }

  window.addEventListener('standortpass:address-selected', async (event) => {
    const record = event.detail?.record;
    const addressChangeAction = event.detail?.addressChangeAction || 'initial';
    if (record && !hydrationRunning) {
      // Bei einer Adresskorrektur bleiben manuelle Gebäudeangaben aus dem gemeinsamen
      // Adressmanager erhalten. Bei einem wirklich neuen Projekt beginnt die Geometrie leer.
      store.setPath('location', { addressRecord: compactAddressRecord(record) });
      if (!['correct', 'same'].includes(addressChangeAction)) store.setPath('building', {});
      store.setPath('modules.standortpass', {});
      store.setPath('project.addressLabel', record.label || '');
    }
    reportHasRun = false;
    $('reportProgress').hidden = true;
    $('reportProgressBar').style.width = '0%';
    const button = $('runReportButton');
    button.disabled = false;
    button.textContent = 'Standort analysieren';
    setReportStatus('bereit', 'success');
    $('reportRunMessage').textContent = 'Standort ist gewählt. Mit „Bericht erstellen“ werden alle verfügbaren Prüfungen automatisch nacheinander ausgeführt.';
    if (!hydrationRunning) {
      if (addressChangeAction === 'correct') {
        restoreGeometryEstimates(store.get().building?.geometry);
      } else if (addressChangeAction !== 'same') {
        resetGeometryEstimatesInputs();
      }
    }
    await updateLocationLinks();
    if (!hydrationRunning) syncProjectFromUi();
  });

  window.addEventListener('standortpass:address-cleared', () => {
    if (!hydrationRunning) {
      store.setPath('project.addressLabel', '');
      store.setPath('location', {});
      store.setPath('building', {});
      store.setPath('modules.standortpass', {});
    }
    resetReportUi();
  });

  window.addEventListener('standortpass:kg-loaded', (event) => {
    const number = event.detail?.number;
    const name = event.detail?.name;
    if (number !== undefined && number !== null) {
      store.setPath('location.cadastralMunicipalityNumber', field(String(number), { origin: model.ORIGIN.OFFICIAL, source: 'TIRIS ogd_basis' }));
    }
    if (name) store.setPath('location.cadastralMunicipalityName', field(name, { origin: model.ORIGIN.OFFICIAL, source: 'TIRIS ogd_basis' }));
    syncProjectFromUi();
  });

  window.addEventListener('standortpass:building-selected', (event) => {
    const feature = event.detail?.feature;
    const selectionMode = event.detail?.selectionMode || 'manual';
    if (feature && !hydrationRunning) store.setPath('building', mergeSelectedBuilding(feature, selectionMode));
    renderGeometryEstimates();
    if (reportHasRun && !reportRunning) {
      setReportStatus('aktualisieren');
      $('runReportButton').textContent = 'Standort aktualisieren';
      $('reportRunMessage').textContent = 'Gebäudeauswahl geändert. Solar- und Risikoprüfung sollten mit „Bericht aktualisieren“ neu berechnet werden.';
    }
    syncProjectFromUi();
  });

  window.addEventListener('standortpass:building-cleared', () => {
    if (!hydrationRunning) store.setPath('building', clearSelectedBuildingPreservingProjectValues());
    renderGeometryEstimates();
    syncProjectFromUi();
  });

  window.addEventListener('energy-tools:project-reset', () => {
    hydrationRunning = true;
    try { core.clearAddress(); } finally { hydrationRunning = false; }
    resetReportUi();
  });

  window.addEventListener('energy-tools:project-imported', (event) => {
    hydrateProject(event.detail?.project, { autoRun: true });
  });

  window.addEventListener('energy-tools:prepare-print', buildPrintSummary);

  $('runReportButton')?.addEventListener('click', () => runFullReport());
  $('printReportButtonBottom')?.addEventListener('click', () => {
    buildPrintSummary();
    window.requestAnimationFrame(() => window.print());
  });

  ['heatedSharePercent', 'windowSharePercent', 'manualStoreysValue', 'manualGrossFloorAreaValue', 'manualUsableFloorAreaValue', 'manualExteriorWallValue', 'manualWindowAreaValue', 'manualTopFloorAreaValue', 'manualBasementAreaValue', 'manualRoofPitchValue', 'manualRoofSlopeAreaValue', 'manualVolumeValue'].forEach((id) => {
    $(id)?.addEventListener('input', () => {
      renderGeometryEstimates();
      buildPrintSummary();
      syncProjectFromUi();
    });
    $(id)?.addEventListener('change', () => {
      if (id === 'manualStoreysValue') {
        const value = parseInputValue(id);
        setInputValue(id, value === null ? null : Math.max(1, Math.round(value)));
      } else if (!['manualRoofPitchValue', 'heatedSharePercent', 'windowSharePercent'].includes(id)) {
        const value = parseInputValue(id);
        if (value !== null && value <= 0) setInputValue(id, null);
      }
      renderGeometryEstimates();
      buildPrintSummary();
      syncProjectFromUi();
    });
  });

  document.querySelectorAll('.estimate-reset').forEach((button) => {
    button.addEventListener('click', () => {
      setInputValue(button.dataset.resetId, null);
      renderGeometryEstimates();
      buildPrintSummary();
      syncProjectFromUi();
    });
  });

  const observer = new MutationObserver(() => {
    window.clearTimeout(observer.timer);
    observer.timer = window.setTimeout(syncProjectFromUi, 140);
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'hidden'],
  });

  renderGeometryEstimates();
  setMainToolAreasVisible(false);
  renderOverview();

  // Persistierte Projekte stellen zuerst Standort und Gebäude-Snapshot wieder her.
  // Dadurch überschreibt ein leer gestartetes UI keine bereits gespeicherte Auswahl.
  const initial = store.get();
  if (initial.project?.addressLabel || initial.location?.addressRecord) {
    hydrateProject(initial, { autoRun: false });
  } else {
    syncProjectFromUi();
    resetReportUi();
  }
})();
