'use strict';

(function initEconomicsTool(global) {
  const store = global.EnergyToolsProjectStore;
  const model = global.EnergyToolsDataModel;
  const resolver = global.EnergyToolsValueResolver;
  const economics = global.EnergyEconomicsCore;
  const paths = global.EnergyToolsPaths;
  const addressManager = global.EnergyToolsAddressManager;
  const geometryService = global.EnergyToolsBuildingGeometryService;

  if (!store || !model || !resolver || !economics || !paths || !addressManager || !geometryService) {
    console.error('Wirtschaftlichkeit: gemeinsame Projektbasis oder Rechenkern fehlt.');
    return;
  }

  const $ = (id) => document.getElementById(id);
  const money = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const number0 = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 0 });
  const number1 = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const ORIGIN_LABEL = {
    manual: 'manuell', official: 'amtlich', derived: 'abgeleitet', fallback: 'Fallback',
  };

  const QUICK_DEFINITIONS = [
    { id: 'wall', componentId: 'exteriorWall', dataId: 'wall_external', costModelId: 'wall_wdvs', label: 'Außenwand', areaPath: 'building.geometry.opaqueExteriorWallArea', uPath: 'building.thermal.envelope.exteriorWall.uValue', flowId: 'exteriorWall' },
    { id: 'top-ceiling', componentId: 'topFloorCeiling', dataId: 'roof_top_ceiling', costModelId: 'top_ceiling', label: 'Oberste Geschoßdecke', areaPath: 'building.geometry.topFloorArea', uPath: 'building.thermal.envelope.topFloorCeiling.uValue', flowId: 'topFloorCeiling' },
    { id: 'basement', componentId: 'basementCeiling', dataId: 'ceiling_unheated', costModelId: 'basement_ceiling', label: 'Kellerdecke', areaPath: 'building.geometry.basementCeilingArea', uPath: 'building.thermal.envelope.basementCeiling.uValue', flowId: 'basementCeiling' },
    { id: 'windows', componentId: 'windows', dataId: 'window_external', costModelId: 'window_replace', label: 'Fenster', areaPath: 'building.geometry.windowArea', uPath: 'building.thermal.envelope.windows.uValue', flowId: 'windows' },
    { id: 'heating', componentId: 'heating', dataId: null, costModelId: null, label: 'Heizung fossilfrei', areaPath: null, uPath: null, flowId: null, manualOnly: true },
    { id: 'pv', componentId: 'pv', dataId: null, costModelId: null, label: 'PV-Anlage', areaPath: null, uPath: null, flowId: null, manualOnly: true, informational: true },
  ];

  let financeConfig = null;
  let energyPrices = null;
  let costConfig = null;
  let lifetimeConfig = null;
  let targetsConfig = null;
  let coBenefits = null;
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
  function formatEnergy(value) { return Number.isFinite(Number(value)) ? `${number0.format(roundTo(value, 100))} kWh/a` : '–'; }
  function formatArea(value) { return Number.isFinite(Number(value)) ? `${number0.format(roundTo(value, 5))} m²` : '–'; }
  function escapeHtml(value) { return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }

  async function fetchJson(path) {
    const response = await fetch(new URL(path, paths.sharedData));
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }

  async function loadConfigs() {
    [financeConfig, energyPrices, costConfig, lifetimeConfig, targetsConfig, coBenefits] = await Promise.all([
      fetchJson('economics/financial-defaults.json'),
      fetchJson('economics/energy-prices.json'),
      fetchJson('costs/renovation-costs.json'),
      fetchJson('standards/economics/component-lifetimes.json'),
      fetchJson('measures/envelope-targets.json'),
      fetchJson('measures/co-benefits.json'),
    ]);
  }

  function carrierItem(id) { return (energyPrices?.items ?? []).find((item) => item.id === id) ?? energyPrices?.items?.[0] ?? null; }
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

  function writeManualField(path, value, unit = null, source = 'Nutzereingabe Wirtschaftlichkeit V0.1') {
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
    $('basisEnergy').textContent = formatEnergy(annualEnergy);
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
    if (!valueAt(project, 'systems.heating.installationYear', null)) missing.push('Heizungsbaujahr');
    if (!missing.length) {
      $('basisHint').textContent = 'Gute Berechnungsbasis: die wesentlichen Projektwerte sind vorhanden.';
      $('basisHint').className = 'econ-hint is-info';
    } else {
      $('basisHint').textContent = `${missing.length} Ergänzung${missing.length === 1 ? '' : 'en'} verbessern die Aussage: ${missing.join(', ')}.`;
      $('basisHint').className = 'econ-hint is-warning';
    }
  }

  function renderChoiceGroup(id, selected, multiple = false) {
    const host = $(id);
    host.querySelectorAll('button[data-value]').forEach((button) => {
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

  function flowComponent(project, id) { return project.modules?.energiefluss?.resultSummary?.components?.find((item) => item.id === id) ?? null; }
  function costModel(id) { return (costConfig?.models ?? []).find((item) => item.id === id && item.active !== false) ?? null; }
  function lifetimeFor(id) { return (lifetimeConfig?.items ?? []).find((item) => item.cost_model_id === id && item.active !== false) ?? null; }

  function fallbackMeasure(project, definition) {
    if (definition.manualOnly) {
      const draft = project.modules?.wirtschaftlichkeit?.measureDrafts?.[definition.id] ?? {};
      return {
        id: definition.id, label: definition.label, componentId: definition.componentId, source: 'Schnellangabe', selected: Boolean(draft.selected),
        fullInvestmentEur: finite(draft.fullInvestmentEur, 0), referenceCostEur: finite(draft.referenceCostEur, 0), referenceYear: finite(draft.referenceYear, 0),
        deliveredSavingsKwh: finite(draft.deliveredSavingsKwh, 0), lifetimeYears: finite(draft.lifetimeYears, definition.id === 'heating' ? 18 : 25),
        manualOnly: true, informational: Boolean(definition.informational), dataQuality: 'orientierend',
      };
    }
    const area = finite(valueAt(project, definition.areaPath, null), null);
    const u = finite(valueAt(project, definition.uPath, null), null);
    const target = finite(targetsConfig?.components?.[definition.dataId]?.recommended, null);
    const cost = costModel(definition.costModelId);
    const middle = finite(cost?.range_eur_m2?.middle, finite(cost?.base_cost_eur_m2, null));
    const fullInvestment = area !== null && middle !== null ? area * middle : 0;
    const reference = area !== null ? area * finite(cost?.sunk_cost_eur_m2, 0) : 0;
    const flow = flowComponent(project, definition.flowId);
    const existingLoss = finite(flow?.lossKwh, null);
    const savings = existingLoss !== null && u > 0 && target > 0 ? Math.max(0, existingLoss * (1 - target / u)) : 0;
    const life = lifetimeFor(definition.costModelId);
    return {
      id: definition.id, label: definition.label, componentId: definition.componentId, source: 'automatische Schnellabschätzung', selected: false,
      fullInvestmentEur: fullInvestment, referenceCostEur: reference, referenceYear: 0,
      deliveredSavingsKwh: savings, lifetimeYears: finite(life?.years, 40),
      manualOnly: false, informational: false, dataQuality: area && existingLoss !== null ? 'gute Abschätzung' : 'orientierend',
      areaM2: area, existingUValue: u, targetUValue: target, costRange: cost?.range_eur_m2 ?? null,
    };
  }

  function storedMeasureToCandidate(project, definition, stored) {
    const draft = project.modules?.wirtschaftlichkeit?.measureDrafts?.[definition.id] ?? {};
    return {
      id: definition.id, label: stored.title ?? definition.label, componentId: stored.componentId ?? definition.componentId,
      source: 'Bauteil & Sanierung', selected: draft.selected !== undefined ? Boolean(draft.selected) : true,
      fullInvestmentEur: finite(draft.fullInvestmentEur, finite(stored.costModel?.fullInvestmentEur, 0)),
      referenceCostEur: finite(draft.referenceCostEur, finite(stored.sunkCosts?.totalEur, 0)),
      referenceYear: finite(draft.referenceYear, stored.costModel?.renewalContext === 'renewal_due' ? 0 : 0),
      deliveredSavingsKwh: finite(draft.deliveredSavingsKwh, finite(stored.energyEffect?.deliveredSavingsKwh, 0)),
      lifetimeYears: finite(draft.lifetimeYears, finite(stored.costModel?.lifetimeYears, 40)),
      dataQuality: 'objektspezifisch', areaM2: finite(stored.existingState?.areaM2, null), existingUValue: finite(stored.existingState?.uValue, null), targetUValue: finite(stored.selectedVariant?.uValue, null),
      manualOnly: false, informational: false,
    };
  }

  function buildMeasures(project) {
    const allStored = Object.values(project.measures ?? {}).filter((item) => item && item.status !== 'archived');
    measures = QUICK_DEFINITIONS.map((definition) => {
      const stored = allStored.find((item) => item.componentId === definition.componentId && item.autoGenerated !== true)
        ?? allStored.find((item) => item.componentId === definition.componentId);
      return stored ? storedMeasureToCandidate(project, definition, stored) : fallbackMeasure(project, definition);
    });
  }

  function renderMeasures(project) {
    buildMeasures(project);
    const storedCount = measures.filter((item) => item.source === 'Bauteil & Sanierung').length;
    $('measureSourceNote').textContent = storedCount ? `${storedCount} Maßnahme${storedCount === 1 ? '' : 'n'} aus Bauteil & Sanierung übernommen.` : 'Noch keine gespeicherten Maßnahmen; Schnellabschätzungen werden aus Projektwerten vorbereitet.';
    $('measureList').innerHTML = measures.map((item) => {
      const cost = item.fullInvestmentEur > 0 ? formatMoney(item.fullInvestmentEur) : 'Kosten ergänzen';
      const saving = item.deliveredSavingsKwh > 0 ? `${formatEnergy(item.deliveredSavingsKwh)} Einsparung` : item.informational ? 'im Prototyp noch ohne Ertragsmodell' : 'Einsparung ergänzen';
      return `<div class="measure-item" data-measure-id="${escapeHtml(item.id)}"><div class="measure-item-header"><input type="checkbox" ${item.selected ? 'checked' : ''} aria-label="${escapeHtml(item.label)} auswählen"><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.source)} · ${escapeHtml(item.dataQuality)}</small></div><div class="measure-item-values"><strong>${cost}</strong><small>${saving}</small></div></div><details><summary>Werte prüfen</summary><div class="measure-detail-grid"><label><span>Vollkosten</span><div class="input-with-unit"><input data-field="fullInvestmentEur" type="number" min="0" step="500" value="${item.fullInvestmentEur || ''}"><em>€</em></div></label><label><span>Referenz-Erneuerung</span><div class="input-with-unit"><input data-field="referenceCostEur" type="number" min="0" step="500" value="${item.referenceCostEur || ''}"><em>€</em></div></label><label><span>Referenz in</span><div class="input-with-unit"><input data-field="referenceYear" type="number" min="0" max="60" step="1" value="${item.referenceYear || 0}"><em>J.</em></div></label><label><span>Energieeinsparung</span><div class="input-with-unit"><input data-field="deliveredSavingsKwh" type="number" min="0" step="100" value="${item.deliveredSavingsKwh || ''}"><em>kWh/a</em></div></label></div></details></div>`;
    }).join('');

    $('measureList').querySelectorAll('.measure-item').forEach((row) => {
      const id = row.dataset.measureId;
      row.querySelector('input[type="checkbox"]').addEventListener('change', (event) => saveMeasureDraft(id, { selected: event.target.checked }));
      row.querySelectorAll('[data-field]').forEach((input) => input.addEventListener('change', () => saveMeasureDraft(id, { [input.dataset.field]: finite(input.value, 0) })));
    });
    renderMeasureCostDetails();
  }

  function saveMeasureDraft(id, patch) {
    const current = store.get().modules?.wirtschaftlichkeit?.measureDrafts?.[id] ?? {};
    store.setPath(`modules.wirtschaftlichkeit.measureDrafts.${id}`, { ...current, ...patch });
  }

  function selectedMeasures() { return measures.filter((item) => item.selected && !item.informational); }

  function renderFutureFit(project) {
    const envelope = project.building?.thermal?.envelope ?? {};
    const envelopeKnown = ['exteriorWall','topFloorCeiling','basementCeiling','windows'].some((id) => finite(resolver.value(envelope?.[id]?.uValue), null) !== null);
    const carrier = currentCarrier(project);
    const fossilFree = ['electricity','district_heat','wood','pellets'].includes(carrier);
    const pv = Boolean(project.systems?.pv?.installed || project.modules?.pv?.resultSummary);
    const steps = [
      ['Hülle', envelopeKnown ? 'partial' : 'open', envelopeKnown ? 'teilweise' : 'offen'],
      ['Technik', valueAt(project, 'systems.heating.usefulHeatFactor', null) ? 'partial' : 'open', valueAt(project, 'systems.heating.usefulHeatFactor', null) ? 'bekannt' : 'offen'],
      ['fossilfrei', fossilFree ? 'done' : 'open', fossilFree ? 'erfüllt' : 'offen'],
      ['PV', pv ? 'done' : 'open', pv ? 'vorhanden' : 'offen'],
    ];
    $('futureFitTrack').innerHTML = steps.map(([label,state,note], i) => `<div class="future-step ${state === 'done' ? 'is-done' : state === 'partial' ? 'is-partial' : ''}"><i>${i+1}</i><span>${label}</span><small>${note}</small></div>`).join('');
  }

  function renderMeasureCostDetails() {
    const host = $('measureCostDetails');
    if (!host) return;
    host.innerHTML = selectedMeasures().map((item) => `<div class="measure-cost-row"><strong>${escapeHtml(item.label)}</strong><span>Vollkosten<br><b>${formatMoney(item.fullInvestmentEur)}</b></span><span>Referenz<br><b>${formatMoney(item.referenceCostEur)}</b></span><span>in ${number0.format(item.referenceYear || 0)} Jahren</span></div>`).join('') || '<p>Noch keine Maßnahme ausgewählt.</p>';
  }

  function fundingValues(project) {
    const draft = project.modules?.wirtschaftlichkeit?.funding ?? {};
    return { state: finite(draft.state, 0), federal: finite(draft.federal, 0), bonus: finite(draft.bonus, 0) };
  }

  function calculate(project) {
    const selected = selectedMeasures();
    const carrierId = currentCarrier(project);
    const price = currentEnergyPrice(project, carrierId);
    const annualEnergy = finite(valueAt(project, 'consumption.heating.annualEnergy', null), 0);
    const annualBaseCost = annualEnergy * price;
    const savingsKwh = Math.min(annualEnergy, selected.reduce((sum, item) => sum + finite(item.deliveredSavingsKwh, 0), 0));
    const annualCandidateCost = Math.max(0, annualBaseCost - savingsKwh * price);
    const funding = fundingValues(project);
    const totalFunding = Math.max(0, funding.state + funding.federal + funding.bonus);
    const assumptions = currentAssumptions(project);
    const q = economics.factorFromPercent(assumptions.interestRatePercent);
    const energyP = economics.factorFromPercent(assumptions.energyEscalationPercent);
    const buildingP = economics.factorFromPercent(assumptions.buildingEscalationPercent);
    const technicalP = economics.factorFromPercent(assumptions.technicalEscalationPercent);

    const totalInvestment = selected.reduce((sum, item) => sum + finite(item.fullInvestmentEur, 0), 0);
    const cappedFunding = Math.min(totalInvestment, totalFunding);
    const candidate = {
      id: 'renovation', label: 'Sanierungsvariante',
      capitalComponents: selected.filter((item) => item.fullInvestmentEur > 0).map((item) => ({ id: item.id, label: item.label, initialCost: item.fullInvestmentEur, replacementCost: item.fullInvestmentEur, lifetimeYears: item.lifetimeYears, startYear: 0, capitalPriceFactor: item.componentId === 'heating' ? technicalP : buildingP, disposalCost: 0 })),
      capitalEvents: cappedFunding > 0 ? [{ id: 'funding', label: 'Förderung', year: 0, amount: -cappedFunding, priceFactor: 1 }] : [],
      consumptionCosts: [{ id: 'energy', label: 'Energie', annualCost: annualCandidateCost, priceFactor: energyP }], operationCosts: [],
    };
    const reference = {
      id: 'reference', label: 'Referenz',
      capitalComponents: selected.filter((item) => item.referenceCostEur > 0).map((item) => ({ id: `ref-${item.id}`, label: `Referenz ${item.label}`, initialCost: item.referenceCostEur, replacementCost: item.referenceCostEur, lifetimeYears: item.lifetimeYears, startYear: Math.max(0, item.referenceYear), capitalPriceFactor: item.componentId === 'heating' ? technicalP : buildingP, disposalCost: 0 })),
      capitalEvents: [],
      consumptionCosts: [{ id: 'energy', label: 'Energie', annualCost: annualBaseCost, priceFactor: energyP }], operationCosts: [],
    };
    const coreAssumptions = { periodYears: assumptions.periodYears, interestFactor: q, seriesStepYears: 1 };
    const comparison = selected.length && annualEnergy > 0 ? economics.compareVariants(candidate, reference, coreAssumptions, 'cumulative') : null;
    const referencePv = reference.capitalComponents.reduce((sum, item) => sum + economics.presentValue(item.initialCost, item.capitalPriceFactor, q, item.startYear), 0);
    const relevantInvestment = Math.max(0, totalInvestment - cappedFunding - referencePv);
    return { selected, assumptions, annualEnergy, price, annualBaseCost, savingsKwh, annualSavingsEur: savingsKwh * price, totalInvestment, funding: { ...funding, total: cappedFunding }, netInvestment: Math.max(0, totalInvestment - cappedFunding), referencePv, relevantInvestment, comparison };
  }

  function segment(label, value, total, className) {
    const width = total > 0 ? Math.max(value > 0 ? 2 : 0, value / total * 100) : 0;
    return `<div class="bar-segment ${className}" style="width:${width}%">${width > 12 ? escapeHtml(label) : ''}</div>`;
  }

  function renderBars(result) {
    const referenceNominal = result.selected.reduce((sum, item) => sum + finite(item.referenceCostEur, 0), 0);
    const energetic = Math.max(0, result.totalInvestment - Math.min(result.totalInvestment, referenceNominal));
    $('costCompositionBar').innerHTML = segment('ohnehin', Math.min(result.totalInvestment, referenceNominal), result.totalInvestment, 'bar-segment--reference') + segment('energetisch', energetic, result.totalInvestment, 'bar-segment--energy');
    $('costCompositionLegend').innerHTML = `<span>ohnehin notwendige Arbeiten <b>${formatMoney(referenceNominal)}</b></span><span>energetische Verbesserung <b>${formatMoney(energetic)}</b></span>`;
    const total = result.totalInvestment || 1;
    $('fundingBar').innerHTML = segment('Land', result.funding.state, total, 'bar-segment--state') + segment('Bund', result.funding.federal, total, 'bar-segment--federal') + segment('Bonus', result.funding.bonus, total, 'bar-segment--bonus') + segment('Eigenanteil', result.netInvestment, total, 'bar-segment--own');
    $('fundingLegend').innerHTML = `<span>Land <b>${formatMoney(result.funding.state)}</b></span><span>Bund <b>${formatMoney(result.funding.federal)}</b></span><span>Paketbonus <b>${formatMoney(result.funding.bonus)}</b></span><span>Eigenanteil <b>${formatMoney(result.netInvestment)}</b></span>`;
  }

  function renderChart(result) {
    const svg = $('economicsChart');
    svg.innerHTML = '';
    if (!result.comparison?.series?.length) {
      svg.innerHTML = '<text x="380" y="150" text-anchor="middle" class="chart-label">Für die Zeitgrafik werden Verbrauch und mindestens eine bewertbare Maßnahme benötigt.</text>';
      $('chartStatus').textContent = 'noch nicht berechenbar';
      return;
    }
    const series = result.comparison.series;
    const width=760, height=300, ml=62, mr=24, mt=22, mb=42, plotW=width-ml-mr, plotH=height-mt-mb;
    const values = series.map((p) => p.advantage); const min = Math.min(0,...values), max = Math.max(0,...values); const span=Math.max(1,max-min);
    const x=(year)=>ml+year/result.assumptions.periodYears*plotW; const y=(v)=>mt+(max-v)/span*plotH; const y0=y(0);
    const ns='http://www.w3.org/2000/svg'; const add=(name,attrs={})=>{const el=document.createElementNS(ns,name);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));svg.append(el);return el;};
    add('rect',{x:ml,y:mt,width:plotW,height:Math.max(0,y0-mt),class:'chart-zone-positive'}); add('rect',{x:ml,y:y0,width:plotW,height:Math.max(0,height-mb-y0),class:'chart-zone-negative'});
    for(let yr=0;yr<=result.assumptions.periodYears;yr+=5){const xx=x(yr);add('line',{x1:xx,y1:mt,x2:xx,y2:height-mb,class:'chart-grid'});const t=add('text',{x:xx,y:height-16,'text-anchor':'middle',class:'chart-label'});t.textContent=`${yr} J.`;}
    add('line',{x1:ml,y1:y0,x2:width-mr,y2:y0,class:'chart-zero'}); add('line',{x1:ml,y1:mt,x2:ml,y2:height-mb,class:'chart-axis'});
    const pts=series.map((p)=>`${x(p.year)},${y(p.advantage)}`).join(' '); add('polyline',{points:pts,class:'chart-line'});
    if(result.comparison.durableAdvantageYear!==null){const xx=x(result.comparison.durableAdvantageYear);add('line',{x1:xx,y1:mt,x2:xx,y2:height-mb,class:'chart-crossing'});const t=add('text',{x:xx+5,y:mt+15,class:'chart-label'});t.textContent=`dauerhaft ab ca. ${number1.format(result.comparison.durableAdvantageYear)} J.`;}
    const top=add('text',{x:ml+6,y:mt+15,class:'chart-label'});top.textContent='finanzieller Vorteil'; const bottom=add('text',{x:ml+6,y:height-mb-8,class:'chart-label'});bottom.textContent='Mehrkosten';
    $('chartStatus').textContent = result.comparison.advantagePresentValue >= 0 ? `Barwertvorteil ${formatMoney(result.comparison.advantagePresentValue)}` : `Barwertmehrkosten ${formatMoney(-result.comparison.advantagePresentValue)}`;
  }

  function effectRows(result, project) {
    const priorities = project.advice?.priorities ?? [];
    const selectedComponents = result.selected.map((m)=>m.componentId);
    const benefitTexts = { costs:['Kosten','wirtschaftlich betrachtet'], comfort:['Komfort','positiv'], climate:['Klimaschutz','positiv'], independence:['Unabhängigkeit','positiv'], value:['Werterhalt','positiv'], effort:['Baustellenaufwand','projektabhängig'] };
    const ordered = [...priorities, 'effort'].filter((v,i,a)=>a.indexOf(v)===i).slice(0,4);
    if (!ordered.length) ordered.push('comfort','climate','effort');
    return ordered.map((key)=>benefitTexts[key] ?? [key,'projektabhängig']);
  }

  function interpretation(result, project) {
    if (!result.selected.length) return 'Wählen Sie mindestens eine Maßnahme aus. Vorhandene Maßnahmen aus „Bauteil & Sanierung“ werden automatisch übernommen.';
    if (!(result.annualEnergy > 0)) return 'Kosten können bereits betrachtet werden. Für die langfristige Energiekostenwirkung fehlt noch ein Heizenergieverbrauch.';
    const due = result.selected.filter((m)=>m.referenceCostEur>0 && m.referenceYear<=3).map((m)=>m.label);
    const durable = result.comparison?.durableAdvantageYear;
    let text = due.length ? `${due.join(', ')}: Eine ohnehin notwendige Erneuerung ist im Modell kurzfristig berücksichtigt. ` : '';
    if (durable !== null && durable !== undefined) text += `Die Sanierungsvariante liegt ab etwa Jahr ${Math.round(durable)} dauerhaft günstiger als die Referenz.`;
    else if (result.comparison?.advantagePresentValue >= 0) text += `Über ${result.assumptions.periodYears} Jahre ergibt sich ein wirtschaftlicher Vorteil, auch wenn kein eindeutiger dauerhafter Schnittpunkt ausgewiesen wird.`;
    else text += `Die Energieeinsparung deckt die wirtschaftliche Mehrinvestition im betrachteten Zeitraum nicht vollständig. Weitere Wirkungen und der Zustand ohnehin zu erneuernder Bauteile bleiben für die Entscheidung wesentlich.`;
    return text;
  }

  function renderResult(project) {
    const result = calculate(project); currentComparison = result;
    $('totalInvestment').textContent = formatMoney(result.totalInvestment); $('fundingTotal').textContent = `bis zu ${formatMoney(result.funding.total)}`; $('netInvestment').textContent = formatMoney(result.netInvestment); $('relevantInvestment').textContent = formatMoney(result.relevantInvestment);
    $('costStatus').textContent = result.selected.length ? `${result.selected.length} Maßnahme${result.selected.length===1?'':'n'}` : 'keine Maßnahme'; $('costStatus').className = `status-chip ${result.selected.length?'is-success':''}`.trim();
    renderBars(result); renderMeasureCostDetails();
    $('resultNet').textContent = formatMoney(result.netInvestment); $('resultRelevant').textContent = formatMoney(result.relevantInvestment); $('resultSavings').textContent = result.annualSavingsEur>0 ? `${formatMoney(result.annualSavingsEur,50)}/a` : '–';
    if (result.comparison?.durableAdvantageYear !== null && result.comparison?.durableAdvantageYear !== undefined) { $('resultFourthLabel').textContent='Dauerhaft günstiger'; $('resultFourth').textContent=`ab ca. Jahr ${Math.round(result.comparison.durableAdvantageYear)}`; $('resultFourthNote').textContent='dynamischer Vergleich'; }
    else if (result.relevantInvestment>0 && result.comparison) { const share=Math.max(0,Math.min(999,(result.relevantInvestment+result.comparison.advantagePresentValue)/result.relevantInvestment*100)); $('resultFourthLabel').textContent='Energie trägt'; $('resultFourth').textContent=`ca. ${number0.format(share)} %`; $('resultFourthNote').textContent=`im Betrachtungszeitraum ${result.assumptions.periodYears} Jahre`; }
    else { $('resultFourthLabel').textContent='Dauerhaft günstiger'; $('resultFourth').textContent='–'; $('resultFourthNote').textContent='noch nicht berechenbar'; }
    $('resultStatus').textContent = result.comparison ? (result.comparison.advantagePresentValue>=0?'wirtschaftlicher Vorteil':'Mehrkosten verbleiben') : 'noch keine vollständige Rechnung'; $('resultStatus').className=`status-chip ${result.comparison?'is-success':''}`.trim();
    renderChart(result);
    $('effectsList').innerHTML = effectRows(result,project).map(([label,value])=>`<div class="effect-row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`).join('');
    $('interpretationText').textContent = interpretation(result, project);
    const uncertain = result.selected.some((m)=>m.dataQuality==='orientierend') || result.funding.total>0;
    $('sensitivityBox').textContent = uncertain ? 'Ergebnis sensitiv: Richtkosten, Förderhöhe und Referenzzeitpunkt sollten vor einer Investitionsentscheidung mit Angeboten und Förderstellen geprüft werden.' : 'Aussage auf guter Projektbasis. Investitionskosten und Energiepreisentwicklung bleiben die wichtigsten Sensitivitäten.';
    buildMethodology(result,project); buildPrintReport(result,project); persistSnapshot(result,project);
  }

  function buildMethodology(result, project) {
    const a=result.assumptions;
    $('methodDataStrip').innerHTML = `<span><strong>Rechenkern</strong> ${economics.MODEL_VERSION}</span><span><strong>Zeitraum</strong> ${a.periodYears} Jahre</span><span><strong>Zins</strong> ${number1.format(a.interestRatePercent)} %</span><span><strong>Energiepreis</strong> ${number1.format(a.energyEscalationPercent)} %/a</span><span><strong>Kostenstand</strong> ${costConfig?.data_date ?? '–'}</span>`;
    $('methodologyGrid').innerHTML = [
      ['1 · Vergleichslogik','Verglichen werden eine Referenzvariante („Was passiert ohne vorgezogene energetische Verbesserung?“) und die gewählte Sanierungsvariante. Ohnehin notwendige Erneuerungen werden zu ihrem erwarteten Zeitpunkt und nicht pauschal heute abgezogen.'],
      ['2 · Barwert','Für eine Zahlung K im Jahr t gilt intern BW = K × (P / Q)^t. P ist der Preisentwicklungsfaktor der Kostenposition, Q der gemeinsame Zinsfaktor. Anfangsinvestitionen liegen in Jahr 0.'],
      ['3 · Lebenszyklus','Komponenten können Wiederbeschaffungen und Restwerte über ihre Nutzungsdauer erzeugen. Der Prototyp nutzt gespeicherte Bauteil-Nutzungsdauern; projektspezifische Werte haben Vorrang.'],
      ['4 · Energie','Der reale Heizenergieverbrauch verankert die heutigen Energiekosten. Maßnahmen übernehmen ihre Energieeinsparung bevorzugt aus „Bauteil & Sanierung“; fehlt sie, kann sie im Prototyp manuell ergänzt werden.'],
      ['5 · Förderung','Förderungen werden als kostenmindernde Positionen behandelt. V0.1 verwendet noch manuell bestätigte Beträge; die geplante Förderengine ergänzt später Programm-, Kombinations- und Paketregeln.'],
      ['6 · Amortisation','Die Zeitgrafik folgt der Kumulationsmethode: Zahlungsströme werden in dem Jahr berücksichtigt, in dem sie anfallen. Dadurch sind mehrere Amortisations- und Deamortisationspunkte möglich.'],
      ['7 · Datenpriorität','Projektspezifische bzw. manuell bestätigte Werte haben Vorrang vor zentralen EAT-Richtwerten; abgeleitete Werte und Fallbacks werden als solche gekennzeichnet.'],
      ['8 · Grenzen','Beratungshilfe, keine Finanzierungs- oder Förderzusage. Richtkosten, Lebensdauern, Energiepreise und Förderungen sind vor Umsetzung projektspezifisch zu prüfen.'],
    ].map(([h,p])=>`<div><h3>${h}</h3><p>${p}</p></div>`).join('');
  }

  function buildPrintReport(result, project) {
    const host=$('economicsPrintReport'); if(!host)return;
    const selected=result.selected.map((m)=>m.label).join(' · ') || 'keine Maßnahme';
    host.innerHTML=`<section class="print-econ-section"><h1 class="print-econ-title">Wirtschaftlichkeit</h1><p><strong>${escapeHtml(project.project?.title||'Energieberatung')}</strong><br>${escapeHtml(project.project?.addressLabel||'')}</p><p>Betrachtet: ${escapeHtml(selected)}</p><div class="print-econ-grid"><div class="print-econ-kpi"><span>Gesamtinvestition</span><strong>${formatMoney(result.totalInvestment)}</strong></div><div class="print-econ-kpi"><span>Mögliche Förderung</span><strong>bis zu ${formatMoney(result.funding.total)}</strong></div><div class="print-econ-kpi"><span>Restinvestition</span><strong>${formatMoney(result.netInvestment)}</strong></div><div class="print-econ-kpi"><span>Wirtschaftliche Mehrinvestition</span><strong>${formatMoney(result.relevantInvestment)}</strong></div></div></section><section class="print-econ-section print-econ-note"><strong>Einordnung</strong><p>${escapeHtml(interpretation(result,project))}</p></section><section class="print-econ-section"><h2>Energiewirkung</h2><p>Heutige Energiekosteneinsparung: <strong>${result.annualSavingsEur>0?`${formatMoney(result.annualSavingsEur,50)}/a`:'–'}</strong></p><p>${result.comparison?.durableAdvantageYear!==null&&result.comparison?.durableAdvantageYear!==undefined?`Dauerhaft wirtschaftlich günstiger ab etwa Jahr ${Math.round(result.comparison.durableAdvantageYear)}.`:'Im Betrachtungszeitraum wird kein eindeutiger dauerhafter wirtschaftlicher Schnittpunkt ausgewiesen.'}</p><p class="print-funding-note">Förderungen wurden orientierend abgeschätzt. Bitte klären Sie vor Beauftragung bzw. Umsetzung die tatsächliche Förderhöhe, Verfügbarkeit, Voraussetzungen und Einreichfristen direkt mit den zuständigen Förderstellen.</p></section>`;
  }

  function persistSnapshot(result, project) {
    if (suppressRender) return;
    const snapshot={calculatedAt:new Date().toISOString(),modelVersion:economics.MODEL_VERSION,costDataVersion:costConfig?.version??null,energyPriceVersion:energyPrices?.version??null,financialDefaultsVersion:financeConfig?.version??null,selectedMeasureIds:result.selected.map((m)=>m.id),totalInvestmentEur:result.totalInvestment,fundingEur:result.funding.total,netInvestmentEur:result.netInvestment,relevantInvestmentEur:result.relevantInvestment,annualSavingsEur:result.annualSavingsEur,durableAdvantageYear:result.comparison?.durableAdvantageYear??null,advantagePresentValueEur:result.comparison?.advantagePresentValue??null,assumptions:result.assumptions};
    const old=project.economics?.latestCalculation; const sig=JSON.stringify({...snapshot,calculatedAt:null}); const oldSig=old?JSON.stringify({...old,calculatedAt:null}):null;
    if(sig!==oldSig){suppressRender=true;store.setPath('economics.latestCalculation',snapshot);suppressRender=false;}
  }

  function render(project) {
    if (suppressRender) return;
    renderBasis(project); renderAdvice(project); renderFutureFit(project); renderMeasures(project);
    const f=fundingValues(project); if(document.activeElement!==$('fundState'))$('fundState').value=f.state||''; if(document.activeElement!==$('fundFederal'))$('fundFederal').value=f.federal||''; if(document.activeElement!==$('fundBonus'))$('fundBonus').value=f.bonus||'';
    renderResult(project); updateAddressAnalysisState(project); renderGeometryStatus(project);
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

  function bindFunding() { ['State','Federal','Bonus'].forEach((suffix)=>$( `fund${suffix}`).addEventListener('change',()=>store.setPath(`modules.wirtschaftlichkeit.funding.${suffix.toLowerCase()}`,finite($( `fund${suffix}`).value,0)))); }

  function bindFutureFit() {
    $('futureFitButton').addEventListener('click',()=>{const project=store.get();['wall','top-ceiling','basement','windows','heating'].forEach((id)=>{const current=project.modules?.wirtschaftlichkeit?.measureDrafts?.[id]??{};store.setPath(`modules.wirtschaftlichkeit.measureDrafts.${id}`,{...current,selected:true});});$('futureFitHint').textContent='Zukunftsfit-Vorschlag übernommen; Maßnahmen können einzeln wieder abgewählt werden.';});
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
