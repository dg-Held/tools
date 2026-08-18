'use strict';

(function initEconomicsTool(global) {
  const store = global.EnergyToolsProjectStore;
  const model = global.EnergyToolsDataModel;
  const resolver = global.EnergyToolsValueResolver;
  const economics = global.EnergyEconomicsCore;
  const energyFlowCore = global.EnergyFlowCore;
  const anchorCore = global.EnergyConsumptionAnchorCore;
  const measureCore = global.EnvelopeRenovationCore;
  const projectEnergyAdapter = global.EnergyProjectEnergyAdapter;
  const renewalHorizonCore = global.EnergyRenewalHorizonCore;
  const paths = global.EnergyToolsPaths;
  const addressManager = global.EnergyToolsAddressManager;
  const geometryService = global.EnergyToolsBuildingGeometryService;

  if (!store || !model || !resolver || !economics || !energyFlowCore || !anchorCore || !measureCore || !projectEnergyAdapter || !renewalHorizonCore || !paths || !addressManager || !geometryService) {
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
    independence: '⚡ Autarkie & Sicherheit', value: '⌂ Werterhalt', effort: '⚒ geringer Aufwand',
  };
  const BUDGETS = {
    lt25: { label: '< 25 T€', min: 0, max: 25000 },
    '25-50': { label: '25–50 T€', min: 25000, max: 50000 },
    '50-100': { label: '50–100 T€', min: 50000, max: 100000 },
    gt100: { label: '> 100 T€', min: 100000, max: Infinity },
    open: { label: 'offen', min: null, max: null },
  };

  const QUICK_DEFINITIONS = [
    ...projectEnergyAdapter.DEFAULT_ENVELOPE_DEFINITIONS,
    { id: 'heating', componentId: 'heating', label: 'Heizungstausch', systemCostId: 'heat_pump_air', manualOnly: true },
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
  let energyFlowDefaults = null;
  let referenceConditionConfig = null;
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
    [financeConfig, energyPrices, costConfig, systemCostConfig, lifetimeConfig, targetsConfig, coBenefits, existingUValuesConfig, exchangeVariantsConfig, energyFlowDefaults, referenceConditionConfig] = await Promise.all([
      fetchJson('economics/financial-defaults.json'),
      fetchJson('economics/energy-prices.json'),
      fetchJson('costs/renovation-costs.json'),
      fetchJson('costs/system-costs.json'),
      fetchJson('standards/economics/component-lifetimes.json'),
      fetchJson('measures/envelope-targets.json'),
      fetchJson('measures/measure-effects.json'),
      fetchJson('building/existing-u-values.json'),
      fetchJson('measures/exchange-variants.json'),
      fetchJson('standards/energy-flow-v4-defaults.json'),
      fetchJson('economics/reference-condition-defaults.json'),
    ]);
  }

  function carrierItem(id) { return (energyPrices?.items ?? []).find((item) => item.id === id) ?? energyPrices?.items?.[0] ?? null; }
  function systemCost(id) { return (systemCostConfig?.items ?? []).find((item) => item.id === id && item.active !== false) ?? null; }
  function costModel(id) { return (costConfig?.models ?? []).find((item) => item.id === id && item.active !== false) ?? null; }
  function lifetimeFor(id) { return (lifetimeConfig?.items ?? []).find((item) => item.cost_model_id === id && item.active !== false) ?? null; }

  function referenceConditionState(id) {
    const states = referenceConditionConfig?.states ?? [];
    return states.find((item) => item.id === id) ?? states.find((item) => item.id === referenceConditionConfig?.default) ?? { id: 'age_appropriate', label: 'altersgerecht', horizon_factor: 1 };
  }
  function referenceConditionId(project, definition) {
    return project.modules?.wirtschaftlichkeit?.measureDrafts?.[definition.id]?.referenceCondition ?? referenceConditionConfig?.default ?? 'age_appropriate';
  }
  function referenceConditionLabel(id) { return referenceConditionState(id)?.label ?? 'altersgerecht'; }
  function maintenancePercentForLifetime(lifetime) { return Math.max(0, finite(lifetime?.maintenance_percent_initial_per_year, 0)); }

  function referenceCostFor(cost, quantity = 1, kind = 'area', conditionId = null) {
    const reference = cost?.reference ?? null;
    const mode = reference?.mode ?? (finite(cost?.sunk_cost_eur_m2, 0) > 0 ? 'renewal' : 'none');
    if (mode === 'none') return { value: 0, unitCost: 0, mode, label: reference?.label ?? 'keine regelmäßige Referenz-Erneuerung angesetzt', explicit: true };
    let unitCost = finite(reference?.default_cost, finite(cost?.sunk_cost_eur_m2, 0));
    if (reference?.condition_cost_mode === 'range' && reference?.range) {
      const key = referenceConditionState(conditionId)?.reference_cost_key ?? 'middle';
      unitCost = finite(reference.range[key], unitCost);
    }
    const value = kind === 'item' ? unitCost : Math.max(0, finite(quantity, 0)) * unitCost;
    return { value: Math.max(0, value), unitCost: Math.max(0, unitCost), mode, label: reference?.label ?? 'Referenz-Erneuerung', explicit: Boolean(reference) };
  }
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
      maintenanceEscalationPercent: finite(project.economics?.assumptions?.maintenanceEscalationPercent, d.maintenance_labor_escalation_percent ?? 3.2),
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

  function writeManualField(path, value, unit = null, source = 'Nutzereingabe Wirtschaftlichkeit V1.0') {
    if (value === null || value === '') store.clearFieldCandidate(path, model.ORIGIN.MANUAL);
    else store.setFieldCandidate(path, model.ORIGIN.MANUAL, value, { unit, source });
  }

  function renderBasis(project) {
    const area = describeAt(project, 'building.geometry.heatedFloorArea');
    const usable = describeAt(project, 'building.geometry.usableFloorArea');
    const energy = describeAt(project, 'consumption.heating.annualEnergy');
    const personsInfo = describeAt(project, 'usage.household.persons');
    const hotWaterInfo = describeAt(project, 'systems.heating.hotWaterIncluded');
    const carrierId = currentCarrier(project);
    const carrier = carrierItem(carrierId);
    const price = currentEnergyPrice(project, carrierId);
    const effectiveArea = finite(area.value, finite(usable.value, null));
    const annualEnergy = finite(energy.value, null);
    const annualCost = annualEnergy !== null ? annualEnergy * price : null;
    const a = energyFlowDefaults?.assumptions ?? {};
    const hotWaterIncluded = Boolean(valueAt(project, 'systems.heating.hotWaterIncluded', a.hot_water_included ?? true));
    const persons = finite(valueAt(project, 'usage.household.persons', a.persons ?? 4), a.persons ?? 4);

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
    if (document.activeElement !== $('inputHotWaterIncluded')) $('inputHotWaterIncluded').value = String(hotWaterIncluded);
    if (document.activeElement !== $('inputPersons')) $('inputPersons').value = persons ?? '';
    if (document.activeElement !== $('inputEfficiency')) $('inputEfficiency').value = valueAt(project, 'systems.heating.usefulHeatFactor', 0.85) ?? 0.85;
    if (document.activeElement !== $('inputPeriod')) $('inputPeriod').value = currentAssumptions(project).periodYears;
    $('energyPriceSource').textContent = project.economics?.energyPriceOverrides?.[carrierId] !== undefined ? 'projektspezifisch' : `zentraler Richtwert · ${energyPrices?.data_date ?? '–'}`;

    let quality = 'orientierend'; let cls = '';
    const known = [effectiveArea, annualEnergy, valueAt(project, 'building.profile.constructionYear', null), valueAt(project, 'systems.heating.usefulHeatFactor', null)].filter((v) => v !== null && v !== undefined).length;
    if (known >= 4 && project.modules?.energiefluss?.resultSummary) { quality = 'objektspezifisch'; cls = 'is-success'; }
    else if (known >= 2) { quality = 'gute Abschätzung'; cls = 'is-working'; }

    const consistency = energyConsistency(project);
    if (consistency.level === 'strong') { quality = 'Grundlagen prüfen'; cls = ''; }
    else if (consistency.level === 'check' && quality === 'objektspezifisch') { quality = 'Plausibilität prüfen'; cls = 'is-working'; }
    $('basisQuality').textContent = quality;
    $('basisQuality').className = `status-chip ${cls}`.trim();

    const missing = [];
    if (!(effectiveArea > 0)) missing.push('beheizte Fläche');
    if (!(annualEnergy > 0)) missing.push('Heizenergieverbrauch');
    if (!valueAt(project, 'building.profile.constructionYear', null)) missing.push('Baujahr');
    if (!missing.length) {
      const hints = [];
      if (!valueAt(project, 'systems.heating.installationYear', null)) hints.push('Das Baujahr der Heizung verbessert den Vergleich „Tausch jetzt oder später“.');
      if (hotWaterIncluded && (!personsInfo || personsInfo.origin === model.ORIGIN.FALLBACK || personsInfo.value === null)) hints.push('Eine bestätigte Personenzahl verbessert den Warmwasserabzug.');
      $('basisHint').textContent = hints.length ? `Gute Berechnungsbasis. ${hints.join(' ')}` : 'Gute Berechnungsbasis: die wesentlichen Projektwerte sind vorhanden.';
      $('basisHint').className = 'econ-hint is-info';
    } else {
      $('basisHint').textContent = `${missing.length} Ergänzung${missing.length === 1 ? '' : 'en'} verbessern die Aussage: ${missing.join(', ')}.`;
      $('basisHint').className = 'econ-hint is-warning';
    }

    const consistencyBox = $('energyConsistencyHint');
    if (consistency.level === 'strong' || consistency.level === 'check') {
      const impact = consistency.impact;
      const corrected = impact?.correctedHwbKwhM2a;
      const physical = impact?.physicalHwbKwhM2a;
      const climateNote = consistency.climateFallback ? ' · Klima derzeit Tirol-Fallback' : '';
      consistencyBox.hidden = false;
      consistencyBox.textContent = `${consistency.level === 'strong' ? 'Hüllzustand prüfen' : 'Hüllmodell plausibilisieren'}: verbrauchsbasiert korrigiert ca. ${number0.format(roundTo(corrected, 1))} kWh/m²a, U-Wert-Modell ca. ${number0.format(roundTo(physical, 1))} kWh/m²a${climateNote}. Die Einsparung wird am realen Verbrauch verankert; bereits sanierte Bauteile bzw. Bestands-U-Werte sollten bei dieser Abweichung geprüft werden.`;
    } else {
      consistencyBox.hidden = true;
      consistencyBox.textContent = '';
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
    renderChoiceGroup('timeChoices', advice.timeHorizon === '3-10' ? '3-7' : (advice.timeHorizon ?? null));
    renderChoiceGroup('budgetChoices', advice.budgetBand ?? null);
    renderChoiceGroup('priorityChoices', Array.isArray(advice.priorities) ? advice.priorities : [], true);
    $('goalStatus').textContent = advice.reason || advice.timeHorizon || advice.priorities?.length ? 'Rahmen gesetzt' : 'offen';
    $('goalStatus').className = `status-chip ${advice.priorities?.length ? 'is-success' : ''}`.trim();
  }

  function periodIdForYear(year) {
    return projectEnergyAdapter.periodIdForYear(year, existingUValuesConfig);
  }

  function constructionUValue(project, definition) {
    return projectEnergyAdapter.constructionUValue(project, definition, existingUValuesConfig);
  }

  function componentEnvelopeRelevant(project, definition) {
    return projectEnergyAdapter.componentEnvelopeRelevant(project, definition);
  }

  function energyFlowAssumptions() {
    return projectEnergyAdapter.energyFlowAssumptions(energyFlowDefaults);
  }

  function climateForEnergyModel(project) {
    return projectEnergyAdapter.climateForEnergyModel(project, energyFlowDefaults, { hgtFallbackKd: HGT_FALLBACK_TIROL });
  }

  function energyModelInputs(project, selected = [], candidate = false) {
    return projectEnergyAdapter.energyModelInputs(
      project,
      QUICK_DEFINITIONS.filter((definition) => !definition.manualOnly),
      selected,
      candidate,
      { energyFlowDefaults, existingUValuesConfig, hgtFallbackKd: HGT_FALLBACK_TIROL }
    );
  }

  function anchoredImpact(project, selected = []) {
    return anchorCore.compare(energyModelInputs(project, selected, false), energyModelInputs(project, selected, true));
  }

  function energyConsistency(project) {
    const annualEnergy = finite(valueAt(project, 'consumption.heating.annualEnergy', null), null);
    if (!(annualEnergy > 0)) return { level: 'none', impact: null };
    const impact = anchoredImpact(project, []);
    const deviation = finite(impact.hwbDeviationPercent, null);
    if (deviation === null) return { level: 'none', impact };
    const absolute = Math.abs(deviation);
    const level = absolute > 60 ? 'strong' : absolute > 30 ? 'check' : 'ok';
    return { level, impact, deviation, climateFallback: Boolean(impact.base?.plausibility?.source?.includes('Fallback')) };
  }

  function referenceTimingText(value) {
    const year = finite(value, null);
    if (year === null) return 'offen';
    if (year <= 0) return 'jetzt / kurzfristig';
    return `ca. ${number0.format(year)} J.`;
  }

  function referenceTiming(project, definition, lifetimeYears, conditionId = null) {
    const draft = project.modules?.wirtschaftlichkeit?.measureDrafts?.[definition.id] ?? {};
    const result = renewalHorizonCore.calculate({
      currentYear: CURRENT_YEAR,
      explicitOffsetYears: draft.referenceYear,
      explicitConfirmed: Boolean(draft.referenceYearConfirmed),
      lastRenewalYear: draft.lastRenewalYear,
      constructionYear: valueAt(project, 'building.profile.constructionYear', null),
      lifetimeYears,
      condition: referenceConditionState(conditionId ?? referenceConditionId(project, definition)),
    });
    return result.years;
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
    const referenceCondition = draft.referenceCondition ?? referenceConditionConfig?.default ?? 'age_appropriate';
    const maintenancePercent = maintenancePercentForLifetime(life);
    const referenceMeta = cost?.reference ?? null;
    const referenceMode = referenceMeta?.mode ?? (finite(cost?.sunk_cost_eur_m2, 0) > 0 ? 'renewal' : 'none');
    const referenceYearAuto = ['none','project_specific'].includes(referenceMode) ? null : referenceTiming(project, definition, lifetimeYears, referenceCondition);
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
      referenceCost = referenceCostFor(cost, definition.kind === 'door' ? 1 : (area ?? 0), definition.kind === 'door' ? 'item' : 'area', referenceCondition).value;
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
        referenceCost = referenceCostFor(cost, area ?? 0, 'area', referenceCondition).value;
        selectedVariantLabel = `${number0.format(thickness)} cm`; 
      }
    }

    const energy = newU && u.value ? measureCore.energyEffect({ ...energyInputs, newUValue: newU }) : { available: false };
    const prepared = Boolean(draft.prepared || project.modules?.wirtschaftlichkeit?.autoPreparedAt);
    const referenceYear = draft.referenceYearConfirmed ? finite(draft.referenceYear, referenceYearAuto) : referenceYearAuto;
    const fullInvestmentManual = Boolean(draft.fullInvestmentManual);
    const referenceCostManual = Boolean(draft.referenceCostManual);
    const energySavingsManual = Boolean(draft.energySavingsManual);
    const dataQuality = area && u.value && energy.available ? (u.fallback || existingLoss === null ? 'gute Abschätzung' : 'objektspezifisch') : 'orientierend';
    return {
      id: definition.id, label: definition.label, componentId: definition.componentId, source: prepared ? 'Wirtschaftlichkeit · automatisch vorbereitet' : 'Vorschlag aus Projektbasis',
      selected: prepared ? Boolean(draft.selected) : false, prepared,
      fullInvestmentEur: fullInvestmentManual ? finite(draft.fullInvestmentEur, fullInvestment) : fullInvestment,
      fullInvestmentAutoEur: fullInvestment, fullInvestmentManual,
      referenceCostEur: referenceCostManual ? finite(draft.referenceCostEur, referenceCost) : referenceCost,
      referenceCostAutoEur: referenceCost, referenceCostManual,
      referenceMode, referenceLabel: referenceMeta?.label ?? (referenceMode === 'none' ? 'keine regelmäßige Referenz-Erneuerung angesetzt' : 'Referenz-Erneuerung'),
      referenceYear, referenceYearAuto, referenceYearManual: Boolean(draft.referenceYearConfirmed),
      deliveredSavingsKwh: energySavingsManual ? roundTo(finite(draft.deliveredSavingsKwh, 0), 10) : 0,
      energySavingsManual,
      lifetimeYears, maintenancePercent, referenceCondition, manualOnly: false, informational: false, dataQuality, areaM2: area,
      existingUValue: u.value, targetUValue: newU, costRange: cost?.range_eur_m2 ?? null,
      selectedVariantLabel, energyMethod: energySavingsManual ? 'manueller Override' : 'verbrauchsverankert · wird live berechnet', fundingEntries: [], fundingEur: 0,
      note: referenceMode === 'project_specific' && referenceCost > 0 ? 'Referenzkosten sind vorhanden; der tatsächliche Erneuerungszeitpunkt ist projektspezifisch zu bestätigen.' : (referenceYearAuto === null && referenceCost > 0 && referenceMode !== 'none' ? 'Bauteilalter unbekannt: Referenzkosten werden konservativ noch nicht angerechnet.' : null),
    };
  }

  function systemFallbackMeasure(project, definition) {
    const draft = project.modules?.wirtschaftlichkeit?.measureDrafts?.[definition.id] ?? {};
    const config = systemCost(definition.systemCostId);
    const prepared = Boolean(draft.prepared || project.modules?.wirtschaftlichkeit?.autoPreparedAt);
    const middle = finite(config?.range?.middle, 0);
    const lifetimeYears = finite(draft.lifetimeYears, finite(config?.lifetime_years, definition.id === 'heating' ? 18 : 25));
    const referenceCondition = draft.referenceCondition ?? referenceConditionConfig?.default ?? 'age_appropriate';
    const maintenancePercent = Math.max(0, finite(config?.maintenance_percent_initial_per_year, 0));
    let referenceCost = 0;
    let referenceYear = null;
    let deliveredSavingsKwh = 0;
    let note = null;
    if (definition.id === 'heating') {
      const installYear = finite(valueAt(project, 'systems.heating.installationYear', null), null);
      const baseLife = finite(systemCostConfig?.reference_strategy?.heat_generator?.typical_lifetime_years, finite(config?.reference_lifetime_years, 20));
      const condition = referenceConditionState(referenceCondition);
      const horizonLife = baseLife * Math.max(0.5, finite(condition?.horizon_factor, 1));
      referenceYear = installYear ? Math.max(0, horizonLife - Math.max(0, CURRENT_YEAR - installYear)) : null;
      referenceCost = installYear ? middle : 0;
      const annualEnergy = finite(valueAt(project, 'consumption.heating.annualEnergy', null), 0);
      const eta = finite(valueAt(project, 'systems.heating.usefulHeatFactor', 0.85), 0.85);
      const targetEta = finite(config?.target_efficiency, 3.2);
      deliveredSavingsKwh = annualEnergy > 0 ? Math.max(0, annualEnergy - annualEnergy * eta / targetEta) : 0;
      note = installYear ? `Referenz: Ersatz in ca. ${referenceYear} Jahren.` : 'Heizungsbaujahr ergänzt den Vergleich „jetzt oder später“.';
    } else if (definition.id === 'pv') {
      note = 'Kosten und Finanzierung werden berücksichtigt; PV ist bis zum Ertrags-/Eigenverbrauchsadapter bewusst nicht Teil der Lebenszyklus-Wirtschaftlichkeitskurve.';
    }
    const fullInvestment = definition.id === 'pv' ? middle * finite(config?.default_size_kwp, 10) : middle;
    const fullInvestmentManual = Boolean(draft.fullInvestmentManual);
    const referenceCostManual = Boolean(draft.referenceCostManual);
    return {
      id: definition.id, label: definition.label, componentId: definition.componentId, source: prepared ? 'Wirtschaftlichkeit · Systemvorschlag' : 'Systemvorschlag',
      selected: prepared ? Boolean(draft.selected) : false, prepared,
      fullInvestmentEur: fullInvestmentManual ? finite(draft.fullInvestmentEur, fullInvestment) : fullInvestment,
      fullInvestmentAutoEur: fullInvestment, fullInvestmentManual,
      referenceCostEur: referenceCostManual ? finite(draft.referenceCostEur, referenceCost) : referenceCost,
      referenceCostAutoEur: referenceCost, referenceCostManual,
      referenceMode: definition.id === 'heating' ? 'renewal' : 'none', referenceLabel: definition.id === 'heating' ? 'späterer Ersatz des Wärmeerzeugers' : 'keine Referenz-Erneuerung angesetzt',
      referenceYear: draft.referenceYearConfirmed ? finite(draft.referenceYear, referenceYear) : referenceYear,
      referenceYearAuto: referenceYear, referenceYearManual: Boolean(draft.referenceYearConfirmed),
      deliveredSavingsKwh: finite(draft.deliveredSavingsKwh, deliveredSavingsKwh),
      lifetimeYears, maintenancePercent, referenceCondition, manualOnly: true, informational: Boolean(definition.informational), dataQuality: 'orientierend', fundingEntries: [], fundingEur: 0,
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
    const storedFrameMaterial = stored.selectedVariant?.frameMaterial ?? stored.costModel?.frameMaterial ?? null;
    const lifetimeEntry = storedFrameMaterial
      ? (lifetimeConfig?.items ?? []).find((item) => item.cost_model_id === definition.costModelId && item.frame_material === storedFrameMaterial) ?? lifetimeFor(definition.costModelId)
      : lifetimeFor(definition.costModelId);
    const lifetimeYears = finite(draft.lifetimeYears, finite(stored.costModel?.lifetimeYears, finite(lifetimeEntry?.years, 40)));
    const maintenancePercent = Math.max(0, finite(stored.costModel?.maintenancePercent, maintenancePercentForLifetime(lifetimeEntry)));
    const referenceCondition = draft.referenceCondition ?? referenceConditionConfig?.default ?? 'age_appropriate';
    const fallbackMeasureData = envelopeFallbackMeasure(project, definition);
    const storedReference = finite(stored.sunkCosts?.totalEur, 0);
    const storedReferenceRate = finite(stored.sunkCosts?.rate, finite(stored.sunkCosts?.rateEurM2, null));
    const model = costModel(definition.costModelId);
    const modelReferenceDefault = finite(model?.reference?.default_cost, finite(model?.sunk_cost_eur_m2, null));
    const storedReferenceLooksAutomatic = storedReference > 0 && storedReferenceRate !== null && modelReferenceDefault !== null && Math.abs(storedReferenceRate - modelReferenceDefault) < 0.01;
    const referenceMode = storedReference > 0 ? 'renewal' : fallbackMeasureData.referenceMode;
    const referenceYearAuto = ['none','project_specific'].includes(referenceMode) ? null : referenceTiming(project, definition, lifetimeYears, referenceCondition);
    const fallbackReference = fallbackMeasureData.referenceCostEur;
    const referenceCostAuto = storedReference > 0 && !storedReferenceLooksAutomatic ? storedReference : fallbackReference;
    const referenceYear = draft.referenceYearConfirmed ? finite(draft.referenceYear, referenceYearAuto) : referenceYearAuto;
    const energySavingsManual = Boolean(draft.energySavingsManual);
    const fullInvestmentAuto = finite(stored.costModel?.fullInvestmentEur, 0);
    const fullInvestmentManual = Boolean(draft.fullInvestmentManual);
    const referenceCostManual = Boolean(draft.referenceCostManual);
    return {
      id: definition.id, label: stored.title ?? definition.label, componentId: stored.componentId ?? definition.componentId,
      source: 'Bauteil & Sanierung', selected: draft.selected !== undefined ? Boolean(draft.selected) : true, prepared: true,
      fullInvestmentEur: fullInvestmentManual ? finite(draft.fullInvestmentEur, fullInvestmentAuto) : fullInvestmentAuto,
      fullInvestmentAutoEur: fullInvestmentAuto, fullInvestmentManual,
      referenceCostEur: referenceCostManual ? finite(draft.referenceCostEur, referenceCostAuto) : referenceCostAuto,
      referenceCostAutoEur: referenceCostAuto, referenceCostManual,
      referenceMode, referenceLabel: storedReference > 0 ? 'Referenz aus Bauteil & Sanierung' : fallbackMeasureData.referenceLabel,
      referenceYear, referenceYearAuto, referenceYearManual: Boolean(draft.referenceYearConfirmed),
      deliveredSavingsKwh: energySavingsManual ? roundTo(finite(draft.deliveredSavingsKwh, 0), 10) : 0,
      energySavingsManual,
      lifetimeYears, maintenancePercent, referenceCondition,
      dataQuality: 'objektspezifisch', areaM2: finite(stored.existingState?.areaM2, null), existingUValue: finite(stored.existingState?.uValue, null), targetUValue: finite(stored.selectedVariant?.uValue, null),
      manualOnly: false, informational: false, fundingEntries, fundingEur,
      energyMethod: energySavingsManual ? 'manueller Override' : 'verbrauchsverankert · wird live berechnet',
      note: referenceYearAuto === null && referenceCostAuto > 0 && referenceMode !== 'none' ? 'Referenzzeitpunkt prüfen.' : null,
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

    measures.forEach((item) => {
      if (item.manualOnly || item.energySavingsManual) return;
      const impact = anchoredImpact(project, [item]);
      item.deliveredSavingsAutoKwh = impact.available ? roundTo(Math.max(0, impact.deliveredSavingsKwh), 10) : 0;
      if (!item.energySavingsManual) item.deliveredSavingsKwh = item.deliveredSavingsAutoKwh;
      item.energyMethod = impact.available ? 'verbrauchsverankert · relative Hüllwirkung' : 'Einsparung noch nicht berechenbar';
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
    const openMeasureIds = new Set([...document.querySelectorAll('.measure-item details[open]')].map((details) => details.closest('.measure-item')?.dataset.measureId).filter(Boolean));
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
      const referenceValue = item.referenceYear === null || item.referenceYear === undefined ? '' : item.referenceYear;
      const energyValue = item.deliveredSavingsKwh > 0 ? roundTo(item.deliveredSavingsKwh, 10) : '';
      const energyNote = item.energySavingsManual ? 'manueller Override' : 'automatisch · realer Verbrauch × relative Hüllwirkung';
      const fullCostNote = item.fullInvestmentManual ? 'manuell überschrieben' : 'automatisch / Projektdaten bzw. Richtwert';
      const referenceCostNote = item.referenceMode === 'none'
        ? 'keine reguläre Referenz-Erneuerung angesetzt'
        : item.referenceCostEur > 0
          ? (item.referenceCostManual ? 'manuell überschrieben' : 'automatisch / Referenzkostenmodell')
          : item.referenceMode === 'project_specific' ? 'projektspezifisch prüfen' : 'Referenzkosten noch offen';
      const referenceTimingNote = item.referenceMode === 'none'
        ? 'kein Referenzzeitpunkt erforderlich'
        : item.referenceYearManual ? `${referenceTimingText(item.referenceYear)} · manuell` : `${referenceTimingText(item.referenceYear)} · automatisch`;
      const fundingCard = item.fundingEur > 0 ? `<small class="measure-card-funding">Förderung bis zu ${escapeHtml(formatMoney(item.fundingEur))}</small>` : '';
      const reset = (field, visible) => visible ? `<button class="measure-reset" data-reset-field="${field}" type="button">↺ automatisch</button>` : '';
      return `<div class="measure-item ${disabled ? 'is-unprepared' : ''}" data-measure-id="${escapeHtml(item.id)}"><div class="measure-item-header"><input type="checkbox" ${item.selected ? 'checked' : ''} ${disabled ? 'disabled' : ''} aria-label="${escapeHtml(item.label)} auswählen"><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.source)} · ${escapeHtml(item.dataQuality)}</small>${item.note ? `<small class="measure-note">${escapeHtml(item.note)}</small>` : ''}</div><div class="measure-item-values"><strong>${cost}</strong><small>${escapeHtml(saving)}</small>${fundingCard}</div></div><details ${openMeasureIds.has(item.id) ? 'open' : ''}><summary>Werte prüfen</summary><div class="measure-detail-grid"><label><span>Vollkosten</span><div class="input-with-unit measure-input-unit"><input data-field="fullInvestmentEur" type="number" min="0" step="500" value="${item.fullInvestmentEur || ''}"><em>€</em></div><div class="measure-field-meta"><small class="measure-field-note">${escapeHtml(fullCostNote)}</small>${reset('fullInvestmentEur', item.fullInvestmentManual)}</div></label><label><span>Referenz-Erneuerung</span><div class="input-with-unit measure-input-unit"><input data-field="referenceCostEur" type="number" min="0" step="500" value="${item.referenceCostEur || ''}" placeholder="offen"><em>€</em></div><div class="measure-field-meta"><small class="measure-field-note">${escapeHtml(referenceCostNote)}</small>${reset('referenceCostEur', item.referenceCostManual)}</div></label><label><span>Referenz in</span><div class="input-with-unit measure-input-unit"><input data-field="referenceYear" type="number" min="0" max="60" step="1" value="${referenceValue}" placeholder="offen"><em>J.</em></div><div class="measure-field-meta"><small class="measure-field-note">${escapeHtml(referenceTimingNote)}</small>${reset('referenceYear', item.referenceYearManual)}</div></label><label><span>Energieeinsparung</span><div class="input-with-unit measure-input-unit measure-input-unit--energy"><input data-field="deliveredSavingsKwh" type="number" min="0" step="10" value="${energyValue}" placeholder="offen"><em>kWh/a</em></div><div class="measure-field-meta"><small class="measure-field-note">${escapeHtml(energyNote)}</small>${reset('deliveredSavingsKwh', item.energySavingsManual)}</div></label></div>${item.referenceMode !== 'none' ? `<label class="measure-condition-field"><span>Zustand / Erneuerungshorizont</span><select data-field="referenceCondition">${(referenceConditionConfig?.states ?? []).map((state)=>`<option value="${escapeHtml(state.id)}" ${state.id === item.referenceCondition ? 'selected' : ''}>${escapeHtml(state.label)} · ${escapeHtml(state.scope_hint ?? '')}</option>`).join('')}</select><small>${escapeHtml(referenceConditionState(item.referenceCondition)?.description ?? '')} Ein konkreter Termin oder manueller Referenzzeitpunkt hat Vorrang. Bei dafür freigegebenen Referenzmodellen passt der Zustand auch den automatischen Referenzumfang an; manuelle Kosten bleiben unverändert.</small></label>` : ''}</details></div>`;
    }).join('');
    $('measureList').querySelectorAll('.measure-item').forEach((row) => {
      const id = row.dataset.measureId;
      row.querySelector('input[type="checkbox"]').addEventListener('change', (event) => saveMeasureDraft(id, { selected: event.target.checked, prepared: true }));
      row.querySelectorAll('[data-field]').forEach((input) => input.addEventListener('change', () => {
        const field = input.dataset.field;
        if (field === 'referenceCondition') {
          saveMeasureDraft(id, { referenceCondition: input.value || 'age_appropriate', referenceYear: null, referenceYearConfirmed: false, prepared: true });
        } else if (field === 'referenceYear') {
          if (input.value === '') saveMeasureDraft(id, { referenceYear: null, referenceYearConfirmed: false, prepared: true });
          else saveMeasureDraft(id, { referenceYear: Math.max(0, finite(input.value, 0)), referenceYearConfirmed: true, prepared: true });
        } else if (field === 'deliveredSavingsKwh') {
          if (input.value === '') saveMeasureDraft(id, { deliveredSavingsKwh: null, energySavingsManual: false, prepared: true });
          else saveMeasureDraft(id, { deliveredSavingsKwh: Math.max(0, roundTo(finite(input.value, 0), 10)), energySavingsManual: true, prepared: true });
        } else if (field === 'fullInvestmentEur') {
          if (input.value === '') saveMeasureDraft(id, { fullInvestmentEur: null, fullInvestmentManual: false, prepared: true });
          else saveMeasureDraft(id, { fullInvestmentEur: Math.max(0, finite(input.value, 0)), fullInvestmentManual: true, prepared: true });
        } else if (field === 'referenceCostEur') {
          if (input.value === '') saveMeasureDraft(id, { referenceCostEur: null, referenceCostManual: false, prepared: true });
          else saveMeasureDraft(id, { referenceCostEur: Math.max(0, finite(input.value, 0)), referenceCostManual: true, prepared: true });
        }
      }));
      row.querySelectorAll('[data-reset-field]').forEach((button) => button.addEventListener('click', () => {
        const field = button.dataset.resetField;
        if (field === 'deliveredSavingsKwh') saveMeasureDraft(id, { deliveredSavingsKwh: null, energySavingsManual: false, prepared: true });
        else if (field === 'referenceYear') saveMeasureDraft(id, { referenceYear: null, referenceYearConfirmed: false, prepared: true });
        else if (field === 'fullInvestmentEur') saveMeasureDraft(id, { fullInvestmentEur: null, fullInvestmentManual: false, prepared: true });
        else if (field === 'referenceCostEur') saveMeasureDraft(id, { referenceCostEur: null, referenceCostManual: false, prepared: true });
      }));
    });
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
          fullInvestmentEur: current.fullInvestmentManual ? finite(current.fullInvestmentEur, item.fullInvestmentEur) : null,
          fullInvestmentManual: Boolean(current.fullInvestmentManual),
          referenceCostEur: current.referenceCostManual ? finite(current.referenceCostEur, item.referenceCostEur) : null,
          referenceCostManual: Boolean(current.referenceCostManual),
          referenceYear: current.referenceYearConfirmed ? finite(current.referenceYear, item.referenceYear) : null,
          referenceYearConfirmed: Boolean(current.referenceYearConfirmed),
          deliveredSavingsKwh: current.energySavingsManual ? roundTo(finite(current.deliveredSavingsKwh, 0), 10) : null,
          energySavingsManual: Boolean(current.energySavingsManual),
          lifetimeYears: finite(current.lifetimeYears, item.lifetimeYears),
          selected: selectFutureFit ? neededIds.includes(item.id) : Boolean(current.selected),
        });
      });
      store.setPath('modules.wirtschaftlichkeit.autoPreparedAt', new Date().toISOString());
    });
    suppressRender = false;
    render(store.get());
  }
  function envelopeFutureFitState(candidate = false) {
    const selectedIds = new Set(candidate ? selectedMeasures().map((item) => item.id) : []);
    const relevant = measures.filter((item) => !item.manualOnly && finite(item.areaM2, 0) > 0 && finite(item.targetUValue, null) > 0);
    const known = relevant.filter((item) => finite(item.existingUValue, null) > 0);
    if (!known.length) return { state: 'open', note: 'offen' };
    let good = 0;
    known.forEach((item) => {
      const value = candidate && selectedIds.has(item.id) && finite(item.targetUValue, null) > 0 ? item.targetUValue : item.existingUValue;
      if (value <= item.targetUValue * 1.05) good += 1;
    });
    if (good === 0) return { state: 'needs', note: 'Sanierung nötig' };
    if (known.length === relevant.length && good === known.length) return { state: 'done', note: 'zukunftsfit' };
    const share = good / Math.max(1, known.length);
    if (share >= 0.75) return { state: 'advanced', note: 'weitgehend' };
    return { state: 'partial', note: 'teilweise' };
  }

  function techniqueFutureFitState(project, candidate = false) {
    const selectedHeating = candidate ? selectedMeasures().find((item) => item.id === 'heating') : null;
    if (selectedHeating) return { state: 'done', note: 'zukunftsfähig' };
    const carrier = valueAt(project, 'systems.heating.energyCarrier', null);
    const efficiency = finite(valueAt(project, 'systems.heating.usefulHeatFactor', null), null);
    const installYear = finite(valueAt(project, 'systems.heating.installationYear', null), null);
    if (!carrier && efficiency === null && !installYear) return { state: 'open', note: 'offen' };
    const age = installYear ? Math.max(0, CURRENT_YEAR - installYear) : null;
    if (age !== null && age >= 20) return { state: 'needs', note: 'erneuerungsnah' };
    if (carrier === 'electricity' && efficiency !== null && efficiency >= 2.5) return { state: 'done', note: 'zukunftsfähig' };
    if (carrier === 'district_heat' && (age === null || age < 20)) return { state: 'advanced', note: 'gut' };
    return { state: 'partial', note: 'prüfen' };
  }

  function fossilFutureFitState(project, candidate = false) {
    const selectedHeating = candidate ? selectedMeasures().find((item) => item.id === 'heating') : null;
    const carrier = selectedHeating?.targetCarrierId ?? valueAt(project, 'systems.heating.energyCarrier', null);
    if (!carrier) return { state: 'open', note: 'offen' };
    const fossilFree = ['electricity','district_heat','wood','pellets'].includes(carrier);
    return fossilFree ? { state: 'done', note: selectedHeating ? 'vorgesehen' : 'erfüllt' } : { state: 'needs', note: 'fossil' };
  }

  function pvFutureFitState(project, candidate = false) {
    const selectedPv = candidate ? selectedMeasures().some((item) => item.id === 'pv') : false;
    if (selectedPv) return { state: 'done', note: 'vorgesehen' };
    const installed = Boolean(project.systems?.pv?.installed || project.modules?.pv?.resultSummary);
    if (installed) return { state: 'done', note: 'vorhanden' };
    if (hasOwn(project.systems?.pv, 'installed')) return { state: 'needs', note: 'nicht vorhanden' };
    return { state: 'open', note: 'offen' };
  }

  function futureFitSteps(project, candidate = false) {
    return [
      ['Hülle', envelopeFutureFitState(candidate)],
      ['Technik', techniqueFutureFitState(project, candidate)],
      ['fossilfrei', fossilFutureFitState(project, candidate)],
      ['PV', pvFutureFitState(project, candidate)],
    ];
  }

  function renderFutureFitTrack(id, steps) {
    const host = $(id);
    if (!host) return;
    host.innerHTML = steps.map(([label, info], i) => {
      const cls = info.state === 'done' ? 'is-done' : info.state === 'advanced' ? 'is-advanced' : info.state === 'partial' ? 'is-partial' : info.state === 'needs' ? 'is-needs' : '';
      return `<div class="future-step ${cls}"><i>${i+1}</i><span>${escapeHtml(label)}</span><small>${escapeHtml(info.note)}</small></div>`;
    }).join('');
  }

  function renderFutureFit(project) {
    renderFutureFitTrack('futureFitTrack', futureFitSteps(project, false));
    renderFutureFitTrack('futureFitResultTrack', futureFitSteps(project, true));
  }
  function needsFutureFitMeasure(project, item) {
    if (item.id === 'heating') return !['electricity','district_heat','wood','pellets'].includes(currentCarrier(project));
    if (item.id === 'pv') return !(project.systems?.pv?.installed || project.modules?.pv?.resultSummary);
    if (item.targetUValue && item.existingUValue) return item.existingUValue > item.targetUValue * 1.05;
    return Boolean(item.prepared || item.areaM2 > 0);
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
    const envelope = selected.filter((item) => !['heating','pv'].includes(item.id));
    const automaticEnvelope = envelope.filter((item) => !item.energySavingsManual);
    const manualEnvelope = envelope.filter((item) => item.energySavingsManual);
    const impact = anchoredImpact(project, automaticEnvelope);
    const baseRoomHeat = impact.base?.consumption?.roomHeatKwh ?? annualEnergy * efficiency;
    const hotWaterKwh = impact.base?.losses?.hotWaterKwh ?? 0;
    let roomHeatAfter = impact.available ? impact.realRoomAfterKwh : baseRoomHeat;
    const manualUsefulSavings = manualEnvelope.reduce((sum, item) => sum + Math.max(0, finite(item.deliveredSavingsKwh, 0)) * efficiency, 0);
    roomHeatAfter = Math.max(0, roomHeatAfter - Math.min(roomHeatAfter, manualUsefulSavings));
    const usefulAfter = roomHeatAfter + hotWaterKwh;
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
      annualBaseCost, annualCandidateCost, annualSavingsEur: annualBaseCost - annualCandidateCost,
      annualEnergySavingsKwh: annualEnergy - candidateEnergy,
      roomHeatBeforeKwh: baseRoomHeat, roomHeatAfterKwh: roomHeatAfter, hotWaterKwh,
      physicalRatio: impact.physicalRatio, physicalRoomHeatBeforeKwh: impact.physicalBeforeKwh, physicalRoomHeatAfterKwh: impact.physicalAfterKwh,
      correctedHwbKwhM2a: impact.correctedHwbKwhM2a, physicalHwbKwhM2a: impact.physicalHwbKwhM2a,
      hwbDeviationPercent: impact.hwbDeviationPercent, climateSource: impact.base?.plausibility?.source ?? null,
      anchored: impact.available, manualEnergyOverrides: manualEnvelope.map((item) => item.id),
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

    // PV remains in financing and target image, but is intentionally excluded from the lifecycle curve
    // until an object-specific yield/self-consumption adapter is available. Funding is allocated
    // proportionally to the economically evaluated investment to avoid a hidden PV advantage.
    const evaluatedSelected = selected.filter((item) => !item.informational);
    const evaluatedInvestment = evaluatedSelected.reduce((sum, item) => sum + finite(item.fullInvestmentEur, 0), 0);
    const excludedInvestment = Math.max(0, totalInvestment - evaluatedInvestment);
    const evaluatedFunding = totalInvestment > 0 ? Math.min(evaluatedInvestment, cappedFunding * evaluatedInvestment / totalInvestment) : 0;
    const maintenanceP = economics.factorFromPercent(assumptions.maintenanceEscalationPercent);

    const candidate = {
      id: 'renovation', label: 'Sanierungsvariante',
      capitalComponents: evaluatedSelected.filter((item) => item.fullInvestmentEur > 0).map((item) => ({
        id: item.id, label: item.label, initialCost: item.fullInvestmentEur, replacementCost: item.fullInvestmentEur,
        lifetimeYears: item.lifetimeYears, startYear: 0, capitalPriceFactor: item.componentId === 'heating' ? technicalP : buildingP, disposalCost: 0,
      })),
      capitalEvents: evaluatedFunding > 0 ? [{ id: 'funding', label: 'anteilige Förderung bewerteter Maßnahmen', year: 0, amount: -evaluatedFunding, priceFactor: 1 }] : [],
      consumptionCosts: [{ id: 'energy', label: 'Energie', annualCost: energy.annualCandidateCost, priceFactor: energyP }],
      operationCosts: evaluatedSelected.filter((item) => finite(item.maintenancePercent, 0) > 0 && finite(item.fullInvestmentEur, 0) > 0).map((item) => ({
        id: `maint-${item.id}`, label: `Wartung ${item.label}`, annualCost: item.fullInvestmentEur * finite(item.maintenancePercent, 0) / 100, priceFactor: maintenanceP, startYear: 0,
      })),
    };
    const reference = {
      id: 'reference', label: 'Referenz',
      capitalComponents: evaluatedSelected.filter((item) => item.referenceCostEur > 0 && finite(item.referenceYear, null) !== null).map((item) => ({
        id: `ref-${item.id}`, label: `Referenz ${item.label}`, initialCost: item.referenceCostEur, replacementCost: item.referenceCostEur,
        lifetimeYears: item.lifetimeYears, startYear: Math.max(0, item.referenceYear), capitalPriceFactor: item.componentId === 'heating' ? technicalP : buildingP, disposalCost: 0,
      })),
      capitalEvents: [],
      consumptionCosts: [{ id: 'energy', label: 'Energie', annualCost: energy.annualBaseCost, priceFactor: energyP }],
      operationCosts: evaluatedSelected.filter((item) => finite(item.maintenancePercent, 0) > 0 && item.referenceCostEur > 0 && finite(item.referenceYear, null) !== null).map((item) => ({
        id: `maint-ref-${item.id}`, label: `Wartung Referenz ${item.label}`, annualCost: item.referenceCostEur * finite(item.maintenancePercent, 0) / 100, priceFactor: maintenanceP, startYear: Math.max(0, item.referenceYear),
      })),
    };
    const coreAssumptions = { periodYears: assumptions.periodYears, interestFactor: q, seriesStepYears: 1 };
    const comparison = evaluatedSelected.length && energy.annualEnergy > 0 ? economics.compareVariants(candidate, reference, coreAssumptions, 'cumulative') : null;
    const referencePv = reference.capitalComponents.reduce((sum, item) => sum + economics.presentValue(item.initialCost, item.capitalPriceFactor, q, item.startYear), 0);
    const relevantInvestment = evaluatedInvestment - evaluatedFunding - referencePv;
    const referenceNominal = Math.min(totalInvestment, selected.reduce((sum, item) => sum + finite(item.referenceCostEur, 0), 0));
    const energeticNominal = Math.max(0, totalInvestment - referenceNominal);
    return {
      selected, evaluatedSelected, assumptions, energy, totalInvestment, evaluatedInvestment, excludedInvestment, evaluatedFunding, funding, netInvestment: Math.max(0, totalInvestment - cappedFunding),
      referencePv, relevantInvestment, referenceNominal, energeticNominal, comparison,
    };
  }

  function segment(label, value, total, className) {
    if (!(value > 0) || !(total > 0)) return '';
    const width = Math.max(2, value / total * 100);
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
    const legends = [];
    if (state > 0) legends.push(`<span>Land <b>${formatMoney(state)}</b></span>`);
    if (federal > 0) legends.push(`<span>Bund <b>${formatMoney(federal)}</b></span>`);
    if (other > 0) legends.push(`<span>Sonstige <b>${formatMoney(other)}</b></span>`);
    if (bonus > 0) legends.push(`<span>Paketbonus <b>${formatMoney(bonus)}</b></span>`);
    if (result.netInvestment > 0 || !legends.length) legends.push(`<span>Eigenanteil <b>${formatMoney(result.netInvestment)}</b></span>`);
    $('fundingLegend').innerHTML = legends.join('');
  }

  function svgHelpers(svg) {
    const ns='http://www.w3.org/2000/svg';
    return (name,attrs={})=>{const el=document.createElementNS(ns,name);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));svg.append(el);return el;};
  }

  function formatAxisMoney(value) {
    const amount = Number(value) || 0;
    if (Math.abs(amount) >= 1000) return `${number0.format(amount / 1000)} T€`;
    return `${number0.format(amount)} €`;
  }

  function renderChart(result) {
    const svg = $('economicsChart'); svg.innerHTML = '';
    if (!result.comparison?.series?.length) {
      svg.innerHTML = '<text x="380" y="155" text-anchor="middle" class="chart-label">Für die Zeitgrafik werden Verbrauch und mindestens eine bewertbare Maßnahme benötigt.</text>';
      $('chartStatus').textContent = 'noch nicht berechenbar'; return;
    }
    const series = result.comparison.series;
    const width=760, height=320, ml=76, mr=10, mt=26, mb=48, plotW=width-ml-mr, plotH=height-mt-mb;
    const values = series.map((p) => p.advantage); const min = Math.min(0,...values), max = Math.max(0,...values); const span=Math.max(1,max-min);
    const x=(year)=>ml+year/result.assumptions.periodYears*plotW; const y=(v)=>mt+(max-v)/span*plotH; const y0=y(0); const add=svgHelpers(svg);
    add('rect',{x:ml,y:mt,width:plotW,height:Math.max(0,y0-mt),class:'chart-zone-positive'}); add('rect',{x:ml,y:y0,width:plotW,height:Math.max(0,height-mb-y0),class:'chart-zone-negative'});
    for(let yr=0;yr<=result.assumptions.periodYears;yr+=5){const xx=x(yr);add('line',{x1:xx,y1:mt,x2:xx,y2:height-mb,class:'chart-grid'});const t=add('text',{x:xx,y:height-18,'text-anchor':'middle',class:'chart-label'});t.textContent=`${yr} J.`;}
    for(let i=0;i<=4;i++){const value=min+(span*i/4);const yy=y(value);add('line',{x1:ml,y1:yy,x2:width-mr,y2:yy,class:'chart-grid'});const t=add('text',{x:ml-8,y:yy+4,'text-anchor':'end',class:'chart-label'});t.textContent=formatAxisMoney(value);}
    add('line',{x1:ml,y1:y0,x2:width-mr,y2:y0,class:'chart-zero'}); add('line',{x1:ml,y1:mt,x2:ml,y2:height-mb,class:'chart-axis'});
    const axisTitle=add('text',{x:18,y:mt+plotH/2,'text-anchor':'middle',class:'chart-axis-title',transform:`rotate(-90 18 ${mt+plotH/2})`});axisTitle.textContent='€ Vorteil gegenüber Referenz';
    const zeroLabel=add('text',{x:width-mr-4,y:Math.max(mt+14,Math.min(height-mb-8,y0-7)),'text-anchor':'end',class:'chart-label-strong'});zeroLabel.textContent='Referenz · beide Varianten gleich teuer';
    const top=add('text',{x:ml+plotW/2,y:mt+16,'text-anchor':'middle',class:'chart-label-strong'});top.textContent='Sanierung günstiger';
    const bottom=add('text',{x:ml+plotW/2,y:height-mb-10,'text-anchor':'middle',class:'chart-label-strong'});bottom.textContent='Sanierung noch teurer';
    const pts=series.map((p)=>`${x(p.year)},${y(p.advantage)}`).join(' '); add('polyline',{points:pts,class:'chart-line'});
    const start=series[0];
    if(start){const sy=y(start.advantage);add('circle',{cx:x(start.year),cy:sy,r:4,class:'chart-point'});const labelY=start.advantage<=0?Math.max(mt+14,sy-10):Math.min(height-mb-8,sy+18);const st=add('text',{x:x(start.year)+8,y:labelY,class:'chart-label-strong'});st.textContent=`heute ${formatSignedMoney(start.advantage)}`;}
    if(result.comparison.durableAdvantageYear!==null){const xx=x(result.comparison.durableAdvantageYear);add('line',{x1:xx,y1:mt,x2:xx,y2:height-mb,class:'chart-crossing'});const t=add('text',{x:Math.min(width-mr-5,xx+6),y:mt+34,class:'chart-label'});t.textContent=`dauerhaft ab ca. ${number1.format(result.comparison.durableAdvantageYear)} J.`;}
    const end=series.at(-1);
    if(end){const ey=y(end.advantage);add('circle',{cx:x(end.year),cy:ey,r:4,class:'chart-point'});const endY=ey<mt+28?ey+18:ey-9;const t=add('text',{x:x(end.year)-6,y:endY,'text-anchor':'end',class:'chart-label-strong'});t.textContent=`kumuliert ${formatSignedMoney(end.advantage)}`;}
    const advantage = result.comparison.advantagePresentValue;
    $('chartStatus').textContent = advantage >= 0 ? `Über ${result.assumptions.periodYears} Jahre ca. ${formatMoney(advantage)} günstiger` : `Über ${result.assumptions.periodYears} Jahre ca. ${formatMoney(-advantage)} teurer`;
  }
  function renderComparisonChart(result) {
    const svg=$('comparisonChart'); svg.innerHTML='';
    const series=result.comparison?.series??[];
    if(!series.length){svg.innerHTML='<text x="380" y="145" text-anchor="middle" class="chart-label">Noch keine vollständige Vergleichsrechnung.</text>';return;}
    const width=760,height=300,ml=76,mr=12,mt=26,mb=48,plotW=width-ml-mr,plotH=height-mt-mb;
    const max=Math.max(1,...series.flatMap((p)=>[p.referenceCost,p.candidateCost])); const x=(year)=>ml+year/result.assumptions.periodYears*plotW; const y=(v)=>mt+(1-v/max)*plotH; const add=svgHelpers(svg);
    for(let yr=0;yr<=result.assumptions.periodYears;yr+=5){const xx=x(yr);add('line',{x1:xx,y1:mt,x2:xx,y2:height-mb,class:'chart-grid'});const t=add('text',{x:xx,y:height-18,'text-anchor':'middle',class:'chart-label'});t.textContent=`${yr} J.`;}
    for(let i=0;i<=4;i++){const value=max*i/4;const yy=y(value);add('line',{x1:ml,y1:yy,x2:width-mr,y2:yy,class:'chart-grid'});const t=add('text',{x:ml-8,y:yy+4,'text-anchor':'end',class:'chart-label'});t.textContent=formatAxisMoney(value);}
    add('line',{x1:ml,y1:height-mb,x2:width-mr,y2:height-mb,class:'chart-axis'}); add('line',{x1:ml,y1:mt,x2:ml,y2:height-mb,class:'chart-axis'});
    const axisTitle=add('text',{x:18,y:mt+plotH/2,'text-anchor':'middle',class:'chart-axis-title',transform:`rotate(-90 18 ${mt+plotH/2})`});axisTitle.textContent='€ kumulierte Lebenszykluskosten';
    add('polyline',{points:series.map((p)=>`${x(p.year)},${y(p.referenceCost)}`).join(' '),class:'chart-line-reference'}); add('polyline',{points:series.map((p)=>`${x(p.year)},${y(p.candidateCost)}`).join(' '),class:'chart-line-candidate'});
    const start=series[0];
    if(start){const ry=y(start.referenceCost),cy=y(start.candidateCost);let rLabelY=ry-9,cLabelY=cy+17;if(Math.abs(ry-cy)<28){const middle=(ry+cy)/2;rLabelY=Math.max(mt+14,middle-14);cLabelY=Math.min(height-mb-7,middle+20);}else{rLabelY=Math.max(mt+14,rLabelY);cLabelY=Math.min(height-mb-7,cLabelY);}const r=add('text',{x:x(0)+8,y:rLabelY,class:'chart-label-reference'});r.textContent=`Referenz Start ${formatMoney(start.referenceCost)}`;const c=add('text',{x:x(0)+8,y:cLabelY,class:'chart-label-candidate'});c.textContent=`Sanierung Start ${formatMoney(start.candidateCost)}`;}
    const last=series.at(-1);const rEndY=y(last.referenceCost),cEndY=y(last.candidateCost);let rEndLabel=rEndY-8,cEndLabel=cEndY+16;if(Math.abs(rEndY-cEndY)<24){const middle=(rEndY+cEndY)/2;rEndLabel=Math.max(mt+14,middle-12);cEndLabel=Math.min(height-mb-6,middle+18);}const lr=add('text',{x:width-mr-4,y:rEndLabel,'text-anchor':'end',class:'chart-label-reference'});lr.textContent='Referenz';const lc=add('text',{x:width-mr-4,y:cEndLabel,'text-anchor':'end',class:'chart-label-candidate'});lc.textContent='Sanierung';
  }
  function effectRows(result, project) {
    const priorities = project.advice?.priorities ?? [];
    const benefitTexts = { costs:['Kosten','wirtschaftlich betrachtet'], comfort:['Komfort','positiv'], climate:['Klimaschutz','positiv'], independence:['Autarkie & Sicherheit','positiv'], value:['Werterhalt','positiv'], effort:['geringer Aufwand','projektabhängig'] };
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
    if (priorities.length) text += `Für das Kundengespräch besonders relevant: ${priorities.slice(0,3).join(', ')}. `;
    if (Math.abs(finite(result.energy.hwbDeviationPercent,0)) > 60) text += 'Verbrauch und U-Wert-Hüllmodell weichen deutlich voneinander ab; die Energieeinsparung wurde deshalb verbrauchsverankert gerechnet und der Bestandszustand sollte geprüft werden. ';
    if (result.selected.some((m)=>m.informational)) text += 'PV bleibt in Gesamt- und Restinvestition sowie im Zukunftsfit-Zielbild enthalten, ist bis zum objektspezifischen Ertrags-/Eigenverbrauchsadapter aber bewusst nicht Bestandteil der Lebenszyklus-Wirtschaftlichkeitskurve.';
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
    $('costBasisText').textContent = `EAT-Richtwerte ${costConfig?.data_date ?? '–'} · Angebote haben Vorrang`;
    $('fundingEditorTotal').textContent = `bis zu ${formatMoney(result.funding.total)}`;
    $('fundingTotal').textContent = `bis zu ${formatMoney(result.funding.total)}`;
    const fundingTotalPercent = result.totalInvestment > 0 ? result.funding.total / result.totalInvestment * 100 : null;
    const fundingEnergeticPercent = result.energeticNominal > 0 ? result.funding.total / result.energeticNominal * 100 : null;
    $('fundingPercent').textContent = fundingTotalPercent === null ? '–' : `ca. ${number0.format(fundingTotalPercent)} % der Gesamtinvestition${fundingEnergeticPercent !== null ? ` / ca. ${number0.format(fundingEnergeticPercent)} % der energetischen Investition` : ''}`;
    $('netInvestment').textContent = formatMoney(result.netInvestment);
    const relevantIsAdvantage=result.relevantInvestment<0;
    $('relevantInvestment').textContent = formatMoney(Math.abs(result.relevantInvestment));
    $('relevantInvestmentLabel').textContent = relevantIsAdvantage ? 'Wirtschaftlicher Startvorteil' : 'Wirtschaftlich zusätzliche Investition';
    const pvExcluded = result.excludedInvestment > 0.5;
    $('relevantInvestmentNote').textContent = relevantIsAdvantage
      ? `Für die wirtschaftlich bewerteten Maßnahmen übersteigen anteilige Förderung und heutiger Barwert der erwarteten Referenz-Erneuerungen die aktuelle Zusatzinvestition.${pvExcluded ? ` PV (${formatMoney(result.excludedInvestment)}) bleibt ohne Ertragsmodell außerhalb dieser Kennzahl.` : ''}`
      : `Bewertete Sanierungsinvestition abzüglich anteiliger Förderung und des heutigen Barwerts der erwarteten Referenz-Erneuerungen.${pvExcluded ? ` PV (${formatMoney(result.excludedInvestment)}) bleibt ohne Ertragsmodell außerhalb dieser Kennzahl.` : ''}`;
    document.querySelector('.relevant-investment')?.classList.toggle('is-advantage', relevantIsAdvantage);
    $('costStatus').textContent = result.selected.length ? `${result.selected.length} Maßnahme${result.selected.length===1?'':'n'}` : 'keine Maßnahme'; $('costStatus').className = `status-chip ${result.selected.length?'is-success':''}`.trim();
    renderBars(result); renderFundingInputs(result,project);
    const overlap=result.funding.total-result.energeticNominal;
    const overlapNote=$('fundingOverlapNote');
    if(overlap>0.5){overlapNote.hidden=false;overlapNote.textContent=`Die angenommene Förderung liegt ca. ${formatMoney(overlap)} über den nominalen energetischen Mehrkosten. Das kann plausibel sein, wenn Förderregeln auch Gerüst, Putz oder andere förderfähige Begleitarbeiten berücksichtigen.`;}
    else overlapNote.hidden=true;
    const pvNote=$('pvEconomicsNote');
    if(result.excludedInvestment>0.5){
      pvNote.hidden=false;
      pvNote.textContent=`PV-Investition ${formatMoney(result.excludedInvestment)} ist in Gesamtinvestition, Restinvestition, Finanzierung und Zukunftsfit-Zielbild enthalten. Ohne objektspezifisches Ertrags-/Eigenverbrauchsmodell wird sie in V1.0 bewusst nicht in der Lebenszyklus-Wirtschaftlichkeitskurve bewertet. Eine Gesamtförderung wird für die Kurve nur anteilig dem bewerteten Investitionsanteil zugerechnet.`;
    } else pvNote.hidden=true;

    $('resultNet').textContent = formatMoney(result.netInvestment);
    $('resultRelevant').textContent = formatMoney(Math.abs(result.relevantInvestment));
    $('resultRelevantLabel').textContent = relevantIsAdvantage ? 'Startvorteil gegenüber Referenz' : 'Wirtschaftlich zusätzlich';
    $('resultEnergyAfter').textContent = result.energy.annualEnergy>0 ? `${formatMoney(result.energy.annualCandidateCost,50)}/a` : '–';
    $('resultEnergyBefore').textContent = result.energy.annualEnergy>0 ? `vorher ${formatMoney(result.energy.annualBaseCost,50)}/a` : 'vorher –';
    $('resultSavings').textContent = result.energy.annualSavingsEur > 0 ? `↓ ${formatMoney(result.energy.annualSavingsEur,50)}/a` : result.energy.annualSavingsEur < 0 ? `↑ ${formatMoney(Math.abs(result.energy.annualSavingsEur),50)}/a Mehrkosten` : 'keine Kostendifferenz berechnet';
    if (result.comparison?.durableAdvantageYear !== null && result.comparison?.durableAdvantageYear !== undefined) { $('resultFourthLabel').textContent='Dauerhaft günstiger'; $('resultFourth').textContent=`ab ca. Jahr ${Math.round(result.comparison.durableAdvantageYear)}`; $('resultFourthNote').textContent='gegenüber Referenz'; }
    else if (result.relevantInvestment>0 && result.comparison) { const energyPv=Math.max(0,result.comparison.reference.consumption.total-result.comparison.candidate.consumption.total); const share=Math.max(0,Math.min(999,energyPv/result.relevantInvestment*100)); $('resultFourthLabel').textContent='Energie trägt'; $('resultFourth').textContent=`ca. ${number0.format(share)} %`; $('resultFourthNote').textContent=`der wirtschaftlichen Zusatzinvestition`; }
    else { $('resultFourthLabel').textContent='Dauerhaft günstiger'; $('resultFourth').textContent='–'; $('resultFourthNote').textContent='noch nicht berechenbar'; }
    $('resultStatus').textContent = result.comparison ? (result.comparison.advantagePresentValue>=0?'Lebenszyklusvorteil':'Mehrkosten verbleiben') : 'noch keine vollständige Rechnung'; $('resultStatus').className=`status-chip ${result.comparison?'is-success':''}`.trim();
    renderChart(result); renderComparisonChart(result); renderCustomerContext(project,result);
    $('effectsList').innerHTML = effectRows(result,project).map(([label,value])=>`<div class="effect-row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`).join('');
    $('interpretationText').textContent = interpretation(result, project);
    const orienting=result.selected.some((m)=>m.dataQuality==='orientierend');
    const fundingNeedsCheck=result.funding.total>0;
    const hwbMismatch=Math.abs(finite(result.energy.hwbDeviationPercent,0))>60;
    const referenceTimingOpen=result.selected.some((m)=>m.referenceCostEur>0&&finite(m.referenceYear,null)===null);
    const pvExcludedForQuality=result.selected.some((m)=>m.informational);
    let quality='Gute Datengrundlage. Investitionskosten und Energiepreisentwicklung bleiben grundsätzlich zu prüfen.';
    if(orienting||fundingNeedsCheck||hwbMismatch||referenceTimingOpen||pvExcludedForQuality){const reasons=[];if(orienting)reasons.push('einzelne Maßnahmen beruhen noch auf Richt- oder Bauperiodenwerten');if(fundingNeedsCheck)reasons.push('Förderungen sind nur orientierend berücksichtigt');if(hwbMismatch)reasons.push('Verbrauch und U-Wert-Hüllmodell weichen deutlich voneinander ab; die Einsparung wird deshalb am realen Verbrauch verankert');if(referenceTimingOpen)reasons.push('bei mindestens einer Referenz-Erneuerung ist der Zeitpunkt noch offen und sie wird bis zur Klärung nicht als heutige Referenzinvestition angerechnet');if(pvExcludedForQuality)reasons.push('PV ist in Finanzierung und Gesamtinvestition enthalten, aber ohne Ertragsmodell nicht in der Lebenszykluskurve bewertet');quality=`Orientierende Aussage: ${reasons.join('; ')}. Vor einer Investitionsentscheidung Angebote, Förderbedingungen, Bauteilzustände und Referenzzeitpunkte prüfen.`;}
    $('sensitivityBox').textContent=quality;
    buildMethodology(result,project); buildPrintReport(result,project); persistSnapshot(result,project);
  }

  function buildMethodology(result, project) {
    const a=result.assumptions;
    const energyAssumptions=energyFlowAssumptions();
    $('methodDataStrip').innerHTML = `<span><strong>Rechenkern</strong> ${economics.MODEL_VERSION}</span><span><strong>Energiebrücke</strong> ${anchorCore.MODEL_VERSION}</span><span><strong>Zeitraum</strong> ${a.periodYears} Jahre</span><span><strong>Zins</strong> ${number1.format(a.interestRatePercent)} %</span><span><strong>Energiepreis</strong> ${number1.format(a.energyEscalationPercent)} %/a</span><span><strong>Warmwasseransatz</strong> ${number0.format(energyAssumptions.hotWaterKwhPerPerson)} kWh/Person·a</span><span><strong>Kostenstand</strong> ${costConfig?.data_date ?? '–'}</span>`;
    $('methodologyGrid').innerHTML = [
      ['1 · Vergleichslogik','Verglichen werden eine Referenzvariante („Was passiert ohne vorgezogene energetische Verbesserung?“) und die gewählte Sanierungsvariante. Ohnehin notwendige Erneuerungen werden zu ihrem erwarteten Zeitpunkt und nicht pauschal heute abgezogen.'],
      ['2 · Reale Ausgangswärme',`Wenn Warmwasser im Verbrauch enthalten ist, gilt: <code>Q_Raum,real = E_Verbrauch × η − Q_WW</code>. Dabei wird <code>Q_WW = Personen × ${number0.format(energyAssumptions.hotWaterKwhPerPerson)} kWh/a</code> angesetzt, sofern kein besserer Projektwert vorliegt.`],
      ['3 · Verbrauchsverankerte Hüllwirkung','Das unabhängige Hüllmodell wird mit Geometrie, U-Werten, Klima, Lüftung und Gewinnen einmal im Bestand und einmal nach allen ausgewählten Hüllmaßnahmen gerechnet. <code>r_Hülle = Q_U,nach / Q_U,vor</code>. Danach gilt <code>Q_Raum,nach = Q_Raum,real × r_Hülle</code>.'],
      ['4 · Heizsystem nach Sanierung','Nach Hüllmaßnahmen wird der Endenergiebedarf des Zielsystems aus der verbleibenden Nutzwärme bestimmt: <code>E_nach = (Q_Raum,nach + Q_WW) / η_neu</code>. Bei Wärmepumpen steht <code>η_neu</code> für die verwendete JAZ.'],
      ['5 · Barwert','Für eine Zahlung <code>K</code> im Jahr <code>t</code> gilt <code>BW_t = K × (P / Q)^t</code>. <code>P</code> ist der Preisentwicklungsfaktor der jeweiligen Kostenart, <code>Q</code> der Zinsfaktor.'],
      ['6 · Jährliche Kosten','Energie- und Betriebskosten werden als jährlich nachschüssige Zahlungsreihe über den Betrachtungszeitraum abgezinst. Unterschiedliche Kostenarten dürfen unterschiedliche Preisentwicklungen verwenden.'],
      ['7 · Lebenszyklus','Komponenten können Wiederbeschaffungen, Entsorgung und Restwerte über ihre Nutzungsdauer erzeugen. Eine Referenzkomponente startet erst im erwarteten Erneuerungsjahr.'],
      ['8 · Annuität','Aus dem Gesamtbarwert wird intern die äquivalente Jahresannuität bestimmt: <code>A = BW × (Q − 1) / (1 − Q^−T)</code>. Sie wird in der normalen Beratung nicht als Hauptkennzahl gezeigt.'],
      ['9 · Förderung','Förderung ist nicht auf die energetische Mehrinvestition begrenzt. Förderfähige Kosten werden durch das jeweilige Programm definiert und können auch Gerüst, Putz oder andere Begleitarbeiten umfassen.'],
      ['10 · Kostenstruktur','Die Grafik „Woraus besteht die Investition?“ trennt nominale Referenzarbeiten und energetische Verbesserung. Diese Aufteilung ist nicht identisch mit der Förderbasis.'],
      ['11 · Amortisation / Gesamtkostenverlauf','Die Zeitgrafik folgt der Kumulationsmethode. Zahlungsströme werden in dem Jahr berücksichtigt, in dem sie anfallen; dadurch sind mehrere Amortisations- und Deamortisationspunkte möglich.'],
      ['12 · Hüllplausibilität','Verbrauchsbasierter korrigierter HWB und unabhängiger U-Wert-HWB werden als Plausibilitätscheck gegenübergestellt. Deutliche Abweichungen sind ein Beratungsanlass, keine automatische Fehlerdiagnose.'],
      ['13 · Datenpriorität / Overrides','Projektspezifische bzw. manuell bestätigte Werte haben Vorrang vor zentralen EAT-Richtwerten. Automatisch abgeleitete Werte werden bei besseren Projektdaten neu berechnet. Ein manueller Override kann über „↺ automatisch“ wiederhergestellt werden.'],
      ['14 · PV-Abgrenzung V1.0','PV bleibt in Gesamtinvestition, Restinvestition, Finanzierung und Zukunftsfit-Zielbild enthalten. Solange kein objektspezifisches Ertrags-/Eigenverbrauchsmodell vorliegt, wird PV aus der Lebenszykluskurve und der Kennzahl „wirtschaftlich zusätzlich“ herausgenommen. Eine nicht eindeutig zuordenbare Gesamtförderung wird für die Kurve proportional auf den bewerteten Investitionsanteil verteilt.'],
      ['15 · Wartung und Instandhaltung','Regelmäßige Wartung wird nur dort als Default angesetzt, wo sie plausibel und ausreichend belegt ist. Passive Dämmbauteile erhalten standardmäßig 0 %. Für Wärmepumpen wird der freigegebene EAT-/Norm-orientierte Wartungsansatz verwendet; Fensterwerte folgen je Rahmenmaterial der zentralen Lebensdauerdatenbasis. Wartung einer späteren Referenz-Erneuerung beginnt erst ab deren Einbaujahr.'],
      ['16 · Zustand, Referenzumfang und Erneuerungshorizont','Der Zustand <code>gepflegt / altersgerecht / schadhaft</code> korrigiert den automatisch abgeleiteten Erneuerungshorizont. Bei dafür freigegebenen Referenzmodellen (derzeit insbesondere Fassade und Dach) wird zusätzlich der niedrige / mittlere / höhere Referenzumfang aus dem hinterlegten Kostenband verwendet. Ein konkreter Termin sowie manuelle/project-specific Kosten haben immer Vorrang. Die Regel ist keine Zustandsdiagnose.'],
      ['17 · Regelwerke und Grenzen','Methodische Grundlage: ÖNORM B 8110-4:2024-04-15, ÖNORM M 7140:2021-01 und ÖNORM EN 15459-1:2017. Beratungshilfe, keine Finanzierungs- oder Förderzusage. Richtkosten, Lebensdauern, Energiepreise, Förderfähigkeit und Förderhöhe sind vor Umsetzung projektspezifisch zu prüfen.'],
    ].map(([h,p])=>`<div><h3>${h}</h3><p>${p}</p></div>`).join('');
  }
  function printFutureFitMarkup(project, candidate = false) {
    return `<div class="print-future-fit-track">${futureFitSteps(project, candidate).map(([label, info], i) => {
      const cls = info.state === 'done' ? 'is-done' : info.state === 'advanced' ? 'is-advanced' : info.state === 'partial' ? 'is-partial' : info.state === 'needs' ? 'is-needs' : '';
      return `<div class="print-future-step ${cls}"><i>${i + 1}</i><span>${escapeHtml(label)}</span><small>${escapeHtml(info.note)}</small></div>`;
    }).join('')}</div>`;
  }

  function printChartMarkup(id, viewBox) {
    const source = $(id);
    return `<svg class="print-econ-chart" viewBox="${viewBox}" aria-hidden="true">${source?.innerHTML ?? ''}</svg>`;
  }

  function printBarMarkup(result) {
    const composition = segment('Referenz', result.referenceNominal, result.totalInvestment, 'bar-segment--reference') + segment('energetisch', result.energeticNominal, result.totalInvestment, 'bar-segment--energy');
    const total = result.totalInvestment || 1;
    const categoryTotal = result.funding.state + result.funding.federal + result.funding.other + result.funding.bonus;
    const scale = categoryTotal > 0 && result.funding.total < categoryTotal ? result.funding.total / categoryTotal : 1;
    const state = result.funding.state * scale, federal = result.funding.federal * scale, other = result.funding.other * scale, bonus = result.funding.bonus * scale;
    const finance = segment('Land', state, total, 'bar-segment--state') + segment('Bund', federal, total, 'bar-segment--federal') + segment('Sonstige', other, total, 'bar-segment--other') + segment('Bonus', bonus, total, 'bar-segment--bonus') + segment('Eigenanteil', result.netInvestment, total, 'bar-segment--own');
    const financeLegend = [state > 0 ? `Land ${formatMoney(state)}` : '', federal > 0 ? `Bund ${formatMoney(federal)}` : '', other > 0 ? `Sonstige ${formatMoney(other)}` : '', bonus > 0 ? `Bonus ${formatMoney(bonus)}` : '', `Eigenanteil ${formatMoney(result.netInvestment)}`].filter(Boolean).join(' · ');
    return `<div class="print-econ-bar-group"><h3>Woraus besteht die Investition?</h3><div class="stacked-bar">${composition}</div><p>Referenz-/ohnehin notwendige Arbeiten <b>${formatMoney(result.referenceNominal)}</b> · energetische Verbesserung <b>${formatMoney(result.energeticNominal)}</b></p></div><div class="print-econ-bar-group"><h3>Wie wird sie finanziert?</h3><div class="stacked-bar">${finance}</div><p>${escapeHtml(financeLegend)}</p></div>`;
  }

  function buildPrintReport(result, project) {
    const host=$('economicsPrintReport'); if(!host)return;
    const selected=result.selected.map((m)=>m.label).join(' · ') || 'keine Maßnahme';
    const priorities=(project.advice?.priorities??[]).map((id)=>PRIORITY_LABEL[id]).filter(Boolean);
    const budget=budgetAssessment(project,result);
    const fundingTotalPercent = result.totalInvestment > 0 ? result.funding.total / result.totalInvestment * 100 : null;
    const fundingEnergeticPercent = result.energeticNominal > 0 ? result.funding.total / result.energeticNominal * 100 : null;
    const fundingPercentText = fundingTotalPercent === null ? '–' : `ca. ${number0.format(fundingTotalPercent)} % gesamt${fundingEnergeticPercent !== null ? ` / ${number0.format(fundingEnergeticPercent)} % energetischer Anteil` : ''}`;
    const durable = result.comparison?.durableAdvantageYear;
    const longTerm = result.comparison?.advantagePresentValue;
    const longTermText = longTerm === null || longTerm === undefined ? '–' : `${formatMoney(Math.abs(longTerm))} ${longTerm >= 0 ? 'günstiger' : 'teurer'}`;
    const effectMarkup = effectRows(result,project).map(([label,value])=>`<div class="print-effect"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
    const measureRows = result.selected.map((m)=>{
      const reference = m.referenceMode === 'none' ? 'keine reguläre' : m.referenceCostEur > 0 ? `${formatMoney(m.referenceCostEur)}${finite(m.referenceYear,null)!==null ? ` · ${referenceTimingText(m.referenceYear)}` : ' · Zeitpunkt offen'}${m.referenceCondition ? ` · ${referenceConditionLabel(m.referenceCondition)}` : ''}` : 'offen';
      const saving = m.id === 'heating' ? (m.targetEfficiency ? `Zielsystem · JAZ ${number1.format(m.targetEfficiency)}` : 'Systemwechsel') : m.informational ? 'Ertragsmodell offen' : m.deliveredSavingsKwh > 0 ? formatEnergy(m.deliveredSavingsKwh,10) : '–';
      return `<tr><td><strong>${escapeHtml(m.label)}</strong><small>${escapeHtml(m.source)} · ${escapeHtml(m.dataQuality)}</small></td><td>${formatMoney(m.fullInvestmentEur)}</td><td>${m.fundingEur>0?`bis zu ${formatMoney(m.fundingEur)}`:'–'}</td><td>${escapeHtml(reference)}</td><td>${escapeHtml(saving)}</td></tr>`;
    }).join('');
    const quality = $('sensitivityBox')?.textContent ?? 'Aussagequalität konnte nicht bestimmt werden.';
    const methodMeta = `Rechenkern ${economics.MODEL_VERSION} · Energiebrücke ${anchorCore.MODEL_VERSION} · Kostenstand ${costConfig?.data_date ?? '–'} · Betrachtung ${result.assumptions.periodYears} Jahre · Zins ${number1.format(result.assumptions.interestRatePercent)} %`;
    host.innerHTML=`
      <section class="print-econ-page">
        <header class="print-report-header"><p class="print-kicker">Beratungsausdruck</p><h1>Wirtschaftlichkeit</h1></header>
        <div class="print-econ-intro"><div><span>Betrachtet</span><strong>${escapeHtml(selected)}</strong></div><div><span>Budget</span><strong>${escapeHtml(budget.label)}</strong><small>${escapeHtml(budget.note)}</small></div></div>
        <div class="print-econ-grid print-econ-grid--top">
          <div class="print-econ-kpi"><span>Gesamtinvestition</span><strong>${formatMoney(result.totalInvestment)}</strong></div>
          <div class="print-econ-kpi"><span>Mögliche Förderung</span><strong>bis zu ${formatMoney(result.funding.total)}</strong><small>${escapeHtml(fundingPercentText)}</small></div>
          <div class="print-econ-kpi"><span>Restinvestition</span><strong>${formatMoney(result.netInvestment)}</strong></div>
          <div class="print-econ-kpi"><span>Energiekosten</span><strong>${formatMoney(result.energy.annualCandidateCost,50)}/a</strong><small>vorher ${formatMoney(result.energy.annualBaseCost,50)}/a · Δ ${formatMoney(Math.abs(result.energy.annualSavingsEur),50)}/a</small></div>
        </div>
        <div class="print-future-fit-compare">
          <div><p class="eyebrow">Zielbild · Bestand</p><h2>Zukunftsfit 2050</h2>${printFutureFitMarkup(project,false)}</div>
          <div><p class="eyebrow">Zielbild · Sanierung</p><h2>Mit gewählten Maßnahmen</h2>${printFutureFitMarkup(project,true)}</div>
        </div>
        <div class="print-econ-bars">${printBarMarkup(result)}</div>
        <div class="print-econ-chart-card"><div class="print-chart-title"><h2>Wirtschaftlicher Verlauf gegenüber der Referenz</h2><strong>${escapeHtml(longTermText)}</strong></div>${printChartMarkup('economicsChart','0 0 760 320')}<p>Die Nulllinie ist die Referenz. ${durable!==null&&durable!==undefined?`Die Sanierungsvariante liegt ab etwa Jahr ${Math.round(durable)} dauerhaft günstiger.`:'Im Betrachtungszeitraum wird kein eindeutiger dauerhafter Schnittpunkt ausgewiesen.'}</p></div>
      </section>
      <section class="print-econ-page print-econ-page--break">
        <header class="print-report-header"><h1>Wirtschaftlichkeit · Details</h1></header>
        <h2>Gewählte Maßnahmen</h2>
        <table class="print-measure-table"><thead><tr><th>Maßnahme</th><th>Vollkosten</th><th>Förderung</th><th>Referenz</th><th>Energie</th></tr></thead><tbody>${measureRows||'<tr><td colspan="5">Keine Maßnahme gewählt.</td></tr>'}</tbody></table>
        <div class="print-econ-chart-card print-econ-chart-card--compact"><div class="print-chart-title"><h2>Kumulierte Lebenszykluskosten</h2><strong>Referenz ↔ Sanierung</strong></div>${printChartMarkup('comparisonChart','0 0 760 300')}</div>
        <div class="print-customer-row"><div><span>Ihre Schwerpunkte</span><strong>${escapeHtml(priorities.join(' · ')||'noch nicht festgelegt')}</strong></div><div><span>Budget</span><strong>${escapeHtml(budget.label)}</strong><small>${escapeHtml(budget.note)}</small></div></div>
        <div class="print-effects"><h2>Mehr als Wirtschaftlichkeit</h2><div>${effectMarkup}</div></div>
        <div class="print-econ-note"><strong>Einordnung</strong><p>${escapeHtml(interpretation(result,project))}</p></div>
        <div class="print-quality"><strong>Aussagequalität & Unsicherheiten</strong><p>${escapeHtml(quality)}</p></div>
        <p class="print-funding-note"><strong>Förderhinweis:</strong> Förderungen wurden orientierend abgeschätzt. Förderfähige Kosten können auch notwendige Begleitarbeiten umfassen. Vor Beauftragung bzw. Umsetzung sind tatsächliche Förderhöhe, Verfügbarkeit, Voraussetzungen, förderfähige Kosten und Einreichfristen bei den zuständigen Förderstellen zu prüfen.</p>
        <p class="print-method-meta">${escapeHtml(methodMeta)}. Details und Formeln: „Methode und Datenbasis“ im Webtool.</p>
      </section>`;
  }

  function persistSnapshot(result, project) {
    if (suppressRender) return;
    const snapshot={calculatedAt:new Date().toISOString(),modelVersion:economics.MODEL_VERSION,costDataVersion:costConfig?.version??null,systemCostDataVersion:systemCostConfig?.version??null,energyPriceVersion:energyPrices?.version??null,financialDefaultsVersion:financeConfig?.version??null,selectedMeasureIds:result.selected.map((m)=>m.id),measureResults:Object.fromEntries(result.selected.map((m)=>[m.id,{id:m.id,label:m.label,componentId:m.componentId??null,source:m.source??null,dataQuality:m.dataQuality??null,fullInvestmentEur:finite(m.fullInvestmentEur,0),referenceCostEur:finite(m.referenceCostEur,0),referenceYear:finite(m.referenceYear,null),referenceMode:m.referenceMode??null,referenceCondition:m.referenceCondition??null,fundingEur:finite(m.fundingEur,0),deliveredSavingsKwh:finite(m.deliveredSavingsKwh,0),lifetimeYears:finite(m.lifetimeYears,null),targetCarrierId:m.targetCarrierId??null,targetEfficiency:finite(m.targetEfficiency,null),systemLabel:m.systemLabel??null,informational:Boolean(m.informational)}])),totalInvestmentEur:result.totalInvestment,fundingEur:result.funding.total,netInvestmentEur:result.netInvestment,relevantInvestmentEur:result.relevantInvestment,annualEnergyCostBeforeEur:result.energy.annualBaseCost,annualEnergyCostAfterEur:result.energy.annualCandidateCost,annualSavingsEur:result.energy.annualSavingsEur,energyAnchorVersion:anchorCore.MODEL_VERSION,hwbCorrectedKwhM2a:result.energy.correctedHwbKwhM2a,hwbPhysicalKwhM2a:result.energy.physicalHwbKwhM2a,hwbDeviationPercent:result.energy.hwbDeviationPercent,durableAdvantageYear:result.comparison?.durableAdvantageYear??null,advantagePresentValueEur:result.comparison?.advantagePresentValue??null,pvEconomicsExcludedEur:result.excludedInvestment,evaluatedInvestmentEur:result.evaluatedInvestment,evaluatedFundingEur:result.evaluatedFunding,referenceConditions:Object.fromEntries(result.selected.filter((m)=>m.referenceMode!=='none').map((m)=>[m.id,m.referenceCondition??'age_appropriate'])),assumptions:result.assumptions};
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
    $('inputHotWaterIncluded').addEventListener('change',()=>writeManualField('systems.heating.hotWaterIncluded',$('inputHotWaterIncluded').value === 'true',null));
    $('inputPersons').addEventListener('change',()=>writeManualField('usage.household.persons',finite($('inputPersons').value,null),'Personen'));
    $('inputEfficiency').addEventListener('change',()=>writeManualField('systems.heating.usefulHeatFactor',finite($('inputEfficiency').value,null),null));
    $('inputCarrier').addEventListener('change',()=>{writeManualField('systems.heating.energyCarrier',$('inputCarrier').value,null);const p=carrierItem($('inputCarrier').value);store.setPath(`economics.energyPriceOverrides.${$('inputCarrier').value}`,finite(p?.price,0));});
    $('inputEnergyPrice').addEventListener('change',()=>store.setPath(`economics.energyPriceOverrides.${$('inputCarrier').value}`,finite($('inputEnergyPrice').value,0)));
    $('inputPeriod').addEventListener('change',()=>store.setPath('economics.assumptions.periodYears',finite($('inputPeriod').value,30)));
  }

  function bindFunding() {
    [['State','state'],['Federal','federal'],['Other','other'],['Bonus','bonus']].forEach(([suffix,key])=>$( `fund${suffix}`).addEventListener('change',()=>store.setPath(`modules.wirtschaftlichkeit.funding.${key}`,finite($( `fund${suffix}`).value,0))));
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

  async function init(){try{await loadConfigs();populateCarrier(store.get());bindChoices();bindBasisInputs();bindFunding();bindFutureFit();await initAddress();$('printEconomicsButton').addEventListener('click',()=>{global.dispatchEvent(new CustomEvent('energy-tools:prepare-print'));requestAnimationFrame(()=>global.print());});store.subscribe((project)=>render(project));render(store.get());}catch(error){console.error(error);$('basisHint').textContent=`Wirtschaftlichkeit konnte nicht vollständig geladen werden: ${error.message}`;$('basisHint').className='econ-hint is-warning';}}

  init();
})(window);
