'use strict';

(function initEnvelopeRenovationTool(global) {
  const store = global.EnergyToolsProjectStore;
  const model = global.EnergyToolsDataModel;
  const resolver = global.EnergyToolsValueResolver;
  const measureCore = global.EnvelopeRenovationCore;
  const economicsCore = global.EnergyEconomicsCore;
  const paths = global.EnergyToolsPaths;
  const oibNatCore = global.OibNatCore;
  const oibTnat13Core = global.OibTnat13Core;
  const precomputedClimateCore = global.PrecomputedClimateCore;

  if (!store || !model || !resolver || !measureCore || !economicsCore) {
    console.error('Bauteil & Sanierung: gemeinsame Basis oder Rechenkerne fehlen.');
    return;
  }

  const $ = (id) => document.getElementById(id);
  const number0 = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 0 });
  const number1 = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const number2 = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const number3 = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const euro0 = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  const COMPONENTS = [
    {
      id: 'exteriorWall', dataId: 'wall_external', label: 'Außenwand', short: 'Außenwand', supported: true,
      areaPath: 'building.geometry.opaqueExteriorWallArea', uPath: 'building.thermal.envelope.exteriorWall.uValue',
      energyFlowId: 'exteriorWall', targetId: 'wall_external', costModelId: 'wall_wdvs',
      boundaryFactor: 1.0, rsi: 0.13, boundaryKind: 'outside', analyticAllowed: true,
    },
    {
      id: 'topFloorCeiling', dataId: 'roof_top_ceiling', label: 'Oberste Geschoßdecke', short: 'OGD', supported: true,
      areaPath: 'building.geometry.topFloorArea', uPath: 'building.thermal.envelope.topFloorCeiling.uValue',
      energyFlowId: 'topFloorCeiling', targetId: 'roof_top_ceiling', costModelId: 'top_ceiling',
      boundaryFactor: 0.8, rsi: 0.10, boundaryKind: 'unheated', analyticAllowed: false,
    },
    {
      id: 'roof', dataId: 'roof_top_ceiling', label: 'Dach / Dachschräge', short: 'Dach', supported: true,
      areaPath: 'building.geometry.roofSlopeArea', uPath: 'building.thermal.envelope.roof.uValue',
      energyFlowId: 'roof', targetId: 'roof_top_ceiling', costModelId: 'roof',
      boundaryFactor: 1.0, rsi: 0.10, boundaryKind: 'outside', analyticAllowed: true,
    },
    {
      id: 'basementCeiling', dataId: 'ceiling_unheated', label: 'Kellerdecke / UG-Decke', short: 'Kellerdecke', supported: true,
      areaPath: 'building.geometry.basementCeilingArea', uPath: 'building.thermal.envelope.basementCeiling.uValue',
      energyFlowId: 'basementCeiling', targetId: 'ceiling_unheated', costModelId: 'basement_ceiling',
      boundaryFactor: 0.5, rsi: 0.17, boundaryKind: 'unheated', analyticAllowed: false,
    },
    {
      id: 'groundFloor', dataId: 'floor_ground', label: 'Boden gegen Erdreich', short: 'Boden', supported: true,
      areaPath: 'building.geometry.groundFloorArea', uPath: 'building.thermal.envelope.groundFloor.uValue',
      energyFlowId: 'groundFloor', targetId: 'floor_ground', costModelId: 'ground_floor',
      boundaryFactor: 0.5, rsi: 0.17, boundaryKind: 'ground', analyticAllowed: false,
    },
    { id: 'windows', dataId: 'window_external', label: 'Fenster', short: 'Fenster', supported: false },
    { id: 'doors', dataId: 'door_external', label: 'Außentür', short: 'Tür', supported: false },
  ];

  const ORIGIN_LABELS = {
    [model.ORIGIN.MANUAL]: 'manuell bestätigt',
    [model.ORIGIN.OFFICIAL]: 'amtlich',
    [model.ORIGIN.DERIVED]: 'abgeleitet',
    [model.ORIGIN.FALLBACK]: 'Fallback',
  };

  const FALLBACK_FINANCE = {
    period_years: 30,
    interest_rate_percent: 3,
    energy_price_escalation_percent: 3,
    investment_price_escalation_percent: 2,
    disposal_price_escalation_percent: 2,
  };

  let targetsConfig = null;
  let lambdaConfig = null;
  let coBenefitsConfig = null;
  let costConfig = null;
  let lifetimeConfig = null;
  let financeConfig = null;
  let energyPricesConfig = null;
  let emissionFactorsConfig = null;
  let activeComponentId = 'exteriorWall';
  let variants = [];
  let enrichedVariants = [];
  let selectedThicknessCm = null;
  let specialVariants = { recommendation: null, economic: null, ambitious: null };
  let optimizationMeta = { rawEconomicThicknessCm: null, rawShortestPaybackThicknessCm: null, economicRangeCm: null };
  let climateCalculationRunning = false;
  let suppressProjectRender = false;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

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
    if (value === null || value === undefined || value === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function hasPositive(value) {
    return finite(value, 0) > 0;
  }

  function formatNumber(value, digits = 0) {
    if (!Number.isFinite(Number(value))) return '–';
    if (digits === 3) return number3.format(Number(value));
    if (digits === 2) return number2.format(Number(value));
    if (digits === 1) return number1.format(Number(value));
    return number0.format(Number(value));
  }

  function roundDisplay(value, step) {
    return measureCore.roundToStep(value, step);
  }

  function formatMoney(value) {
    if (!Number.isFinite(Number(value))) return '–';
    return euro0.format(roundDisplay(Number(value), financeConfig?.rounding?.total_eur ?? 500));
  }

  function formatAnnualMoney(value) {
    if (!Number.isFinite(Number(value))) return '–';
    return `${euro0.format(roundDisplay(Number(value), financeConfig?.rounding?.annual_eur ?? 50))}/a`;
  }

  function formatEnergy(value) {
    if (!Number.isFinite(Number(value))) return '–';
    return `${formatNumber(roundDisplay(Number(value), 100), 0)} kWh/a`;
  }

  function formatCo2(value) {
    if (!Number.isFinite(Number(value))) return '–';
    return `${formatNumber(roundDisplay(Number(value), financeConfig?.rounding?.co2_kg ?? 100), 0)} kg CO₂e/a`;
  }

  function activeComponent() {
    return COMPONENTS.find((item) => item.id === activeComponentId) ?? COMPONENTS[0];
  }

  function targetForComponent(component = activeComponent()) {
    return targetsConfig?.components?.[component.targetId] ?? null;
  }

  function projectDraft(project = store.get(), componentId = activeComponentId) {
    return project.modules?.bauteilSanierung?.drafts?.[componentId] ?? {};
  }

  function writeDraft(patch) {
    const project = store.get();
    const current = projectDraft(project);
    suppressProjectRender = true;
    store.setPath(`modules.bauteilSanierung.drafts.${activeComponentId}`, {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    store.setPath('modules.bauteilSanierung.selectedComponentId', activeComponentId);
    suppressProjectRender = false;
  }

  function inputNumber(id, fallback = null) {
    return finite($(id)?.value, fallback);
  }

  function setInput(id, value, digits = null) {
    const input = $(id);
    if (!input) return;
    if (value === null || value === undefined || value === '') {
      input.value = '';
      return;
    }
    input.value = digits === null ? String(value) : Number(value).toFixed(digits);
  }

  function componentProjectValues(project, component) {
    const draft = projectDraft(project, component.id);
    const areaInfo = component.areaPath ? describeAt(project, component.areaPath) : { value: draft.areaM2 ?? null, origin: null, source: null };
    const uInfo = component.uPath ? describeAt(project, component.uPath) : { value: draft.existingUValue ?? null, origin: null, source: null };
    return { areaInfo, uInfo, draft };
  }

  function energyFlowComponent(project, component) {
    return project.modules?.energiefluss?.resultSummary?.components?.find((item) => item.id === component.energyFlowId) ?? null;
  }

  function climateContext(project) {
    const summary = project.modules?.klima?.climateSummary;
    const natC = finite(summary?.natC, null);
    const fullLoadHours = finite(summary?.metrics?.average_full_load_hours, null);
    const heatingDegreeHoursKh = natC !== null && fullLoadHours !== null && fullLoadHours > 0 && 15 > natC
      ? fullLoadHours * (15 - natC)
      : null;
    return {
      summary,
      natC,
      fullLoadHours,
      heatingDegreeHoursKh,
      period: summary?.period ?? null,
    };
  }

  function renderComponentSelector() {
    const host = $('componentSelector');
    host.innerHTML = COMPONENTS.map((component) => `
      <button class="component-choice ${component.id === activeComponentId ? 'is-active' : ''} ${component.supported ? '' : 'is-planned'}" data-component-choice="${component.id}" type="button" ${component.supported ? '' : 'disabled'}>
        <strong>${escapeHtml(component.short)}</strong>
        <span>${component.supported ? 'Dämmmaßnahme' : 'Austausch folgt'}</span>
      </button>`).join('');
    host.querySelectorAll('[data-component-choice]').forEach((button) => {
      button.addEventListener('click', () => selectComponent(button.dataset.componentChoice));
    });

    const select = $('componentSelect');
    select.innerHTML = COMPONENTS.map((component) => `<option value="${component.id}" ${component.supported ? '' : 'disabled'}>${escapeHtml(component.label)}${component.supported ? '' : ' – folgt'}</option>`).join('');
    select.value = activeComponentId;
  }

  function populateLambdaOptions() {
    const select = $('lambdaSelect');
    const values = (lambdaConfig?.values ?? []).filter((item) => item.active !== false);
    select.innerHTML = values.map((item) => `<option value="${item.value}">${escapeHtml(item.label)}</option>`).join('') + '<option value="custom">eigener Wert</option>';
  }

  function costModelFor(component = activeComponent()) {
    return (costConfig?.models ?? []).find((item) => item.id === component.costModelId) ?? null;
  }

  function lifetimeFor(component = activeComponent()) {
    return (lifetimeConfig?.items ?? []).find((item) => item.cost_model_id === component.costModelId || item.id === component.costModelId) ?? null;
  }

  function energyCarrierItems() {
    return (energyPricesConfig?.items ?? []).filter((item) => item.active !== false && Number.isFinite(Number(item.price)));
  }

  function populateEnergyCarrierOptions(selectedId = null) {
    const select = $('energyCarrierSelect');
    const items = energyCarrierItems();
    select.innerHTML = items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join('');
    if (!items.length) select.innerHTML = '<option value="custom">Energiepreis manuell</option>';
    const desired = items.some((item) => item.id === selectedId) ? selectedId : (items.find((item) => item.id === 'oil')?.id ?? items[0]?.id ?? 'custom');
    select.value = desired;
    return desired;
  }

  function carrierDefaults(carrierId) {
    const price = (energyPricesConfig?.items ?? []).find((item) => item.id === carrierId);
    const emission = (emissionFactorsConfig?.items ?? []).find((item) => item.id === carrierId);
    return {
      price: finite(price?.price, null),
      emissionFactor: finite(emission?.factor_kg_co2e_kwh, null),
      label: price?.label ?? emission?.label ?? 'Energieträger',
    };
  }

  function fundingDraft(draft = {}) {
    const existing = draft.funding ?? {};
    return {
      state: existing.state ?? { mode: 'none', value: 0 },
      federal: existing.federal ?? { mode: 'none', value: 0 },
      other: existing.other ?? { mode: 'none', value: 0 },
    };
  }

  function updateFundingUnits() {
    ['state', 'federal', 'other'].forEach((id) => {
      const mode = $(`${id}FundingMode`)?.value ?? 'none';
      const unit = mode === 'amount' ? '€' : mode.startsWith('percent_') ? '%' : '–';
      $(`${id}FundingUnit`).textContent = unit;
      $(`${id}FundingValue`).disabled = mode === 'none';
    });
  }

  function defaultCostValues(component = activeComponent()) {
    const modelValue = costModelFor(component);
    const lifetimeValue = lifetimeFor(component);
    return {
      model: modelValue,
      baseCostEurM2: finite(modelValue?.base_cost_eur_m2, null),
      variableCostEurM2Cm: finite(modelValue?.variable_cost_eur_m2_cm, null),
      sunkCostEurM2: finite(modelValue?.sunk_cost_eur_m2, 0),
      lifetimeYears: finite(lifetimeValue?.years, null),
    };
  }

  function selectComponent(componentId) {
    const component = COMPONENTS.find((item) => item.id === componentId && item.supported);
    if (!component) return;
    activeComponentId = component.id;
    suppressProjectRender = true;
    store.setPath('modules.bauteilSanierung.selectedComponentId', activeComponentId);
    suppressProjectRender = false;
    selectedThicknessCm = null;
    renderComponentSelector();
    renderFromProject(store.get());
    const url = new URL(global.location.href);
    url.searchParams.set('component', activeComponentId);
    global.history.replaceState(null, '', url);
  }

  function renderFromProject(project) {
    if (suppressProjectRender) return;
    const component = activeComponent();
    const { areaInfo, uInfo, draft } = componentProjectValues(project, component);
    const target = targetForComponent(component);
    const climate = climateContext(project);
    const flowComponent = energyFlowComponent(project, component);
    const financeDefaults = financeConfig?.defaults ?? FALLBACK_FINANCE;
    const costDefaults = defaultCostValues(component);

    setInput('areaM2', areaInfo.value, 0);
    setInput('existingUValue', uInfo.value, 2);
    $('areaSource').textContent = areaInfo.value !== null
      ? `${ORIGIN_LABELS[areaInfo.origin] ?? 'Projektwert'}${areaInfo.source ? ` · ${areaInfo.source}` : ''}`
      : 'noch kein Wert vorhanden';
    $('uValueSource').textContent = uInfo.value !== null
      ? `${ORIGIN_LABELS[uInfo.origin] ?? 'Projektwert'}${uInfo.source ? ` · ${uInfo.source}` : ''}`
      : 'noch kein Wert vorhanden';

    if (selectedThicknessCm === null && draft.selectedThicknessCm !== null && draft.selectedThicknessCm !== undefined) selectedThicknessCm = finite(draft.selectedThicknessCm, null);
    const lambdaValue = finite(draft.lambdaWmk, 0.035);
    const lambdaOption = Array.from($('lambdaSelect').options).find((option) => finite(option.value, null) === lambdaValue);
    $('lambdaSelect').value = lambdaOption ? String(lambdaValue) : 'custom';
    setInput('lambdaCustom', lambdaValue, 3);
    $('lambdaCustomWrap').hidden = $('lambdaSelect').value !== 'custom';

    setInput('annualEfficiency', draft.annualEfficiency ?? valueAt(project, 'systems.heating.usefulHeatFactor', 0.85), 2);
    setInput('indoorTemperature', draft.indoorTemperatureC ?? valueAt(project, 'building.thermal.indoorTemperature', 20), 1);
    setInput('boundaryFactor', draft.boundaryFactor ?? component.boundaryFactor, 2);
    setInput('heatingDegreeDays', draft.heatingDegreeDaysKd, 0);

    $('renewalContext').value = draft.renewalContext ?? 'renewal_due';
    setInput('baseCostEurM2', draft.baseCostEurM2 ?? costDefaults.baseCostEurM2, 0);
    setInput('variableCostEurM2Cm', draft.variableCostEurM2Cm ?? costDefaults.variableCostEurM2Cm, 1);
    setInput('sunkCostEurM2', draft.sunkCostEurM2 ?? costDefaults.sunkCostEurM2, 0);
    setInput('lifetimeYears', draft.lifetimeYears ?? costDefaults.lifetimeYears, 0);

    const selectedCarrier = populateEnergyCarrierOptions(draft.energyCarrierId);
    const carrier = carrierDefaults(selectedCarrier);
    setInput('energyPriceEurKwh', draft.energyPriceEurKwh ?? carrier.price, 3);
    setInput('emissionFactorKgKwh', draft.emissionFactorKgKwh ?? carrier.emissionFactor, 3);

    setInput('periodYears', draft.periodYears ?? financeDefaults.period_years, 0);
    setInput('interestRatePercent', draft.interestRatePercent ?? financeDefaults.interest_rate_percent, 1);
    setInput('energyEscalationPercent', draft.energyEscalationPercent ?? financeDefaults.energy_price_escalation_percent, 1);
    setInput('investmentEscalationPercent', draft.investmentEscalationPercent ?? financeDefaults.investment_price_escalation_percent, 1);
    setInput('disposalEscalationPercent', draft.disposalEscalationPercent ?? financeDefaults.disposal_price_escalation_percent, 1);

    const funding = fundingDraft(draft);
    ['state', 'federal', 'other'].forEach((id) => {
      $(`${id}FundingMode`).value = funding[id].mode ?? 'none';
      setInput(`${id}FundingValue`, funding[id].value ?? 0, 1);
    });
    updateFundingUnits();

    const recommended = target?.recommended;
    const ambitious = target?.ambitious;
    $('recommendedTarget').textContent = recommended ? `U ≤ ${formatNumber(recommended, 2)} W/m²K` : 'noch offen';
    $('ambitiousTarget').textContent = ambitious ? `U ≤ ${formatNumber(ambitious, 2)} W/m²K` : 'noch offen';

    if (flowComponent?.lossKwh > 0) {
      $('climateStrip').dataset.level = 'good';
      $('energyBasisTitle').textContent = 'Kalibrierter Bauteilverlust aus Energiefluss';
      $('energyBasisText').textContent = `${formatEnergy(flowComponent.lossKwh)} Bestand · Verbrauchsbasis des Projekts`;
      $('calculateClimate').hidden = true;
    } else if (climate.heatingDegreeHoursKh) {
      $('climateStrip').dataset.level = 'good';
      $('energyBasisTitle').textContent = 'Standortklima verfügbar';
      $('energyBasisText').textContent = `INCA ${climate.period ?? ''} · überschlägige U × A-Klimarechnung`;
      $('calculateClimate').hidden = true;
    } else {
      $('climateStrip').dataset.level = 'warning';
      $('energyBasisTitle').textContent = 'Energiegrundlage fehlt noch';
      $('energyBasisText').textContent = 'Energiefluss berechnen, Klimawerte hier laden oder technische Varianten zunächst ohne Energie-/Kostenwirkung prüfen.';
      $('calculateClimate').hidden = false;
    }

    const modelStatus = costDefaults.model?.status === 'confirmed' ? 'bestätigter Richtwert' : costDefaults.model ? 'Vorschlag – bitte prüfen' : 'manuelle Eingabe';
    $('projectLinkStatus').textContent = areaInfo.value && uInfo.value ? 'Projektwerte übernommen' : 'Eingaben ergänzen';
    $('costDataStatus').textContent = costDefaults.baseCostEurM2 !== null ? modelStatus : 'Kostenwerte ergänzen';
    const costRange = costDefaults.model?.range_eur_m2;
    $('costSummaryModel').textContent = costRange?.low !== undefined && costRange?.high !== undefined
      ? `ca. ${formatNumber(costRange.low)}–${formatNumber(costRange.high)} €/m²`
      : costDefaults.baseCostEurM2 !== null ? 'Richtwert automatisch geladen' : 'noch kein Richtwert';
    $('costSummaryModelNote').textContent = `${costDefaults.model?.label ?? component.label} · ${modelStatus}`;
    $('costSummarySunk').textContent = $('renewalContext').value === 'renewal_due' && inputNumber('sunkCostEurM2', 0) > 0
      ? 'automatisch berücksichtigt'
      : 'nicht angesetzt';
    $('costSummaryFinance').textContent = 'Standardannahmen geladen';
    $('costSummaryFinanceNote').textContent = `${formatNumber(inputNumber('periodYears', 30))} Jahre · ${formatNumber(inputNumber('interestRatePercent', 3), 1)} % Zins · Sensitivität empfohlen`;

    calculateAndRender();
  }

  function currentInputs() {
    const component = activeComponent();
    const project = store.get();
    const flowComponent = energyFlowComponent(project, component);
    const climate = climateContext(project);
    const selectedLambda = $('lambdaSelect').value === 'custom'
      ? inputNumber('lambdaCustom', null)
      : finite($('lambdaSelect').value, null);
    const fundingEntries = [
      { id: 'state', label: 'Landesförderung', mode: $('stateFundingMode').value, value: inputNumber('stateFundingValue', 0) },
      { id: 'federal', label: 'Bundesförderung', mode: $('federalFundingMode').value, value: inputNumber('federalFundingValue', 0) },
      { id: 'other', label: 'Sonstige Förderung', mode: $('otherFundingMode').value, value: inputNumber('otherFundingValue', 0) },
    ];
    return {
      component,
      areaM2: inputNumber('areaM2', 0),
      existingUValue: inputNumber('existingUValue', 0),
      lambdaWmk: selectedLambda,
      annualEfficiency: inputNumber('annualEfficiency', 0.85),
      indoorTemperatureC: inputNumber('indoorTemperature', 20),
      boundaryFactor: inputNumber('boundaryFactor', component.boundaryFactor),
      heatingDegreeDaysKd: inputNumber('heatingDegreeDays', null),
      existingLossKwh: finite(flowComponent?.lossKwh, null),
      heatingDegreeHoursKh: climate.heatingDegreeHoursKh,
      natC: climate.natC,
      period: climate.period,
      renewalContext: $('renewalContext').value,
      baseCostEurM2: measureCore.roundToStep(inputNumber('baseCostEurM2', null), financeConfig?.rounding?.cost_per_m2_eur ?? 10),
      variableCostEurM2Cm: inputNumber('variableCostEurM2Cm', null),
      sunkCostEurM2: measureCore.roundToStep(inputNumber('sunkCostEurM2', 0), financeConfig?.rounding?.cost_per_m2_eur ?? 10),
      lifetimeYears: inputNumber('lifetimeYears', null),
      energyCarrierId: $('energyCarrierSelect').value,
      energyPriceEurKwh: inputNumber('energyPriceEurKwh', null),
      periodYears: inputNumber('periodYears', FALLBACK_FINANCE.period_years),
      interestRatePercent: inputNumber('interestRatePercent', FALLBACK_FINANCE.interest_rate_percent),
      energyEscalationPercent: inputNumber('energyEscalationPercent', FALLBACK_FINANCE.energy_price_escalation_percent),
      investmentEscalationPercent: inputNumber('investmentEscalationPercent', FALLBACK_FINANCE.investment_price_escalation_percent),
      disposalEscalationPercent: inputNumber('disposalEscalationPercent', FALLBACK_FINANCE.disposal_price_escalation_percent),
      fundingEntries,
      emissionFactorKgKwh: inputNumber('emissionFactorKgKwh', null),
    };
  }

  function renderAssumptionSummary(inputs) {
    const modelValue = costModelFor(inputs.component);
    const costRange = modelValue?.range_eur_m2;
    $('costSummaryModel').textContent = costRange?.low !== undefined && costRange?.high !== undefined
      ? `ca. ${formatNumber(costRange.low)}–${formatNumber(costRange.high)} €/m²`
      : inputs.baseCostEurM2 !== null ? 'Richtwert automatisch geladen' : 'noch kein Richtwert';
    $('costSummaryModelNote').textContent = modelValue?.label ?? inputs.component.label;
    $('costSummarySunk').textContent = inputs.renewalContext === 'renewal_due' && (inputs.sunkCostEurM2 ?? 0) > 0
      ? 'automatisch berücksichtigt'
      : 'nicht angesetzt';
    $('costSummaryFinance').textContent = 'Standardannahmen geladen';
    $('costSummaryFinanceNote').textContent = `${formatNumber(inputs.periodYears)} Jahre · ${formatNumber(inputs.interestRatePercent, 1)} % Zins · Sensitivität empfohlen`;
  }

  function variantEconomics(variant, reference, inputs) {
    const costReady = inputs.baseCostEurM2 !== null
      && inputs.variableCostEurM2Cm !== null
      && hasPositive(inputs.lifetimeYears)
      && inputs.energyPriceEurKwh !== null
      && variant.energy.available;
    if (!costReady) return { available: false, result: null, paybackYears: null };

    const interestFactor = economicsCore.factorFromPercent(inputs.interestRatePercent);
    const energyFactor = economicsCore.factorFromPercent(inputs.energyEscalationPercent);
    const investmentFactor = economicsCore.factorFromPercent(inputs.investmentEscalationPercent);
    const disposalFactor = economicsCore.factorFromPercent(inputs.disposalEscalationPercent);
    const assumptions = {
      periodYears: inputs.periodYears,
      interestFactor,
    };

    const toEconomicVariant = (item) => {
      const capitalComponents = item.investment.fullInvestmentEur > 0 ? [{
        id: `${inputs.component.id}-construction`,
        label: inputs.component.label,
        initialCost: item.investment.fullInvestmentEur,
        replacementCost: item.investment.fullInvestmentEur,
        disposalCost: 0,
        lifetimeYears: inputs.lifetimeYears,
        capitalPriceFactor: investmentFactor,
        disposalPriceFactor: disposalFactor,
      }] : [];
      const annualEnergyCost = item.energy.available
        ? item.energy.newUsefulKwh / inputs.annualEfficiency * inputs.energyPriceEurKwh
        : 0;
      return {
        id: item.id,
        label: `${item.thicknessCm} cm`,
        capitalComponents,
        consumptionCosts: [{
          id: 'component-energy',
          label: 'Energieverlust Bauteil',
          annualCost: annualEnergyCost,
          priceFactor: energyFactor,
        }],
        operationCosts: [],
      };
    };

    const economicVariant = toEconomicVariant(variant);
    const economicReference = toEconomicVariant(reference);
    const result = economicsCore.calculateVariant(economicVariant, assumptions);
    const crossings = variant.thicknessCm > 0
      ? economicsCore.findCrossings(economicVariant, economicReference, assumptions, 'cumulative')
      : [];
    const payback = crossings.find((entry) => entry.type === 'amortisation')?.year ?? null;
    return { available: true, result, paybackYears: payback, assumptions };
  }

  function calculateAndRender() {
    const inputs = currentInputs();
    renderAssumptionSummary(inputs);
    const target = targetForComponent(inputs.component);
    const technicalReady = hasPositive(inputs.areaM2) && hasPositive(inputs.existingUValue) && hasPositive(inputs.lambdaWmk);

    if (!technicalReady) {
      variants = [];
      enrichedVariants = [];
      renderEmptyResults('Fläche, Bestands-U-Wert und λ-Wert ergänzen.');
      return;
    }

    variants = measureCore.createVariants({
      areaM2: inputs.areaM2,
      existingUValue: inputs.existingUValue,
      lambdaWmk: inputs.lambdaWmk,
      maximumThicknessCm: 30,
      thicknessStepCm: 2,
      existingLossKwh: inputs.existingLossKwh,
      heatingDegreeHoursKh: inputs.heatingDegreeHoursKh,
      boundaryFactor: inputs.boundaryFactor,
      annualEfficiency: inputs.annualEfficiency,
      renewalContext: inputs.renewalContext,
      baseCostEurM2: inputs.baseCostEurM2 ?? 0,
      variableCostEurM2Cm: inputs.variableCostEurM2Cm ?? 0,
      sunkCostEurM2: inputs.sunkCostEurM2 ?? 0,
      fundingEntries: inputs.fundingEntries,
      energyPriceEurKwh: inputs.energyPriceEurKwh,
      emissionFactorKgKwh: inputs.emissionFactorKgKwh,
    });

    const reference = variants[0];
    enrichedVariants = variants.map((variant) => ({
      ...variant,
      economics: variantEconomics(variant, reference, inputs),
    }));

    // Die Beratungstabelle bleibt in 2-cm-Schritten. Für das interne Kosten- und
    // Amortisationsoptimum wird feiner gerechnet, ohne diese Scheingenauigkeit
    // in der Oberfläche auszugeben.
    const denseThicknesses = measureCore.createThicknesses(30, 0.25);
    const denseBase = measureCore.createVariants({
      areaM2: inputs.areaM2,
      existingUValue: inputs.existingUValue,
      lambdaWmk: inputs.lambdaWmk,
      thicknessesCm: denseThicknesses,
      existingLossKwh: inputs.existingLossKwh,
      heatingDegreeHoursKh: inputs.heatingDegreeHoursKh,
      boundaryFactor: inputs.boundaryFactor,
      annualEfficiency: inputs.annualEfficiency,
      renewalContext: inputs.renewalContext,
      baseCostEurM2: inputs.baseCostEurM2 ?? 0,
      variableCostEurM2Cm: inputs.variableCostEurM2Cm ?? 0,
      sunkCostEurM2: inputs.sunkCostEurM2 ?? 0,
      fundingEntries: inputs.fundingEntries,
      energyPriceEurKwh: inputs.energyPriceEurKwh,
      emissionFactorKgKwh: inputs.emissionFactorKgKwh,
    });
    const denseReference = denseBase[0];
    const denseEnriched = denseBase.map((variant) => ({
      ...variant,
      economics: variantEconomics(variant, denseReference, inputs),
    }));

    const recommendationRaw = measureCore.requiredThicknessCm(inputs.existingUValue, target?.recommended, inputs.lambdaWmk);
    const ambitiousRaw = measureCore.requiredThicknessCm(inputs.existingUValue, target?.ambitious, inputs.lambdaWmk);
    const recommendationCm = recommendationRaw === null ? null : measureCore.ceilToStep(recommendationRaw, 2);
    const ambitiousCm = ambitiousRaw === null ? null : measureCore.ceilToStep(ambitiousRaw, 2);
    const recommendation = nearestVariant(recommendationCm);
    const ambitious = nearestVariant(ambitiousCm);

    const withEconomics = denseEnriched.filter((item) => item.economics.available);
    const rawEconomic = withEconomics.length
      ? withEconomics.reduce((best, item) => item.economics.result.totalPresentValue < best.economics.result.totalPresentValue ? item : best)
      : null;
    const rawShortestPayback = withEconomics
      .filter((item) => item.thicknessCm > 0 && item.economics.paybackYears !== null)
      .sort((a, b) => a.economics.paybackYears - b.economics.paybackYears)[0] ?? null;
    let rawEconomicRange = null;
    if (rawEconomic) {
      const minimum = rawEconomic.economics.result.totalPresentValue;
      const nearMinimum = withEconomics.filter((item) => item.economics.result.totalPresentValue <= minimum * 1.05);
      rawEconomicRange = nearMinimum.length ? [nearMinimum[0].thicknessCm, nearMinimum.at(-1).thicknessCm] : [rawEconomic.thicknessCm, rawEconomic.thicknessCm];
    }
    const economicDisplayCm = rawEconomic ? measureCore.roundToStep(rawEconomic.thicknessCm, 2) : null;
    const shortestDisplayCm = rawShortestPayback ? measureCore.roundToStep(rawShortestPayback.thicknessCm, 2) : null;
    const economic = economicDisplayCm === null ? null : nearestVariant(economicDisplayCm);
    const shortestPayback = shortestDisplayCm === null ? null : nearestVariant(shortestDisplayCm);
    optimizationMeta = {
      rawEconomicThicknessCm: rawEconomic?.thicknessCm ?? null,
      rawShortestPaybackThicknessCm: rawShortestPayback?.thicknessCm ?? null,
      economicRangeCm: rawEconomicRange,
    };

    specialVariants = { recommendation, economic, ambitious };
    if (selectedThicknessCm === null || !nearestVariant(selectedThicknessCm)) {
      selectedThicknessCm = recommendation?.thicknessCm ?? 0;
    }

    $('recommendedThickness').textContent = recommendation ? `ca. ${formatNumber(recommendation.thicknessCm)} cm` : '–';
    $('ambitiousThickness').textContent = ambitious ? `ca. ${formatNumber(ambitious.thicknessCm)} cm` : '–';

    renderSummaryCards(inputs, recommendation, economic, ambitious, shortestPayback);
    renderVariantSelect();
    renderSelectedVariant(inputs);
    renderVariantsTable(inputs, recommendation);
    renderCharts(inputs, recommendation, economic, ambitious);
    buildPrintReport(inputs);
    $('resultStatus').textContent = enrichedVariants.some((item) => item.economics.available) ? 'Technik + Wirtschaftlichkeit' : 'Technische Varianten';
  }

  function nearestVariant(thicknessCm) {
    const source = enrichedVariants.length ? enrichedVariants : variants;
    if (thicknessCm === null || !source.length) return null;
    return source.reduce((best, item) => Math.abs(item.thicknessCm - thicknessCm) < Math.abs(best.thicknessCm - thicknessCm) ? item : best);
  }

  function enrichedAtThickness(thicknessCm) {
    return enrichedVariants.find((item) => Math.abs(item.thicknessCm - thicknessCm) < 1e-6) ?? null;
  }

  function renderEmptyResults(message) {
    $('recommendationCardValue').textContent = '–';
    $('recommendationCardText').textContent = message;
    $('economicCardValue').textContent = '–';
    $('economicCardText').textContent = 'Kostenangaben ergänzen.';
    $('ambitiousCardValue').textContent = '–';
    $('ambitiousCardText').textContent = message;
    $('selectedVariantSelect').innerHTML = '';
    $('selectedVariantTitle').textContent = '–';
    ['selectedUValue','selectedEnergySaving','selectedCo2Saving','selectedSurfaceTemperature','bridgeFullCost','bridgeSunkCost','bridgeEnergeticCost','bridgeSubsidy','bridgeOwnInvestment'].forEach((id) => { $(id).textContent = '–'; });
    $('variantsTableBody').innerHTML = '';
    $('costChart').innerHTML = '<p>Kostenangaben ergänzen.</p>';
    $('paybackChart').innerHTML = '<p>Kostenangaben ergänzen.</p>';
  }

  function renderSummaryCards(inputs, recommendation, economic, ambitious, shortestPayback) {
    $('recommendationCardValue').textContent = recommendation ? `${formatNumber(recommendation.thicknessCm)} cm` : '–';
    $('recommendationCardText').textContent = recommendation
      ? `U ≈ ${formatNumber(recommendation.newUValue, 2)} W/m²K${recommendation.energy.available ? ` · ${formatEnergy(recommendation.energy.deliveredSavingsKwh)} weniger Endenergie` : ''}`
      : 'Kein Empfehlungspunkt verfügbar.';

    if (economic) {
      const rawRange = optimizationMeta.economicRangeCm;
      const lower = rawRange ? measureCore.roundToStep(rawRange[0], 2) : economic.thicknessCm;
      const upper = rawRange ? measureCore.roundToStep(rawRange[1], 2) : economic.thicknessCm;
      $('economicCardValue').textContent = `${formatNumber(economic.thicknessCm)} cm`;
      $('economicCardText').textContent = `Kostenminimum; wirtschaftlicher Bereich ca. ${formatNumber(lower)}–${formatNumber(upper)} cm${shortestPayback ? `. Kürzeste Amortisation bei ${formatNumber(shortestPayback.thicknessCm)} cm: ${formatNumber(shortestPayback.economics.paybackYears, 1)} Jahre.` : '.'}`;
    } else {
      $('economicCardValue').textContent = 'noch offen';
      $('economicCardText').textContent = 'Kosten, Nutzungsdauer und Energiepreis ergänzen.';
    }

    $('ambitiousCardValue').textContent = ambitious ? `${formatNumber(ambitious.thicknessCm)} cm` : '–';
    $('ambitiousCardText').textContent = ambitious
      ? `U ≈ ${formatNumber(ambitious.newUValue, 2)} W/m²K${ambitious.energy.available ? ` · zusätzliche Komfort- und CO₂-Wirkung` : ''}`
      : 'Kein ambitionierter Punkt verfügbar.';

    const analytic = calculateAnalyticOptimum(inputs);
    if (analytic !== null && economic) {
      $('economicCardText').textContent += ` Analytische Orientierung: ca. ${formatNumber(measureCore.roundToStep(analytic, 2))} cm.`;
    }
  }

  function calculateAnalyticOptimum(inputs) {
    if (!inputs.component.analyticAllowed || !hasPositive(inputs.heatingDegreeDaysKd) || !hasPositive(inputs.energyPriceEurKwh) || !hasPositive(inputs.variableCostEurM2Cm) || !hasPositive(inputs.lambdaWmk) || !hasPositive(inputs.lifetimeYears)) return null;
    try {
      const result = economicsCore.simplifiedOptimalInsulationThickness({
        lambdaWmk: inputs.lambdaWmk,
        heatingDegreeDaysKd: inputs.heatingDegreeDaysKd,
        endEnergyPriceEurKwh: inputs.energyPriceEurKwh,
        annualEfficiency: inputs.annualEfficiency,
        energyPriceRatePercent: inputs.energyEscalationPercent,
        interestRatePercent: inputs.interestRatePercent,
        periodYears: inputs.lifetimeYears,
        insulationVolumePriceEurM3: inputs.variableCostEurM2Cm * 100,
        baseResistanceM2KW: 1 / inputs.existingUValue,
      });
      return result.optimalThicknessM * 100;
    } catch (error) {
      return null;
    }
  }

  function renderVariantSelect() {
    const select = $('selectedVariantSelect');
    select.innerHTML = enrichedVariants.map((item) => `<option value="${item.thicknessCm}">${formatNumber(item.thicknessCm)} cm · U ${formatNumber(item.newUValue, 2)}</option>`).join('');
    const selected = enrichedAtThickness(selectedThicknessCm) ?? enrichedVariants[0];
    if (selected) {
      selectedThicknessCm = selected.thicknessCm;
      select.value = String(selected.thicknessCm);
    }
  }

  function boundaryTemperature(inputs) {
    if (inputs.component.boundaryKind === 'outside') return inputs.natC ?? -12;
    return 10;
  }

  function renderSelectedVariant(inputs) {
    const selected = enrichedAtThickness(selectedThicknessCm) ?? enrichedVariants[0];
    if (!selected) return;
    selectedThicknessCm = selected.thicknessCm;
    $('selectedVariantTitle').textContent = selected.thicknessCm > 0 ? `${formatNumber(selected.thicknessCm)} cm Zusatzdämmung` : 'Bestand / Referenz';
    $('selectedUValue').textContent = `${formatNumber(selected.newUValue, 2)} W/m²K`;
    $('selectedEnergySaving').textContent = selected.energy.available ? formatEnergy(selected.energy.deliveredSavingsKwh) : 'Energiegrundlage fehlt';
    $('selectedCo2Saving').textContent = selected.co2SavingsKgA !== null ? formatCo2(selected.co2SavingsKgA) : 'Faktor ergänzen';

    const oldSurface = measureCore.surfaceTemperatureC({
      indoorTemperatureC: inputs.indoorTemperatureC,
      boundaryTemperatureC: boundaryTemperature(inputs),
      uValue: inputs.existingUValue,
      internalSurfaceResistanceM2KW: inputs.component.rsi,
    });
    const newSurface = measureCore.surfaceTemperatureC({
      indoorTemperatureC: inputs.indoorTemperatureC,
      boundaryTemperatureC: boundaryTemperature(inputs),
      uValue: selected.newUValue,
      internalSurfaceResistanceM2KW: inputs.component.rsi,
    });
    $('selectedSurfaceTemperature').textContent = oldSurface !== null && newSurface !== null
      ? `${formatNumber(oldSurface, 1)} → ${formatNumber(newSurface, 1)} °C`
      : '–';

    const costsAvailable = inputs.baseCostEurM2 !== null && inputs.variableCostEurM2Cm !== null;
    $('bridgeFullCost').textContent = costsAvailable ? formatMoney(selected.investment.fullInvestmentEur) : 'Kosten ergänzen';
    $('bridgeSunkCost').textContent = costsAvailable ? formatMoney(selected.investment.sunkCostEur) : '–';
    $('bridgeEnergeticCost').textContent = costsAvailable ? formatMoney(selected.investment.energeticAdditionalEur) : '–';
    $('bridgeSubsidy').textContent = costsAvailable ? formatMoney(selected.subsidyEur) : '–';
    $('bridgeOwnInvestment').textContent = costsAvailable ? formatMoney(selected.relevantOwnInvestmentEur) : '–';

    const benefits = coBenefitsConfig?.components?.[inputs.component.targetId] ?? {};
    const surfaceGain = oldSurface !== null && newSurface !== null ? Math.max(0, newSurface - oldSurface) : null;
    $('comfortText').textContent = [
      benefits.winter_comfort ? `Winterkomfort: ${benefits.winter_comfort}.` : null,
      surfaceGain !== null ? `Innere Oberfläche überschlägig um ${formatNumber(surfaceGain, 1)} K wärmer.` : null,
      benefits.moisture ? `${benefits.moisture}.` : null,
      'Wärmebrücken und Anschlüsse bleiben separat zu planen.',
    ].filter(Boolean).join(' ');
  }

  function renderVariantsTable(inputs, recommendation) {
    const body = $('variantsTableBody');
    body.innerHTML = enrichedVariants.map((item) => {
      const economicText = item.economics.available ? formatMoney(item.economics.result.totalPresentValue) : '–';
      const payback = item.economics.paybackYears !== null ? `${formatNumber(item.economics.paybackYears, 1)} a` : '–';
      const invest = hasPositive(inputs.baseCostEurM2) || hasPositive(inputs.variableCostEurM2Cm) ? formatMoney(item.investment.fullInvestmentEur) : '–';
      return `<tr class="${Math.abs(item.thicknessCm - selectedThicknessCm) < 1e-6 ? 'is-selected' : ''} ${recommendation && item.thicknessCm === recommendation.thicknessCm ? 'is-recommended' : ''}">
        <td>${formatNumber(item.thicknessCm)} cm</td>
        <td>${formatNumber(item.newUValue, 2)}</td>
        <td>${item.energy.available ? formatEnergy(item.energy.deliveredSavingsKwh) : '–'}</td>
        <td>${invest}</td>
        <td>${economicText}</td>
        <td>${payback}</td>
        <td><button class="table-select-button" data-select-thickness="${item.thicknessCm}" type="button">wählen</button></td>
      </tr>`;
    }).join('');
    body.querySelectorAll('[data-select-thickness]').forEach((button) => button.addEventListener('click', () => {
      selectedThicknessCm = Number(button.dataset.selectThickness);
      renderVariantSelect();
      renderSelectedVariant(inputs);
      renderVariantsTable(inputs, recommendation);
      buildPrintReport(inputs);
    }));
  }

  function svgLineChart(points, options) {
    if (!points.length) return '<p>Keine Werte verfügbar.</p>';
    const width = 620;
    const height = 230;
    const pad = { left: 62, right: 18, top: 18, bottom: 42 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minYRaw = Math.min(...ys);
    const maxYRaw = Math.max(...ys);
    const yPadding = Math.max((maxYRaw - minYRaw) * 0.1, maxYRaw * 0.03, 1);
    const minY = Math.max(0, minYRaw - yPadding);
    const maxY = maxYRaw + yPadding;
    const sx = (x) => pad.left + (maxX === minX ? 0 : (x - minX) / (maxX - minX) * innerW);
    const sy = (y) => pad.top + innerH - (maxY === minY ? 0 : (y - minY) / (maxY - minY) * innerH);
    const path = points.map((p, index) => `${index ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    const xTicks = [minX, Math.round((minX + maxX) / 2), maxX];
    const yTicks = [minY, (minY + maxY) / 2, maxY];
    const markers = (options.markers ?? []).filter(Boolean).map((marker) => {
      const point = points.find((p) => p.x === marker.x);
      if (!point) return '';
      return `<circle cx="${sx(point.x)}" cy="${sy(point.y)}" r="6" class="chart-marker chart-marker--${marker.kind}"><title>${escapeHtml(marker.label)}</title></circle>`;
    }).join('');
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(options.ariaLabel)}">
      <g class="chart-grid">${yTicks.map((tick) => `<line x1="${pad.left}" x2="${width - pad.right}" y1="${sy(tick)}" y2="${sy(tick)}"/><text x="${pad.left - 8}" y="${sy(tick) + 4}" text-anchor="end">${escapeHtml(options.yFormatter(tick))}</text>`).join('')}</g>
      <line class="chart-axis" x1="${pad.left}" x2="${pad.left}" y1="${pad.top}" y2="${height - pad.bottom}"/>
      <line class="chart-axis" x1="${pad.left}" x2="${width - pad.right}" y1="${height - pad.bottom}" y2="${height - pad.bottom}"/>
      ${xTicks.map((tick) => `<text class="chart-label" x="${sx(tick)}" y="${height - 16}" text-anchor="middle">${formatNumber(tick)} cm</text>`).join('')}
      <path class="chart-line" d="${path}" fill="none"/>
      ${points.map((p) => `<circle class="chart-point" cx="${sx(p.x)}" cy="${sy(p.y)}" r="3"><title>${formatNumber(p.x)} cm: ${escapeHtml(options.yFormatter(p.y))}</title></circle>`).join('')}
      ${markers}
    </svg>`;
  }

  function renderCharts(inputs, recommendation, economic, ambitious) {
    const costPoints = enrichedVariants.filter((item) => item.economics.available).map((item) => ({ x: item.thicknessCm, y: item.economics.result.totalPresentValue }));
    $('costChart').innerHTML = costPoints.length ? svgLineChart(costPoints, {
      ariaLabel: 'Gesamtkosten nach Dämmdicke',
      yFormatter: (value) => `${formatNumber(roundDisplay(value, 500) / 1000, 1)} T€`,
      markers: [
        recommendation ? { x: recommendation.thicknessCm, kind: 'recommendation', label: 'Empfehlung' } : null,
        economic ? { x: economic.thicknessCm, kind: 'economic', label: 'Kostenoptimum' } : null,
        ambitious ? { x: ambitious.thicknessCm, kind: 'ambitious', label: 'Ambitioniert' } : null,
      ],
    }) : '<p>Kosten, Nutzungsdauer und Energiepreis ergänzen.</p>';

    const paybackPoints = enrichedVariants.filter((item) => item.thicknessCm > 0 && item.economics.paybackYears !== null).map((item) => ({ x: item.thicknessCm, y: item.economics.paybackYears }));
    $('paybackChart').innerHTML = paybackPoints.length ? svgLineChart(paybackPoints, {
      ariaLabel: 'Dynamische Amortisationsdauer nach Dämmdicke',
      yFormatter: (value) => `${formatNumber(value, 1)} a`,
      markers: [],
    }) : '<p>Innerhalb des Betrachtungszeitraums keine dynamische Amortisation ermittelt oder Kostenangaben fehlen.</p>';
  }

  function persistVisibleInputs() {
    const inputs = currentInputs();
    const component = inputs.component;
    suppressProjectRender = true;
    if (component.areaPath) store.setFieldCandidate(component.areaPath, model.ORIGIN.MANUAL, inputs.areaM2, { unit: 'm²', source: 'Bauteil & Sanierung V0.2' });
    if (component.uPath) store.setFieldCandidate(component.uPath, model.ORIGIN.MANUAL, inputs.existingUValue, { unit: 'W/m²K', source: 'Bauteil & Sanierung V0.2' });
    store.setFieldCandidate('systems.heating.usefulHeatFactor', model.ORIGIN.MANUAL, inputs.annualEfficiency, { source: 'Bauteil & Sanierung V0.2' });
    store.setFieldCandidate('building.thermal.indoorTemperature', model.ORIGIN.MANUAL, inputs.indoorTemperatureC, { unit: '°C', source: 'Bauteil & Sanierung V0.2' });
    writeDraft({
      lambdaWmk: inputs.lambdaWmk,
      annualEfficiency: inputs.annualEfficiency,
      indoorTemperatureC: inputs.indoorTemperatureC,
      boundaryFactor: inputs.boundaryFactor,
      heatingDegreeDaysKd: inputs.heatingDegreeDaysKd,
      renewalContext: inputs.renewalContext,
      baseCostEurM2: inputs.baseCostEurM2,
      variableCostEurM2Cm: inputs.variableCostEurM2Cm,
      sunkCostEurM2: inputs.sunkCostEurM2,
      lifetimeYears: inputs.lifetimeYears,
      energyCarrierId: inputs.energyCarrierId,
      energyPriceEurKwh: inputs.energyPriceEurKwh,
      periodYears: inputs.periodYears,
      interestRatePercent: inputs.interestRatePercent,
      energyEscalationPercent: inputs.energyEscalationPercent,
      investmentEscalationPercent: inputs.investmentEscalationPercent,
      disposalEscalationPercent: inputs.disposalEscalationPercent,
      funding: {
        state: inputs.fundingEntries.find((item) => item.id === 'state'),
        federal: inputs.fundingEntries.find((item) => item.id === 'federal'),
        other: inputs.fundingEntries.find((item) => item.id === 'other'),
      },
      emissionFactorKgKwh: inputs.emissionFactorKgKwh,
      selectedThicknessCm,
    });
    suppressProjectRender = false;
  }

  function saveMeasure() {
    const inputs = currentInputs();
    const selected = enrichedAtThickness(selectedThicknessCm);
    if (!selected) return;
    persistVisibleInputs();
    const measureId = `envelope-${inputs.component.id}`;
    const target = targetForComponent(inputs.component);
    const oldSurface = measureCore.surfaceTemperatureC({ indoorTemperatureC: inputs.indoorTemperatureC, boundaryTemperatureC: boundaryTemperature(inputs), uValue: inputs.existingUValue, internalSurfaceResistanceM2KW: inputs.component.rsi });
    const newSurface = measureCore.surfaceTemperatureC({ indoorTemperatureC: inputs.indoorTemperatureC, boundaryTemperatureC: boundaryTemperature(inputs), uValue: selected.newUValue, internalSurfaceResistanceM2KW: inputs.component.rsi });
    const measure = {
      id: measureId,
      category: 'envelope',
      type: 'insulation',
      componentId: inputs.component.id,
      title: `${inputs.component.label} sanieren`,
      status: 'draft-selected',
      existingState: { areaM2: inputs.areaM2, uValue: inputs.existingUValue },
      selectedVariant: { thicknessCm: selected.thicknessCm, uValue: selected.newUValue, lambdaWmk: inputs.lambdaWmk },
      targetProfile: {
        recommendedUValue: target?.recommended ?? null,
        ambitiousUValue: target?.ambitious ?? null,
        sourceVersion: targetsConfig?.version ?? null,
      },
      energyEffect: clone(selected.energy),
      costModel: {
        renewalContext: inputs.renewalContext,
        baseCostEurM2: inputs.baseCostEurM2,
        variableCostEurM2Cm: inputs.variableCostEurM2Cm,
        lifetimeYears: inputs.lifetimeYears,
        fullInvestmentEur: selected.investment.fullInvestmentEur,
      },
      sunkCosts: { rateEurM2: inputs.sunkCostEurM2, totalEur: selected.investment.sunkCostEur },
      funding: { entries: clone(selected.fundingItems ?? []), amountEur: selected.subsidyEur, confirmed: (selected.fundingItems ?? []).some((item) => item.confirmed) },
      financialAssumptions: {
        periodYears: inputs.periodYears,
        interestRatePercent: inputs.interestRatePercent,
        energyEscalationPercent: inputs.energyEscalationPercent,
        investmentEscalationPercent: inputs.investmentEscalationPercent,
      },
      economicsResult: selected.economics.available ? {
        totalPresentValueEur: selected.economics.result.totalPresentValue,
        annuityEurA: selected.economics.result.annuity,
        amortisationYears: selected.economics.paybackYears,
      } : null,
      co2Effect: { annualKg: selected.co2SavingsKgA, factorKgKwh: inputs.emissionFactorKgKwh },
      comfortEffect: { existingSurfaceTemperatureC: oldSurface, renovatedSurfaceTemperatureC: newSurface },
      comments: '',
      sourceVersions: {
        measureCore: measureCore.MODEL_VERSION,
        economicsCore: economicsCore.MODEL_VERSION,
        targets: targetsConfig?.version ?? null,
        costs: costConfig?.version ?? null,
      },
      displayRounding: clone(financeConfig?.rounding ?? {}),
      updatedAt: new Date().toISOString(),
    };
    store.setPath(`measures.${measureId}`, measure);
    $('saveMeasureStatus').textContent = 'Maßnahme wurde im gemeinsamen Projekt gespeichert.';
    global.setTimeout(() => { $('saveMeasureStatus').textContent = ''; }, 4000);
  }

  function climateLocationFromProject(project) {
    const address = project.location?.addressRecord;
    if (!address || !Number.isFinite(Number(address.latitude)) || !Number.isFinite(Number(address.longitude))) {
      throw new Error('Für die automatische Klimaberechnung ist eine bestätigte Projektadresse mit Koordinaten erforderlich. Alternativ können HGT und technische Eingaben manuell ergänzt werden.');
    }
    if (!oibNatCore || !precomputedClimateCore) throw new Error('OIB- oder INCA-Klimamodul wurde nicht geladen.');
    const natLookup = oibNatCore.lookupAddress(address);
    if (natLookup?.status !== 'exact' || !natLookup.reference) {
      throw new Error(`${natLookup?.message ?? 'Die Katastralgemeinde konnte nicht eindeutig bestimmt werden.'} Bitte die KG im Klima-Tool einmal eindeutig auswählen.`);
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

  async function calculateClimate() {
    if (climateCalculationRunning) return;
    climateCalculationRunning = true;
    $('calculateClimate').disabled = true;
    $('calculateClimate').textContent = 'Klimawerte werden berechnet …';
    try {
      const location = climateLocationFromProject(store.get());
      const loaded = await precomputedClimateCore.loadForLocation(location);
      const result = loaded?.result;
      if (!result) throw new Error(loaded?.parts?.errors?.[0]?.message ?? 'Kein vollständiges INCA-Profil gefunden.');
      const years = Array.isArray(result.data?.years) ? result.data.years.map(Number).filter(Number.isFinite) : [];
      const period = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : null;
      store.patch({ modules: { klima: { climateSummary: {
        period,
        source: result.data?.source ?? null,
        natC: result.location?.nat_c ?? location.nat_c,
        tnat13C: result.location?.tnat13_c ?? location.tnat13_c,
        metrics: clone(result.metrics ?? {}),
        gridLatitude: result.location?.grid_latitude ?? null,
        gridLongitude: result.location?.grid_longitude ?? null,
        calculationMode: 'bauteil-sanierung-direct',
        updatedAt: new Date().toISOString(),
      }, updatedAt: new Date().toISOString() } } });
    } catch (error) {
      $('climateStrip').dataset.level = 'warning';
      $('energyBasisTitle').textContent = 'Klimaberechnung nicht möglich';
      $('energyBasisText').textContent = error.message;
    } finally {
      climateCalculationRunning = false;
      $('calculateClimate').disabled = false;
      $('calculateClimate').textContent = 'Klimawerte berechnen';
    }
  }

  function buildPrintReport(inputs = currentInputs()) {
    const selected = enrichedAtThickness(selectedThicknessCm);
    const project = store.get();
    const target = targetForComponent(inputs.component);
    if (!selected) {
      $('renovationPrintReport').innerHTML = '<h1>Bauteil &amp; Sanierung</h1><p>Für den Ausdruck fehlen Berechnungswerte.</p>';
      return;
    }
    const shortlist = [specialVariants.recommendation, specialVariants.economic, specialVariants.ambitious]
      .filter(Boolean)
      .filter((item, index, array) => array.findIndex((entry) => entry.thicknessCm === item.thicknessCm) === index);
    $('renovationPrintReport').innerHTML = `
      <section><p class="eyebrow">Bauteil &amp; Sanierung</p><h1>${escapeHtml(inputs.component.label)}</h1><p>${escapeHtml(project.project?.addressLabel || 'ohne Standort')}</p></section>
      <section class="print-summary-grid">
        <div><span>Fläche</span><strong>${formatNumber(inputs.areaM2)} m²</strong></div>
        <div><span>U-Wert Bestand</span><strong>${formatNumber(inputs.existingUValue, 2)} W/m²K</strong></div>
        <div><span>λ-Wert</span><strong>${formatNumber(inputs.lambdaWmk, 3)} W/mK</strong></div>
      </section>
      <section><h2>Ausgewählte Variante</h2><div class="print-kpi-grid">
        <div><span>Dämmstärke</span><strong>${formatNumber(selected.thicknessCm)} cm</strong></div>
        <div><span>U-Wert neu</span><strong>${formatNumber(selected.newUValue, 2)} W/m²K</strong></div>
        <div><span>Energieeinsparung</span><strong>${selected.energy.available ? formatEnergy(selected.energy.deliveredSavingsKwh) : 'nicht berechnet'}</strong></div>
        <div><span>CO₂-Einsparung</span><strong>${selected.co2SavingsKgA !== null ? formatCo2(selected.co2SavingsKgA) : 'nicht berechnet'}</strong></div>
        <div><span>Gesamtkosten</span><strong>${formatMoney(selected.investment.fullInvestmentEur)}</strong></div>
        <div><span>Amortisation</span><strong>${selected.economics.paybackYears !== null ? `${formatNumber(selected.economics.paybackYears, 1)} Jahre` : 'nicht ermittelt'}</strong></div>
      </div></section>
      <section><h2>Kostenbrücke</h2><div class="print-cost-bridge">
        <div><span>Gesamtkosten</span><strong>${formatMoney(selected.investment.fullInvestmentEur)}</strong></div>
        <div><span>− Sowiesokosten</span><strong>${formatMoney(selected.investment.sunkCostEur)}</strong></div>
        <div><span>= energetische Mehrkosten</span><strong>${formatMoney(selected.investment.energeticAdditionalEur)}</strong></div>
        <div><span>− bestätigte Förderung</span><strong>${formatMoney(selected.subsidyEur)}</strong></div>
        <div><span>= relevante Eigeninvestition</span><strong>${formatMoney(selected.relevantOwnInvestmentEur)}</strong></div>
      </div></section>
      <section><h2>Orientierungspunkte</h2><table class="print-variants"><thead><tr><th>Bereich</th><th>Dämmung</th><th>U-Wert</th><th>Gesamtkosten</th><th>Amortisation</th></tr></thead><tbody>
        ${shortlist.map((item) => {
          const label = item === specialVariants.recommendation ? 'Empfehlung' : item === specialVariants.economic ? 'Kostenoptimum' : 'Ambitioniert';
          return `<tr><td>${label}</td><td>${formatNumber(item.thicknessCm)} cm</td><td>${formatNumber(item.newUValue, 2)}</td><td>${item.economics.available ? formatMoney(item.economics.result.totalPresentValue) : '–'}</td><td>${item.economics.paybackYears !== null ? `${formatNumber(item.economics.paybackYears, 1)} a` : '–'}</td></tr>`;
        }).join('')}
      </tbody></table></section>
      <section><h2>Grundlagen und Grenzen</h2><p>Empfehlung U ≤ ${target?.recommended ? formatNumber(target.recommended, 2) : '–'} W/m²K; ambitioniert U ≤ ${target?.ambitious ? formatNumber(target.ambitious, 2) : '–'} W/m²K. Interne Berechnung ohne Rundung, Darstellung: Dämmdicke in 2-cm-Schritten, Richtpreise auf 10 €/m² und Summen auf 500 €. Beratungshilfe; aktuelle rechtliche, förderbezogene und bauphysikalische Anforderungen projektbezogen prüfen.</p></section>`;
  }

  function bindEvents() {
    $('componentSelect').addEventListener('change', () => selectComponent($('componentSelect').value));
    $('lambdaSelect').addEventListener('change', () => {
      const custom = $('lambdaSelect').value === 'custom';
      $('lambdaCustomWrap').hidden = !custom;
      if (!custom) setInput('lambdaCustom', Number($('lambdaSelect').value), 3);
      calculateAndRender();
    });
    $('selectedVariantSelect').addEventListener('change', () => {
      selectedThicknessCm = Number($('selectedVariantSelect').value);
      const inputs = currentInputs();
      renderSelectedVariant(inputs);
      renderVariantsTable(inputs, specialVariants.recommendation);
      buildPrintReport(inputs);
    });
    document.querySelectorAll('[data-select-special]').forEach((button) => button.addEventListener('click', () => {
      const item = specialVariants[button.dataset.selectSpecial];
      if (!item) return;
      selectedThicknessCm = item.thicknessCm;
      renderVariantSelect();
      const inputs = currentInputs();
      renderSelectedVariant(inputs);
      renderVariantsTable(inputs, specialVariants.recommendation);
      buildPrintReport(inputs);
    }));
    $('calculateClimate').addEventListener('click', calculateClimate);
    $('saveMeasure').addEventListener('click', saveMeasure);
    $('energyCarrierSelect').addEventListener('change', () => {
      const defaults = carrierDefaults($('energyCarrierSelect').value);
      if (defaults.price !== null) setInput('energyPriceEurKwh', defaults.price, 3);
      if (defaults.emissionFactor !== null) setInput('emissionFactorKgKwh', defaults.emissionFactor, 3);
      calculateAndRender();
      persistVisibleInputs();
    });
    ['state', 'federal', 'other'].forEach((id) => {
      $(`${id}FundingMode`).addEventListener('change', () => {
        updateFundingUnits();
        calculateAndRender();
        persistVisibleInputs();
      });
    });
    $('renewalContext').addEventListener('change', () => {
      $('costSummarySunk').textContent = $('renewalContext').value === 'renewal_due' && inputNumber('sunkCostEurM2', 0) > 0
        ? 'automatisch berücksichtigt'
        : 'nicht angesetzt';
    });

    const calculationInputs = document.querySelectorAll('.renovation-workspace input, .renovation-workspace select');
    calculationInputs.forEach((input) => {
      if (['componentSelect', 'selectedVariantSelect', 'lambdaSelect', 'energyCarrierSelect', 'stateFundingMode', 'federalFundingMode', 'otherFundingMode'].includes(input.id)) return;
      input.addEventListener('input', calculateAndRender);
      input.addEventListener('change', persistVisibleInputs);
    });

    global.addEventListener('energy-tools:prepare-print', () => buildPrintReport());
    store.subscribe((project) => renderFromProject(project));
  }

  async function loadJson(relativePath, fallback) {
    try {
      const url = paths?.href(relativePath, new URL(paths.sharedData)) ?? `../../shared/data/${relativePath}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.warn(`Datendatei ${relativePath} konnte nicht geladen werden.`, error);
      return fallback;
    }
  }

  async function init() {
    const requested = new URL(global.location.href).searchParams.get('component');
    const stored = store.get().modules?.bauteilSanierung?.selectedComponentId;
    activeComponentId = COMPONENTS.some((item) => item.id === requested && item.supported)
      ? requested
      : COMPONENTS.some((item) => item.id === stored && item.supported) ? stored : 'exteriorWall';

    [targetsConfig, lambdaConfig, coBenefitsConfig, costConfig, lifetimeConfig, financeConfig, energyPricesConfig, emissionFactorsConfig] = await Promise.all([
      loadJson('measures/envelope-targets.json', { components: {} }),
      loadJson('measures/lambda-values.json', { values: [{ value: 0.035, label: '0,035 W/mK', active: true }] }),
      loadJson('measures/co-benefits.json', { components: {} }),
      loadJson('costs/renovation-costs.json', { models: [] }),
      loadJson('costs/lifetimes.json', { items: [] }),
      loadJson('economics/financial-defaults.json', { defaults: FALLBACK_FINANCE, rounding: {} }),
      loadJson('economics/energy-prices.json', { items: [] }),
      loadJson('emissions/emission-factors.json', { items: [] }),
    ]);

    populateLambdaOptions();
    populateEnergyCarrierOptions();
    renderComponentSelector();
    document.querySelector('[data-project-change-address]')?.setAttribute('hidden', '');
    bindEvents();
    renderFromProject(store.get());
  }

  init().catch((error) => {
    console.error('Bauteil & Sanierung konnte nicht initialisiert werden.', error);
    $('resultStatus').textContent = 'Fehler';
  });
})(window);
