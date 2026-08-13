'use strict';

(function initEconomicsTool(global) {
  const store = global.EnergyToolsProjectStore;
  const model = global.EnergyToolsDataModel;
  const resolver = global.EnergyToolsValueResolver;
  const economics = global.EnergyEconomicsCore;
  const measureCore = global.EnvelopeRenovationCore;
  const paths = global.EnergyToolsPaths;
  const addressManager = global.EnergyToolsAddressManager;
  const geometryService = global.EnergyToolsBuildingGeometryService;

  if (!store || !model || !resolver || !economics || !measureCore || !paths || !addressManager || !geometryService) {
    console.error('Wirtschaftlichkeit: gemeinsame Projektbasis oder Rechenkern fehlt.');
    return;
  }

  const $ = (id) => document.getElementById(id);
  const money = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const number0 = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 0 });
  const number1 = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const CURRENT_YEAR = 2026;
  const HGT_FALLBACK_TIROL = 3500;

  const ORIGIN_LABEL = { manual: 'manuell', official: 'amtlich', derived: 'abgeleitet', fallback: 'Fallback' };
  const PRIORITY_LABEL = {
    costs: '€ Kosten', comfort: '♡ Komfort & Gesundheit', climate: '♻ Klimaschutz',
    independence: '⚡ Unabhängigkeit', value: '⌂ Werterhalt', effort: '⚒ wenig Aufwand',
  };
  const BUDGETS = {
    lt25: { label: '< 25 T€', min: 0, max: 25000 },
    '25-50': { label: '25–50 T€', min: 25000, max: 50000 },
    '50-100': { label: '50–100 T€', min: 50000, max: 100000 },
    gt100: { label: '> 100 T€', min: 100000, max: Infinity },
    open: { label: 'offen', min: null, max: null },
  };

  const QUICK_DEFINITIONS = [
    { id: 'wall', componentId: 'exteriorWall', dataId: 'wall_external', costModelId: 'wall_wdvs', label: 'Außenwand', areaPath: 'building.geometry.opaqueExteriorWallArea', uPath: 'building.thermal.envelope.exteriorWall.uValue', enabledPath: 'building.thermal.envelope.exteriorWall.enabled', defaultEnabled: true, flowId: 'exteriorWall', boundaryFactor: 1.0, kind: 'insulation' },
    { id: 'top-ceiling', componentId: 'topFloorCeiling', dataId: 'roof_top_ceiling', costModelId: 'top_ceiling', label: 'Oberste Geschoßdecke', areaPath: 'building.geometry.topFloorArea', uPath: 'building.thermal.envelope.topFloorCeiling.uValue', enabledPath: 'building.thermal.envelope.topFloorCeiling.enabled', defaultEnabled: true, flowId: 'topFloorCeiling', boundaryFactor: 0.8, kind: 'insulation' },
    { id: 'roof', componentId: 'roof', dataId: 'roof_top_ceiling', costModelId: 'roof', label: 'Dach / Dachschräge', areaPath: 'building.geometry.roofSlopeArea', uPath: 'building.thermal.envelope.roof.uValue', enabledPath: 'building.thermal.envelope.roof.enabled', defaultEnabled: false, flowId: 'roof', boundaryFactor: 1.0, kind: 'insulation' },
    { id: 'basement', componentId: 'basementCeiling', dataId: 'ceiling_unheated', costModelId: 'basement_ceiling', label: 'Kellerdecke / UG-Decke', areaPath: 'building.geometry.basementCeilingArea', uPath: 'building.thermal.envelope.basementCeiling.uValue', enabledPath: 'building.thermal.envelope.basementCeiling.enabled', defaultEnabled: true, flowId: 'basementCeiling', boundaryFactor: 0.5, kind: 'insulation' },
    { id: 'ground-floor', componentId: 'groundFloor', dataId: 'floor_ground', costModelId: 'ground_floor', label: 'Boden gegen Erdreich', areaPath: 'building.geometry.groundFloorArea', uPath: 'building.thermal.envelope.groundFloor.uValue', enabledPath: 'building.thermal.envelope.groundFloor.enabled', defaultEnabled: false, flowId: 'groundFloor', boundaryFactor: 0.5, kind: 'insulation' },
    { id: 'windows', componentId: 'windows', dataId: 'window_external', costModelId: 'window_replace', label: 'Fenster', areaPath: 'building.geometry.windowArea', uPath: 'building.thermal.envelope.windows.uValue', enabledPath: 'building.thermal.envelope.windows.enabled', defaultEnabled: true, flowId: 'windows', boundaryFactor: 1.0, kind: 'exchange' },
    { id: 'doors', componentId: 'doors', dataId: 'door_external', costModelId: 'door_replace', label: 'Haustür / Außentür', areaPath: 'building.geometry.doorArea', uPath: 'building.thermal.envelope.doors.uValue', enabledPath: 'building.thermal.envelope.doors.enabled', defaultEnabled: true, flowId: 'doors', boundaryFactor: 1.0, kind: 'door' },
    { id: 'heating', componentId: 'heating', label: 'Heizung fossilfrei', systemCostId: 'heat_pump_air', manualOnly: true },
    { id: 'pv', componentId: 'pv', label: 'PV-Anlage', systemCostId: 'pv_standard', manualOnly: true, informational: true },
  ];

  let financeConfig = null;
  let energyPrices = null;
  let costConfig = null;
  let systemCostConfig = null;
  let lifetimeConfig = null;
  let targetsConfig = null;
  let coBenefits = null;
  let existingUValuesConfig = null;
  let exchangeVariantsConfig = null;
  let measures = [];
  let currentComparison = null;
  let suppressRender = false;
  let hybridAddressProvider = null;
  let addressTimer = null;
  let addressSequence = 0;
  let pendingAddress = null;

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function finite(value, fallback = null) { if (value === '' || value === null || value === undefined) return fallback; const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function getPath(obj, path, fallback = null) { const value = String(path).split('.').reduce((cursor, key) => cursor?.[key], obj); return value === undefined ? fallback : value; }
  function valueAt(project, path, fallback = null) { return resolver.value(getPath(project, path), fallback); }
  function describeAt(project, path) { return resolver.describe(getPath(project, path)); }
  function roundTo(value, step) { if (!Number.isFinite(Number(value))) return null; return Math.round(Number(value) / step) * step; }
  function formatMoney(value, step = 500) { const rounded = roundTo(value, step); return rounded === null ? '–' : money.format(rounded); }
  function formatSignedMoney(value, step = 500) { const rounded = roundTo(value, step); if (rounded === null) return '–'; return `${rounded >= 0 ? '+' : '−'} ${money.format(Math.abs(rounded))}`; }
  function formatEnergy(value, step = 10) { return Number.isFinite(Number(value)) ? `${number0.format(roundTo(value, step))} kWh/a` : '–'; }
  function formatArea(value) { return Number.isFinite(Number(value)) ? `${number0.format(roundTo(value, 5))} m²` : '–'; }
  function escapeHtml(value) { return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
  function hasOwn(obj, key) { return Boolean(obj && Object.prototype.hasOwnProperty.call(obj, key)); }

  async function fetchJson(path) {
    const response = await fetch(new URL(path, paths.sharedData));
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }

  async function loadConfigs() {
    [financeConfig, energyPrices, costConfig, systemCostConfig, lifetimeConfig, targetsConfig, coBenefits, existingUValuesConfig, exchangeVariantsConfig] = await Promise.all([
      fetchJson('economics/financial-defaults.json'),
      fetchJson('economics/energy-prices.json'),
      fetchJson('costs/renovation-costs.json'),
      fetchJson('costs/system-costs.json'),
      fetchJson('standards/economics/component-lifetimes.json'),
      fetchJson('measures/envelope-targets.json'),
      fetchJson('measures/co-benefits.json'),
      fetchJson('building/existing-u-values.json'),
      fetchJson('measures/exchange-variants.json'),
    ]);
  }

  function carrierItem(id) { return (energyPrices?.items ?? []).find((item) => item.id === id) ?? energyPrices?.items?.[0] ?? null; }
  function systemCost(id) { return (systemCostConfig?.items ?? []).find((item) => item.id === id && item.active !== false) ?? null; }
  function costModel(id) { return (costConfig?.models ?? []).find((item) => item.id === id && item.active !== false) ?? null; }
  function lifetimeFor(id) { return (lifetimeConfig?.items ?? []).find((item) => item.cost_model_id === id && item.active !== false) ?? null; }
  function flowComponent(project, id) { return project.modules?.energiefluss?.resultSummary?.components?.find((item) => item.id === id) ?? null; }

  function currentCarrier(project) {
    return valueAt(project, 'systems.heating.energyCarrier', null)
      ?? project.modules?.wirtschaftlichkeit?.draft?.carrierId
      ?? project.modules?.bauteilSanierung?.drafts?.exteriorWall?.energyCarrierId
      ?? 'oil';
  }
  function currentEnergyPrice(project, carrierId) {
    const override = finite(project.economics?.energyPriceOverrides?.[carrierId], null);
    return override ?? finite(carrierItem(carrierId)?.price, 0);
  }
  function currentAssumptions(project) {
    const d = financeConfig?.defaults ?? {};
    return {
      periodYears: finite(project.economics?.assumptions?.periodYears, d.period_years ?? 30),
      interestRatePercent: finite(project.economics?.assumptions?.interestRatePercent, d.interest_rate_percent ?? 2.5),
      energyEscalationPercent: finite(project.economics?.assumptions?.energyEscalationPercent, d.energy_price_escalation_percent ?? 2.7),
      buildingEscalationPercent: finite(project.economics?.assumptions?.buildingEscalationPercent, d.investment_price_escalation_percent ?? 2),
      technicalEscalationPercent: finite(project.economics?.assumptions?.technicalEscalationPercent, d.technical_component_price_escalation_percent ?? 3.5),
    };
  }

  function populateCarrier(project) {
    const select = $('inputCarrier');
    select.innerHTML = (energyPrices?.items ?? []).filter((item) => item.active !== false).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join('');
    select.value = currentCarrier(project);
  }

  function sourceText(info) {
    if (!info || info.value === null || info.value === undefined) return 'nicht vorhanden';
    return `${ORIGIN_LABEL[info.origin] ?? 'Projektwert'}${info.source ? ` · ${info.source}` : ''}`;
  }

  function writeManualField(path, value, unit = null, source = 'Nutzereingabe Wirtschaftlichkeit V0.2') {
    if (value === null || value === '') store.clearFieldCandidate(path, model.ORIGIN.MANUAL);
    else store.setFieldCandidate(path, model.ORIGIN.MANUAL, value, { unit, source });
  }

  function renderBasis(project) {
    const area = describeAt(project, 'building.geometry.heatedFloorArea');
    const usable = describeAt(project, 'building.geometry.usableFloorArea');
    const energy = describeAt(project, 'consumption.heating.annualEnergy');
    const carrierId = currentCarrier(project);
    const carrier = carrierItem(carrierId);
    const price = currentEnergyPrice(project, carrierId);
    const effectiveArea = finite(area.value, finite(usable.value, null));
    const annualEnergy = finite(energy.value, null);
    const annualCost = annualEnergy !== null ? annualEnergy * price : null;

    $('basisArea').textContent = formatArea(effectiveArea);
    $('basisAreaSource').textContent = sourceText(area.value !== null ? area : usable);
    $('basisEnergy').textContent = formatEnergy(annualEnergy, 100);
    $('basisEnergySource').textContent = sourceText(energy);
    $('basisCarrier').textContent = carrier?.label ?? '–';
    $('basisCarrierSource').textContent = valueAt(project, 'systems.heating.energyCarrier', null) ? 'gemeinsamer Projektwert' : 'Vorschlag / Toolwert';
    $('basisAnnualCost').textContent = annualCost === null ? '–' : `${formatMoney(annualCost, 50)}/a`;
    $('basisAnnualCostSource').textContent = `${number1.format(price)} €/kWh · Stand ${energyPrices?.data_date ?? '–'}`;

    if (document.activeElement !== $('inputArea')) $('inputArea').value = effectiveArea ?? '';
    if (document.activeElement !== $('inputEnergy')) $('inputEnergy').value = annualEnergy ?? '';
    if (document.activeElement !== $('inputCarrier')) $('inputCarrier').value = carrierId;
    if (document.activeElement !== $('inputEnergyPrice')) $('inputEnergyPrice').value = price || '';
    if (document.activeElement !== $('inputConstructionYear')) $('inputConstructionYear').value = valueAt(project, 'building.profile.constructionYear', '') ?? '';
    if (document.activeElement !== $('inputHeatingYear')) $('inputHeatingYear').value = valueAt(project, 'systems.heating.installationYear', '') ?? '';
    if (document.activeElement !== $('inputEfficiency')) $('inputEfficiency').value = valueAt(project, 'systems.heating.usefulHeatFactor', 0.85) ?? 0.85;
    if (document.activeElement !== $('inputPeriod')) $('inputPeriod').value = currentAssumptions(project).periodYears;
    $('energyPriceSource').textContent = project.economics?.energyPriceOverrides?.[carrierId] !== undefined ? 'projektspezifisch' : `zentraler Richtwert · ${energyPrices?.data_date ?? '–'}`;

    let quality = 'orientierend'; let cls = '';
    const known = [effectiveArea, annualEnergy, valueAt(project, 'building.profile.constructionYear', null), valueAt(project, 'systems.heating.usefulHeatFactor', null)].filter((v) => v !== null && v !== undefined).length;
    if (known >= 4 && project.modules?.energiefluss?.resultSummary) { quality = 'objektspezifisch'; cls = 'is-success'; }
    else if (known >= 2) { quality = 'gute Abschätzung'; cls = 'is-working'; }
    $('basisQuality').textContent = quality;
    $('basisQuality').className = `status-chip ${cls}`.trim();

    const missing = [];
    if (!(effectiveArea > 0)) missing.push('beheizte Fläche');
    if (!(annualEnergy > 0)) missing.push('Heizenergieverbrauch');
    if (!valueAt(project, 'building.profile.constructionYear', null)) missing.push('Baujahr');
    if (!missing.length) {
      const heatingMissing = !valueAt(project, 'systems.heating.installationYear', null);
      $('basisHint').textContent = heatingMissing
        ? 'Gute Berechnungsbasis. Das Baujahr der Heizung würde den Vergleich „Tausch jetzt oder später“ zusätzlich verbessern.'
        : 'Gute Berechnungsbasis: die wesentlichen Projektwerte sind vorhanden.';
      $('basisHint').className = 'econ-hint is-info';
    } else {
      $('basisHint').textContent = `${missing.length} Ergänzung${missing.length === 1 ? '' : 'en'} verbessern die Aussage: ${missing.join(', ')}.`;
      $('basisHint').className = 'econ-hint is-warning';
    }
  }

  function renderChoiceGroup(id, selected, multiple = false) {
    $(id).querySelectorAll('button[data-value]').forEach((button) => {
      const active = multiple ? selected.includes(button.dataset.value) : selected === button.dataset.value;
      button.classList.toggle('is-selected', active);
    });
  }

  function renderAdvice(project) {
    const advice = project.advice ?? {};
    renderChoiceGroup('reasonChoices', advice.reason ?? null);
    renderChoiceGroup('timeChoices', advice.timeHorizon ?? null);
    renderChoiceGroup('budgetChoices', advice.budgetBand ?? null);
    renderChoiceGroup('priorityChoices', Array.isArray(advice.priorities) ? advice.priorities : [], true);
    $('goalStatus').textContent = advice.reason || advice.timeHorizon || advice.priorities?.length ? 'Rahmen gesetzt' : 'offen';
    $('goalStatus').className = `status-chip ${advice.priorities?.length ? 'is-success' : ''}`.trim();
  }

  function periodIdForYear(year) {
    const y = finite(year, null);
    if (y === null) return null;
    return (existingUValuesConfig?.periods ?? []).find((period) => (period.year_min === undefined || y >= period.year_min) && (period.year_max === undefined || y <= period.year_max))?.id ?? null;
  }

  function constructionUValue(project, definition) {
    const direct = finite(valueAt(project, definition.uPath, null), null);
    if (direct !== null && direct > 0) return { value: direct, source: 'Projekt-U-Wert', fallback: false };
    const year = finite(valueAt(project, 'building.profile.constructionYear', null), null);
    const periodId = periodIdForYear(year);
    const key = definition.componentId === 'doors' ? 'exteriorDoor' : definition.componentId;
    const fallback = finite(existingUValuesConfig?.components?.[key]?.values?.[periodId], null);
    return fallback !== null ? { value: fallback, source: `Bauperiodenvorschlag ${year ?? ''}`.trim(), fallback: true } : { value: null, source: 'U-Wert fehlt', fallback: true };
  }

  function componentEnvelopeRelevant(project, definition) {
    if (!definition.enabledPath) return true;
    return Boolean(valueAt(project, definition.enabledPath, definition.defaultEnabled !== false));
  }

  function referenceTiming(project, definition, lifetimeYears) {
    const draft = project.modules?.wirtschaftlichkeit?.measureDrafts?.[definition.id] ?? {};
    const explicit = finite(draft.referenceYear, null);
    if (explicit !== null && draft.referenceYearConfirmed) return Math.max(0, explicit);
    const lastRenewal = finite(draft.lastRenewalYear, null);
    const construction = finite(valueAt(project, 'building.profile.constructionYear', null), null);
    const baseYear = lastRenewal ?? construction;
    if (!(baseYear > 0) || !(lifetimeYears > 0)) return null;
    return Math.max(0, lifetimeYears - Math.max(0, CURRENT_YEAR - baseYear));
  }

  function exchangeRecommended(definition) {
    return (exchangeVariantsConfig?.components?.[definition.dataId]?.variants ?? []).find((item) => item.role === 'recommended')
      ?? (exchangeVariantsConfig?.components?.[definition.dataId]?.variants ?? [])[0]
      ?? null;
  }

  function envelopeFallbackMeasure(project, definition) {
    const draft = project.modules?.wirtschaftlichkeit?.measureDrafts?.[definition.id] ?? {};
    const area = finite(valueAt(project, definition.areaPath, null), null);
    const u = constructionUValue(project, definition);
    const target = finite(targetsConfig?.components?.[definition.dataId]?.recommended, null);
    const cost = costModel(definition.costModelId);
    const life = lifetimeFor(definition.costModelId);
    const lifetimeYears = finite(draft.lifetimeYears, finite(life?.years, 40));
    const referenceYearAuto = referenceTiming(project, definition, lifetimeYears);
    const flow = flowComponent(project, definition.flowId);
    const existingLoss = finite(flow?.lossKwh, null);
    const efficiency = finite(valueAt(project, 'systems.heating.usefulHeatFactor', 0.85), 0.85);
    const energyInputs = {
      areaM2: area ?? 0,
      existingUValue: u.value ?? 0,
      existingLossKwh: existingLoss,
      heatingDegreeHoursKh: existingLoss === null ? HGT_FALLBACK_TIROL * 24 : null,
      boundaryFactor: definition.boundaryFactor ?? 1,
      annualEfficiency: efficiency,
    };

    let newU = target;
    let fullInvestment = 0;
    let referenceCost = 0;
    let selectedVariantLabel = null;

    if (definition.kind === 'exchange' || definition.kind === 'door') {
      const exchange = exchangeRecommended(definition);
      newU = finite(exchange?.u_value, target);
      const middle = finite(cost?.range_eur_m2?.middle, finite(cost?.base_cost_eur_m2, 0));
      if (definition.kind === 'door') fullInvestment = middle;
      else fullInvestment = (area ?? 0) * middle;
      referenceCost = definition.kind === 'door' ? finite(cost?.sunk_cost_eur_m2, 0) : (area ?? 0) * finite(cost?.sunk_cost_eur_m2, 0);
      selectedVariantLabel = exchange?.short_label ?? exchange?.label ?? 'Mindeststandard';
    } else if (area !== null && u.value !== null && target !== null) {
      const thicknessRaw = measureCore.requiredThicknessCm(u.value, target, 0.035);
      const thickness = thicknessRaw === null ? null : measureCore.ceilToStep(thicknessRaw, 2);
      if (thickness !== null) {
        const investment = measureCore.investmentForThickness({
          thicknessCm: thickness,
          areaM2: area,
          baseCostEurM2: finite(cost?.base_cost_eur_m2, 0),
          variableCostEurM2Cm: finite(cost?.variable_cost_eur_m2_cm, 0),
          sunkCostEurM2: finite(cost?.sunk_cost_eur_m2, 0),
          renewalContext: 'renewal_due',
        });
        fullInvestment = investment.fullInvestmentEur;
        referenceCost = investment.sunkCostEur;
        selectedVariantLabel = `${number0.format(thickness)} cm`; 
      }
    }

    const energy = newU && u.value ? measureCore.energyEffect({ ...energyInputs, newUValue: newU }) : { available: false };
    const prepared = Boolean(draft.prepared || project.modules?.wirtschaftlichkeit?.autoPreparedAt);
    const referenceYear = finite(draft.referenceYear, referenceYearAuto ?? 0);
    const dataQuality = area && u.value && energy.available ? (u.fallback || existingLoss === null ? 'gute Abschätzung' : 'objektspezifisch') : 'orientierend';
    return {
      id: definition.id, label: definition.label, componentId: definition.componentId, source: prepared ? 'Wirtschaftlichkeit · automatisch vorbereitet' : 'Vorschlag aus Projektbasis',
      selected: prepared ? Boolean(draft.selected) : false, prepared,
      fullInvestmentEur: finite(draft.fullInvestmentEur, fullInvestment),
      referenceCostEur: finite(draft.referenceCostEur, referenceYearAuto === null ? 0 : referenceCost),
      referenceYear, referenceYearAuto, deliveredSavingsKwh: finite(draft.deliveredSavingsKwh, finite(energy?.deliveredSavingsKwh, 0)),
      lifetimeYears, manualOnly: false, informational: false, dataQuality, areaM2: area,
      existingUValue: u.value, targetUValue: newU, costRange: cost?.range_eur_m2 ?? null,
      selectedVariantLabel, energyMethod: energy?.method ?? null, fundingEntries: [], fundingEur: 0,
      note: referenceYearAuto === null && referenceCost > 0 ? 'Bauteilalter unbekannt: Referenzkosten werden konservativ noch nicht angerechnet.' : null,
    };
  }

  function systemFallbackMeasure(project, definition) {
    const draft = project.modules?.wirtschaftlichkeit?.measureDrafts?.[definition.id] ?? {};
    const config = systemCost(definition.systemCostId);
    const prepared = Boolean(draft.prepared || project.modules?.wirtschaftlichkeit?.autoPreparedAt);
    const middle = finite(config?.range?.middle, 0);
    const lifetimeYears = finite(draft.lifetimeYears, finite(config?.lifetime_years, definition.id === 'heating' ? 18 : 25));
    let referenceCost = 0;
    let referenceYear = 0;
    let deliveredSavingsKwh = 0;
    let note = null;
    if (definition.id === 'heating') {
      const installYear = finite(valueAt(project, 'systems.heating.installationYear', null), null);
      const baseLife = finite(config?.reference_lifetime_years, 20);
      referenceYear = installYear ? Math.max(0, baseLife - Math.max(0, CURRENT_YEAR - installYear)) : 0;
      referenceCost = installYear ? middle : 0;
      const annualEnergy = finite(valueAt(project, 'consumption.heating.annualEnergy', null), 0);
      const eta = finite(valueAt(project, 'systems.heating.usefulHeatFactor', 0.85), 0.85);
      const targetEta = finite(config?.target_efficiency, 3.2);
      deliveredSavingsKwh = annualEnergy > 0 ? Math.max(0, annualEnergy - annualEnergy * eta / targetEta) : 0;
      note = installYear ? `Referenz: Ersatz in ca. ${referenceYear} Jahren.` : 'Heizungsbaujahr ergänzt den Vergleich „jetzt oder später“.';
    } else if (definition.id === 'pv') {
      note = 'Kosten werden berücksichtigt; ein objektspezifisches PV-Ertragsmodell folgt in einer späteren Fachrunde.';
    }
    const fullInvestment = definition.id === 'pv' ? middle * finite(config?.default_size_kwp, 10) : middle;
    return {
      id: definition.id, label: definition.label, componentId: definition.componentId, source: prepared ? 'Wirtschaftlichkeit · Systemvorschlag' : 'Systemvorschlag',
      selected: prepared ? Boolean(draft.selected) : false, prepared,
      fullInvestmentEur: finite(draft.fullInvestmentEur, fullInvestment), referenceCostEur: finite(draft.referenceCostEur, referenceCost),
      referenceYear: finite(draft.referenceYear, referenceYear), deliveredSavingsKwh: finite(draft.deliveredSavingsKwh, deliveredSavingsKwh),
      lifetimeYears, manualOnly: true, informational: Boolean(definition.informational), dataQuality: 'orientierend', fundingEntries: [], fundingEur: 0,
      targetCarrierId: config?.target_carrier_id ?? null, targetEfficiency: finite(draft.targetEfficiency, finite(config?.target_efficiency, null)),
      systemLabel: config?.label ?? definition.label, note,
    };
  }

  function fallbackMeasure(project, definition) {
    return definition.manualOnly ? systemFallbackMeasure(project, definition) : envelopeFallbackMeasure(project, definition);
  }

  function storedMeasureToCandidate(project, definition, stored) {
    const draft = project.modules?.wirtschaftlichkeit?.measureDrafts?.[definition.id] ?? {};
    const fundingEntries = clone(stored.funding?.entries ?? []);
    const fundingEur = finite(stored.funding?.amountEur, fundingEntries.reduce((sum, item) => sum + finite(item.amountEur, 0), 0));
    return {
      id: definition.id, label: stored.title ?? definition.label, componentId: stored.componentId ?? definition.componentId,
      source: 'Bauteil & Sanierung', selected: draft.selected !== undefined ? Boolean(draft.selected) : true, prepared: true,
      fullInvestmentEur: finite(draft.fullInvestmentEur, finite(stored.costModel?.fullInvestmentEur, 0)),
      referenceCostEur: finite(draft.referenceCostEur, finite(stored.sunkCosts?.totalEur, 0)),
      referenceYear: finite(draft.referenceYear, stored.costModel?.renewalContext === 'renewal_due' ? 0 : 0),
      deliveredSavingsKwh: finite(draft.deliveredSavingsKwh, finite(stored.energyEffect?.deliveredSavingsKwh, 0)),
      lifetimeYears: finite(draft.lifetimeYears, finite(stored.costModel?.lifetimeYears, 40)),
      dataQuality: 'objektspezifisch', areaM2: finite(stored.existingState?.areaM2, null), existingUValue: finite(stored.existingState?.uValue, null), targetUValue: finite(stored.selectedVariant?.uValue, null),
      manualOnly: false, informational: false, fundingEntries, fundingEur,
      note: stored.funding?.confirmed ? 'Förderung aus Bauteil & Sanierung übernommen.' : null,
    };
  }

  function buildMeasures(project) {
    const allStored = Object.values(project.measures ?? {}).filter((item) => item && item.status !== 'archived');
    measures = QUICK_DEFINITIONS.filter((definition) => {
      if (definition.manualOnly) return true;
      const stored = allStored.find((item) => item.componentId === definition.componentId && item.thermalEnvelope?.relevant !== false);
      return Boolean(stored) || componentEnvelopeRelevant(project, definition);
    }).map((definition) => {
      const stored = allStored.find((item) => item.componentId === definition.componentId && item.autoGenerated !== true && item.thermalEnvelope?.relevant !== false)
        ?? allStored.find((item) => item.componentId === definition.componentId && item.thermalEnvelope?.relevant !== false);
      return stored ? storedMeasureToCandidate(project, definition, stored) : fallbackMeasure(project, definition);
    });
  }

  function saveMeasureDraft(id, patch) {
    const current = store.get().modules?.wirtschaftlichkeit?.measureDrafts?.[id] ?? {};
    store.setPath(`modules.wirtschaftlichkeit.measureDrafts.${id}`, { ...current, ...patch });
  }

  function selectedMeasures() { return measures.filter((item) => item.selected); }

  function renderPreparePanel(project) {
    const storedCount = measures.filter((item) => item.source === 'Bauteil & Sanierung').length;
    const preparedCount = measures.filter((item) => item.prepared).length;
    const technicalReady = measures.filter((item) => !item.manualOnly).filter((item) => item.areaM2 > 0 && item.existingUValue > 0).length;
    const panel = $('prepareMeasuresPanel');
    if (storedCount || preparedCount) {
      panel.classList.add('is-ready');
      $('prepareMeasuresHint').textContent = storedCount ? `${storedCount} vorhandene Maßnahme${storedCount === 1 ? '' : 'n'} übernommen; weitere Vorschläge können bei Bedarf aktualisiert werden.` : `${preparedCount} Maßnahmen wurden aus der Projektbasis vorbereitet.`;
      $('prepareMeasuresButton').textContent = 'Vorschläge aktualisieren';
    } else {
      panel.classList.remove('is-ready');
      $('prepareMeasuresHint').textContent = technicalReady
        ? 'Geometrie und Baujahr reichen für eine orientierende Maßnahmenvorbereitung. Beste Projektdaten werden automatisch bevorzugt.'
        : 'Für Hüllmaßnahmen werden mindestens Geometrie und Baujahr/U-Werte benötigt. Heizung und PV können trotzdem orientierend vorbereitet werden.';
      $('prepareMeasuresButton').textContent = 'Maßnahmen aus Gebäude vorbereiten';
    }
  }

  function renderMeasures(project) {
    buildMeasures(project);
    const storedCount = measures.filter((item) => item.source === 'Bauteil & Sanierung').length;
    $('measureSourceNote').textContent = storedCount ? `${storedCount} Maßnahme${storedCount === 1 ? '' : 'n'} aus Bauteil & Sanierung übernommen.` : 'Noch keine gespeicherten Maßnahmen; aus Gebäude, Baujahr und zentralen Zielwerten können Vorschläge vorbereitet werden.';
    renderPreparePanel(project);
    $('measureList').innerHTML = measures.map((item) => {
      const cost = item.fullInvestmentEur > 0 ? formatMoney(item.fullInvestmentEur) : 'Kosten ergänzen';
      let saving = item.deliveredSavingsKwh > 0 ? `${formatEnergy(item.deliveredSavingsKwh, 10)} Einsparung` : 'Einsparung noch offen';
      if (item.id === 'heating' && item.targetEfficiency) saving = `Systemvorschlag · JAZ ${number1.format(item.targetEfficiency)}`;
      if (item.informational) saving = 'Kosten vorbereitet · Ertragsmodell folgt';
      const disabled = !item.prepared && item.source !== 'Bauteil & Sanierung';
      return `<div class="measure-item ${disabled ? 'is-unprepared' : ''}" data-measure-id="${escapeHtml(item.id)}"><div class="measure-item-header"><input type="checkbox" ${item.selected ? 'checked' : ''} ${disabled ? 'disabled' : ''} aria-label="${escapeHtml(item.label)} auswählen"><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.source)} · ${escapeHtml(item.dataQuality)}</small>${item.note ? `<small class="measure-note">${escapeHtml(item.note)}</small>` : ''}</div><div class="measure-item-values"><strong>${cost}</strong><small>${escapeHtml(saving)}</small></div></div><details><summary>Werte prüfen</summary><div class="measure-detail-grid"><label><span>Vollkosten</span><div class="input-with-unit"><input data-field="fullInvestmentEur" type="number" min="0" step="500" value="${item.fullInvestmentEur || ''}"><em>€</em></div></label><label><span>Referenz-Erneuerung</span><div class="input-with-unit"><input data-field="referenceCostEur" type="number" min="0" step="500" value="${item.referenceCostEur || ''}"><em>€</em></div></label><label><span>Referenz in</span><div class="input-with-unit"><input data-field="referenceYear" type="number" min="0" max="60" step="1" value="${item.referenceYear || 0}"><em>J.</em></div></label><label><span>Energieeinsparung</span><div class="input-with-unit"><input data-field="deliveredSavingsKwh" type="number" min="0" step="10" value="${item.deliveredSavingsKwh || ''}"><em>kWh/a</em></div></label></div></details></div>`;
    }).join('');

    $('measureList').querySelectorAll('.measure-item').forEach((row) => {
      const id = row.dataset.measureId;
      row.querySelector('input[type="checkbox"]').addEventListener('change', (event) => saveMeasureDraft(id, { selected: event.target.checked, prepared: true }));
      row.querySelectorAll('[data-field]').forEach((input) => {
        input.addEventListener('change', () => {
          const patch = {
            [input.dataset.field]: finite(input.value, 0),
            prepared: true,
          };
          if (input.dataset.field === 'referenceYear') patch.referenceYearConfirmed = true;
          saveMeasureDraft(id, patch);
        });
      });
    });
    renderMeasureCostDetails();
  }

  function prepareMeasures(selectFutureFit = false) {
    const project = store.get();
    buildMeasures(project);
    const neededIds = selectFutureFit ? measures.filter((item) => needsFutureFitMeasure(project, item)).map((item) => item.id) : [];
    suppressRender = true;
    store.batch(() => {
      measures.forEach((item) => {
        const current = store.get().modules?.wirtschaftlichkeit?.measureDrafts?.[item.id] ?? {};
        store.setPath(`modules.wirtschaftlichkeit.measureDrafts.${item.id}`, {
          ...current,
          prepared: true,
          fullInvestmentEur: finite(current.fullInvestmentEur, item.fullInvestmentEur),
          referenceCostEur: finite(current.referenceCostEur, item.referenceCostEur),
          referenceYear: current.referenceYearConfirmed ? finite(current.referenceYear, item.referenceYear) : item.referenceYear,
          deliveredSavingsKwh: finite(current.deliveredSavingsKwh, item.deliveredSavingsKwh),
          lifetimeYears: finite(current.lifetimeYears, item.lifetimeYears),
          selected: selectFutureFit ? neededIds.includes(item.id) : Boolean(current.selected),
        });
      });
      store.setPath('modules.wirtschaftlichkeit.autoPreparedAt', new Date().toISOString());
    });
    suppressRender = false;
    render(store.get());
  }

  function renderFutureFit(project) {
    const visibleEnvelope = measures.filter((item) => !item.manualOnly);
    const envelopeKnown = visibleEnvelope.some((item) => item.existingUValue > 0);
    const envelopeGood = visibleEnvelope.length > 0 && visibleEnvelope.every((item) => !(item.targetUValue > 0) || !(item.existingUValue > item.targetUValue * 1.05));
    const carrier = currentCarrier(project);
    const fossilFree = ['electricity','district_heat','wood','pellets'].includes(carrier);
    const pv = Boolean(project.systems?.pv?.installed || project.modules?.pv?.resultSummary);
    const steps = [
      ['Hülle', envelopeGood ? 'done' : envelopeKnown ? 'partial' : 'open', envelopeGood ? 'gut' : envelopeKnown ? 'teilweise' : 'offen'],
      ['Technik', valueAt(project, 'systems.heating.usefulHeatFactor', null) ? 'partial' : 'open', valueAt(project, 'systems.heating.usefulHeatFactor', null) ? 'bekannt' : 'offen'],
      ['fossilfrei', fossilFree ? 'done' : 'open', fossilFree ? 'erfüllt' : 'offen'],
      ['PV', pv ? 'done' : 'open', pv ? 'vorhanden' : 'offen'],
    ];
    $('futureFitTrack').innerHTML = steps.map(([label,state,note], i) => `<div class="future-step ${state === 'done' ? 'is-done' : state === 'partial' ? 'is-partial' : ''}"><i>${i+1}</i><span>${label}</span><small>${note}</small></div>`).join('');
  }

  function needsFutureFitMeasure(project, item) {
    if (item.id === 'heating') return !['electricity','district_heat','wood','pellets'].includes(currentCarrier(project));
    if (item.id === 'pv') return !(project.systems?.pv?.installed || project.modules?.pv?.resultSummary);
    if (item.targetUValue && item.existingUValue) return item.existingUValue > item.targetUValue * 1.05;
    return Boolean(item.prepared || item.areaM2 > 0);
  }

  function renderMeasureCostDetails() {
    const host = $('measureCostDetails');
    if (!host) return;
    host.innerHTML = selectedMeasures().map((item) => `<div class="measure-cost-row"><strong>${escapeHtml(item.label)}</strong><span>Vollkosten<br><b>${formatMoney(item.fullInvestmentEur)}</b></span><span>Referenz<br><b>${formatMoney(item.referenceCostEur)}</b></span><span>Referenz in<br><b>${number0.format(item.referenceYear || 0)} J.</b></span><span>Förderung aus Maßnahme<br><b>${formatMoney(item.fundingEur || 0)}</b></span></div>`).join('') || '<p>Noch keine Maßnahme ausgewählt.</p>';
  }

  function aggregateInheritedFunding(selected) {
    const sums = { state: 0, federal: 0, other: 0, bonus: 0 };
    let measuresWithFunding = 0;
    selected.forEach((item) => {
      if (item.fundingEur > 0) measuresWithFunding += 1;
      const entries = item.fundingEntries ?? [];
      if (!entries.length && item.fundingEur > 0) sums.other += item.fundingEur;
      entries.forEach((entry) => {
        const id = String(entry.id ?? '').toLowerCase();
        const amount = finite(entry.amountEur, 0);
        if (id.includes('state') || id.includes('land')) sums.state += amount;
        else if (id.includes('federal') || id.includes('bund')) sums.federal += amount;
        else sums.other += amount;
      });
    });
    return { ...sums, measuresWithFunding };
  }

  function fundingValues(project, selected) {
    const inherited = aggregateInheritedFunding(selected);
    const draft = project.modules?.wirtschaftlichkeit?.funding ?? {};
    const effective = {};
    const source = {};
    ['state','federal','other','bonus'].forEach((key) => {
      if (hasOwn(draft, key)) { effective[key] = Math.max(0, finite(draft[key], 0)); source[key] = 'in Wirtschaftlichkeit bestätigt'; }
      else { effective[key] = Math.max(0, finite(inherited[key], 0)); source[key] = inherited[key] > 0 ? 'aus Bauteil & Sanierung übernommen' : key === 'bonus' ? 'noch nicht ergänzt' : 'keine Förderung hinterlegt'; }
    });
    return { ...effective, source, inheritedMeasures: inherited.measuresWithFunding };
  }

  function calculateEnergy(project, selected) {
    const carrierId = currentCarrier(project);
    const price = currentEnergyPrice(project, carrierId);
    const annualEnergy = Math.max(0, finite(valueAt(project, 'consumption.heating.annualEnergy', null), 0));
    const efficiency = Math.max(0.1, finite(valueAt(project, 'systems.heating.usefulHeatFactor', 0.85), 0.85));
    const annualBaseCost = annualEnergy * price;
    const envelopeSavingsDelivered = selected.filter((item) => !['heating','pv'].includes(item.id)).reduce((sum, item) => sum + Math.max(0, finite(item.deliveredSavingsKwh, 0)), 0);
    const usefulBase = annualEnergy * efficiency;
    const usefulSavings = Math.min(usefulBase, envelopeSavingsDelivered * efficiency);
    const usefulAfter = Math.max(0, usefulBase - usefulSavings);
    const heating = selected.find((item) => item.id === 'heating');
    let candidateCarrierId = carrierId;
    let candidateEfficiency = efficiency;
    if (heating) {
      candidateCarrierId = heating.targetCarrierId ?? 'electricity';
      candidateEfficiency = Math.max(0.1, finite(heating.targetEfficiency, 3.2));
    }
    const candidateEnergy = usefulAfter / candidateEfficiency;
    const candidatePrice = currentEnergyPrice(project, candidateCarrierId);
    const annualCandidateCost = candidateEnergy * candidatePrice;
    return {
      carrierId, candidateCarrierId, price, candidatePrice, annualEnergy, candidateEnergy, efficiency, candidateEfficiency,
      annualBaseCost, annualCandidateCost, annualSavingsEur: Math.max(0, annualBaseCost - annualCandidateCost),
      annualEnergySavingsKwh: Math.max(0, annualEnergy - candidateEnergy),
    };
  }

  function calculate(project) {
    const selected = selectedMeasures();
    const assumptions = currentAssumptions(project);
    const q = economics.factorFromPercent(assumptions.interestRatePercent);
    const energyP = economics.factorFromPercent(assumptions.energyEscalationPercent);
    const buildingP = economics.factorFromPercent(assumptions.buildingEscalationPercent);
    const technicalP = economics.factorFromPercent(assumptions.technicalEscalationPercent);
    const energy = calculateEnergy(project, selected);
    const totalInvestment = selected.reduce((sum, item) => sum + finite(item.fullInvestmentEur, 0), 0);
    const fundingRaw = fundingValues(project, selected);
    const rawFundingTotal = fundingRaw.state + fundingRaw.federal + fundingRaw.other + fundingRaw.bonus;
    const cappedFunding = Math.min(totalInvestment, Math.max(0, rawFundingTotal));
    const funding = { ...fundingRaw, total: cappedFunding, rawTotal: rawFundingTotal };

    const candidate = {
      id: 'renovation', label: 'Sanierungsvariante',
      capitalComponents: selected.filter((item) => item.fullInvestmentEur > 0).map((item) => ({
        id: item.id, label: item.label, initialCost: item.fullInvestmentEur, replacementCost: item.fullInvestmentEur,
        lifetimeYears: item.lifetimeYears, startYear: 0, capitalPriceFactor: item.componentId === 'heating' || item.componentId === 'pv' ? technicalP : buildingP, disposalCost: 0,
      })),
      capitalEvents: cappedFunding > 0 ? [{ id: 'funding', label: 'Förderung', year: 0, amount: -cappedFunding, priceFactor: 1 }] : [],
      consumptionCosts: [{ id: 'energy', label: 'Energie', annualCost: energy.annualCandidateCost, priceFactor: energyP }], operationCosts: [],
    };
    const reference = {
      id: 'reference', label: 'Referenz',
      capitalComponents: selected.filter((item) => item.referenceCostEur > 0).map((item) => ({
        id: `ref-${item.id}`, label: `Referenz ${item.label}`, initialCost: item.referenceCostEur, replacementCost: item.referenceCostEur,
        lifetimeYears: item.lifetimeYears, startYear: Math.max(0, item.referenceYear), capitalPriceFactor: item.componentId === 'heating' ? technicalP : buildingP, disposalCost: 0,
      })),
      capitalEvents: [],
      consumptionCosts: [{ id: 'energy', label: 'Energie', annualCost: energy.annualBaseCost, priceFactor: energyP }], operationCosts: [],
    };
    const coreAssumptions = { periodYears: assumptions.periodYears, interestFactor: q, seriesStepYears: 1 };
    const comparison = selected.length && energy.annualEnergy > 0 ? economics.compareVariants(candidate, reference, coreAssumptions, 'cumulative') : null;
    const referencePv = reference.capitalComponents.reduce((sum, item) => sum + economics.presentValue(item.initialCost, item.capitalPriceFactor, q, item.startYear), 0);
    const relevantInvestment = totalInvestment - cappedFunding - referencePv;
    const referenceNominal = Math.min(totalInvestment, selected.reduce((sum, item) => sum + finite(item.referenceCostEur, 0), 0));
    const energeticNominal = Math.max(0, totalInvestment - referenceNominal);
    return {
      selected, assumptions, energy, totalInvestment, funding, netInvestment: Math.max(0, totalInvestment - cappedFunding),
      referencePv, relevantInvestment, referenceNominal, energeticNominal, comparison,
    };
  }

  function segment(label, value, total, className) {
    const width = total > 0 ? Math.max(value > 0 ? 2 : 0, value / total * 100) : 0;
    return `<div class="bar-segment ${className}" style="width:${width}%">${width > 12 ? escapeHtml(label) : ''}</div>`;
  }

  function renderBars(result) {
    $('costCompositionBar').innerHTML = segment('Referenz', result.referenceNominal, result.totalInvestment, 'bar-segment--reference') + segment('energetisch', result.energeticNominal, result.totalInvestment, 'bar-segment--energy');
    $('costCompositionLegend').innerHTML = `<span>ohnehin notwendige / Referenzarbeiten <b>${formatMoney(result.referenceNominal)}</b></span><span>energetische Verbesserung <b>${formatMoney(result.energeticNominal)}</b></span>`;
    const total = result.totalInvestment || 1;
    const categoryTotal = result.funding.state + result.funding.federal + result.funding.other + result.funding.bonus;
    const scale = categoryTotal > 0 && result.funding.total < categoryTotal ? result.funding.total / categoryTotal : 1;
    const state = result.funding.state * scale, federal = result.funding.federal * scale, other = result.funding.other * scale, bonus = result.funding.bonus * scale;
    $('fundingBar').innerHTML = segment('Land', state, total, 'bar-segment--state') + segment('Bund', federal, total, 'bar-segment--federal') + segment('Sonstige', other, total, 'bar-segment--other') + segment('Bonus', bonus, total, 'bar-segment--bonus') + segment('Eigenanteil', result.netInvestment, total, 'bar-segment--own');
    $('fundingLegend').innerHTML = `<span>Land <b>${formatMoney(state)}</b></span><span>Bund <b>${formatMoney(federal)}</b></span>${other > 0 ? `<span>Sonstige <b>${formatMoney(other)}</b></span>` : ''}<span>Paketbonus <b>${formatMoney(bonus)}</b></span><span>Eigenanteil <b>${formatMoney(result.netInvestment)}</b></span>`;
  }

  function svgHelpers(svg) {
    const ns='http://www.w3.org/2000/svg';
    return (name,attrs={})=>{const el=document.createElementNS(ns,name);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));svg.append(el);return el;};
  }

  function renderChart(result) {
    const svg = $('economicsChart'); svg.innerHTML = '';
    if (!result.comparison?.series?.length) {
      svg.innerHTML = '<text x="380" y="155" text-anchor="middle" class="chart-label">Für die Zeitgrafik werden Verbrauch und mindestens eine bewertbare Maßnahme benötigt.</text>';
      $('chartStatus').textContent = 'noch nicht berechenbar'; return;
    }
    const series = result.comparison.series;
    const width=760, height=320, ml=72, mr=30, mt=26, mb=48, plotW=width-ml-mr, plotH=height-mt-mb;
    const values = series.map((p) => p.advantage); const min = Math.min(0,...values), max = Math.max(0,...values); const span=Math.max(1,max-min);
    const x=(year)=>ml+year/result.assumptions.periodYears*plotW; const y=(v)=>mt+(max-v)/span*plotH; const y0=y(0); const add=svgHelpers(svg);
    add('rect',{x:ml,y:mt,width:plotW,height:Math.max(0,y0-mt),class:'chart-zone-positive'}); add('rect',{x:ml,y:y0,width:plotW,height:Math.max(0,height-mb-y0),class:'chart-zone-negative'});
    for(let yr=0;yr<=result.assumptions.periodYears;yr+=5){const xx=x(yr);add('line',{x1:xx,y1:mt,x2:xx,y2:height-mb,class:'chart-grid'});const t=add('text',{x:xx,y:height-18,'text-anchor':'middle',class:'chart-label'});t.textContent=`${yr} J.`;}
    add('line',{x1:ml,y1:y0,x2:width-mr,y2:y0,class:'chart-zero'}); add('line',{x1:ml,y1:mt,x2:ml,y2:height-mb,class:'chart-axis'});
    const zeroLabel=add('text',{x:width-mr-4,y:Math.max(mt+14,y0-7),'text-anchor':'end',class:'chart-label-strong'});zeroLabel.textContent='Referenz · beide Varianten gleich teuer';
    const top=add('text',{x:ml+8,y:mt+16,class:'chart-label-strong'});top.textContent='Sanierung günstiger'; const bottom=add('text',{x:ml+8,y:height-mb-10,class:'chart-label-strong'});bottom.textContent='Sanierung noch teurer';
    const pts=series.map((p)=>`${x(p.year)},${y(p.advantage)}`).join(' '); add('polyline',{points:pts,class:'chart-line'});
    if(result.comparison.durableAdvantageYear!==null){const xx=x(result.comparison.durableAdvantageYear);add('line',{x1:xx,y1:mt,x2:xx,y2:height-mb,class:'chart-crossing'});const t=add('text',{x:Math.min(width-mr-5,xx+6),y:mt+34,class:'chart-label'});t.textContent=`dauerhaft ab ca. ${number1.format(result.comparison.durableAdvantageYear)} J.`;}
    const end=series.at(-1); if(end){add('circle',{cx:x(end.year),cy:y(end.advantage),r:4,class:'chart-point'});const t=add('text',{x:x(end.year)-6,y:y(end.advantage)-9,'text-anchor':'end',class:'chart-label-strong'});t.textContent=`kumuliert ${formatSignedMoney(end.advantage)}`;}
    const advantage = result.comparison.advantagePresentValue;
    $('chartStatus').textContent = advantage >= 0 ? `Über ${result.assumptions.periodYears} Jahre ca. ${formatMoney(advantage)} günstiger` : `Über ${result.assumptions.periodYears} Jahre ca. ${formatMoney(-advantage)} teurer`;
  }

  function renderComparisonChart(result) {
    const svg=$('comparisonChart'); svg.innerHTML='';
    const series=result.comparison?.series??[];
    if(!series.length){svg.innerHTML='<text x="380" y="145" text-anchor="middle" class="chart-label">Noch keine vollständige Vergleichsrechnung.</text>';return;}
    const width=760,height=300,ml=72,mr=32,mt=26,mb=48,plotW=width-ml-mr,plotH=height-mt-mb;
    const max=Math.max(1,...series.flatMap((p)=>[p.referenceCost,p.candidateCost])); const x=(year)=>ml+year/result.assumptions.periodYears*plotW; const y=(v)=>mt+(1-v/max)*plotH; const add=svgHelpers(svg);
    for(let yr=0;yr<=result.assumptions.periodYears;yr+=5){const xx=x(yr);add('line',{x1:xx,y1:mt,x2:xx,y2:height-mb,class:'chart-grid'});const t=add('text',{x:xx,y:height-18,'text-anchor':'middle',class:'chart-label'});t.textContent=`${yr} J.`;}
    add('line',{x1:ml,y1:height-mb,x2:width-mr,y2:height-mb,class:'chart-axis'}); add('line',{x1:ml,y1:mt,x2:ml,y2:height-mb,class:'chart-axis'});
    add('polyline',{points:series.map((p)=>`${x(p.year)},${y(p.referenceCost)}`).join(' '),class:'chart-line-reference'}); add('polyline',{points:series.map((p)=>`${x(p.year)},${y(p.candidateCost)}`).join(' '),class:'chart-line-candidate'});
    const lr=add('text',{x:width-mr-4,y:y(series.at(-1).referenceCost)-8,'text-anchor':'end',class:'chart-label-strong'});lr.textContent='Referenz';
    const lc=add('text',{x:width-mr-4,y:y(series.at(-1).candidateCost)+16,'text-anchor':'end',class:'chart-label-strong'});lc.textContent='Sanierung';
  }

  function effectRows(result, project) {
    const priorities = project.advice?.priorities ?? [];
    const benefitTexts = { costs:['Kosten','wirtschaftlich betrachtet'], comfort:['Komfort','positiv'], climate:['Klimaschutz','positiv'], independence:['Unabhängigkeit','positiv'], value:['Werterhalt','positiv'], effort:['Baustellenaufwand','projektabhängig'] };
    const ordered = [...priorities, 'effort'].filter((v,i,a)=>a.indexOf(v)===i).slice(0,4);
    if (!ordered.length) ordered.push('comfort','climate','effort');
    return ordered.map((key)=>benefitTexts[key] ?? [key,'projektabhängig']);
  }

  function budgetAssessment(project, result) {
    const band = BUDGETS[project.advice?.budgetBand ?? 'open'] ?? BUDGETS.open;
    if (band.min === null) return { label: band.label, note: 'Noch kein Budgetrahmen festgelegt.', state: 'open' };
    const value = result.netInvestment;
    if (value >= band.min && value <= band.max) return { label: band.label, note: 'Restinvestition liegt im gewählten Budgetrahmen.', state: 'ok' };
    if (value > band.max && Number.isFinite(band.max)) return { label: band.label, note: `Restinvestition liegt ca. ${formatMoney(value-band.max)} über der Obergrenze.`, state: 'high' };
    if (value < band.min) return { label: band.label, note: `Restinvestition liegt ca. ${formatMoney(band.min-value)} unter der gewählten Untergrenze.`, state: 'low' };
    return { label: band.label, note: 'Budgetrahmen prüfen.', state: 'open' };
  }

  function interpretation(result, project) {
    if (!result.selected.length) return 'Wählen Sie mindestens eine Maßnahme aus. Vorhandene Maßnahmen aus „Bauteil & Sanierung“ werden automatisch übernommen.';
    if (!(result.energy.annualEnergy > 0)) return 'Kosten können bereits betrachtet werden. Für die langfristige Energiekostenwirkung fehlt noch ein Heizenergieverbrauch.';
    const due = result.selected.filter((m)=>m.referenceCostEur>0 && m.referenceYear<=3).map((m)=>m.label);
    const durable = result.comparison?.durableAdvantageYear;
    const priorities = (project.advice?.priorities ?? []).map((id)=>PRIORITY_LABEL[id]).filter(Boolean);
    let text = due.length ? `${due.join(', ')}: Eine ohnehin notwendige Erneuerung ist im Modell kurzfristig berücksichtigt. ` : '';
    if (durable !== null && durable !== undefined) text += `Die Sanierungsvariante liegt ab etwa Jahr ${Math.round(durable)} dauerhaft günstiger als die Referenz. `;
    else if (result.comparison?.advantagePresentValue >= 0) text += `Über ${result.assumptions.periodYears} Jahre ergibt sich ein rechnerischer Lebenszyklusvorteil. `;
    else text += `Die Energie- und Lebenszykluswirkung deckt die wirtschaftlich zusätzliche Investition im betrachteten Zeitraum nicht vollständig. `;
    if (priorities.length) text += `Für das Kundengespräch besonders relevant: ${priorities.slice(0,3).join(', ')}.`;
    if (result.selected.some((m)=>m.informational)) text += ' PV-Kosten sind bereits in der Investition enthalten; ein objektspezifisches PV-Ertragsmodell ist in V0.2 noch nicht Bestandteil der Zeitrechnung.';
    return text.trim();
  }

  function renderFundingInputs(result, project) {
    const mapping=[['State','state'],['Federal','federal'],['Other','other'],['Bonus','bonus']];
    mapping.forEach(([suffix,key])=>{
      const input=$(`fund${suffix}`); if(document.activeElement!==input) input.value=result.funding[key]||'';
      const source=$(`fund${suffix}Source`); if(source) source.textContent=result.funding.source[key]??'–';
    });
    const inherited = result.funding.inheritedMeasures;
    $('fundingOriginNote').textContent = inherited > 0 ? `${inherited} ausgewählte Maßnahme${inherited===1?'':'n'} mit hinterlegter Förderung übernommen; Paketbonus kann ergänzt werden.` : 'Noch keine Förderung aus Maßnahmen übernommen; Beträge können orientierend ergänzt werden.';
  }

  function renderCustomerContext(project, result) {
    const budget=budgetAssessment(project,result); $('budgetResult').textContent=budget.label; $('budgetResultNote').textContent=budget.note;
    const priorities=project.advice?.priorities??[];
    $('selectedPriorities').innerHTML=priorities.length?priorities.map((id)=>`<span>${escapeHtml(PRIORITY_LABEL[id]??id)}</span>`).join(''):'<span>noch keine Schwerpunkte gewählt</span>';
  }

  function renderResult(project) {
    const result = calculate(project); currentComparison = result;
    $('totalInvestment').textContent = formatMoney(result.totalInvestment);
    $('fundingEditorTotal').textContent = `bis zu ${formatMoney(result.funding.total)}`;
    $('fundingTotal').textContent = `bis zu ${formatMoney(result.funding.total)}`;
    $('fundingPercent').textContent = result.totalInvestment > 0 ? `ca. ${number0.format(result.funding.total/result.totalInvestment*100)} % der Gesamtinvestition` : '–';
    $('netInvestment').textContent = formatMoney(result.netInvestment);
    const relevantIsAdvantage=result.relevantInvestment<0;
    $('relevantInvestment').textContent = formatMoney(Math.abs(result.relevantInvestment));
    $('relevantInvestmentLabel').textContent = relevantIsAdvantage ? 'Wirtschaftlicher Startvorteil' : 'Wirtschaftlich zusätzliche Investition';
    $('relevantInvestmentNote').textContent = relevantIsAdvantage
      ? 'Förderung und heutiger Barwert der ohnehin zu erwartenden Erneuerungen übersteigen in der Modellrechnung die aktuelle Zusatzinvestition.'
      : 'Sanierungsinvestition abzüglich Förderung und des heutigen Barwerts der ohnehin zu erwartenden Erneuerungen.';
    document.querySelector('.relevant-investment')?.classList.toggle('is-advantage', relevantIsAdvantage);
    $('costStatus').textContent = result.selected.length ? `${result.selected.length} Maßnahme${result.selected.length===1?'':'n'}` : 'keine Maßnahme'; $('costStatus').className = `status-chip ${result.selected.length?'is-success':''}`.trim();
    renderBars(result); renderMeasureCostDetails(); renderFundingInputs(result,project);
    const overlap=result.funding.total-result.energeticNominal;
    const overlapNote=$('fundingOverlapNote');
    if(overlap>0.5){overlapNote.hidden=false;overlapNote.textContent=`Die angenommene Förderung liegt ca. ${formatMoney(overlap)} über den nominalen energetischen Mehrkosten. Das kann plausibel sein, wenn Förderregeln auch Gerüst, Putz oder andere förderfähige Begleitarbeiten berücksichtigen.`;}
    else overlapNote.hidden=true;

    $('resultNet').textContent = formatMoney(result.netInvestment);
    $('resultRelevant').textContent = formatMoney(Math.abs(result.relevantInvestment));
    $('resultRelevantLabel').textContent = relevantIsAdvantage ? 'Startvorteil gegenüber Referenz' : 'Wirtschaftlich zusätzlich';
    $('resultEnergyAfter').textContent = result.energy.annualEnergy>0 ? `${formatMoney(result.energy.annualCandidateCost,50)}/a` : '–';
    $('resultEnergyBefore').textContent = result.energy.annualEnergy>0 ? `vorher ${formatMoney(result.energy.annualBaseCost,50)}/a` : 'vorher –';
    $('resultSavings').textContent = result.energy.annualSavingsEur>0 ? `↓ ${formatMoney(result.energy.annualSavingsEur,50)}/a` : 'keine Kosteneinsparung berechnet';
    if (result.comparison?.durableAdvantageYear !== null && result.comparison?.durableAdvantageYear !== undefined) { $('resultFourthLabel').textContent='Dauerhaft günstiger'; $('resultFourth').textContent=`ab ca. Jahr ${Math.round(result.comparison.durableAdvantageYear)}`; $('resultFourthNote').textContent='gegenüber Referenz'; }
    else if (result.relevantInvestment>0 && result.comparison) { const energyPv=Math.max(0,result.comparison.reference.consumption.total-result.comparison.candidate.consumption.total); const share=Math.max(0,Math.min(999,energyPv/result.relevantInvestment*100)); $('resultFourthLabel').textContent='Energie trägt'; $('resultFourth').textContent=`ca. ${number0.format(share)} %`; $('resultFourthNote').textContent=`der wirtschaftlichen Zusatzinvestition`; }
    else { $('resultFourthLabel').textContent='Dauerhaft günstiger'; $('resultFourth').textContent='–'; $('resultFourthNote').textContent='noch nicht berechenbar'; }
    $('resultStatus').textContent = result.comparison ? (result.comparison.advantagePresentValue>=0?'Lebenszyklusvorteil':'Mehrkosten verbleiben') : 'noch keine vollständige Rechnung'; $('resultStatus').className=`status-chip ${result.comparison?'is-success':''}`.trim();
    renderChart(result); renderComparisonChart(result); renderCustomerContext(project,result);
    $('effectsList').innerHTML = effectRows(result,project).map(([label,value])=>`<div class="effect-row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`).join('');
    $('interpretationText').textContent = interpretation(result, project);
    const orienting=result.selected.some((m)=>m.dataQuality==='orientierend');
    const fundingNeedsCheck=result.funding.total>0;
    let quality='Gute Datengrundlage. Investitionskosten und Energiepreisentwicklung bleiben grundsätzlich zu prüfen.';
    if(orienting||fundingNeedsCheck){const reasons=[];if(orienting)reasons.push('einzelne Maßnahmen beruhen noch auf Richt- oder Bauperiodenwerten');if(fundingNeedsCheck)reasons.push('Förderungen sind nur orientierend berücksichtigt');quality=`Orientierende Aussage: ${reasons.join('; ')}. Vor einer Investitionsentscheidung Angebote, Förderbedingungen und Referenzzeitpunkte prüfen.`;}
    $('sensitivityBox').textContent=quality;
    buildMethodology(result,project); buildPrintReport(result,project); persistSnapshot(result,project);
  }

  function buildMethodology(result, project) {
    const a=result.assumptions;
    $('methodDataStrip').innerHTML = `<span><strong>Rechenkern</strong> ${economics.MODEL_VERSION}</span><span><strong>Zeitraum</strong> ${a.periodYears} Jahre</span><span><strong>Zins</strong> ${number1.format(a.interestRatePercent)} %</span><span><strong>Energiepreis</strong> ${number1.format(a.energyEscalationPercent)} %/a</span><span><strong>Kostenstand</strong> ${costConfig?.data_date ?? '–'}</span>`;
    $('methodologyGrid').innerHTML = [
      ['1 · Vergleichslogik','Verglichen werden eine Referenzvariante („Was passiert ohne vorgezogene energetische Verbesserung?“) und die gewählte Sanierungsvariante. Ohnehin notwendige Erneuerungen werden zu ihrem erwarteten Zeitpunkt und nicht pauschal heute abgezogen.'],
      ['2 · Barwert','Für eine Zahlung K im Jahr t gilt intern BW = K × (P / Q)^t. P ist der Preisentwicklungsfaktor der Kostenposition, Q der gemeinsame Zinsfaktor. Anfangsinvestitionen liegen in Jahr 0.'],
      ['3 · Lebenszyklus','Komponenten können Wiederbeschaffungen und Restwerte über ihre Nutzungsdauer erzeugen. Projektspezifische Werte haben Vorrang vor zentralen Standardwerten.'],
      ['4 · Energie','Der reale Heizenergieverbrauch verankert die heutigen Energiekosten. Hüllmaßnahmen übernehmen ihre Einsparung bevorzugt aus Energiefluss/Bauteil; fehlt sie, wird sie aus Fläche, Bestands-U-Wert, Ziel-U-Wert und Klima/HGT orientierend abgeleitet. Bei Wärmepumpe wird die Nutzwärme über eine JAZ auf Strom umgerechnet.'],
      ['5 · Förderung','Förderung ist nicht auf die energetische Mehrinvestition begrenzt. Förderfähige Kosten werden durch das jeweilige Programm definiert und können auch Gerüst, Putz oder andere Begleitarbeiten umfassen. Förderungen wirken als kostenmindernde Position der Sanierungsvariante; Referenzarbeiten ohne förderauslösende energetische Maßnahme erhalten nicht automatisch dieselbe Förderung.'],
      ['6 · Kostenstruktur','Die Grafik „Woraus besteht die Investition?“ trennt nominale Referenzarbeiten und energetische Verbesserung. Diese Aufteilung ist nicht identisch mit der Förderbasis. Die wirtschaftlich zusätzliche Investition berücksichtigt zusätzlich den Zeitpunkt der Referenzerneuerungen.'],
      ['7 · Amortisation','Die Zeitgrafik folgt der Kumulationsmethode: Zahlungsströme werden in dem Jahr berücksichtigt, in dem sie anfallen. Dadurch sind mehrere Amortisations- und Deamortisationspunkte möglich. Die Nulllinie bedeutet: Referenz und Sanierung sind kumuliert gleich teuer.'],
      ['8 · Datenpriorität','Projektspezifische bzw. manuell bestätigte Werte haben Vorrang vor zentralen EAT-Richtwerten; abgeleitete Werte und Fallbacks werden als solche gekennzeichnet.'],
      ['9 · PV in V0.2','PV-Kosten können für Finanzierung und Zukunftsfit-Paket berücksichtigt werden. Ein objektspezifisches PV-Ertrags-/Eigenverbrauchsmodell ist in V0.2 noch nicht Teil der wirtschaftlichen Zeitrechnung; das Ergebnis ist bei ausgewählter PV daher konservativ.'],
      ['10 · Grenzen','Beratungshilfe, keine Finanzierungs- oder Förderzusage. Richtkosten, Lebensdauern, Energiepreise, Förderfähigkeit und Förderhöhe sind vor Umsetzung projektspezifisch zu prüfen.'],
    ].map(([h,p])=>`<div><h3>${h}</h3><p>${p}</p></div>`).join('');
  }

  function buildPrintReport(result, project) {
    const host=$('economicsPrintReport'); if(!host)return;
    const selected=result.selected.map((m)=>m.label).join(' · ') || 'keine Maßnahme';
    const priorities=(project.advice?.priorities??[]).map((id)=>PRIORITY_LABEL[id]).filter(Boolean).join(' · ')||'–';
    const budget=budgetAssessment(project,result);
    host.innerHTML=`<section class="print-econ-section"><h1 class="print-econ-title">Wirtschaftlichkeit</h1><p><strong>${escapeHtml(project.project?.title||'Energieberatung')}</strong><br>${escapeHtml(project.project?.addressLabel||'')}</p><p>Betrachtet: ${escapeHtml(selected)}</p><p><strong>Schwerpunkte:</strong> ${escapeHtml(priorities)} · <strong>Budget:</strong> ${escapeHtml(budget.label)}</p><div class="print-econ-grid"><div class="print-econ-kpi"><span>Gesamtinvestition</span><strong>${formatMoney(result.totalInvestment)}</strong></div><div class="print-econ-kpi"><span>Mögliche Förderung</span><strong>bis zu ${formatMoney(result.funding.total)}</strong></div><div class="print-econ-kpi"><span>Restinvestition</span><strong>${formatMoney(result.netInvestment)}</strong></div><div class="print-econ-kpi"><span>${result.relevantInvestment<0?'Wirtschaftlicher Startvorteil':'Wirtschaftliche Mehrinvestition'}</span><strong>${formatMoney(Math.abs(result.relevantInvestment))}</strong></div></div></section><section class="print-econ-section print-econ-note"><strong>Einordnung</strong><p>${escapeHtml(interpretation(result,project))}</p></section><section class="print-econ-section"><h2>Energiekosten</h2><p>Vorher: <strong>${formatMoney(result.energy.annualBaseCost,50)}/a</strong> · nachher: <strong>${formatMoney(result.energy.annualCandidateCost,50)}/a</strong> · Einsparung: <strong>${formatMoney(result.energy.annualSavingsEur,50)}/a</strong></p><p>${result.comparison?.durableAdvantageYear!==null&&result.comparison?.durableAdvantageYear!==undefined?`Dauerhaft wirtschaftlich günstiger ab etwa Jahr ${Math.round(result.comparison.durableAdvantageYear)}.`:'Im Betrachtungszeitraum wird kein eindeutiger dauerhafter wirtschaftlicher Schnittpunkt ausgewiesen.'}</p><p class="print-funding-note">Förderungen wurden orientierend abgeschätzt. Förderfähige Kosten können auch notwendige Begleitarbeiten umfassen. Bitte klären Sie vor Beauftragung bzw. Umsetzung die tatsächliche Förderhöhe, Verfügbarkeit, Voraussetzungen, förderfähigen Kosten und Einreichfristen direkt mit den zuständigen Förderstellen.</p></section>`;
  }

  function persistSnapshot(result, project) {
    if (suppressRender) return;
    const snapshot={calculatedAt:new Date().toISOString(),modelVersion:economics.MODEL_VERSION,costDataVersion:costConfig?.version??null,systemCostDataVersion:systemCostConfig?.version??null,energyPriceVersion:energyPrices?.version??null,financialDefaultsVersion:financeConfig?.version??null,selectedMeasureIds:result.selected.map((m)=>m.id),totalInvestmentEur:result.totalInvestment,fundingEur:result.funding.total,netInvestmentEur:result.netInvestment,relevantInvestmentEur:result.relevantInvestment,annualEnergyCostBeforeEur:result.energy.annualBaseCost,annualEnergyCostAfterEur:result.energy.annualCandidateCost,annualSavingsEur:result.energy.annualSavingsEur,durableAdvantageYear:result.comparison?.durableAdvantageYear??null,advantagePresentValueEur:result.comparison?.advantagePresentValue??null,assumptions:result.assumptions};
    const old=project.economics?.latestCalculation; const sig=JSON.stringify({...snapshot,calculatedAt:null}); const oldSig=old?JSON.stringify({...old,calculatedAt:null}):null;
    if(sig!==oldSig){suppressRender=true;store.setPath('economics.latestCalculation',snapshot);suppressRender=false;}
  }

  function render(project) {
    if (suppressRender) return;
    renderBasis(project); renderAdvice(project); renderMeasures(project); renderFutureFit(project); renderResult(project); updateAddressAnalysisState(project); renderGeometryStatus(project);
  }

  function bindChoices() {
    [['reasonChoices','advice.reason'],['timeChoices','advice.timeHorizon'],['budgetChoices','advice.budgetBand']].forEach(([id,path])=>$(id).querySelectorAll('button').forEach((b)=>b.addEventListener('click',()=>store.setPath(path,b.dataset.value))));
    $('priorityChoices').querySelectorAll('button').forEach((b)=>b.addEventListener('click',()=>{const p=store.get().advice?.priorities??[];const next=p.includes(b.dataset.value)?p.filter((x)=>x!==b.dataset.value):[...p,b.dataset.value];store.setPath('advice.priorities',next);}));
    $('comparisonMode').querySelectorAll('button').forEach((b)=>b.addEventListener('click',()=>{store.setPath('modules.wirtschaftlichkeit.comparisonMode',b.dataset.value);$('comparisonMode').querySelectorAll('button').forEach((x)=>x.classList.toggle('is-selected',x===b));}));
  }

  function bindBasisInputs() {
    $('inputArea').addEventListener('change',()=>writeManualField('building.geometry.usableFloorArea',finite($('inputArea').value,null),'m²'));
    $('inputEnergy').addEventListener('change',()=>writeManualField('consumption.heating.annualEnergy',finite($('inputEnergy').value,null),'kWh/a'));
    $('inputConstructionYear').addEventListener('change',()=>writeManualField('building.profile.constructionYear',finite($('inputConstructionYear').value,null),'Jahr'));
    $('inputHeatingYear').addEventListener('change',()=>writeManualField('systems.heating.installationYear',finite($('inputHeatingYear').value,null),'Jahr'));
    $('inputEfficiency').addEventListener('change',()=>writeManualField('systems.heating.usefulHeatFactor',finite($('inputEfficiency').value,null),null));
    $('inputCarrier').addEventListener('change',()=>{writeManualField('systems.heating.energyCarrier',$('inputCarrier').value,null);const p=carrierItem($('inputCarrier').value);store.setPath(`economics.energyPriceOverrides.${$('inputCarrier').value}`,finite(p?.price,0));});
    $('inputEnergyPrice').addEventListener('change',()=>store.setPath(`economics.energyPriceOverrides.${$('inputCarrier').value}`,finite($('inputEnergyPrice').value,0)));
    $('inputPeriod').addEventListener('change',()=>store.setPath('economics.assumptions.periodYears',finite($('inputPeriod').value,30)));
  }

  function bindFunding() {
    [['State','state'],['Federal','federal'],['Other','other'],['Bonus','bonus']].forEach(([suffix,key])=>$( `fund${suffix}`).addEventListener('change',()=>store.setPath(`modules.wirtschaftlichkeit.funding.${key}`,finite($( `fund${suffix}`).value,0))));
    $('openFundingDetails').addEventListener('click',()=>{const details=$('costFundingDetails');details.open=true;details.scrollIntoView({behavior:'smooth',block:'nearest'});});
  }

  function bindFutureFit() {
    $('prepareMeasuresButton').addEventListener('click',()=>{prepareMeasures(false);$('futureFitHint').textContent='Maßnahmen wurden aus der aktuellen Projektbasis vorbereitet.';});
    $('futureFitButton').addEventListener('click',()=>{prepareMeasures(true);$('futureFitHint').textContent='Zukunftsfit-Vorschlag übernommen; nur noch notwendige Hüll-, Heizungs- und PV-Schritte wurden ausgewählt.';});
  }

  function updateAddressAnalysisState(project=store.get()) { const button=$('econAnalyzeLocation'),hint=$('econAnalysisHint');const address=pendingAddress??project.location?.addressRecord;const hasAddress=Boolean(address&&Number.isFinite(Number(address.latitude))&&Number.isFinite(Number(address.longitude)));const hasGeometry=Boolean(project.building?.identity?.objectId||finite(valueAt(project,'building.geometry.footprintArea'),null)>0);button.disabled=!hasAddress;button.textContent=hasGeometry?'Standort aktualisieren':'Standort analysieren';hint.textContent=!hasAddress?'Zuerst eine Adresse auswählen.':hasGeometry?'Gebäudegeometrie ist vorhanden und kann bei Bedarf aktualisiert werden.':'Adresse ist ausgewählt; TIRIS-Gebäude noch analysieren.'; }
  function renderGeometryStatus(project=store.get()) { const chip=$('geometryStatus');const objectId=project.building?.identity?.objectId;const area=finite(valueAt(project,'building.geometry.footprintArea'),null);if(objectId||area>0){chip.textContent=objectId?`TIRIS Gebäude ${objectId}`:'Projektgeometrie vorhanden';chip.className='status-chip is-success';}else{chip.textContent='noch keine Gebäudegeometrie';chip.className='status-chip';} }
  function preserveManualFields(next,previous){if(Array.isArray(next))return clone(next);if(!next||typeof next!=='object')return clone(next);const out=clone(next);Object.entries(previous??{}).forEach(([key,old])=>{if(resolver.isField(old)){const manual=old.candidates?.[model.ORIGIN.MANUAL];if(!manual)return;const base=resolver.isField(out[key])?out[key]:model.field(null,{unit:old.unit??null});base.candidates={...(base.candidates??{}),[model.ORIGIN.MANUAL]:clone(manual)};out[key]=model.finalizeField(base);}else if(old&&typeof old==='object'&&!Array.isArray(old))out[key]=preserveManualFields(out[key]??{},old);});return out;}
  function applyBuildingFeature(feature,mode='manual'){const current=store.get();const next=geometryService.toProjectBuilding(feature,mode);store.setPath('building',preserveManualFields(next,current.building));$('econBuildingCandidates').hidden=true;pendingAddress=null;}
  function renderBuildingCandidates(result){const host=$('econBuildingCandidates');if(!result.features.length){host.hidden=true;return;}host.hidden=false;host.innerHTML=`<strong>Gebäude bitte prüfen</strong>${result.features.map((feature,index)=>{const item=geometryService.candidateSummary(feature,index);return `<button type="button" data-building-index="${index}"><strong>${escapeHtml(item.label)}</strong><small>${item.areaM2!==null?`${number0.format(item.areaM2)} m² Dachprojektion`:''}${Number.isFinite(item.distanceM)?` · ca. ${number0.format(item.distanceM)} m`:''}</small></button>`;}).join('')}`;host.querySelectorAll('[data-building-index]').forEach((button)=>button.addEventListener('click',()=>applyBuildingFeature(result.features[Number(button.dataset.buildingIndex)],'manual')));}
  async function loadGeometry(address){$('geometryStatus').textContent='Gebäude wird zugeordnet …';try{const result=await geometryService.findCandidates(address,{maxRadiusM:30});if(result.automaticallySelected)applyBuildingFeature(result.automaticallySelected,'automatic');else renderBuildingCandidates(result);}catch(error){$('econAddressStatus').textContent=`Adresse übernommen; TIRIS-Gebäude konnte nicht geladen werden: ${error.message}`;}}
  function compactAddress(address){const keys=['id','label','street','house_number','postal_code','municipality','municipality_code','locality','latitude','longitude','address_latitude','address_longitude','coordinate_kind','cadastral_municipality_number','cadastral_municipality_numbers','source','source_id','dataset_date','license','address_code','subcode','tiris_layer_id','tiris_layer_label'];const out={};keys.forEach((key)=>{if(address?.[key]!==undefined&&address?.[key]!==null)out[key]=clone(address[key]);});return out;}
  async function selectAddress(address){const permission=await addressManager.requestSelection(address);if(!permission.allowed)return;$('econAddressStatus').textContent='Adresse wird mit TIRIS live abgeglichen …';let resolution={address,usedFallback:true};try{resolution=await hybridAddressProvider.resolve(address);}catch(error){console.warn(error);}const selected=resolution.address||address;const source=selected.source||'Gemeinsame Adresssuche';store.patch({project:{addressLabel:selected.label},location:{addressRecord:compactAddress(selected),address:model.field(selected.label,{origin:model.ORIGIN.OFFICIAL,source,dataDate:selected.dataset_date??null}),latitude:model.field(Number(selected.latitude),{unit:'°',origin:model.ORIGIN.OFFICIAL,source}),longitude:model.field(Number(selected.longitude),{unit:'°',origin:model.ORIGIN.OFFICIAL,source}),municipality:model.field(selected.municipality||null,{origin:model.ORIGIN.OFFICIAL,source}),municipalityCode:model.field(selected.municipality_code||null,{origin:model.ORIGIN.OFFICIAL,source})}});$('econAddressInput').value=selected.label;$('econAddressResults').hidden=true;$('econAddressStatus').textContent=resolution.usedFallback?(resolution.warning||'BEV-Adresse übernommen; kein eindeutiger TIRIS-Live-Treffer.'):'TIRIS-Live-Adresse übernommen.';pendingAddress=selected;updateAddressAnalysisState(store.get());}
  function renderAddressResults(results,guidance=''){const host=$('econAddressResults');if(!results.length){host.hidden=!guidance;host.innerHTML=guidance?`<small>${escapeHtml(guidance)}</small>`:'';return;}host.hidden=false;host.innerHTML=results.map((a,i)=>`<button type="button" data-address-index="${i}"><strong>${escapeHtml(a.label)}</strong><small>${escapeHtml(a.source||'Adressvorschlag')}</small></button>`).join('');host.querySelectorAll('[data-address-index]').forEach((b)=>b.addEventListener('click',()=>selectAddress(results[Number(b.dataset.addressIndex)])));}
  async function searchAddress(query){const seq=++addressSequence;const q=query.trim();if(q.length<3){renderAddressResults([],'Mindestens drei Zeichen eingeben.');return;}try{const result=await hybridAddressProvider.search(q,{limit:8});if(seq!==addressSequence)return;renderAddressResults(result.results??[],result.guidance??'');$('econAddressStatus').textContent=result.results?.length?'Adresse auswählen und anschließend den Standort analysieren.':(result.guidance||'Keine Adresse gefunden.');}catch(error){if(seq!==addressSequence)return;renderAddressResults([],error.message);}}
  async function initAddress(){const local=new global.BevLocalAddressProvider();const live=new global.TirisLiveAddressProvider();hybridAddressProvider=new global.HybridAddressProvider({suggestionProvider:local,liveProvider:live});try{await hybridAddressProvider.init();}catch(error){$('econAddressStatus').textContent=`Adressindex konnte nicht geladen werden: ${error.message}`;}$('econAddressInput').value=store.get().project?.addressLabel||'';$('econAddressInput').addEventListener('input',()=>{clearTimeout(addressTimer);addressTimer=setTimeout(()=>searchAddress($('econAddressInput').value),280);});pendingAddress=store.get().location?.addressRecord??null;$('econAnalyzeLocation').addEventListener('click',async()=>{const address=pendingAddress??store.get().location?.addressRecord;if(address)await loadGeometry(address);});}

  async function init(){try{await loadConfigs();populateCarrier(store.get());bindChoices();bindBasisInputs();bindFunding();bindFutureFit();await initAddress();$('printEconomicsButton').addEventListener('click',()=>{global.dispatchEvent(new CustomEvent('energy-tools:prepare-print'));requestAnimationFrame(()=>global.print());});store.subscribe((project)=>render(project));render(store.get());}catch(error){console.error(error);$('basisHint').textContent=`Prototyp konnte nicht vollständig geladen werden: ${error.message}`;$('basisHint').className='econ-hint is-warning';}}

  init();
})(window);
