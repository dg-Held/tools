'use strict';

(function initEnergyFlowV4(global) {
  const store = global.EnergyToolsProjectStore;
  const model = global.EnergyToolsDataModel;
  const resolver = global.EnergyToolsValueResolver;
  const addressManager = global.EnergyToolsAddressManager;
  const geometryService = global.EnergyToolsBuildingGeometryService;
  const core = global.EnergyFlowCore;
  const paths = global.EnergyToolsPaths;
  const addressCore = global.AddressProviderCore;
  const oibNatCore = global.OibNatCore;
  const oibTnat13Core = global.OibTnat13Core;
  const precomputedClimateCore = global.PrecomputedClimateCore;

  if (!store || !model || !resolver || !addressManager || !geometryService || !core) {
    console.error('Energiefluss V4: gemeinsame Basis oder Rechenkern fehlt.');
    return;
  }

  const $ = (id) => document.getElementById(id);
  const number0 = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 0 });
  const number1 = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const number2 = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const ORIGIN_LABELS = {
    [model.ORIGIN.MANUAL]: 'manuell',
    [model.ORIGIN.OFFICIAL]: 'amtlich',
    [model.ORIGIN.DERIVED]: 'abgeleitet',
    [model.ORIGIN.FALLBACK]: 'Fallback',
  };

  const DEFAULT_CONFIG = {
    data_date: '2026-08-04',
    assumptions: {
      heated_floor_area_m2: 120,
      persons: 4,
      annual_heating_energy_kwh: 25000,
      useful_heat_factor: 0.85,
      hot_water_included: true,
      indoor_temperature_c: 22,
      heated_share_percent: 100,
      storeys: 2,
      usable_floor_area_factor_percent: 75,
      window_share_percent: 20,
      storey_height_m: 3.2,
      internal_gains_w_m2: 2.7,
      solar_radiation_factor_kwh_m2a: 175,
      glazing_share: 0.70,
      solar_utilization_factor: 1.00,
      ventilation_loss_kwh_m3a: 10,
      hot_water_kwh_person_a: 1000,
      thermal_bridge_share: 0.075,
    },
    u_value_profiles: {
      unsanierter_altbau: { label: 'Unsanierter Altbau', exteriorWall: 1.40, windows: 2.80, topFloorCeiling: 1.00, roof: 1.00, basementCeiling: 1.20, groundFloor: 1.00 },
      teilsanierter_bestand: { label: 'Teilsanierter Bestand', exteriorWall: 0.70, windows: 1.60, topFloorCeiling: 0.40, roof: 0.40, basementCeiling: 0.70, groundFloor: 0.70 },
      sanierter_bestand: { label: 'Sanierter Bestand', exteriorWall: 0.30, windows: 1.10, topFloorCeiling: 0.20, roof: 0.20, basementCeiling: 0.35, groundFloor: 0.35 },
      neuerer_standard: { label: 'Neuerer Standard / Neubau', exteriorWall: 0.20, windows: 0.90, topFloorCeiling: 0.15, roof: 0.15, basementCeiling: 0.25, groundFloor: 0.25 },
    },
  };

  const COMPONENTS = [
    {
      id: 'exteriorWall', label: 'Außenwand opak', note: 'Außenwand brutto minus Fenster',
      areaPath: 'building.geometry.opaqueExteriorWallArea',
      uPath: 'building.thermal.envelope.exteriorWall.uValue',
      enabledPath: 'building.thermal.envelope.exteriorWall.enabled',
      defaultEnabled: true,
      areaStep: 10,
    },
    {
      id: 'windows', label: 'Fenster', note: 'gesamte Fensterfläche',
      areaPath: 'building.geometry.windowArea',
      uPath: 'building.thermal.envelope.windows.uValue',
      enabledPath: 'building.thermal.envelope.windows.enabled',
      defaultEnabled: true,
      areaStep: 5,
    },
    {
      id: 'topFloorCeiling', label: 'Oberste Geschoßdecke', note: 'aktiv bei unbeheiztem Dachraum',
      areaPath: 'building.geometry.topFloorArea',
      uPath: 'building.thermal.envelope.topFloorCeiling.uValue',
      enabledPath: 'building.thermal.envelope.topFloorCeiling.enabled',
      defaultEnabled: true,
      areaStep: 10,
    },
    {
      id: 'roof', label: 'Dach', note: 'aktiv bei ausgebautem Dach oder Teilfläche',
      areaPath: 'building.geometry.roofSlopeArea',
      uPath: 'building.thermal.envelope.roof.uValue',
      enabledPath: 'building.thermal.envelope.roof.enabled',
      defaultEnabled: false,
      areaStep: 10,
    },
    {
      id: 'basementCeiling', label: 'Kellerdecke / UG-Decke', note: 'Abschluss gegen unbeheizten Bereich',
      areaPath: 'building.geometry.basementCeilingArea',
      uPath: 'building.thermal.envelope.basementCeiling.uValue',
      enabledPath: 'building.thermal.envelope.basementCeiling.enabled',
      defaultEnabled: true,
      areaStep: 10,
    },
    {
      id: 'groundFloor', label: 'Boden / unterste Geschoßdecke', note: 'gegen Erdreich oder Außenluft',
      areaPath: 'building.geometry.groundFloorArea',
      uPath: 'building.thermal.envelope.groundFloor.uValue',
      enabledPath: 'building.thermal.envelope.groundFloor.enabled',
      defaultEnabled: false,
      areaStep: 10,
    },
  ];

  let config = DEFAULT_CONFIG;
  let existingUValuesConfig = null;
  let envelopeEvaluationConfig = null;
  let hybridAddressProvider = null;
  let addressSearchTimer = null;
  let addressSearchSequence = 0;
  let rendering = false;
  let lastResult = null;
  let lastResultFingerprint = '';
  let fallbackUpdateRunning = false;
  let climateCalculationRunning = false;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function getPath(object, path, fallback = null) {
    const value = String(path).split('.').reduce((cursor, key) => cursor?.[key], object);
    return value === undefined ? fallback : value;
  }

  function valueAt(project, path, fallback = null) {
    return resolver.value(getPath(project, path), fallback);
  }

  function describeAt(project, path) {
    return resolver.describe(getPath(project, path));
  }

  function finite(value, fallback = null) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function hasValue(value) {
    return value !== null && value !== undefined && value !== '';
  }

  function formatNumber(value, digits = 0) {
    if (!Number.isFinite(Number(value))) return '–';
    if (digits === 2) return number2.format(Number(value));
    if (digits === 1) return number1.format(Number(value));
    return number0.format(Number(value));
  }

  function formatEnergy(value) {
    return Number.isFinite(Number(value)) ? `${number0.format(Number(value))} kWh` : '–';
  }

  function formatSpecific(value) {
    return Number.isFinite(Number(value)) ? `${number0.format(Number(value))} kWh/m²a` : '–';
  }

  function formatEditableNumber(value, digits = 1) {
    if (!Number.isFinite(Number(value))) return '';
    const factor = 10 ** digits;
    const rounded = Math.round(Number(value) * factor) / factor;
    return String(rounded);
  }

  function roundToStep(value, step = 1) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    const increment = Number(step);
    if (!Number.isFinite(number) || !Number.isFinite(increment) || increment <= 0) return null;
    return Math.round(number / increment) * increment;
  }

  function roundedComponentArea(project, component) {
    return roundToStep(valueAt(project, component.areaPath, 0), component.areaStep ?? 10) ?? 0;
  }

  function formatSignedPercent(value) {
    if (!Number.isFinite(Number(value))) return '–';
    const rounded = Math.round(Number(value) / 5) * 5;
    return `${rounded > 0 ? '+' : ''}${number0.format(rounded)} %`;
  }

  function comparisonAssessment(deviationPercent) {
    if (!Number.isFinite(Number(deviationPercent))) {
      return { level: 'missing', label: 'Klimadaten fehlen', note: 'Klima einmal berechnen' };
    }
    const absolute = Math.abs(Number(deviationPercent));
    if (absolute <= 15) return { level: 'good', label: 'gute Übereinstimmung', note: 'Größenordnung passt gut' };
    if (absolute <= 30) return { level: 'plausible', label: 'plausibler Bereich', note: 'Eingaben wirken stimmig' };
    if (absolute <= 50) return { level: 'check', label: 'deutliche Abweichung', note: 'U-Werte und Annahmen prüfen' };
    return { level: 'warning', label: 'große Abweichung', note: 'Grundlagen genauer prüfen' };
  }

  function hashText(text) {
    let hash = 5381;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
    }
    return (hash >>> 0).toString(16);
  }

  function sameCandidate(field, origin, nextValue) {
    const current = field?.candidates?.[origin]?.value;
    if (!hasValue(current) && !hasValue(nextValue)) return true;
    if (typeof nextValue === 'number' || typeof current === 'number') {
      return Number.isFinite(Number(current)) && Number.isFinite(Number(nextValue))
        && Math.abs(Number(current) - Number(nextValue)) < 1e-9;
    }
    return current === nextValue;
  }

  function fallbackUpdate(updates, project, path, value, options = {}) {
    const field = getPath(project, path);
    if (sameCandidate(field, model.ORIGIN.FALLBACK, value)) return;
    updates.push({ path, origin: model.ORIGIN.FALLBACK, value, options });
  }

  function effectiveGeometryFallbacks(project) {
    const a = config.assumptions;
    const heatedFloorArea = finite(valueAt(project, 'building.geometry.heatedFloorArea'), a.heated_floor_area_m2);
    const storeys = Math.max(1, Math.round(finite(valueAt(project, 'building.geometry.storeysAboveGround'), a.storeys)));
    const grossFloorArea = finite(valueAt(project, 'building.geometry.grossFloorArea'), heatedFloorArea / (a.usable_floor_area_factor_percent / 100));
    const footprintArea = finite(valueAt(project, 'building.geometry.footprintArea'), grossFloorArea / storeys);
    const perimeter = finite(valueAt(project, 'building.geometry.perimeter'), 4 * Math.sqrt(Math.max(footprintArea, 0)));
    const heightMedian = finite(valueAt(project, 'building.geometry.heightMedian'), storeys * a.storey_height_m);
    const exteriorWallGrossArea = finite(valueAt(project, 'building.geometry.exteriorWallGrossArea'), perimeter * heightMedian);
    const windowArea = finite(valueAt(project, 'building.geometry.windowArea'), exteriorWallGrossArea * a.window_share_percent / 100);
    const opaqueWallArea = Math.max(0, exteriorWallGrossArea - windowArea);
    const grossVolume = finite(valueAt(project, 'building.geometry.grossVolume'), grossFloorArea * a.storey_height_m);

    return {
      heatedFloorArea,
      storeys,
      grossFloorArea,
      footprintArea,
      perimeter,
      heightMedian,
      exteriorWallGrossArea,
      windowArea,
      opaqueWallArea,
      grossVolume,
    };
  }

  function constructionPeriodForYear(year) {
    const numericYear = Number(year);
    if (!Number.isFinite(numericYear) || !existingUValuesConfig?.periods?.length) return null;
    return existingUValuesConfig.periods.find((period) => {
      const minimum = period.year_min ?? Number.NEGATIVE_INFINITY;
      const maximum = period.year_max ?? Number.POSITIVE_INFINITY;
      return numericYear >= minimum && numericYear <= maximum;
    }) ?? null;
  }

  function uValueFallbackContext(project) {
    const conditionInfo = describeAt(project, 'building.thermal.condition');
    const year = valueAt(project, 'building.profile.constructionYear', null);
    const period = constructionPeriodForYear(year);

    if (conditionInfo.origin === model.ORIGIN.MANUAL) {
      const profile = config.u_value_profiles?.[conditionInfo.value];
      if (profile) return {
        kind: 'condition',
        label: profile.label,
        values: profile,
        source: `Gebäudezustand · ${profile.label}`,
        method: 'manuell gewählter grober Zustandsfallback',
      };
    }

    if (period && existingUValuesConfig?.components) {
      const values = {};
      COMPONENTS.forEach((component) => {
        values[component.id] = existingUValuesConfig.components?.[component.id]?.values?.[period.id] ?? null;
      });
      return {
        kind: 'construction-period',
        label: `Bauperiode ${period.label}`,
        values,
        source: `U-Wert-Vorschlag · Bauperiode ${period.label}`,
        method: 'Bestandsvorschlag nach Jahr der Baubewilligung',
      };
    }

    const condition = conditionInfo.value || 'teilsanierter_bestand';
    const profile = config.u_value_profiles?.[condition] ?? config.u_value_profiles?.teilsanierter_bestand;
    return {
      kind: 'condition',
      label: profile?.label ?? 'Teilsanierter Bestand',
      values: profile ?? {},
      source: `Gebäudezustand · ${profile?.label ?? 'Teilsanierter Bestand'}`,
      method: 'grober Zustandsfallback, da keine Bauperiode vorliegt',
    };
  }

  function evaluateUValue(componentId, value) {
    const uValue = Number(value);
    const settings = envelopeEvaluationConfig?.components?.[componentId];
    if (!settings || !Number.isFinite(uValue)) return null;
    const thresholds = settings.thresholds ?? {};
    if (uValue <= thresholds.green_max) return { level: 'green', label: 'sehr gut' };
    if (uValue <= thresholds.lightgreen_max) return { level: 'lightgreen', label: 'gut' };
    if (uValue <= thresholds.orange_max) return { level: 'orange', label: 'verbesserbar' };
    return { level: 'red', label: 'hohes Verbesserungspotenzial' };
  }

  function ensureFallbackCandidates(project) {
    if (fallbackUpdateRunning) return false;
    const a = config.assumptions;
    const geometry = effectiveGeometryFallbacks(project);
    const uFallback = uValueFallbackContext(project);
    const updates = [];

    fallbackUpdate(updates, project, 'usage.household.persons', a.persons, { unit: 'Personen', source: 'Energiefluss V4 Standardannahme' });
    fallbackUpdate(updates, project, 'consumption.heating.annualEnergy', a.annual_heating_energy_kwh, { unit: 'kWh/a', source: 'Energiefluss V4 Standardannahme' });
    fallbackUpdate(updates, project, 'systems.heating.usefulHeatFactor', a.useful_heat_factor, { source: 'Energiefluss V4 Standardannahme' });
    fallbackUpdate(updates, project, 'systems.heating.hotWaterIncluded', a.hot_water_included, { source: 'Energiefluss V4 Standardannahme' });
    fallbackUpdate(updates, project, 'building.thermal.indoorTemperature', a.indoor_temperature_c, { unit: '°C', source: 'Energiefluss V4 Standardannahme' });
    fallbackUpdate(updates, project, 'building.thermal.heatedSharePercent', a.heated_share_percent, { unit: '%', source: 'Energiefluss V4 Standardannahme' });
    fallbackUpdate(updates, project, 'building.thermal.condition', 'teilsanierter_bestand', { source: 'Energiefluss V4 Standardannahme' });

    fallbackUpdate(updates, project, 'building.geometry.heatedFloorArea', geometry.heatedFloorArea, { unit: 'm²', source: 'Energiefluss V4 Fallbackgeometrie', method: 'sichtbare Standardannahme' });
    fallbackUpdate(updates, project, 'building.geometry.grossFloorArea', geometry.grossFloorArea, { unit: 'm²', source: 'Energiefluss V4 Fallbackgeometrie', method: 'beheizte Nutzfläche / 0,75' });
    fallbackUpdate(updates, project, 'building.geometry.storeysAboveGround', geometry.storeys, { unit: 'Geschoße', source: 'Energiefluss V4 Fallbackgeometrie' });
    fallbackUpdate(updates, project, 'building.geometry.footprintArea', geometry.footprintArea, { unit: 'm²', source: 'Energiefluss V4 Fallbackgeometrie', method: 'BGF / Geschoße' });
    fallbackUpdate(updates, project, 'building.geometry.perimeter', geometry.perimeter, { unit: 'm', source: 'Energiefluss V4 Fallbackgeometrie', method: 'quadratischer Gebäudegrundriss' });
    fallbackUpdate(updates, project, 'building.geometry.heightMedian', geometry.heightMedian, { unit: 'm', source: 'Energiefluss V4 Fallbackgeometrie', method: 'Geschoße × 3,2 m' });
    fallbackUpdate(updates, project, 'building.geometry.exteriorWallGrossArea', geometry.exteriorWallGrossArea, { unit: 'm²', source: 'Energiefluss V4 Fallbackgeometrie', method: 'Umfang × Höhe' });
    fallbackUpdate(updates, project, 'building.geometry.windowArea', geometry.windowArea, { unit: 'm²', source: 'Energiefluss V4 Fallbackgeometrie', method: 'Außenwand brutto × 20 %' });
    fallbackUpdate(updates, project, 'building.geometry.opaqueExteriorWallArea', geometry.opaqueWallArea, { unit: 'm²', source: 'Energiefluss V4 Fallbackgeometrie', method: 'Außenwand brutto − Fenster' });
    fallbackUpdate(updates, project, 'building.geometry.topFloorArea', geometry.footprintArea, { unit: 'm²', source: 'Energiefluss V4 Fallbackgeometrie', method: 'Gebäudegrundfläche' });
    fallbackUpdate(updates, project, 'building.geometry.roofSlopeArea', geometry.footprintArea, { unit: 'm²', source: 'Energiefluss V4 Fallbackgeometrie', method: 'Dachprojektion ohne bekannte Dachneigung' });
    fallbackUpdate(updates, project, 'building.geometry.basementCeilingArea', geometry.footprintArea, { unit: 'm²', source: 'Energiefluss V4 Fallbackgeometrie', method: 'Gebäudegrundfläche' });
    fallbackUpdate(updates, project, 'building.geometry.groundFloorArea', geometry.footprintArea, { unit: 'm²', source: 'Energiefluss V4 Fallbackgeometrie', method: 'Gebäudegrundfläche' });
    fallbackUpdate(updates, project, 'building.geometry.grossVolume', geometry.grossVolume, { unit: 'm³', source: 'Energiefluss V4 Fallbackgeometrie', method: 'BGF × 3,2 m' });

    COMPONENTS.forEach((component) => {
      fallbackUpdate(updates, project, component.enabledPath, component.defaultEnabled, { source: 'Energiefluss V4 Standardannahme' });
      const fallbackUValue = uFallback.values?.[component.id];
      if (Number.isFinite(Number(fallbackUValue))) {
        fallbackUpdate(updates, project, component.uPath, Number(fallbackUValue), {
          unit: 'W/m²K',
          source: uFallback.source,
          method: uFallback.method,
          dataDate: existingUValuesConfig?.data_date ?? config.data_date ?? null,
          quality: 'Beratungsannahme; konkreten Aufbau und Sanierungsstand prüfen',
        });
      }
    });

    if (!updates.length) return false;
    fallbackUpdateRunning = true;
    try {
      store.setFieldCandidates(updates);
    } finally {
      fallbackUpdateRunning = false;
    }
    return true;
  }

  function buildValueField(host) {
    const path = host.dataset.projectPath;
    const kind = host.dataset.kind || 'number';
    const unit = host.dataset.unit || '';
    const label = host.dataset.label || path;
    const step = host.dataset.step || (kind === 'number' ? 'any' : '');
    const min = host.dataset.min;
    const max = host.dataset.max;

    let control = '';
    if (kind === 'boolean-select') {
      control = '<select data-value-input><option value="true">inkludiert</option><option value="false">nicht inkludiert</option></select>';
    } else if (kind === 'condition-select') {
      control = `<select data-value-input>
        <option value="unsanierter_altbau">Unsanierter Altbau</option>
        <option value="teilsanierter_bestand">Teilsanierter Bestand</option>
        <option value="sanierter_bestand">Sanierter Bestand</option>
        <option value="neuerer_standard">Neuerer Standard / Neubau</option>
      </select>`;
    } else {
      control = `<input data-value-input type="number" step="${step}"${min !== undefined ? ` min="${min}"` : ''}${max !== undefined ? ` max="${max}"` : ''}>`;
    }

    host.innerHTML = `
      <div class="v4-value-field__head"><label>${label}</label><span class="value-origin" data-value-origin>–</span></div>
      <div class="v4-value-field__control">${control}${unit ? `<span class="value-unit">${unit}</span>` : ''}<button class="value-reset" data-value-reset type="button">↺</button></div>
      <small data-value-detail></small>`;

    const input = host.querySelector('[data-value-input]');
    const reset = host.querySelector('[data-value-reset]');

    input.addEventListener('change', () => {
      if (rendering) return;
      let value;
      if (kind === 'boolean-select') value = input.value === 'true';
      else if (kind === 'condition-select') value = input.value;
      else value = input.value.trim() === '' ? null : Number(input.value);
      if (kind === 'number' && value !== null && !Number.isFinite(value)) return;
      store.setFieldCandidate(path, model.ORIGIN.MANUAL, value, { unit: unit || null, source: 'Energiefluss V4.3' });
    });
    reset.addEventListener('click', () => store.clearFieldCandidate(path, model.ORIGIN.MANUAL));
  }

  function renderValueField(host, project) {
    const path = host.dataset.projectPath;
    const kind = host.dataset.kind || 'number';
    const unit = host.dataset.unit || '';
    const digits = Number(host.dataset.digits ?? 1);
    const info = describeAt(project, path);
    const input = host.querySelector('[data-value-input]');
    const origin = host.querySelector('[data-value-origin]');
    const reset = host.querySelector('[data-value-reset]');
    const detail = host.querySelector('[data-value-detail]');

    if (kind === 'boolean-select') input.value = String(Boolean(info.value));
    else input.value = info.value === null || info.value === undefined ? '' : String(info.value);
    origin.textContent = ORIGIN_LABELS[info.origin] ?? 'offen';
    origin.dataset.origin = info.origin ?? 'empty';
    reset.hidden = !info.isManual;

    const automaticText = info.isManual && info.automaticValue !== null
      ? `Automatik: ${formatNumber(info.automaticValue, digits)}${unit ? ` ${unit}` : ''}`
      : '';
    const sourceText = info.source ? `Quelle: ${info.source}` : '';
    detail.textContent = [automaticText, sourceText].filter(Boolean).join(' · ');
  }

  function buildEnvelopeRows() {
    const body = $('envelopeRows');
    body.innerHTML = COMPONENTS.map((component) => `
      <tr data-component-id="${component.id}">
        <td class="envelope-active"><input type="checkbox" data-component-enabled aria-label="${component.label} aktiv"></td>
        <td class="envelope-label"><strong>${component.label}</strong><small>${component.note}</small>${`<a class="envelope-action" href="../bauteil-sanierung/index.html?component=${component.id}">${component.id === 'windows' ? 'Fenster vergleichen' : 'Bauteil sanieren'}</a>`}</td>
        <td><div class="envelope-field"><input class="envelope-input" type="number" step="${component.areaStep}" min="0" data-component-area><button class="envelope-reset" type="button" data-reset-area>↺</button><small data-area-detail></small></div></td>
        <td><div class="envelope-field"><input class="envelope-input" type="number" step="0.01" min="0" data-component-u><button class="envelope-reset" type="button" data-reset-u>↺</button><small data-u-detail></small></div></td>
        <td class="envelope-result" data-component-ua>–</td>
        <td class="envelope-result" data-component-loss>–</td>
      </tr>`).join('');

    COMPONENTS.forEach((component) => {
      const row = body.querySelector(`[data-component-id="${component.id}"]`);
      const enabled = row.querySelector('[data-component-enabled]');
      const area = row.querySelector('[data-component-area]');
      const uValue = row.querySelector('[data-component-u]');
      const resetArea = row.querySelector('[data-reset-area]');
      const resetU = row.querySelector('[data-reset-u]');

      enabled.addEventListener('change', () => {
        if (rendering) return;
        store.setFieldCandidate(component.enabledPath, model.ORIGIN.MANUAL, enabled.checked, { source: 'Energiefluss V4.3' });
      });
      area.addEventListener('change', () => {
        if (rendering) return;
        const rawValue = area.value.trim() === '' ? null : Number(area.value);
        if (rawValue !== null && !Number.isFinite(rawValue)) return;
        const value = rawValue === null ? null : roundToStep(rawValue, component.areaStep);
        area.value = value === null ? '' : String(value);
        store.setFieldCandidate(component.areaPath, model.ORIGIN.MANUAL, value, { unit: 'm²', source: 'Energiefluss V4.3', method: `bewusst auf ${component.areaStep} m² gerundet` });
      });
      uValue.addEventListener('change', () => {
        if (rendering) return;
        const value = uValue.value.trim() === '' ? null : Number(uValue.value);
        if (value !== null && !Number.isFinite(value)) return;
        store.setFieldCandidate(component.uPath, model.ORIGIN.MANUAL, value, { unit: 'W/m²K', source: 'Energiefluss V4.3' });
      });
      resetArea.addEventListener('click', () => store.clearFieldCandidate(component.areaPath, model.ORIGIN.MANUAL));
      resetU.addEventListener('click', () => store.clearFieldCandidate(component.uPath, model.ORIGIN.MANUAL));
    });
  }

  function renderEnvelopeRows(project, result) {
    COMPONENTS.forEach((component) => {
      const row = document.querySelector(`[data-component-id="${component.id}"]`);
      const enabledInfo = describeAt(project, component.enabledPath);
      const areaInfo = describeAt(project, component.areaPath);
      const uInfo = describeAt(project, component.uPath);
      const componentResult = result?.envelope?.components?.find((item) => item.id === component.id);

      row.querySelector('[data-component-enabled]').checked = Boolean(enabledInfo.value);
      const roundedArea = roundedComponentArea(project, component);
      row.querySelector('[data-component-area]').value = formatEditableNumber(roundedArea, 0);
      row.querySelector('[data-component-u]').value = formatEditableNumber(uInfo.value, 2);
      row.querySelector('[data-reset-area]').hidden = !areaInfo.isManual;
      row.querySelector('[data-reset-u]').hidden = !uInfo.isManual;
      row.querySelector('[data-area-detail]').textContent = `${ORIGIN_LABELS[areaInfo.origin] ?? 'offen'}${areaInfo.isManual && areaInfo.automaticValue !== null ? ` · Automatik ca. ${formatNumber(roundToStep(areaInfo.automaticValue, component.areaStep), 0)} m²` : ''}`;
      const uEvaluation = evaluateUValue(component.id, uInfo.value);
      const uDetail = row.querySelector('[data-u-detail]');
      uDetail.textContent = [
        ORIGIN_LABELS[uInfo.origin] ?? 'offen',
        uInfo.isManual && uInfo.automaticValue !== null ? `Fallback ${formatNumber(uInfo.automaticValue, 2)}` : null,
        uInfo.source && !uInfo.isManual ? uInfo.source : null,
        uEvaluation?.label ?? null,
      ].filter(Boolean).join(' · ');
      uDetail.dataset.evaluation = uEvaluation?.level ?? 'none';
      row.querySelector('[data-component-ua]').textContent = componentResult ? `${formatNumber(componentResult.uaWK, 0)} W/K` : '–';
      row.querySelector('[data-component-loss]').textContent = componentResult ? formatEnergy(componentResult.lossKwh) : '–';
      row.classList.toggle('is-disabled', !enabledInfo.value);
    });
  }

  function climateComparisonInputs(project) {
    const summary = project.modules?.klima?.climateSummary;
    const natC = hasValue(summary?.natC) ? finite(summary.natC, null) : null;
    const averageFullLoadHours = hasValue(summary?.metrics?.average_full_load_hours)
      ? finite(summary.metrics.average_full_load_hours, null)
      : null;
    return {
      natC,
      averageFullLoadHours,
      balanceTemperatureC: 15,
      period: summary?.period ?? null,
      source: summary?.source ?? null,
    };
  }

  function calculationInputs(project) {
    return {
      annualEnergyKwh: valueAt(project, 'consumption.heating.annualEnergy', 0),
      usefulHeatFactor: valueAt(project, 'systems.heating.usefulHeatFactor', 0.85),
      hotWaterIncluded: valueAt(project, 'systems.heating.hotWaterIncluded', true),
      persons: valueAt(project, 'usage.household.persons', 0),
      heatedFloorAreaM2: valueAt(project, 'building.geometry.heatedFloorArea', 0),
      grossFloorAreaM2: valueAt(project, 'building.geometry.grossFloorArea', 0),
      grossVolumeM3: valueAt(project, 'building.geometry.grossVolume', 0),
      indoorTemperatureC: valueAt(project, 'building.thermal.indoorTemperature', 20),
      heatedSharePercent: valueAt(project, 'building.thermal.heatedSharePercent', 100),
      climate: climateComparisonInputs(project),
      components: COMPONENTS.map((component) => ({
        id: component.id,
        label: component.label,
        enabled: valueAt(project, component.enabledPath, component.defaultEnabled),
        areaM2: roundedComponentArea(project, component),
        uValue: valueAt(project, component.uPath, 0),
      })),
      assumptions: {
        hotWaterKwhPerPerson: config.assumptions.hot_water_kwh_person_a,
        internalGainsWM2: config.assumptions.internal_gains_w_m2,
        solarRadiationFactor: config.assumptions.solar_radiation_factor_kwh_m2a,
        glazingShare: config.assumptions.glazing_share,
        solarUtilizationFactor: config.assumptions.solar_utilization_factor,
        ventilationLossKwhM3a: config.assumptions.ventilation_loss_kwh_m3a,
        thermalBridgeShare: config.assumptions.thermal_bridge_share,
      },
    };
  }

  function flowEntry(label, value, maximum, options = {}) {
    const percentage = maximum > 0 ? Math.max(0, Math.min(100, value / maximum * 100)) : 0;
    const classes = [
      'flow-entry',
      options.group ? 'flow-entry--group' : '',
      options.detail ? 'flow-entry--detail' : '',
    ].filter(Boolean).join(' ');
    const barClass = options.loss ? ' class="is-loss"' : '';
    return `<div class="${classes}"><div class="flow-entry__head"><span>${label}</span><strong>${formatEnergy(value)}</strong></div><div class="flow-bar"><i style="width:${percentage.toFixed(2)}%"${barClass}></i></div></div>`;
  }

  function renderComparison(result) {
    const plausibility = result.plausibility;
    const assessment = comparisonAssessment(plausibility.deviationPercent);
    const panel = $('comparisonPanel');
    panel.dataset.level = assessment.level;
    $('comparisonStatus').textContent = assessment.label;

    if (!plausibility.available) {
      $('calculatedDelivered').textContent = '–';
      $('modelDeviation').textContent = '–';
      $('modelDeviationNote').textContent = 'Klima einmal berechnen';
      $('comparisonText').textContent = 'Für den unabhängigen Hüllvergleich fehlen noch die standortbezogenen INCA-Klimakennwerte. Sie können direkt hier berechnet werden; die ausführliche Klimaauswertung ist dafür nicht erforderlich.';
      return;
    }

    $('calculatedDelivered').textContent = formatEnergy(plausibility.calculatedDeliveredKwh);
    $('modelDeviation').textContent = formatSignedPercent(plausibility.deviationPercent);
    $('modelDeviationNote').textContent = assessment.note;
    const direction = plausibility.deviationPercent > 0 ? 'über' : plausibility.deviationPercent < 0 ? 'unter' : 'bei';
    const roundedAbsolute = Math.round(Math.abs(plausibility.deviationPercent) / 5) * 5;
    const period = plausibility.period ? `, INCA ${plausibility.period}` : '';
    $('comparisonText').textContent = `Das Hüllmodell liegt rund ${number0.format(roundedAbsolute)} % ${direction} dem eingegebenen Heizenergieverbrauch. Rechnerischer HWB: ${formatSpecific(plausibility.calculatedHwbKwhM2a)}${period}; Bilanztemperatur 15 °C.`;
  }

  function renderResults(project, result) {
    $('hwbConsumption').textContent = formatSpecific(result.consumption.hwbConsumptionKwhM2a);
    $('hwbCorrected').textContent = formatSpecific(result.consumption.hwbCorrectedKwhM2a);
    $('totalUa').textContent = `${formatNumber(result.envelope.totalUaWK, 0)} W/K`;
    $('calibrationFactor').textContent = result.envelope.calibrationKwhPerWK > 0
      ? `${formatNumber(result.envelope.calibrationKwhPerWK, 1)} kWh/(W/K)a`
      : '–';
    $('componentLossTotal').textContent = formatEnergy(result.losses.componentsKwh);
    $('flowTotal').textContent = formatEnergy(result.gains.totalKwh);

    const gainItems = [
      ['Interne Gewinne', result.gains.internalKwh],
      ['Solare Gewinne', result.gains.solarKwh],
      ['Heizenergieverbrauch', result.gains.deliveredKwh],
    ];
    $('gainFlow').innerHTML = gainItems
      .map(([label, value]) => flowEntry(label, value, result.gains.totalKwh))
      .join('');

    const componentDetails = result.envelope.components
      .filter((item) => item.enabled && item.lossKwh > 0)
      .map((item) => flowEntry(item.label, item.lossKwh, result.losses.totalKwh, { loss: true, detail: true }))
      .join('');
    const lossHtml = [
      flowEntry('Gebäudehülle', result.losses.componentsKwh, result.losses.totalKwh, { loss: true, group: true }),
      componentDetails,
      flowEntry('Wärmebrücken', result.losses.thermalBridgesKwh, result.losses.totalKwh, { loss: true }),
      flowEntry('Lüftung', result.losses.ventilationKwh, result.losses.totalKwh, { loss: true }),
      flowEntry('Anlage', result.losses.systemKwh, result.losses.totalKwh, { loss: true }),
      result.losses.hotWaterKwh > 0
        ? flowEntry('Warmwasser', result.losses.hotWaterKwh, result.losses.totalKwh, { loss: true })
        : '',
    ].join('');
    $('lossFlow').innerHTML = `${lossHtml}<small class="flow-detail-note">Eingerückte Bauteile sind die Aufschlüsselung der Gebäudehülle und werden nicht zusätzlich summiert.</small>`;

    renderComparison(result);

    const warnings = $('v4Warnings');
    warnings.hidden = result.warnings.length === 0;
    warnings.innerHTML = result.warnings.map((warning) => `<p>${warning}</p>`).join('');
    const balanced = Math.abs(result.balanceDifferenceKwh) < 1;
    $('balanceBadge').textContent = balanced ? 'Bilanz ausgeglichen' : `Differenz ${formatEnergy(result.balanceDifferenceKwh)}`;
    $('balanceBadge').classList.toggle('section-badge--berry', !balanced);

    renderEnvelopeRows(project, result);
    buildPrintReport(project, result);
  }

  function resultSnapshot(result, fingerprint) {
    return {
      version: core.MODEL_VERSION,
      defaultsDataDate: config.data_date ?? null,
      inputFingerprint: fingerprint,
      updatedAt: new Date().toISOString(),
      resultSummary: {
        annualEnergyKwh: result.inputs.annualEnergyKwh,
        usefulRoomHeatKwh: result.consumption.roomHeatKwh,
        hwbConsumptionKwhM2a: result.consumption.hwbConsumptionKwhM2a,
        hwbCorrectedKwhM2a: result.consumption.hwbCorrectedKwhM2a,
        specificDeliveredKwhM2a: result.consumption.specificDeliveredKwhM2a,
        componentLossKwh: result.losses.componentsKwh,
        ventilationLossKwh: result.losses.ventilationKwh,
        systemLossKwh: result.losses.systemKwh,
        hotWaterKwh: result.losses.hotWaterKwh,
        totalUaWK: result.envelope.totalUaWK,
        calibrationKwhPerWK: result.envelope.calibrationKwhPerWK,
        components: result.envelope.components.map((item) => ({ id: item.id, areaM2: item.areaM2, uValue: item.uValue, enabled: item.enabled, uaWK: item.uaWK, lossKwh: item.lossKwh })),
        plausibility: {
          available: result.plausibility.available,
          calculatedDeliveredKwh: result.plausibility.calculatedDeliveredKwh,
          calculatedHwbKwhM2a: result.plausibility.calculatedHwbKwhM2a,
          deviationPercent: result.plausibility.deviationPercent,
          climatePeriod: result.plausibility.period,
        },
      },
    };
  }

  function persistResult(project, result, fingerprint) {
    const existing = project.modules?.energiefluss?.inputFingerprint;
    const hwbField = project.building?.thermal?.consumptionHwb;
    const roomHeatField = project.consumption?.heating?.usefulRoomHeatAnnual;
    const updates = [];
    if (!sameCandidate(hwbField, model.ORIGIN.DERIVED, result.consumption.hwbCorrectedKwhM2a)) {
      updates.push({ path: 'building.thermal.consumptionHwb', origin: model.ORIGIN.DERIVED, value: result.consumption.hwbCorrectedKwhM2a, options: { unit: 'kWh/m²a', source: 'Energiefluss V4.3', method: 'verbrauchsbasiert, raumtemperatur- und flächenkorrigiert' } });
    }
    if (!sameCandidate(roomHeatField, model.ORIGIN.DERIVED, result.consumption.roomHeatKwh)) {
      updates.push({ path: 'consumption.heating.usefulRoomHeatAnnual', origin: model.ORIGIN.DERIVED, value: result.consumption.roomHeatKwh, options: { unit: 'kWh/a', source: 'Energiefluss V4.3', method: 'Verbrauch × Nutzungsgrad − Warmwasser' } });
    }
    if (updates.length) store.setFieldCandidates(updates);
    if (existing !== fingerprint) store.patch({ modules: { energiefluss: resultSnapshot(result, fingerprint) } });
  }

  function renderProject(project) {
    if (ensureFallbackCandidates(project)) return;
    rendering = true;
    document.querySelectorAll('.v4-value-field').forEach((host) => renderValueField(host, project));
    const inputs = calculationInputs(project);
    const result = core.calculate(inputs);
    const fingerprint = hashText(JSON.stringify({ inputs, dataDate: config.data_date, modelVersion: core.MODEL_VERSION }));
    lastResult = result;
    lastResultFingerprint = fingerprint;
    renderResults(project, result);
    renderGeometryStatus(project);
    rendering = false;
    persistResult(project, result, fingerprint);
  }

  function renderGeometryStatus(project) {
    const chip = $('geometryStatus');
    const objectId = project.building?.identity?.objectId;
    const footprintInfo = describeAt(project, 'building.geometry.footprintArea');
    if (objectId) {
      chip.textContent = `TIRIS Gebäude ${objectId}`;
      chip.className = 'status-chip is-success';
    } else if (footprintInfo.origin === model.ORIGIN.DERIVED || footprintInfo.origin === model.ORIGIN.OFFICIAL) {
      chip.textContent = 'Projektgeometrie vorhanden';
      chip.className = 'status-chip is-success';
    } else {
      chip.textContent = 'sichtbare Fallbackgeometrie';
      chip.className = 'status-chip';
    }
  }

  function preserveManualFields(next, previous) {
    if (Array.isArray(next)) return clone(next);
    if (!next || typeof next !== 'object') return clone(next);
    const output = clone(next);
    Object.entries(previous ?? {}).forEach(([key, oldValue]) => {
      if (resolver.isField(oldValue)) {
        const manual = oldValue.candidates?.[model.ORIGIN.MANUAL];
        if (!manual) return;
        const base = resolver.isField(output[key]) ? output[key] : model.field(null, { unit: oldValue.unit ?? null });
        base.candidates = { ...(base.candidates ?? {}), [model.ORIGIN.MANUAL]: clone(manual) };
        output[key] = model.finalizeField(base);
      } else if (oldValue && typeof oldValue === 'object' && !Array.isArray(oldValue)) {
        output[key] = preserveManualFields(output[key] ?? {}, oldValue);
      }
    });
    return output;
  }

  function applyBuildingFeature(feature, selectionMode = 'manual') {
    const current = store.get();
    const next = geometryService.toProjectBuilding(feature, selectionMode);
    const merged = preserveManualFields(next, current.building);
    store.setPath('building', merged);
    $('v4BuildingCandidates').hidden = true;
    $('geometryStatus').textContent = `Gebäude ${feature.attributes?.OBJECTID ?? ''} übernommen`;
    $('geometryStatus').className = 'status-chip is-success';
  }

  function renderBuildingCandidates(result) {
    const host = $('v4BuildingCandidates');
    if (!result.features.length) {
      host.hidden = true;
      $('geometryStatus').textContent = 'kein TIRIS-Gebäude gefunden';
      $('geometryStatus').className = 'status-chip';
      return;
    }
    host.hidden = false;
    host.innerHTML = `<strong>Gebäude bitte prüfen</strong>${result.features.map((feature, index) => {
      const item = geometryService.candidateSummary(feature, index);
      return `<button type="button" data-building-index="${index}"><strong>${item.label}</strong><small>${item.areaM2 !== null ? `${formatNumber(item.areaM2, 0)} m² Dachprojektion` : 'Fläche unbekannt'}${item.medianHeightM !== null ? ` · Medianhöhe ${formatNumber(item.medianHeightM, 1)} m` : ''}${Number.isFinite(item.distanceM) ? ` · ca. ${formatNumber(item.distanceM, 0)} m vom Adresspunkt` : ''}</small></button>`;
    }).join('')}`;
    host.querySelectorAll('[data-building-index]').forEach((button) => {
      button.addEventListener('click', () => applyBuildingFeature(result.features[Number(button.dataset.buildingIndex)], 'manual'));
    });
  }

  async function loadGeometryForAddress(address) {
    $('geometryStatus').textContent = 'Gebäude wird zugeordnet …';
    $('geometryStatus').className = 'status-chip is-working';
    try {
      const result = await geometryService.findCandidates(address, { maxRadiusM: 30 });
      if (result.automaticallySelected) {
        applyBuildingFeature(result.automaticallySelected, 'automatic');
      } else {
        renderBuildingCandidates(result);
      }
    } catch (error) {
      $('geometryStatus').textContent = 'Gebäudeabfrage fehlgeschlagen';
      $('geometryStatus').className = 'status-chip is-error';
      $('v4AddressStatus').textContent = `Adresse wurde übernommen; TIRIS-Gebäude konnte nicht geladen werden: ${error.message}`;
    }
  }

  function compactAddress(address) {
    const keys = ['id', 'label', 'street', 'house_number', 'postal_code', 'municipality', 'municipality_code', 'locality', 'latitude', 'longitude', 'address_latitude', 'address_longitude', 'coordinate_kind', 'cadastral_municipality_number', 'cadastral_municipality_numbers', 'source', 'source_id', 'dataset_date', 'license', 'address_code', 'subcode', 'tiris_layer_id', 'tiris_layer_label'];
    const result = {};
    keys.forEach((key) => { if (address?.[key] !== undefined && address?.[key] !== null) result[key] = clone(address[key]); });
    return result;
  }

  async function selectAddress(address) {
    const permission = await addressManager.requestSelection(address);
    if (!permission.allowed) return;
    $('v4AddressStatus').textContent = 'Adresse wird mit TIRIS live abgeglichen …';
    let resolution = { address, mode: 'bev-fallback', usedFallback: true };
    try { resolution = await hybridAddressProvider.resolve(address); } catch (error) { console.warn(error); }
    const selected = resolution.address || address;
    const source = selected.source || 'Gemeinsame Adresssuche';
    store.patch({
      project: { addressLabel: selected.label },
      location: {
        addressRecord: compactAddress(selected),
        address: model.field(selected.label, { origin: model.ORIGIN.OFFICIAL, source, dataDate: selected.dataset_date ?? null }),
        latitude: model.field(Number(selected.latitude), { unit: '°', origin: model.ORIGIN.OFFICIAL, source }),
        longitude: model.field(Number(selected.longitude), { unit: '°', origin: model.ORIGIN.OFFICIAL, source }),
        municipality: model.field(selected.municipality || null, { origin: model.ORIGIN.OFFICIAL, source }),
        municipalityCode: model.field(selected.municipality_code || null, { origin: model.ORIGIN.OFFICIAL, source }),
      },
    });
    $('v4AddressInput').value = selected.label;
    $('v4AddressResults').hidden = true;
    $('v4AddressStatus').textContent = resolution.usedFallback
      ? (resolution.warning || 'BEV-Adresse übernommen; kein eindeutiger TIRIS-Live-Treffer.')
      : 'TIRIS-Live-Adresse übernommen.';
    await loadGeometryForAddress(selected);
  }

  function renderAddressResults(results, guidance = '') {
    const host = $('v4AddressResults');
    if (!results.length) {
      host.hidden = !guidance;
      host.innerHTML = guidance ? `<small>${guidance}</small>` : '';
      return;
    }
    host.hidden = false;
    host.innerHTML = results.map((address, index) => `<button type="button" data-address-index="${index}"><strong>${address.label}</strong><small>${address.source || 'Adressvorschlag'}${address.dataset_date ? ` · Stand ${address.dataset_date}` : ''}</small></button>`).join('');
    host.querySelectorAll('[data-address-index]').forEach((button) => {
      button.addEventListener('click', () => selectAddress(results[Number(button.dataset.addressIndex)]));
    });
  }

  async function searchAddress(query) {
    const sequence = ++addressSearchSequence;
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 3) {
      renderAddressResults([], 'Mindestens drei Zeichen eingeben.');
      return;
    }
    $('v4AddressStatus').textContent = 'Adressvorschläge werden geladen …';
    try {
      const result = await hybridAddressProvider.search(normalizedQuery, { limit: 8 });
      if (sequence !== addressSearchSequence) return;
      renderAddressResults(result.results ?? [], result.guidance ?? '');
      $('v4AddressStatus').textContent = result.results?.length
        ? 'Adresse auswählen. Danach wird das TIRIS-Gebäude automatisch geprüft.'
        : (result.guidance || 'Keine Adresse gefunden.');
    } catch (error) {
      if (sequence !== addressSearchSequence) return;
      renderAddressResults([], error.message);
      $('v4AddressStatus').textContent = `Adresssuche fehlgeschlagen: ${error.message}`;
    }
  }

  async function initAddressSearch() {
    const input = $('v4AddressInput');
    const localProvider = new global.BevLocalAddressProvider();
    const liveProvider = new global.TirisLiveAddressProvider();
    hybridAddressProvider = new global.HybridAddressProvider({ suggestionProvider: localProvider, liveProvider });
    try {
      await hybridAddressProvider.init();
      $('v4AddressStatus').textContent = '';
    } catch (error) {
      $('v4AddressStatus').textContent = `Adressindex konnte nicht geladen werden: ${error.message}`;
    }

    const projectAddress = store.get().project?.addressLabel || '';
    input.value = projectAddress;
    input.addEventListener('input', () => {
      global.clearTimeout(addressSearchTimer);
      const visibleText = input.value;
      addressSearchTimer = global.setTimeout(() => searchAddress(visibleText), 280);
    });
    $('v4UseProjectAddress').addEventListener('click', () => {
      const project = store.get();
      const record = project.location?.addressRecord;
      if (!record) {
        $('v4AddressStatus').textContent = 'Im Projekt ist noch keine bestätigte Adresse mit Koordinaten vorhanden.';
        return;
      }
      input.value = record.label || project.project?.addressLabel || '';
      loadGeometryForAddress(record);
    });
  }

  function printFlowEntry(label, value, maximum, options = {}) {
    const width = maximum > 0 ? Math.min(100, Math.max(0, value / maximum * 100)) : 0;
    const classes = [
      'print-flow-entry',
      options.group ? 'print-flow-entry--group' : '',
      options.detail ? 'print-flow-entry--detail' : '',
    ].filter(Boolean).join(' ');
    const background = options.loss
      ? (options.detail ? 'var(--color-secondary-light)' : 'var(--color-secondary)')
      : 'var(--color-primary)';
    return `<div class="${classes}"><div><span>${label}</span><strong>${formatEnergy(value)}</strong></div><div class="print-flow-bar"><i style="width:${width.toFixed(2)}%;background:${background}"></i></div></div>`;
  }

  function printOrigin(info) {
    return ORIGIN_LABELS[info.origin] ?? 'offen';
  }

  function printComparison(result) {
    const plausibility = result.plausibility;
    if (!plausibility.available) {
      return {
        calculated: '–',
        deviation: '–',
        note: 'Klimadaten fehlen; direkt im Energiefluss berechnen.',
      };
    }
    const assessment = comparisonAssessment(plausibility.deviationPercent);
    return {
      calculated: formatEnergy(plausibility.calculatedDeliveredKwh),
      deviation: formatSignedPercent(plausibility.deviationPercent),
      note: `${assessment.label} · rechnerischer HWB ${formatSpecific(plausibility.calculatedHwbKwhM2a)} · INCA ${plausibility.period ?? 'Projektklima'}`,
    };
  }

  function buildPrintReport(project, result) {
    const address = project.project?.addressLabel || 'Kein Standort gewählt';
    const gainsHtml = [
      printFlowEntry('Interne Gewinne', result.gains.internalKwh, result.gains.totalKwh),
      printFlowEntry('Solare Gewinne', result.gains.solarKwh, result.gains.totalKwh),
      printFlowEntry('Heizenergieverbrauch', result.gains.deliveredKwh, result.gains.totalKwh),
    ].join('');
    const componentDetails = result.envelope.components
      .filter((item) => item.enabled && item.lossKwh > 0)
      .map((item) => printFlowEntry(item.label, item.lossKwh, result.losses.totalKwh, { loss: true, detail: true }))
      .join('');
    const lossesHtml = [
      printFlowEntry('Gebäudehülle', result.losses.componentsKwh, result.losses.totalKwh, { loss: true, group: true }),
      componentDetails,
      printFlowEntry('Wärmebrücken', result.losses.thermalBridgesKwh, result.losses.totalKwh, { loss: true }),
      printFlowEntry('Lüftung', result.losses.ventilationKwh, result.losses.totalKwh, { loss: true }),
      printFlowEntry('Anlage', result.losses.systemKwh, result.losses.totalKwh, { loss: true }),
      result.losses.hotWaterKwh > 0
        ? printFlowEntry('Warmwasser', result.losses.hotWaterKwh, result.losses.totalKwh, { loss: true })
        : '',
    ].join('');
    const comparison = printComparison(result);

    const constructionYear = valueAt(project, 'building.profile.constructionYear', null);
    const baseData = [
      ['Baujahr / Baubewilligung', constructionYear ? formatNumber(constructionYear, 0) : '–', printOrigin(describeAt(project, 'building.profile.constructionYear'))],
      ['Beheizte Nutzfläche', `${formatNumber(result.inputs.heatedFloorAreaM2)} m²`, printOrigin(describeAt(project, 'building.geometry.heatedFloorArea'))],
      ['BGF', `${formatNumber(result.inputs.grossFloorAreaM2)} m²`, printOrigin(describeAt(project, 'building.geometry.grossFloorArea'))],
      ['Volumen', `${formatNumber(result.inputs.grossVolumeM3)} m³`, printOrigin(describeAt(project, 'building.geometry.grossVolume'))],
      ['Personen', formatNumber(result.inputs.persons), printOrigin(describeAt(project, 'usage.household.persons'))],
      ['Verbrauch', `${formatNumber(result.inputs.annualEnergyKwh)} kWh/a`, printOrigin(describeAt(project, 'consumption.heating.annualEnergy'))],
      ['JNG', formatNumber(result.inputs.usefulHeatFactor, 2), printOrigin(describeAt(project, 'systems.heating.usefulHeatFactor'))],
      ['Raumtemperatur', `${formatNumber(result.inputs.indoorTemperatureC, 1)} °C`, printOrigin(describeAt(project, 'building.thermal.indoorTemperature'))],
      ['Beheizter Anteil', `${formatNumber(result.inputs.heatedSharePercent)} %`, printOrigin(describeAt(project, 'building.thermal.heatedSharePercent'))],
    ];

    const envelopeRows = result.envelope.components.map((item) => {
      const component = COMPONENTS.find((entry) => entry.id === item.id);
      const areaInfo = describeAt(project, component.areaPath);
      const uInfo = describeAt(project, component.uPath);
      return `<tr><td>${item.enabled ? 'ja' : 'nein'}</td><td><strong>${item.label}</strong></td><td>${formatNumber(item.areaM2)} m²<br><small>${printOrigin(areaInfo)}</small></td><td>${formatNumber(item.uValue, 2)} W/m²K<br><small>${printOrigin(uInfo)}</small></td><td>${formatNumber(item.uaWK)} W/K</td><td>${formatEnergy(item.lossKwh)}</td></tr>`;
    }).join('');

    $('v4PrintReport').innerHTML = `
      <div class="v4-print-page">
        <div class="print-title"><div><h1>Energiefluss im Gebäude · V4.3</h1><small>${address}</small></div><p>Verbrauchsbasierte Beratungsauswertung mit unabhängigem Hüllvergleich. Kein Ersatz für Energieausweis oder Bauteilberechnung.</p></div>
        <div class="print-flow">
          <div><h2>Einträge</h2>${gainsHtml}</div>
          <div class="print-house"><img src="../../shared/assets/energy-flow-house.svg" alt=""><strong>${formatEnergy(result.gains.totalKwh)}</strong></div>
          <div><h2>Verluste</h2>${lossesHtml}<small class="print-detail-note">Bauteile = Aufschlüsselung der Gebäudehülle</small></div>
        </div>
        <div class="print-kpis">
          <article><span>HWB aus Verbrauch</span><strong>${formatSpecific(result.consumption.hwbConsumptionKwhM2a)}</strong><small>Raumwärme / BGF</small></article>
          <article><span>HWB korrigiert</span><strong>${formatSpecific(result.consumption.hwbCorrectedKwhM2a)}</strong><small>Temperatur + beheizter Anteil</small></article>
          <article><span>Rechnerischer Verbrauch</span><strong>${comparison.calculated}</strong><small>U × A + Klima</small></article>
          <article><span>Abweichung</span><strong>${comparison.deviation}</strong><small>Plausibilitätsvergleich</small></article>
        </div>
        <p class="print-note">${comparison.note} Der gemessene Verbrauch bleibt die farbige Bilanzbasis; das Hüllmodell wird nicht daran kalibriert.</p>
        <section class="print-section"><h2>Projekt- und Verbrauchsbasis</h2><div class="print-data-grid">${baseData.map(([label, value, origin]) => `<div><span>${label}</span><strong>${value}</strong><small>${origin}</small></div>`).join('')}</div></section>
      </div>
      <div class="v4-print-page">
        <div class="print-title"><div><h1>Gebäudehülle und Datenbasis</h1><small>${address}</small></div><p>Automatische, abgeleitete und manuelle Werte bleiben unterscheidbar.</p></div>
        <section class="print-section"><h2>Bauteile</h2><table class="print-envelope"><thead><tr><th>Aktiv</th><th>Bauteil</th><th>Fläche</th><th>U-Wert</th><th>UA</th><th>Verlust</th></tr></thead><tbody>${envelopeRows}</tbody></table></section>
        <section class="print-section"><h2>Zusammenfassung</h2><div class="print-data-grid"><div><span>Summe UA</span><strong>${formatNumber(result.envelope.totalUaWK)} W/K</strong></div><div><span>Kalibrierfaktor</span><strong>${formatNumber(result.envelope.calibrationKwhPerWK, 1)} kWh/(W/K)a</strong></div><div><span>Gebäudehülle</span><strong>${formatEnergy(result.losses.componentsKwh)}</strong></div><div><span>Wärmebrücken</span><strong>${formatEnergy(result.losses.thermalBridgesKwh)}</strong></div></div></section>
        <p class="print-footer-note">Modell ${core.MODEL_VERSION} · Fallback-Datenstand ${config.data_date ?? '–'} · U-Wert-Vorschläge aus shared/data/building/existing-u-values.json; Zustandsfallbacks aus energy-flow-v4-defaults.json · Hüllvergleich mit INCA-Heizgradstunden zur Bilanztemperatur 15 °C; Klimawerte können direkt im Energiefluss berechnet werden.</p>
      </div>`;
  }

  function normalizedProjectAddress(project) {
    const record = project?.location?.addressRecord ?? {};
    const latitude = finite(record.latitude ?? valueAt(project, 'location.latitude'), null);
    const longitude = finite(record.longitude ?? valueAt(project, 'location.longitude'), null);
    const label = record.label ?? project?.project?.addressLabel ?? valueAt(project, 'location.address', '');
    if (!label || latitude === null || longitude === null) return null;

    const projectKg = valueAt(project, 'location.cadastralMunicipalityNumber', null);
    const kgNumber = projectKg ?? record.cadastral_municipality_number ?? null;
    const sourceRecord = {
      ...record,
      id: record.id ?? record.source_id ?? `project-${latitude}-${longitude}`,
      label,
      latitude,
      longitude,
      cadastral_municipality_number: kgNumber ? String(kgNumber) : null,
      cadastral_municipality_numbers: kgNumber
        ? [String(kgNumber)]
        : (Array.isArray(record.cadastral_municipality_numbers) ? record.cadastral_municipality_numbers : []),
      source: record.source ?? 'Gemeinsames Projekt',
      coordinate_kind: record.coordinate_kind ?? 'building',
    };
    return addressCore?.standardizeAddress
      ? addressCore.standardizeAddress(sourceRecord, 'Gemeinsames Projekt')
      : sourceRecord;
  }

  function climateLocationFromProject(project) {
    const address = normalizedProjectAddress(project);
    if (!address) throw new Error('Bitte zuerst eine bestätigte Adresse mit Koordinaten auswählen.');
    if (!oibNatCore || !precomputedClimateCore) {
      throw new Error('OIB- oder INCA-Klimamodul wurde nicht geladen.');
    }

    const natLookup = oibNatCore.lookupAddress(address);
    if (natLookup?.status !== 'exact' || !natLookup.reference) {
      const reason = natLookup?.message ?? 'Die Katastralgemeinde konnte nicht eindeutig bestimmt werden.';
      throw new Error(`${reason} Bitte die KG im Klima-Tool einmal eindeutig auswählen.`);
    }
    const nat = natLookup.reference;
    const tnatLookup = oibTnat13Core?.lookupAddress(address);
    const tnat = tnatLookup?.status === 'exact' ? tnatLookup.reference : null;

    return {
      id: address.id ?? `project-${address.latitude}-${address.longitude}`,
      name: project.project?.title || address.label,
      address_label: address.label,
      address,
      latitude: Number(address.latitude),
      longitude: Number(address.longitude),
      kg_number: nat.kg_number ?? address.cadastral_municipality_number ?? null,
      kg_name: nat.kg_name ?? valueAt(project, 'location.cadastralMunicipalityName', null),
      nat_c: Number(nat.nat_at_elevation_min_c),
      nat_reference_height_m: Number(nat.elevation_min_m),
      nat_reference_max_height_m: Number(nat.elevation_max_m),
      climate_region: nat.climate_region ?? null,
      tnat13_c: tnat ? Number(tnat.tnat13_at_elevation_min_c ?? tnat.tnat13_c) : null,
    };
  }

  async function calculateClimateHere() {
    if (climateCalculationRunning) return;
    const button = $('calculateClimateHere');
    climateCalculationRunning = true;
    button.disabled = true;
    button.textContent = 'Klimawerte werden berechnet …';
    $('comparisonPanel').dataset.level = 'missing';
    $('comparisonStatus').textContent = 'INCA-Klimadaten werden geladen';
    $('comparisonText').textContent = 'Die vorhandenen Jahrespakete werden für die Projektadresse ausgewertet. Große Klimadateien werden dabei nur bei Bedarf geladen.';

    try {
      const project = store.get();
      const location = climateLocationFromProject(project);
      const loaded = await precomputedClimateCore.loadForLocation(location);
      const result = loaded?.result;
      if (!result) {
        const missingYears = loaded?.parts?.missingYears ?? [];
        const detail = missingYears.length
          ? `Es fehlen Jahrespakete: ${missingYears.join(', ')}.`
          : (loaded?.parts?.errors?.[0]?.message ?? 'Für den Standort wurde kein vollständiges INCA-Profil gefunden.');
        throw new Error(detail);
      }

      const years = Array.isArray(result.data?.years) ? result.data.years.map(Number).filter(Number.isFinite) : [];
      const period = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : null;
      store.patch({
        modules: {
          klima: {
            climateSummary: {
              period,
              source: result.data?.source ?? null,
              natC: result.location?.nat_c ?? location.nat_c,
              tnat13C: result.location?.tnat13_c ?? location.tnat13_c,
              metrics: clone(result.metrics ?? {}),
              gridLatitude: result.location?.grid_latitude ?? null,
              gridLongitude: result.location?.grid_longitude ?? null,
              precomputedDistanceM: result.location?.precomputed_distance_m ?? null,
              calculationMode: 'energiefluss-v4-direct',
              updatedAt: new Date().toISOString(),
            },
            updatedAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      console.error('Energiefluss V4: Klimawerte konnten nicht berechnet werden.', error);
      $('comparisonPanel').dataset.level = 'warning';
      $('comparisonStatus').textContent = 'Klimaberechnung nicht möglich';
      $('comparisonText').textContent = error.message;
    } finally {
      climateCalculationRunning = false;
      button.disabled = false;
      button.textContent = 'Klimawerte berechnen';
    }
  }

  async function loadJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function loadConfig() {
    const defaultsUrl = paths?.href('standards/energy-flow-v4-defaults.json', new URL(paths.sharedData))
      ?? '../../shared/data/standards/energy-flow-v4-defaults.json';
    const existingUUrl = paths?.href('building/existing-u-values.json', new URL(paths.sharedData))
      ?? '../../shared/data/building/existing-u-values.json';
    const evaluationUrl = paths?.href('building/envelope-evaluation.json', new URL(paths.sharedData))
      ?? '../../shared/data/building/envelope-evaluation.json';

    const [defaultsResult, existingResult, evaluationResult] = await Promise.allSettled([
      loadJson(defaultsUrl),
      loadJson(existingUUrl),
      loadJson(evaluationUrl),
    ]);

    if (defaultsResult.status === 'fulfilled') config = defaultsResult.value;
    else {
      console.warn('Energiefluss V4: zentrale Fallback-Datendatei nicht geladen; eingebettete Werte werden verwendet.', defaultsResult.reason);
      config = DEFAULT_CONFIG;
    }

    if (existingResult.status === 'fulfilled') existingUValuesConfig = existingResult.value;
    else console.warn('Energiefluss V4: Bauperioden-U-Werte konnten nicht geladen werden.', existingResult.reason);

    if (evaluationResult.status === 'fulfilled') envelopeEvaluationConfig = evaluationResult.value;
    else console.warn('Energiefluss V4: U-Wert-Bewertung konnte nicht geladen werden.', evaluationResult.reason);
  }

  function initInfoTips() {
    const tips = [...document.querySelectorAll('.info-tip')];
    const closeAll = (except = null) => tips.forEach((tip) => {
      if (tip === except) return;
      tip.classList.remove('is-open');
      tip.setAttribute('aria-expanded', 'false');
    });

    tips.forEach((tip) => {
      tip.setAttribute('aria-expanded', 'false');
      tip.addEventListener('click', (event) => {
        event.stopPropagation();
        const opening = !tip.classList.contains('is-open');
        closeAll(tip);
        tip.classList.toggle('is-open', opening);
        tip.setAttribute('aria-expanded', String(opening));
      });
      tip.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        tip.classList.remove('is-open');
        tip.setAttribute('aria-expanded', 'false');
        tip.blur();
      });
    });
    document.addEventListener('click', () => closeAll());
  }

  async function init() {
    initInfoTips();
    document.querySelectorAll('.v4-value-field').forEach(buildValueField);
    buildEnvelopeRows();
    await loadConfig();
    await initAddressSearch();
    $('calculateClimateHere').addEventListener('click', calculateClimateHere);
    store.subscribe(renderProject);
    global.addEventListener('energy-tools:prepare-print', () => {
      if (lastResult) buildPrintReport(store.get(), lastResult);
    });
    global.addEventListener('energy-tools:project-imported', (event) => renderProject(event.detail?.project ?? store.get()));
    global.addEventListener('energy-tools:project-reset', () => {
      $('v4AddressInput').value = '';
      $('v4AddressResults').hidden = true;
      $('v4BuildingCandidates').hidden = true;
      renderProject(store.get());
    });
    renderProject(store.get());
  }

  init().catch((error) => {
    console.error(error);
    $('v4Warnings').hidden = false;
    $('v4Warnings').innerHTML = `<p>Energiefluss V4.3 konnte nicht initialisiert werden: ${error.message}</p>`;
  });
})(window);
