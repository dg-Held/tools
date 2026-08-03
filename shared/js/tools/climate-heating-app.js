'use strict';

const API_URL = 'https://dataset.api.hub.geosphere.at/v1/timeseries/historical/inca-v1-1h-1km';
let START_YEAR = 2012;
let END_YEAR = 2025;
const REQUEST_DELAY_MS = 260;
const TOOL_MODE = document.body?.dataset.toolMode ?? 'combined';
const IS_CLIMATE_TOOL = TOOL_MODE === 'climate';
const IS_HEATING_TOOL = TOOL_MODE === 'heating';

function climatePeriodLabel() {
  return `${START_YEAR}–${END_YEAR}`;
}

async function initializeClimatePeriod() {
  try {
    if (typeof PrecomputedClimateCore === 'undefined') return;
    const manifest = await PrecomputedClimateCore.loadManifest();
    const period = PrecomputedClimateCore.periodInfo?.(manifest);
    if (period?.start_year && period?.end_year) {
      START_YEAR = Number(period.start_year);
      END_YEAR = Number(period.end_year);
    }
    document.querySelectorAll('[data-climate-period]').forEach((node) => {
      node.textContent = climatePeriodLabel();
    });
  } catch (error) {
    console.warn('Klimazeitraum konnte nicht aus dem Manifest gelesen werden. Fallback 2012–2025 bleibt aktiv.', error);
  }
}

const LOCATIONS = {
  terfens: {
    id: 'terfens',
    name: 'Terfens',
    address_label: 'Terfens · technischer Testpunkt',
    latitude: 47.323,
    longitude: 11.646,
    nat_c: -12.6,
    nat_reference_height_m: 541,
    nat_reference_max_height_m: 1494,
    kg_number: '87010',
    kg_name: 'Terfens',
    climate_region: 'NF',
    nat_source_date: '16.06.2015',
    tnat13_c: 21.1,
  },
  innsbruck: {
    id: 'innsbruck',
    name: 'Innsbruck',
    address_label: 'Innsbruck · technischer Testpunkt',
    latitude: 47.2692,
    longitude: 11.4041,
    nat_c: -10.8,
    nat_reference_height_m: 572,
    nat_reference_max_height_m: 580,
    kg_number: '81113',
    kg_name: 'Innsbruck',
    climate_region: 'NF',
    nat_source_date: '16.06.2015',
    tnat13_c: 21.2,
  },
  seefeld: {
    id: 'seefeld',
    name: 'Seefeld in Tirol',
    address_label: 'Seefeld in Tirol · technischer Testpunkt',
    latitude: 47.3302,
    longitude: 11.1879,
    nat_c: -14.5,
    nat_reference_height_m: 1039,
    nat_reference_max_height_m: 2017,
    kg_number: '81131',
    kg_name: 'Seefeld',
    climate_region: 'NF',
    nat_source_date: '16.06.2015',
    tnat13_c: 18.7,
  },
};

const state = {
  results: {},
  currentResult: null,
  heatingCalculation: null,
  selectedAddress: null,
  selectedNatReference: null,
  selectedTnat13Reference: null,
  selectedKgNumber: null,
  addressProviderReady: false,
  addressSearchSequence: 0,
  busy: false,
  heatingLimitSuggestionC: 15,
  heatingLimitManual: false,
};

const projectStore = window.EnergyToolsProjectStore ?? null;
const projectModel = window.EnergyToolsDataModel ?? null;
const projectValueResolver = window.EnergyToolsValueResolver ?? null;
let projectHydrating = false;

function sharedValue(value) {
  return value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')
    ? value.value
    : value;
}

function sharedField(value, options = {}) {
  if (!projectModel) return value;
  return projectModel.field(value ?? null, options);
}

function normalizeSharedAddressRecord(project) {
  const record = project?.location?.addressRecord;
  const latitude = Number(record?.latitude ?? sharedValue(project?.location?.latitude));
  const longitude = Number(record?.longitude ?? sharedValue(project?.location?.longitude));
  const label = record?.label ?? project?.project?.addressLabel ?? sharedValue(project?.location?.address) ?? '';

  if (!label || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const kgNumber = record?.cadastral_municipality_number
    ?? sharedValue(project?.location?.cadastralMunicipalityNumber)
    ?? null;

  return AddressProviderCore.standardizeAddress({
    ...record,
    id: record?.id ?? record?.source_id ?? `project-${latitude}-${longitude}`,
    label,
    latitude,
    longitude,
    municipality: record?.municipality ?? sharedValue(project?.location?.municipality) ?? '',
    municipality_code: record?.municipality_code ?? sharedValue(project?.location?.municipalityCode) ?? '',
    cadastral_municipality_number: kgNumber,
    cadastral_municipality_numbers: record?.cadastral_municipality_numbers ?? (kgNumber ? [String(kgNumber)] : []),
    source: record?.source ?? record?.tiris_layer_label ?? 'Gemeinsames Projekt',
    source_id: record?.source_id ?? record?.address_code ?? '',
    coordinate_kind: record?.coordinate_kind ?? 'building',
  }, 'Gemeinsames Projekt');
}

function compactSharedAddress(address) {
  if (!address) return null;
  return {
    id: address.id,
    label: address.label,
    street: address.street,
    house_number: address.house_number,
    postal_code: address.postal_code,
    municipality: address.municipality,
    municipality_code: address.municipality_code,
    locality: address.locality,
    latitude: address.latitude,
    longitude: address.longitude,
    address_latitude: address.address_latitude,
    address_longitude: address.address_longitude,
    coordinate_kind: address.coordinate_kind,
    cadastral_municipality_number: state.selectedKgNumber ?? address.cadastral_municipality_number ?? null,
    cadastral_municipality_numbers: address.cadastral_municipality_numbers ?? [],
    source: address.source,
    source_id: address.source_id,
    dataset_date: address.dataset_date,
    license: address.license,
  };
}

function syncSharedLocation(address = state.selectedAddress) {
  if (!projectStore || projectHydrating || !address) return;
  const kgNumber = state.selectedKgNumber ?? address.cadastral_municipality_number ?? null;
  const kgName = state.selectedNatReference?.kg_name ?? null;

  projectStore.patch({
    project: { addressLabel: address.label },
    location: {
      address: sharedField(address.label, { origin: projectModel.ORIGIN.OFFICIAL, source: address.source ?? 'Adresse', dataDate: address.dataset_date ?? null }),
      latitude: sharedField(Number(address.latitude), { unit: '°', origin: projectModel.ORIGIN.OFFICIAL, source: address.source ?? 'Adresse' }),
      longitude: sharedField(Number(address.longitude), { unit: '°', origin: projectModel.ORIGIN.OFFICIAL, source: address.source ?? 'Adresse' }),
      municipality: sharedField(address.municipality || null, { origin: projectModel.ORIGIN.OFFICIAL, source: address.source ?? 'Adresse' }),
      municipalityCode: sharedField(address.municipality_code || null, { origin: projectModel.ORIGIN.OFFICIAL, source: address.source ?? 'Adresse' }),
      cadastralMunicipalityNumber: sharedField(kgNumber ? String(kgNumber) : null, { origin: projectModel.ORIGIN.OFFICIAL, source: 'OIB/Adresszuordnung' }),
      cadastralMunicipalityName: sharedField(kgName, { origin: projectModel.ORIGIN.OFFICIAL, source: 'OIB/Adresszuordnung' }),
      addressRecord: compactSharedAddress(address),
    },
  });
}

function syncSharedManualLocation(location) {
  if (!projectStore || projectHydrating || location?.address) return;
  projectStore.patch({
    project: { addressLabel: location.address_label || location.name || 'Manueller Standort' },
    location: {
      address: sharedField(location.address_label || location.name || 'Manueller Standort', { origin: projectModel.ORIGIN.MANUAL, source: IS_HEATING_TOOL ? 'Heizlast' : 'Klima' }),
      latitude: sharedField(Number(location.latitude), { unit: '°', origin: projectModel.ORIGIN.MANUAL, source: IS_HEATING_TOOL ? 'Heizlast' : 'Klima' }),
      longitude: sharedField(Number(location.longitude), { unit: '°', origin: projectModel.ORIGIN.MANUAL, source: IS_HEATING_TOOL ? 'Heizlast' : 'Klima' }),
      cadastralMunicipalityNumber: sharedField(location.kg_number ?? null, { origin: projectModel.ORIGIN.MANUAL, source: IS_HEATING_TOOL ? 'Heizlast' : 'Klima' }),
      cadastralMunicipalityName: sharedField(location.kg_name ?? null, { origin: projectModel.ORIGIN.MANUAL, source: IS_HEATING_TOOL ? 'Heizlast' : 'Klima' }),
      addressRecord: null,
    },
  });
}

const HEATING_LIMIT_PATH = 'systems.heating.heatingLimitTemperature';

function heatingLimitInfo(project = projectStore?.get()) {
  const field = project?.systems?.heating?.heatingLimitTemperature;
  return projectValueResolver?.describe(field) ?? {
    value: null,
    manualValue: null,
    automaticValue: null,
    isManual: false,
  };
}

function specificRoomHeatFromInputs(inputs) {
  const consumption = Math.max(Number(inputs?.annualConsumptionKwh) || 0, 0);
  const factor = Math.max(Number(inputs?.usefulHeatFactor) || 0, 0);
  const persons = Math.max(Number(inputs?.persons) || 0, 0);
  const area = Math.max(Number(inputs?.heatedAreaM2) || 0, 0);
  const hotWater = inputs?.hotWaterIncluded ? persons * 1000 : 0;
  const roomHeat = Math.max(consumption * factor - hotWater, 0);
  return area > 0 ? roomHeat / area : null;
}

function suggestedHeatingLimit(inputs) {
  return HeatingCore.suggestHeatingLimitFromSpecificHeat(
    specificRoomHeatFromInputs(inputs)
  );
}

function clampHeatingLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return HeatingCore.DEFAULT_HEATING_LIMIT_C ?? 15;
  return Math.min(
    HeatingCore.MAX_HEATING_LIMIT_C ?? 18,
    Math.max(HeatingCore.MIN_HEATING_LIMIT_C ?? 8, number)
  );
}

function heatingInputsForProject() {
  if (!elements?.annualConsumption) return null;
  return {
    annualConsumptionKwh: Number(elements.annualConsumption.value),
    usefulHeatFactor: Number(elements.usefulHeatFactor.value),
    hotWaterIncluded: elements.hotWaterIncluded.value === 'yes',
    persons: Number(elements.persons.value),
    heatedAreaM2: Number(elements.heatedArea.value),
    buildingCondition: elements.buildingCondition.value,
    installedMaximumKw: Number(elements.installedMaximum.value),
    installedMinimumKw: elements.installedMinimum.value === '' ? null : Number(elements.installedMinimum.value),
    hwbKwhM2a: elements.hwbValue.value === '' ? null : Number(elements.hwbValue.value),
    bgfM2: elements.hwbBgf.value === '' ? null : Number(elements.hwbBgf.value),
    heatingLimitC: elements.heatingLimitTemperature
      ? clampHeatingLimit(elements.heatingLimitTemperature.value)
      : 15,
  };
}

function syncHeatingLimitCandidates(inputs, suggestionC) {
  if (!projectStore || projectHydrating || IS_CLIMATE_TOOL) return;
  const fallback = projectModel.ORIGIN.FALLBACK;
  const derived = projectModel.ORIGIN.DERIVED;
  projectStore.setFieldCandidates([
    {
      path: HEATING_LIMIT_PATH,
      origin: fallback,
      value: 15,
      options: {
        unit: '°C',
        source: 'Heizlast Standardannahme',
        method: 'Fallback ohne verwertbare Gebäudeeinschätzung',
      },
    },
    {
      path: HEATING_LIMIT_PATH,
      origin: derived,
      value: suggestionC,
      options: {
        unit: '°C',
        source: 'Heizlast',
        method: 'Faustwert aus verbrauchsbezogenem Raumwärmewert',
        quality: 'Beratungsvorschlag',
        note: Number.isFinite(specificRoomHeatFromInputs(inputs))
          ? `${specificRoomHeatFromInputs(inputs).toFixed(1)} kWh/m²a`
          : null,
      },
    },
  ]);
}

function syncSharedInputs() {
  if (!projectStore || projectHydrating || IS_CLIMATE_TOOL) return;
  const inputs = heatingInputsForProject();
  if (!inputs) return;

  const manual = projectModel.ORIGIN.MANUAL;
  projectStore.setFieldCandidates([
    { path: 'consumption.heating.annualEnergy', origin: manual, value: inputs.annualConsumptionKwh, options: { unit: 'kWh/a', source: 'Heizlast' } },
    { path: 'systems.heating.usefulHeatFactor', origin: manual, value: inputs.usefulHeatFactor, options: { source: 'Heizlast' } },
    { path: 'systems.heating.hotWaterIncluded', origin: manual, value: inputs.hotWaterIncluded, options: { source: 'Heizlast' } },
    { path: 'usage.household.persons', origin: manual, value: inputs.persons, options: { unit: 'Personen', source: 'Heizlast' } },
    { path: 'building.geometry.heatedFloorArea', origin: manual, value: inputs.heatedAreaM2, options: { unit: 'm²', source: 'Heizlast' } },
    { path: 'building.thermal.condition', origin: manual, value: inputs.buildingCondition, options: { source: 'Heizlast' } },
    { path: 'systems.heating.installedMaximum', origin: manual, value: inputs.installedMaximumKw, options: { unit: 'kW', source: 'Heizlast' } },
    { path: 'systems.heating.installedMinimum', origin: manual, value: inputs.installedMinimumKw, options: { unit: 'kW', source: 'Heizlast' } },
    { path: 'building.thermal.independentHwb', origin: manual, value: inputs.hwbKwhM2a, options: { unit: 'kWh/m²a', source: 'Heizlast' } },
    { path: 'building.geometry.grossFloorArea', origin: manual, value: inputs.bgfM2, options: { unit: 'm²', source: 'Heizlast' } },
  ]);

  projectStore.patch({
    modules: {
      heizlast: {
        inputMode: 'consulting-estimate',
        updatedAt: new Date().toISOString(),
      },
    },
  });
}
function syncSharedResult(result = state.currentResult) {
  if (!projectStore || projectHydrating || !result) return;
  const locationCheck = result.location?.location_check;
  const elevation = locationCheck?.building?.elevation_m;
  const metrics = result.metrics ?? {};
  const calculation = state.heatingCalculation;

  const patch = {
    modules: {
      klima: {
        climateSummary: {
          period: `${START_YEAR}–${END_YEAR}`,
          source: result.data?.source ?? null,
          natC: result.location?.nat_c ?? null,
          tnat13C: result.location?.tnat13_c ?? null,
          metrics: JSON.parse(JSON.stringify(metrics)),
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      },
    },
  };

  if (!IS_CLIMATE_TOOL && calculation) {
    patch.modules.heizlast = {
      resultSummary: {
        consumptionHeatLoadKw: calculation.consumption?.heat_load_kw ?? null,
        areaMinimumKw: calculation.area_method?.minimum_kw ?? null,
        areaMaximumKw: calculation.area_method?.maximum_kw ?? null,
        hwbHeatLoadKw: calculation.hwb_method?.heat_load_kw ?? null,
        installedMaximumKw: calculation.comparison?.installed_maximum_kw ?? null,
        installedMinimumKw: calculation.comparison?.installed_minimum_kw ?? null,
        heatingLimitC: calculation.assumptions?.heating_limit_c ?? null,
        specificRoomHeatKwhM2a: calculation.assumptions?.specific_room_heat_kwh_m2a ?? null,
      },
      updatedAt: new Date().toISOString(),
    };
  }

  if (Number.isFinite(Number(elevation))) {
    patch.location = {
      elevation: sharedField(Number(elevation), {
        unit: 'm ü. A.',
        origin: projectModel.ORIGIN.OFFICIAL,
        source: 'TIRIS DGM',
        method: locationCheck?.building?.layer_name ?? 'DGM 5 m',
      }),
    };
  }

  projectStore.patch(patch);
}
function restoreSharedInputs(project) {
  const legacyInputs = project?.modules?.klimaHeizlast?.inputs ?? {};
  const persons = sharedValue(project?.usage?.household?.persons ?? project?.user?.persons);
  const heatedArea = sharedValue(project?.building?.geometry?.heatedFloorArea ?? project?.building?.heatedArea);
  const annualConsumption = sharedValue(project?.consumption?.heating?.annualEnergy);
  const usefulHeatFactor = sharedValue(project?.systems?.heating?.usefulHeatFactor);
  const hotWaterIncluded = sharedValue(project?.systems?.heating?.hotWaterIncluded);
  const buildingCondition = sharedValue(project?.building?.thermal?.condition);
  const installedMaximum = sharedValue(project?.systems?.heating?.installedMaximum);
  const installedMinimum = sharedValue(project?.systems?.heating?.installedMinimum);
  const hwb = sharedValue(project?.building?.thermal?.independentHwb);
  const bgf = sharedValue(project?.building?.geometry?.grossFloorArea);
  const limitInfo = heatingLimitInfo(project);

  const hasSavedInputs = [
    persons, heatedArea, annualConsumption, usefulHeatFactor, hotWaterIncluded,
    buildingCondition, installedMaximum, installedMinimum, hwb, bgf,
    limitInfo.value,
  ].some((value) => value !== undefined && value !== null) || Object.keys(legacyInputs).length > 0;

  if (!hasSavedInputs) {
    elements.annualConsumption.value = '25000';
    elements.usefulHeatFactor.value = '0.85';
    elements.hotWaterIncluded.value = 'yes';
    elements.persons.value = '4';
    elements.heatedArea.value = '150';
    elements.buildingCondition.value = 'teilsanierter_bestand';
    elements.installedMaximum.value = '20';
    elements.installedMinimum.value = '';
    elements.hwbValue.value = '';
    elements.hwbBgf.value = '';
    if (elements.heatingLimitTemperature) {
      elements.heatingLimitTemperature.value = '15';
      state.heatingLimitManual = false;
    }
    return;
  }

  const assignments = [
    [elements.annualConsumption, annualConsumption ?? legacyInputs.annualConsumptionKwh],
    [elements.usefulHeatFactor, usefulHeatFactor ?? legacyInputs.usefulHeatFactor],
    [elements.persons, persons ?? legacyInputs.persons],
    [elements.heatedArea, heatedArea ?? legacyInputs.heatedAreaM2],
    [elements.installedMaximum, installedMaximum ?? legacyInputs.installedMaximumKw],
    [elements.installedMinimum, installedMinimum ?? legacyInputs.installedMinimumKw],
    [elements.hwbValue, hwb ?? legacyInputs.hwbKwhM2a],
    [elements.hwbBgf, bgf ?? legacyInputs.bgfM2],
    [elements.heatingLimitTemperature, limitInfo.value ?? 15],
  ];
  assignments.forEach(([element, value]) => {
    if (element && value !== undefined && value !== null && Number.isFinite(Number(value))) element.value = String(value);
  });

  const hotWater = hotWaterIncluded ?? legacyInputs.hotWaterIncluded;
  if (typeof hotWater === 'boolean') elements.hotWaterIncluded.value = hotWater ? 'yes' : 'no';
  const condition = buildingCondition ?? legacyInputs.buildingCondition;
  if (condition) elements.buildingCondition.value = condition;
  state.heatingLimitManual = Boolean(limitInfo.isManual);
}
function hydrateSharedProject(project = projectStore?.get()) {
  if (!projectStore || !project) return;
  projectHydrating = true;
  try {
    restoreSharedInputs(project);
    const address = normalizeSharedAddressRecord(project);
    if (address) applyAddressResult(address);
  } catch (error) {
    console.warn('Gemeinsame Projektdaten konnten nicht vollständig übernommen werden.', error);
  } finally {
    projectHydrating = false;
  }
  updateAnalyzeAvailability();
}


const addressProviders =
  new AddressProviderCore.AddressProviderRegistry();

const bevSuggestionProvider = new BevLocalAddressProvider();

const tirisLiveAddressProvider = new TirisLiveAddressProvider();

const hybridAddressProvider = addressProviders.register(
  new HybridAddressProvider({
    suggestionProvider: bevSuggestionProvider,
    liveProvider: tirisLiveAddressProvider,
  })
);

const elements = {
  manualLocationMode: document.getElementById('manualLocationMode'),
  analysisHint: document.getElementById('analysisHint'),
  addressSearchInput: document.getElementById('addressSearchInput'),
  addressSuggestions: document.getElementById('addressSuggestions'),
  addressSearchStatus: document.getElementById('addressSearchStatus'),
  addressProviderLabel: document.getElementById('addressProviderLabel'),
  selectedAddressCard: document.getElementById('selectedAddressCard'),
  selectedAddressLabel: document.getElementById('selectedAddressLabel'),
  selectedAddressMeta: document.getElementById('selectedAddressMeta'),
  multiKgPanel: document.getElementById('multiKgPanel'),
  multiKgOptions: document.getElementById('multiKgOptions'),
  clearAddressButton: document.getElementById('clearAddressButton'),
  locationSelect: document.getElementById('locationSelect'),
  siteLabelInput: document.getElementById('siteLabelInput'),
  latitudeInput: document.getElementById('latitudeInput'),
  longitudeInput: document.getElementById('longitudeInput'),
  natInput: document.getElementById('natInput'),
  natReferenceHeightInput:
    document.getElementById('natReferenceHeightInput'),
  loadSelectedButton: document.getElementById('loadSelectedButton'),
  loadAllButton: document.getElementById('loadAllButton'),
  clearCacheButton: document.getElementById('clearCacheButton'),
  printButton: document.getElementById('printButton'),
  printButtonBottom: document.getElementById('printButtonBottom'),
  downloadButton: document.getElementById('downloadButton'),
  connectionStatus: document.getElementById('connectionStatus'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  resultsSection: document.getElementById('resultsSection'),
  resultTitle: document.getElementById('resultTitle'),
  resultSubtitle: document.getElementById('resultSubtitle'),
  dataQualitySummary: document.getElementById('dataQualitySummary'),
  locationCheckCard: document.getElementById('locationCheckCard'),
  locationFacts: document.getElementById('locationFacts'),
  heightAssessment: document.getElementById('heightAssessment'),
  heightServiceNote: document.getElementById('heightServiceNote'),
  retryHeightButton: document.getElementById('retryHeightButton'),
  metricGrid: document.getElementById('metricGrid'),
  chartWrap: document.getElementById('chartWrap'),
  annualTable: document.getElementById('annualTable'),
  comparisonCard: document.getElementById('comparisonCard'),
  comparisonTable: document.getElementById('comparisonTable'),
  heatingLoadCard: document.getElementById('heatingLoadCard'),
  annualConsumption: document.getElementById('annualConsumption'),
  usefulHeatFactor: document.getElementById('usefulHeatFactor'),
  hotWaterIncluded: document.getElementById('hotWaterIncluded'),
  persons: document.getElementById('persons'),
  heatedArea: document.getElementById('heatedArea'),
  buildingCondition: document.getElementById('buildingCondition'),
  installedMaximum: document.getElementById('installedMaximum'),
  installedMinimum: document.getElementById('installedMinimum'),
  heatingLimitTemperature: document.getElementById('heatingLimitTemperature'),
  heatingLimitSuggestion: document.getElementById('heatingLimitSuggestion'),
  useHeatingLimitSuggestion: document.getElementById('useHeatingLimitSuggestion'),
  heatingLimitMethodText: document.getElementById('heatingLimitMethodText'),
  hwbValue: document.getElementById('hwbValue'),
  hwbBgf: document.getElementById('hwbBgf'),
  consumptionMainResult: document.getElementById('consumptionMainResult'),
  areaMainResult: document.getElementById('areaMainResult'),
  installedMainResult: document.getElementById('installedMainResult'),
  hwbMainResult: document.getElementById('hwbMainResult'),
  heatingResultGrid: document.getElementById('heatingResultGrid'),
  heatingChartWrap: document.getElementById('heatingChartWrap'),
  coverageNote: document.getElementById('coverageNote'),
  calculationBasisValues: document.getElementById('calculationBasisValues'),
  printClimateLocation: document.getElementById('printClimateLocation'),
  printClimateContext: document.getElementById('printClimateContext'),
  printReportDate: document.getElementById('printReportDate'),
  printHeatingLocation: document.getElementById('printHeatingLocation'),
  printHwbCard: document.getElementById('printHwbCard'),
  printHwbCardValue: document.getElementById('printHwbCardValue'),
  printHwbCardDetail: document.getElementById('printHwbCardDetail'),
  printReportDate2: document.getElementById('printReportDate2'),
  heatingInterpretation: document.getElementById('heatingInterpretation'),
  calculationWarning: document.getElementById('calculationWarning'),
  heatingClimateSummary: document.getElementById('heatingClimateSummary'),
};

function sleep(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}


function hasResolvedAutomaticLocation() {
  const visibleAddressMatches = !state.selectedAddress ||
    elements.addressSearchInput.value.trim() === state.selectedAddress.label;
  return Boolean(
    state.selectedAddress &&
    visibleAddressMatches &&
    state.selectedNatReference &&
    state.selectedTnat13Reference
  );
}

function manualLocationLooksComplete() {
  if (!elements.manualLocationMode?.checked) {
    return false;
  }

  const latitude = Number(elements.latitudeInput.value);
  const longitude = Number(elements.longitudeInput.value);
  const natText = elements.natInput.value.trim();
  const natC = natText === '' ? Number.NaN : Number(natText);

  const name =
    elements.siteLabelInput.value.trim();

  return (
    name.length > 0 &&
    Number.isFinite(latitude) &&
    latitude >= 46 &&
    latitude <= 48 &&
    Number.isFinite(longitude) &&
    longitude >= 10 &&
    longitude <= 13.5 &&
    Number.isFinite(natC) &&
    natC < 15
  );
}

function updateAnalyzeAvailability() {
  const automaticReady = hasResolvedAutomaticLocation();
  const manualReady = manualLocationLooksComplete();

  elements.loadSelectedButton.disabled =
    state.busy || !(automaticReady || manualReady);

  if (state.busy) {
    elements.analysisHint.textContent = 'Analyse läuft …';
    return;
  }

  if (automaticReady) {
    elements.analysisHint.textContent =
      'Standort ist vollständig zugeordnet.';
    return;
  }

  if (
    state.selectedAddress &&
    Array.isArray(
      state.selectedAddress.cadastral_municipality_numbers
    ) &&
    state.selectedAddress.cadastral_municipality_numbers.length > 1
  ) {
    elements.analysisHint.textContent =
      'Bitte zuerst eine Katastralgemeinde auswählen.';
    return;
  }

  if (elements.manualLocationMode?.checked) {
    elements.analysisHint.textContent =
      manualReady
        ? 'Manuelle Standortdaten sind vollständig.'
        : 'Für den manuellen Modus Koordinaten und NAT vollständig eingeben.';
    return;
  }

  elements.analysisHint.textContent =
    'Zuerst eine Adresse auswählen.';
}

function resetProductionLocationFields() {
  elements.siteLabelInput.value = '';
  elements.latitudeInput.value = '';
  elements.longitudeInput.value = '';
  elements.natInput.value = '';
  elements.natReferenceHeightInput.value = '';
  elements.manualLocationMode.checked = false;
  updateAnalyzeAvailability();
}

function setBusy(busy) {
  state.busy = busy;
  elements.loadAllButton.disabled = busy;
  elements.clearCacheButton.disabled = busy;
  elements.locationSelect.disabled = busy;
  elements.siteLabelInput.disabled = busy;
  elements.latitudeInput.disabled = busy;
  elements.longitudeInput.disabled = busy;
  elements.natInput.disabled = busy;
  elements.natReferenceHeightInput.disabled = busy;
  elements.retryHeightButton.disabled = busy;
  elements.addressSearchInput.disabled = busy;
  elements.clearAddressButton.disabled = busy;
  elements.manualLocationMode.disabled = busy;
  updateAnalyzeAvailability();
}

function setStatus(text, type = '') {
  elements.connectionStatus.textContent = text;
  elements.connectionStatus.className = `status-chip${type ? ` is-${type}` : ''}`;
}

function setProgress(done, total, text) {
  const percentage = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  elements.progressFill.style.width = `${percentage}%`;
  elements.progressText.textContent = text;
}

function openCacheDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('klima-heizlast-inca-cache', 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('years')) {
        database.createObjectStore('years');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function cacheGet(key) {
  const database = await openCacheDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('years', 'readonly');
    const request = transaction.objectStore('years').get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function cacheSet(key, value) {
  const database = await openCacheDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('years', 'readwrite');
    transaction.objectStore('years').put(value, key);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function cacheClear() {
  const database = await openCacheDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('years', 'readwrite');
    transaction.objectStore('years').clear();
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}



function debounce(callback, delay = 250) {
  let timeoutId = null;

  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(
      () => callback(...args),
      delay
    );
  };
}

function normalized(value) {
  return AddressProviderCore.normalizeText(value);
}

function presetForAddress(address) {
  const municipality = normalized(address?.municipality);

  return Object.values(LOCATIONS).find((location) => {
    const names = [
      location.name,
      location.kg_name,
    ].map(normalized);

    return names.some(
      (name) =>
        municipality === name ||
        municipality.includes(name) ||
        name.includes(municipality)
    );
  }) ?? null;
}

function addressMetaText(address) {
  const parts = [
    address.source,
    address.postal_code,
    address.municipality,
    `${formatNumber(address.latitude, 5)}° N`,
    `${formatNumber(address.longitude, 5)}° E`,
  ];

  if (address.is_demo) {
    parts.unshift('Demonstrationspunkt');
  }

  if (address.coordinate_kind === 'building') {
    parts.push('Gebäudekoordinate');
  } else if (address.coordinate_kind === 'address_access') {
    parts.push('Zugangskoordinate');
  }

  if (address.cadastral_municipality_number) {
    parts.push(`KG ${address.cadastral_municipality_number}`);
  } else if (
    Array.isArray(address.cadastral_municipality_numbers) &&
    address.cadastral_municipality_numbers.length > 1
  ) {
    parts.push(
      `KG ${address.cadastral_municipality_numbers.join('/')}`
    );
  }

  return parts.filter(Boolean).join(' · ');
}

function closeAddressSuggestions() {
  elements.addressSuggestions.hidden = true;
  elements.addressSuggestions.replaceChildren();
  elements.addressSearchInput.setAttribute(
    'aria-expanded',
    'false'
  );
}


function clearMultiKgChoice() {
  state.selectedKgNumber = null;
  elements.multiKgPanel.hidden = true;
  elements.multiKgOptions.replaceChildren();
}

function applyOibReferenceForKg(kgNumber) {
  const natReference = OibNatCore.lookup(kgNumber);
  const tnatReference = OibTnat13Core.lookup(kgNumber);

  if (!natReference || !tnatReference) {
    throw new Error(
      `Für KG ${kgNumber} fehlen OIB-Referenzdaten.`
    );
  }

  state.selectedKgNumber = String(kgNumber);
  state.selectedNatReference = natReference;
  state.selectedTnat13Reference = tnatReference;

  elements.natInput.value =
    natReference.nat_at_elevation_min_c;
  elements.natReferenceHeightInput.value =
    natReference.elevation_min_m;

  return {
    natReference,
    tnatReference,
  };
}

function renderMultiKgChoice(address) {
  const kgNumbers = [
    ...new Set(
      address.cadastral_municipality_numbers ?? []
    ),
  ];

  elements.multiKgOptions.replaceChildren();

  if (kgNumbers.length <= 1) {
    elements.multiKgPanel.hidden = true;
    return;
  }

  const fragment = document.createDocumentFragment();

  kgNumbers.forEach((kgNumber) => {
    const nat = OibNatCore.lookup(kgNumber);
    const tnat = OibTnat13Core.lookup(kgNumber);

    if (!nat || !tnat) return;

    const label = document.createElement('label');
    label.className = 'multi-kg-option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'cadastralMunicipality';
    radio.value = kgNumber;

    const text = document.createElement('span');
    text.innerHTML = `
      <strong>KG ${nat.kg_number} · ${nat.kg_name}</strong>
      <small>
        NAT ${formatNumber(
          nat.nat_at_elevation_min_c,
          1
        )} °C ·
        TNAT,13 ${formatNumber(
          tnat.tnat13_at_elevation_min_c,
          1
        )} °C ·
        ELEVmin ${formatNumber(
          nat.elevation_min_m
        )} m
      </small>
    `;

    radio.addEventListener('change', () => {
      const refs = applyOibReferenceForKg(kgNumber);

      elements.addressSearchStatus.textContent =
        `KG ${refs.natReference.kg_number} ` +
        `${refs.natReference.kg_name} gewählt · ` +
        `NAT ${formatNumber(
          refs.natReference.nat_at_elevation_min_c,
          1
        )} °C · TNAT,13 ${formatNumber(
          refs.tnatReference.tnat13_at_elevation_min_c,
          1
        )} °C.`;

      elements.selectedAddressMeta.textContent =
        addressMetaText(address) +
        ` · gewählt: KG ${refs.natReference.kg_number} ` +
        `${refs.natReference.kg_name}`;

      updateAnalyzeAvailability();
      syncSharedLocation(address);
    });

    label.append(radio, text);
    fragment.append(label);
  });

  elements.multiKgOptions.append(fragment);
  elements.multiKgPanel.hidden = false;
}

function clearSelectedAddress({ clearInput = true } = {}) {
  state.selectedAddress = null;
  state.selectedNatReference = null;
  state.selectedTnat13Reference = null;
  clearMultiKgChoice();
  elements.selectedAddressCard.hidden = true;

  if (clearInput) {
    elements.addressSearchInput.value = '';
    resetProductionLocationFields();
  }

  closeAddressSuggestions();
  updateAnalyzeAvailability();

  if (projectStore && !projectHydrating) {
    projectStore.batch(() => {
      projectStore.setPath('project.addressLabel', '');
      projectStore.setPath('location', {});
      projectStore.setPath('modules.klima', {});
      projectStore.setPath('modules.heizlast', {});
    });
  }
}

function applyOibReferencesForAddress(address) {
  state.selectedNatReference = null;
  state.selectedTnat13Reference = null;
  state.selectedKgNumber = null;

  const kgNumbers = [
    ...new Set(
      address.cadastral_municipality_numbers ?? (
        address.cadastral_municipality_number
          ? [address.cadastral_municipality_number]
          : []
      )
    ),
  ];

  if (kgNumbers.length === 0) {
    elements.natInput.value = '';
    elements.natReferenceHeightInput.value = '';

    return {
      ok: false,
      ambiguous: false,
      text:
        'Für diese Adresse ist keine Katastralgemeinde hinterlegt.',
    };
  }

  if (kgNumbers.length > 1) {
    elements.natInput.value = '';
    elements.natReferenceHeightInput.value = '';
    renderMultiKgChoice(address);

    return {
      ok: false,
      ambiguous: true,
      text:
        'Mehrere Katastralgemeinden gefunden – bitte unten die passende KG auswählen.',
    };
  }

  clearMultiKgChoice();

  const references =
    applyOibReferenceForKg(kgNumbers[0]);

  return {
    ok: true,
    ambiguous: false,
    text:
      `OIB automatisch: NAT ` +
      `${formatNumber(
        references.natReference.nat_at_elevation_min_c,
        1
      )} °C · TNAT,13 ` +
      `${formatNumber(
        references.tnatReference.tnat13_at_elevation_min_c,
        1
      )} °C · KG ` +
      `${references.natReference.kg_number} ` +
      `${references.natReference.kg_name} · ELEVmin ` +
      `${formatNumber(
        references.natReference.elevation_min_m
      )} m.`,
  };
}

function applyAddressResult(address) {
  state.selectedAddress = address;
  elements.manualLocationMode.checked = false;

  const preset = presetForAddress(address);

  if (preset) {
    elements.locationSelect.value = preset.id;
    populateLocationInputs(preset.id);
  }

  const natResult = address.is_demo
    ? (() => {
        clearMultiKgChoice();
        return {
          ok: true,
          text:
            'Technischer Demonstrationspunkt mit hinterlegter Test-NAT.',
        };
      })()
    : applyOibReferencesForAddress(address);

  elements.siteLabelInput.value = address.label;
  elements.latitudeInput.value =
    address.latitude.toFixed(6);
  elements.longitudeInput.value =
    address.longitude.toFixed(6);

  elements.addressSearchInput.value = address.label;
  elements.selectedAddressLabel.textContent = address.label;
  elements.selectedAddressMeta.textContent =
    addressMetaText(address);
  elements.selectedAddressCard.hidden = false;

  elements.addressSearchStatus.textContent =
    address.is_demo
      ? natResult.text
      : `${address.source || 'Standortadresse'} übernommen. ${natResult.text}`;

  closeAddressSuggestions();
  updateAnalyzeAvailability();
  syncSharedLocation(address);
}

function invalidateResultsForAddressChange() {
  state.results = {};
  state.currentResult = null;
  state.heatingCalculation = null;
  if (elements.resultsSection) elements.resultsSection.hidden = true;
  if (elements.heatingLoadCard) elements.heatingLoadCard.hidden = true;
}

async function approveAddressSelection(address) {
  const decision = await window.EnergyToolsAddressManager?.requestSelection(address)
    ?? { allowed: true, action: 'initial' };
  if (!decision.allowed) {
    const current = window.EnergyToolsAddressManager?.currentAddress();
    if (current?.label) elements.addressSearchInput.value = current.label;
    closeAddressSuggestions();
    elements.addressSearchStatus.textContent =
      'Adresswechsel abgebrochen. Das bisherige Projekt bleibt unverändert.';
    return decision;
  }
  if (decision.action !== 'same') invalidateResultsForAddressChange();
  return decision;
}

async function resolveAndApplyAddressResult(address) {
  elements.addressSearchStatus.textContent =
    'BEV-Vorschlag gewählt · TIRIS wird live abgeglichen …';

  const provider = addressProviders.active();
  let resolved = {
    address,
    usedFallback: false,
    warning: null,
  };

  if (typeof provider.resolve === 'function') {
    try {
      resolved = await provider.resolve(address);
    } catch (error) {
      console.warn('TIRIS-Live-Abgleich fehlgeschlagen.', error);
      resolved = {
        address,
        usedFallback: true,
        warning: 'TIRIS-Live-Abgleich war nicht verfügbar; BEV-Stichtagsadresse wird verwendet.',
      };
    }
  }

  const decision = await approveAddressSelection(resolved.address);
  if (!decision.allowed) return;

  applyAddressResult(resolved.address);
  if (resolved.usedFallback && resolved.warning) {
    elements.addressSearchStatus.textContent += ` ${resolved.warning}`;
  }
}

function suggestionButton(address, index) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'address-suggestion';
  button.setAttribute('role', 'option');
  button.dataset.index = String(index);

  const label = document.createElement('strong');
  label.textContent = address.label;

  const meta = document.createElement('span');
  meta.textContent = address.is_demo
    ? 'Demonstrationspunkt'
    : address.source?.includes('TIRIS')
      ? `${address.source} · Adresscode ${address.source_id}`
      : `BEV-Vorschlag · TIRIS-Live-Check beim Auswählen · Adresscode ${address.source_id}`;

  button.append(label, meta);
  button.addEventListener(
    'click',
    () => resolveAndApplyAddressResult(address)
  );

  return button;
}

function renderAddressSuggestions(searchResult) {
  elements.addressSuggestions.replaceChildren();

  if (searchResult.results.length === 0) {
    closeAddressSuggestions();
    elements.addressSearchStatus.textContent =
      searchResult.guidance ||
      'Keine passende Adresse gefunden.';
    return;
  }

  const fragment = document.createDocumentFragment();

  searchResult.results.forEach((address, index) => {
    fragment.append(suggestionButton(address, index));
  });

  elements.addressSuggestions.append(fragment);
  elements.addressSuggestions.hidden = false;
  elements.addressSearchInput.setAttribute(
    'aria-expanded',
    'true'
  );

  elements.addressSearchStatus.textContent =
    `${searchResult.results.length} Treffer · ` +
    `${searchResult.provider.name}`;
}

async function runAddressSearch() {
  const query = elements.addressSearchInput.value.trim();
  const sequence = ++state.addressSearchSequence;

  if (query.length < 3) {
    closeAddressSuggestions();
    elements.addressSearchStatus.textContent =
      'Mindestens drei Zeichen eingeben.';
    return;
  }

  elements.addressSearchStatus.textContent =
    'Adressindex wird durchsucht …';

  try {
    const searchResult = await addressProviders.search(
      query,
      { limit: 8 }
    );

    if (sequence !== state.addressSearchSequence) return;

    renderAddressSuggestions(searchResult);
  } catch (error) {
    console.error(error);
    closeAddressSuggestions();
    elements.addressSearchStatus.textContent =
      `Adresssuche nicht verfügbar: ${error.message}`;
  }
}

async function initializeAddressProvider() {
  try {
    if (
      typeof AddressProviderCore === 'undefined' ||
      typeof BevLocalAddressProvider === 'undefined' ||
      typeof TirisLiveAddressProvider === 'undefined' ||
      typeof HybridAddressProvider === 'undefined'
    ) {
      throw new Error(
        'Adressprovider-Dateien fehlen oder wurden nicht geladen.'
      );
    }

    const provider = await addressProviders.init();
    const info = provider.info();

    state.addressProviderReady = true;

    elements.addressProviderLabel.textContent =
      info.dataset_mode === 'demo'
        ? 'BEV-Demo · TIRIS Live-Check'
        : `BEV-Vorschläge ${info.dataset_date ?? '–'} · TIRIS live`;

    elements.addressSearchStatus.textContent =
      info.warning ||
      (
        info.dataset_mode === 'demo'
          ? 'Im aktuellen Paket sind zunächst nur die technischen BEV-Testpunkte enthalten; ausgewählte Treffer werden live mit TIRIS geprüft.'
          : `${formatNumber(info.address_count)} BEV-Adressen für schnelle Vorschläge · Datenstand ${info.dataset_date ?? '–'} · ausgewählte Adressen werden live mit TIRIS verifiziert.`
      );
  } catch (error) {
    console.error(error);
    elements.addressProviderLabel.textContent =
      'Adressmodul nicht verfügbar';
    elements.addressSearchStatus.textContent =
      `Der lokale Adressindex konnte nicht geladen werden: ${error.message}`;
  }
}

function presetLocation(locationId) {
  return LOCATIONS[locationId] ?? LOCATIONS.terfens;
}

function populateLocationInputs(locationId) {
  const location = presetLocation(locationId);

  elements.siteLabelInput.value =
    location.address_label ?? location.name;
  elements.latitudeInput.value = location.latitude;
  elements.longitudeInput.value = location.longitude;
  elements.natInput.value = location.nat_c;
  elements.natReferenceHeightInput.value =
    location.nat_reference_height_m;
}

function slugifyLocationId(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36) || 'standort';
}

function readSelectedLocation() {
  const preset = presetLocation(elements.locationSelect.value);
  const manualMode =
    elements.manualLocationMode.checked &&
    !state.selectedAddress;

  const latitude = Number(elements.latitudeInput.value);
  const longitude = Number(elements.longitudeInput.value);
  const natText = elements.natInput.value.trim();
  const natReferenceHeightText =
    elements.natReferenceHeightInput.value.trim();

  const natC =
    natText === ''
      ? Number.NaN
      : Number(natText);

  const natReferenceHeight =
    natReferenceHeightText === ''
      ? Number.NaN
      : Number(natReferenceHeightText);

  const enteredName =
    elements.siteLabelInput.value.trim();

  if (manualMode && enteredName === '') {
    throw new Error(
      'Bitte für den manuellen Standort eine Bezeichnung eingeben.'
    );
  }

  const name =
    enteredName ||
    state.selectedAddress?.label ||
    'Standort';

  if (
    !Number.isFinite(latitude) ||
    latitude < 46 ||
    latitude > 48
  ) {
    throw new Error(
      'Bitte einen gültigen Breitengrad für Tirol eingeben.'
    );
  }

  if (
    !Number.isFinite(longitude) ||
    longitude < 10 ||
    longitude > 13.5
  ) {
    throw new Error(
      'Bitte einen gültigen Längengrad für Tirol eingeben.'
    );
  }

  if (!Number.isFinite(natC) || natC >= 15) {
    throw new Error(
      state.selectedAddress
        ? 'Für diese Adresse konnte die NAT nicht eindeutig automatisch zugeordnet werden. Bitte die Katastralgemeinde prüfen.'
        : 'Die NAT muss als Temperatur unter 15 °C eingegeben werden.'
    );
  }

  const coordinatesChanged =
    Math.abs(latitude - preset.latitude) > 0.000001 ||
    Math.abs(longitude - preset.longitude) > 0.000001;

  return {
    ...preset,
    id:
      manualMode || coordinatesChanged
        ? `${slugifyLocationId(name)}-` +
          `${latitude.toFixed(5)}-${longitude.toFixed(5)}`
        : preset.id,
    name,
    address_label: name,
    latitude,
    longitude,
    nat_c: natC,
    nat_reference_height_m:
      Number.isFinite(natReferenceHeight)
        ? natReferenceHeight
        : null,

    nat_reference_max_height_m:
      manualMode
        ? null
        : (
            state.selectedNatReference?.elevation_max_m ??
            preset.nat_reference_max_height_m ??
            null
          ),

    kg_number:
      manualMode
        ? null
        : (
            state.selectedNatReference?.kg_number ??
            preset.kg_number ??
            null
          ),

    kg_name:
      manualMode
        ? null
        : (
            state.selectedNatReference?.kg_name ??
            preset.kg_name ??
            null
          ),

    climate_region:
      manualMode
        ? null
        : (
            state.selectedNatReference?.climate_region ??
            preset.climate_region ??
            null
          ),

    nat_source_date:
      manualMode
        ? null
        : (
            state.selectedNatReference
              ? '16.06.2015'
              : preset.nat_source_date
          ),

    tnat13_c:
      manualMode
        ? null
        : (
            state.selectedTnat13Reference
              ?.tnat13_at_elevation_min_c ??
            preset.tnat13_c ??
            null
          ),

    tnat13_reference_height_m:
      manualMode
        ? null
        : (
            state.selectedTnat13Reference
              ?.elevation_min_m ??
            null
          ),

    tnat13_source_date:
      manualMode
        ? null
        : (
            state.selectedTnat13Reference
              ? 'April 2026'
              : null
          ),

    coordinates_manually_adjusted:
      manualMode || coordinatesChanged,

    nat_assignment_status:
      manualMode
        ? 'NAT manuell eingegeben; keine automatische KG-Zuordnung.'
        : state.selectedNatReference
          ? 'OIB-NAT automatisch über die zugeordnete Katastralgemeinde (KGNR) übernommen.'
          : 'Keine automatische NAT-Zuordnung.',

    address: state.selectedAddress
      ? {
          label: state.selectedAddress.label,
          street: state.selectedAddress.street,
          house_number: state.selectedAddress.house_number,
          postal_code: state.selectedAddress.postal_code,
          municipality: state.selectedAddress.municipality,
          municipality_code:
            state.selectedAddress.municipality_code,
          source: state.selectedAddress.source,
          source_id: state.selectedAddress.source_id,
          coordinate_kind:
            state.selectedAddress.coordinate_kind,
          address_latitude:
            state.selectedAddress.address_latitude,
          address_longitude:
            state.selectedAddress.address_longitude,
          building:
            state.selectedAddress.building,
          cadastral_municipality_number:
            state.selectedKgNumber ??
            state.selectedAddress.cadastral_municipality_number,
          cadastral_municipality_numbers:
            state.selectedAddress.cadastral_municipality_numbers,
          cadastral_municipality_selection:
            state.selectedKgNumber,
          dataset_date: state.selectedAddress.dataset_date,
          is_demo: state.selectedAddress.is_demo,
        }
      : null,
  };
}

function buildRequestUrl(location, year) {
  const parameters = new URLSearchParams();
  parameters.append('parameters', 'T2M');
  parameters.set('start', `${year}-01-01T00:00`);
  parameters.set('end', `${year}-12-31T23:00`);
  parameters.append('lat_lon', `${location.latitude},${location.longitude}`);
  parameters.set('output_format', 'geojson');
  return `${API_URL}?${parameters.toString()}`;
}

function buildPeriodRequestUrl(
  location,
  startYear = START_YEAR,
  endYear = END_YEAR
) {
  const parameters = new URLSearchParams();
  parameters.append('parameters', 'T2M');
  parameters.set(
    'start',
    `${startYear}-01-01T00:00`
  );
  parameters.set(
    'end',
    `${endYear}-12-31T23:00`
  );
  parameters.append(
    'lat_lon',
    `${location.latitude},${location.longitude}`
  );
  parameters.set('output_format', 'geojson');

  return `${API_URL}?${parameters.toString()}`;
}

function periodCacheKey(location) {
  /*
    Koordinaten sind stabiler als der sichtbare Adressname.
    Sechs Nachkommastellen entsprechen deutlich weniger als einem Meter.
  */
  return (
    `period:${Number(location.latitude).toFixed(6)}:` +
    `${Number(location.longitude).toFixed(6)}:` +
    `${START_YEAR}-${END_YEAR}:T2M:v2`
  );
}

function splitPeriodTemperatureSeries(payload) {
  if (
    !payload ||
    !Array.isArray(payload.timestamps) ||
    !Array.isArray(payload.features)
  ) {
    throw new Error(
      'Unerwartete API-Antwort für den Gesamtzeitraum.'
    );
  }

  const feature = payload.features[0];
  const parameters = feature?.properties?.parameters;

  const parameter =
    parameters?.T2M ??
    Object.values(parameters ?? {}).find(
      (item) =>
        String(item?.name).toUpperCase() === 'T2M'
    );

  if (!parameter || !Array.isArray(parameter.data)) {
    throw new Error(
      'Temperaturreihe T2M für den Gesamtzeitraum fehlt.'
    );
  }

  if (
    payload.timestamps.length !==
    parameter.data.length
  ) {
    throw new Error(
      'Zeitstempel und Temperaturwerte des Gesamtzeitraums ' +
      'haben unterschiedliche Längen.'
    );
  }

  const byYear = new Map();

  for (
    let index = 0;
    index < payload.timestamps.length;
    index += 1
  ) {
    const timestamp = payload.timestamps[index];
    const year = Number(String(timestamp).slice(0, 4));

    if (
      !Number.isInteger(year) ||
      year < START_YEAR ||
      year > END_YEAR
    ) {
      continue;
    }

    if (!byYear.has(year)) {
      byYear.set(year, {
        year,
        timestamps: [],
        temperatures: [],
        grid_coordinates:
          feature.geometry?.coordinates ?? null,
        api_version: payload.version ?? null,
      });
    }

    const item = byYear.get(year);
    item.timestamps.push(timestamp);
    item.temperatures.push(parameter.data[index]);
  }

  const yearlyData = [];

  for (
    let year = START_YEAR;
    year <= END_YEAR;
    year += 1
  ) {
    const item = byYear.get(year);

    if (!item) {
      throw new Error(
        `${year}: Im Gesamtzeitraum fehlen die Jahresdaten.`
      );
    }

    yearlyData.push(item);
  }

  return yearlyData;
}

async function loadLegacyYearCache(location) {
  const yearlyData = [];

  for (
    let year = START_YEAR;
    year <= END_YEAR;
    year += 1
  ) {
    const legacyKey =
      `${location.id}:${year}:T2M:v1`;

    const cached = await cacheGet(legacyKey);

    if (!cached) {
      return null;
    }

    yearlyData.push(cached);
  }

  return yearlyData;
}

async function loadWholePeriod(location) {
  const key = periodCacheKey(location);

  const cached = await cacheGet(key);

  if (Array.isArray(cached) && cached.length > 0) {
    return {
      yearlyData: cached,
      source: 'period-cache',
    };
  }

  /*
    Bereits mit Stufe 2–11 geladene Adressen müssen nicht neu aus
    GeoSphere geladen werden. Sind alle 14 alten Jahres-Caches vorhanden,
    werden sie einmalig in den neuen Perioden-Cache übernommen.
  */
  const legacy = await loadLegacyYearCache(location);

  if (legacy) {
    await cacheSet(key, legacy);

    return {
      yearlyData: legacy,
      source: 'legacy-cache',
    };
  }

  const payload = await fetchWithRetry(
    buildPeriodRequestUrl(location),
    2
  );

  const yearlyData =
    splitPeriodTemperatureSeries(payload);

  await cacheSet(key, yearlyData);

  return {
    yearlyData,
    source: 'period-api',
  };
}

function extractTemperatureSeries(payload, year) {
  if (!payload || !Array.isArray(payload.timestamps) || !Array.isArray(payload.features)) {
    throw new Error(`${year}: Unerwartete API-Antwort.`);
  }

  const feature = payload.features[0];
  const parameters = feature?.properties?.parameters;
  const parameter = parameters?.T2M ?? Object.values(parameters ?? {}).find(
    (item) => String(item?.name).toUpperCase() === 'T2M'
  );

  if (!parameter || !Array.isArray(parameter.data)) {
    throw new Error(`${year}: Temperaturreihe T2M fehlt.`);
  }

  if (payload.timestamps.length !== parameter.data.length) {
    throw new Error(
      `${year}: ${payload.timestamps.length} Zeitstempel, aber ${parameter.data.length} Temperaturwerte.`
    );
  }

  return {
    year,
    timestamps: payload.timestamps,
    temperatures: parameter.data,
    grid_coordinates: feature.geometry?.coordinates ?? null,
    api_version: payload.version ?? null,
  };
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(900 * attempt);
    }
  }

  throw lastError;
}

async function loadYear(location, year) {
  const cacheKey = `${location.id}:${year}:T2M:v1`;
  const cached = await cacheGet(cacheKey);
  if (cached) return { data: cached, fromCache: true };

  const payload = await fetchWithRetry(buildRequestUrl(location, year));
  const data = extractTemperatureSeries(payload, year);
  await cacheSet(cacheKey, data);
  await sleep(REQUEST_DELAY_MS);
  return { data, fromCache: false };
}

async function loadLocation(location, progressState) {
  let climateResult = null;
  let yearlyData = [];
  let climateLoadSource = 'yearly-fallback';
  let precomputedParts = null;

  /*
    Stufe 16:
    Jahrespakete werden zuerst einzeln geprüft. Sind nur einzelne Jahre
    nicht verfügbar, werden ausschließlich diese Jahre live geladen und
    anschließend mit den vorberechneten Jahresanalysen kombiniert.
  */
  try {
    setProgress(
      progressState.done,
      progressState.total,
      `${location.name}: vorberechnete Jahrespakete werden gesucht …`
    );

    const precomputed =
      await PrecomputedClimateCore.loadForLocation(
        location
      );

    precomputedParts = precomputed?.parts ?? null;

    if (precomputed?.result) {
      climateResult = precomputed.result;
      climateLoadSource = 'precomputed-yearly';

      progressState.done +=
        END_YEAR - START_YEAR + 1;

      setProgress(
        progressState.done,
        progressState.total,
        `${location.name}: Klimaprofil ${climatePeriodLabel()} sofort geladen`
      );
    } else if (
      precomputedParts?.reference &&
      precomputedParts.annualAnalyses?.length
    ) {
      const preparedYears =
        precomputedParts.loadedYearNumbers ??
        precomputedParts.annualAnalyses.map((item) => item.year);
      const missingYears =
        precomputedParts.missingYears ?? [];

      progressState.done += preparedYears.length;
      setProgress(
        progressState.done,
        progressState.total,
        `${location.name}: ${preparedYears.length} Jahre vorbereitet · ${missingYears.length} Jahre werden live ergänzt …`
      );

      const liveYearlyData = [];
      for (const year of missingYears) {
        const result = await loadYear(location, year);
        liveYearlyData.push(result.data);
        progressState.done += 1;

        setProgress(
          progressState.done,
          progressState.total,
          `${location.name}: ${year} ${result.fromCache ? 'aus Zwischenspeicher' : 'live geladen'}`
        );
      }

      const liveAnalyses = liveYearlyData.length
        ? ClimateCore.analyzeYearlyData(
            location,
            liveYearlyData
          )
        : [];
      const allAnalyses = [
        ...precomputedParts.annualAnalyses,
        ...liveAnalyses,
      ].sort((a, b) => a.year - b.year);

      const liveGridCoordinates =
        liveYearlyData.find((item) => item.grid_coordinates)
          ?.grid_coordinates ?? null;
      const reference = precomputedParts.reference;

      climateResult =
        ClimateCore.buildResultFromAnnualAnalyses(
          {
            ...location,
            grid_longitude:
              liveGridCoordinates?.[0] ??
              reference.grid_longitude ?? null,
            grid_latitude:
              liveGridCoordinates?.[1] ??
              reference.grid_latitude ?? null,
            start_year: START_YEAR,
            end_year: END_YEAR,
            climate_load_source:
              'precomputed-yearly+live-years',
            precomputed_profile_id:
              reference.profile_id,
            precomputed_distance_m:
              reference.distance_m ?? null,
          },
          allAnalyses,
          {
            schema_version: 5,
            generated_at:
              precomputedParts.generatedAt ??
              new Date().toISOString(),
            source:
              'GeoSphere Austria, INCA-v1-1h-1km, T2M · vorberechnete Jahrespakete mit Live-Ergänzung',
            license: 'CC BY 4.0',
            note:
              'Vorhandene Jahre wurden aus statischen Jahrespaketen geladen. Ausschließlich fehlende oder beschädigte Jahre wurden live über GeoSphere ergänzt.',
            data_extra: {
              precomputed: true,
              yearly_packages: true,
              mixed_sources: true,
              precomputed_years: [...preparedYears],
              live_years: [...missingYears],
            },
          }
        );
      climateLoadSource = 'precomputed-yearly+live-years';

      setProgress(
        progressState.done,
        progressState.total,
        `${location.name}: ${climatePeriodLabel()} aus Jahrespaketen und ${missingYears.length} Live-Jahr(en) kombiniert`
      );
    }
  } catch (precomputedError) {
    /*
      Ein beschädigter oder fehlender statischer Datensatz darf das
      Beratungstool niemals blockieren.
    */
    console.warn(
      'Vorberechnete Klimadaten nicht vollständig verfügbar. ' +
      'Live-GeoSphere bleibt als Rückfallebene aktiv.',
      precomputedError
    );
  }

  if (!climateResult) {
    /*
      Falls gar kein vorberechnetes Profil zugeordnet werden konnte,
      bleibt der bewährte Live-Schnellweg für den Gesamtzeitraum erhalten.
    */
    try {
      setProgress(
        progressState.done,
        progressState.total,
        `${location.name}: Klimadaten ${climatePeriodLabel()} werden live geladen …`
      );

      const periodResult =
        await loadWholePeriod(location);

      yearlyData = periodResult.yearlyData;
      climateLoadSource = periodResult.source;

      progressState.done +=
        END_YEAR - START_YEAR + 1;

      const sourceText = {
        'period-cache':
          'aus Perioden-Zwischenspeicher',
        'legacy-cache':
          'aus vorhandenem Jahres-Zwischenspeicher',
        'period-api':
          'mit einer GeoSphere-Abfrage geladen',
      }[climateLoadSource] ?? 'geladen';

      setProgress(
        progressState.done,
        progressState.total,
        `${location.name}: ${climatePeriodLabel()} ${sourceText}`
      );
    } catch (periodError) {
      console.warn(
        'Gesamtzeitraum konnte nicht in einer Anfrage geladen werden. ' +
        'Die bewährten Jahresabfragen werden verwendet.',
        periodError
      );

      yearlyData = [];

      for (
        let year = START_YEAR;
        year <= END_YEAR;
        year += 1
      ) {
        const result = await loadYear(
          location,
          year
        );

        yearlyData.push(result.data);
        progressState.done += 1;

        setProgress(
          progressState.done,
          progressState.total,
          `${location.name}: ${year} ` +
          `${result.fromCache
            ? 'aus Zwischenspeicher'
            : 'geladen'}`
        );
      }
    }

    const gridCoordinates =
      yearlyData.find(
        (item) => item.grid_coordinates
      )?.grid_coordinates ?? null;

    climateResult =
      ClimateCore.analyzeLocation(
        {
          ...location,
          grid_longitude:
            gridCoordinates?.[0] ?? null,
          grid_latitude:
            gridCoordinates?.[1] ?? null,
          start_year: START_YEAR,
          end_year: END_YEAR,
          climate_load_source:
            climateLoadSource,
        },
        yearlyData
      );
  }

  setProgress(
    progressState.done,
    progressState.total,
    `${location.name}: TIRIS-Geländehöhen werden geprüft …`
  );

  try {
    climateResult.location.location_check =
      await LocationCore.enrichLocation(
        climateResult.location
      );
  } catch (error) {
    climateResult.location.location_check = {
      schema_version: 1,
      building: null,
      inca_grid: null,
      difference_building_grid_m: null,
      difference_building_nat_reference_m: null,
      height_assessment:
        LocationCore.classifyDifference(null),
      automatic_temperature_correction: false,
      errors: {
        building: error.message,
        inca_grid: error.message,
      },
      note:
        'Die Klimaberechnung ist vollständig; nur die ergänzende TIRIS-Höhenabfrage war nicht verfügbar.',
    };
  }

  return climateResult;
}

function formatNumber(value, digits = 0) {
  if (!Number.isFinite(value)) return '–';
  return new Intl.NumberFormat('de-AT', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function infoTip(note) {
  if (!note) return '';

  const safe = escapeAttribute(note);

  return `
    <button
      class="info-tip"
      type="button"
      aria-label="${safe}"
      data-tooltip="${safe}"
      title="${safe}"
    >i</button>`;
}

function metric(label, value, note = '') {
  return `
    <article class="metric-card">
      <div class="compact-card-heading">
        <span>${label}</span>
        ${infoTip(note)}
      </div>
      <strong>${value}</strong>
    </article>`;
}

function renderMetrics(result) {
  const metrics = result.metrics;

  elements.metricGrid.innerHTML = [
    metric(
      'Stunden mit Heizbedarf (< 15 °C)',
      `${formatNumber(metrics.average_heating_demand_hours)} h/a`,
      'Klimatische Stunden mit rechnerischem Wärmebedarf. Das sind keine tatsächlichen Brennerlaufstunden.'
    ),
    metric(
      'Klimatische Vollbenutzungsstunden',
      `${formatNumber(metrics.average_full_load_hours)} h/a`,
      'Äquivalente Stunden bei voller Normheizlast. Die Heizung arbeitet tatsächlich wesentlich länger und überwiegend in Teillast.'
    ),
    metric(
      'Stunden unter 0 °C',
      `${formatNumber(metrics.average_hours_below_0)} h/a`
    ),
    metric(
      'Stunden unter −5 °C',
      `${formatNumber(metrics.average_hours_below_minus_5)} h/a`,
      'Anschaulicher Bereich mit deutlich erhöhtem Heizleistungsbedarf.'
    ),
    metric(
      'Stunden unter −10 °C',
      `${formatNumber(metrics.average_hours_below_minus_10)} h/a`,
      'Sehr kalter Bereich nahe der örtlichen Normaußentemperatur.'
    ),
    metric(
      'Stunden bei/unter NAT',
      `${formatNumber(metrics.average_hours_at_or_below_nat, 1)} h/a`,
      'Im vereinfachten linearen Modell wird die berechnete Normheizlast erreicht oder überschritten.'
    ),
    metric(
      'Hitzetage (≥ 30 °C)',
      `${formatNumber(metrics.average_hot_days, 1)} Tage/a`,
      'Tage, an denen das aus Stundenwerten abgeleitete Tagesmaximum mindestens 30 °C erreicht.'
    ),
    metric(
      'Tropennächte (≥ 20 °C)',
      `${formatNumber(metrics.average_tropical_nights, 1)} Nächte/a`,
      'Nächte, in denen das Minimum der ausgewerteten Nachtstunden mindestens 20 °C beträgt.'
    ),
    metric(
      'Kälteste Einzelstunde',
      `${formatNumber(metrics.absolute_minimum_hourly_c, 1)} °C`
    ),
    metric(
      'Höchste Einzelstunde',
      `${formatNumber(metrics.absolute_maximum_hourly_c, 1)} °C`
    ),
    metric(
      'Kältestes 24-h-Mittel',
      `${formatNumber(metrics.absolute_minimum_24h_mean_c, 1)} °C`,
      'Zeigt eine länger anhaltende Kälteperiode statt einer einzelnen Extremstunde.'
    ),
    metric(
      'Wärmste Nacht (Minimum)',
      `${formatNumber(metrics.warmest_night_minimum_c, 1)} °C`
    ),
  ].join('');
}


function signedMeters(value) {
  if (!Number.isFinite(value)) return '–';
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatNumber(value)} m`;
}

function elevationLabel(value) {
  if (!Number.isFinite(value)) return 'nicht verfügbar';
  return `${formatNumber(value)} m ü. A.`;
}

function locationFact(label, value, note = '') {
  return `
    <div>
      <dt>${label}</dt>
      <dd>${value}</dd>
      ${note ? `<small>${note}</small>` : ''}
    </div>`;
}

function renderLocationCheck(result) {
  const location = result.location;
  const check = location.location_check ?? {};
  const buildingElevation =
    check.building?.elevation_m ?? null;
  const gridElevation =
    check.inca_grid?.elevation_m ?? null;
  const assessment =
    check.height_assessment ??
    LocationCore.classifyDifference(null);

  elements.locationFacts.innerHTML = [
    locationFact(
      'Gebäudestandort',
      `${formatNumber(location.latitude, 5)}° N / ` +
      `${formatNumber(location.longitude, 5)}° E`,
      location.address_label ?? location.name
    ),
    locationFact(
      'INCA-Rasterpunkt',
      `${formatNumber(location.grid_latitude, 5)}° N / ` +
      `${formatNumber(location.grid_longitude, 5)}° E`
    ),
    locationFact(
      'OIB-NAT-Referenz',
      `${formatNumber(location.nat_c, 1)} °C ` +
      `bei ${formatNumber(
        location.nat_reference_height_m
      )} m`,
      location.kg_name
        ? `KG ${location.kg_name} · ${location.kg_number} · Region ${location.climate_region}`
        : 'manuell eingetragener Wert'
    ),
    locationFact(
      'TNAT,13',
      Number.isFinite(location.tnat13_c)
        ? `${formatNumber(location.tnat13_c, 1)} °C`
        : 'nicht eindeutig zugeordnet',
      Number.isFinite(location.tnat13_c)
        ? 'OIB April 2026 · Wert am ELEVmin'
        : 'Bei mehreren KGNR erfolgt bewusst keine automatische Auswahl.'
    ),
    locationFact(
      'Gebäudehöhe',
      elevationLabel(buildingElevation),
      'TIRIS-DGM am Gebäudestandort'
    ),
    locationFact(
      'INCA-Rasterhöhe',
      elevationLabel(gridElevation),
      'TIRIS-DGM am verwendeten Klimarasterpunkt'
    ),
    locationFact(
      'Höhendifferenz Gebäude / Raster',
      signedMeters(
        check.difference_building_grid_m
      ),
      'positiv = Gebäude liegt höher'
    ),
    locationFact(
      'Gebäude / OIB-Referenzhöhe',
      signedMeters(
        check.difference_building_nat_reference_m
      ),
      'noch ohne automatische NAT-Höhenkorrektur'
    ),
    locationFact(
      'KGNR aus BEV',
      location.address?.cadastral_municipality_number
        ? location.address.cadastral_municipality_number
        : Array.isArray(
            location.address?.cadastral_municipality_numbers
          ) &&
          location.address.cadastral_municipality_numbers.length > 1
          ? location.address.cadastral_municipality_numbers.join(' / ')
          : 'nicht verfügbar',
      location.address?.cadastral_municipality_numbers?.length > 1
        ? 'Adresse berührt mehrere Katastralgemeinden; verwendete KG wird nach Auswahl übernommen.'
        : 'Direkte Zuordnung über ADRESSE_GST.csv'
    ),
  ].join('');

  elements.heightAssessment.className =
    `height-assessment is-${assessment.level}`;
  elements.heightAssessment.innerHTML =
    `<strong>${assessment.label}</strong> · ` +
    `${assessment.text}`;

  const errors = [
    check.errors?.building,
    check.errors?.inca_grid,
  ].filter(Boolean);

  if (errors.length > 0) {
    elements.heightServiceNote.className =
      'height-service-note is-error';
    elements.heightServiceNote.textContent =
      'Die TIRIS-Höhenabfrage konnte nicht vollständig geladen werden. ' +
      'Die Klima- und Heizlastberechnung bleibt trotzdem nutzbar. ' +
      errors.join(' ');
  } else {
    elements.heightServiceNote.className =
      'height-service-note';
    elements.heightServiceNote.textContent =
      'Höhenquelle: TIRIS Gelände Tirol, digitales Geländemodell. ' +
      'Es wird bewusst keine pauschale Temperaturkorrektur aus dem Höhenunterschied abgeleitet.';
  }
}

async function retryHeightCheck() {
  if (!state.currentResult || state.busy) return;

  setBusy(true);
  elements.heightServiceNote.className =
    'height-service-note';
  elements.heightServiceNote.textContent =
    'TIRIS-Geländehöhen werden erneut abgefragt …';

  try {
    state.currentResult.location.location_check =
      await LocationCore.enrichLocation(
        state.currentResult.location
      );
    renderLocationCheck(state.currentResult);
    renderDataQuality(state.currentResult);
    setStatus('Höhen erfolgreich geprüft', 'success');
  } catch (error) {
    elements.heightServiceNote.className =
      'height-service-note is-error';
    elements.heightServiceNote.textContent =
      `Höhenabfrage nicht verfügbar: ${error.message}`;
    setStatus('Höhenabfrage nicht verfügbar', 'error');
  } finally {
    setBusy(false);
  }
}

function currentDateLabel() {
  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
}

function updatePrintClimateMetadata(result, validPercent) {
  const location = result.location;
  const check = location.location_check ?? {};
  const buildingElevation =
    elevationLabel(check.building?.elevation_m);
  const gridElevation =
    elevationLabel(check.inca_grid?.elevation_m);
  const gridDifference =
    signedMeters(check.difference_building_grid_m);
  const oibDifference =
    signedMeters(
      check.difference_building_nat_reference_m
    );

  const kgLabel =
    location.kg_number && location.kg_name
      ? `KG ${location.kg_number} ${location.kg_name}`
      : 'KG nicht automatisch zugeordnet';

  const tnatLabel =
    Number.isFinite(location.tnat13_c)
      ? `${formatNumber(location.tnat13_c, 1)} °C`
      : 'nicht eindeutig';

  elements.printClimateLocation.textContent =
    location.name;
  elements.printClimateContext.textContent =
    `Standortbezug: Gebäudehöhe ${buildingElevation} · ` +
    `INCA-Rasterhöhe ${gridElevation} (Δ ${gridDifference}) · ` +
    `${kgLabel} · ELEVmin ${formatNumber(
      location.nat_reference_height_m
    )} m (Gebäude Δ ${oibDifference}) · ` +
    `NAT ${formatNumber(location.nat_c, 1)} °C · ` +
    `TNAT,13 ${tnatLabel}.`;

  elements.printReportDate.textContent =
    currentDateLabel();
  elements.printHeatingLocation.textContent =
    location.name;
  elements.printReportDate2.textContent =
    currentDateLabel();
}

function renderDataQuality(result) {
  const expected = result.annual_metrics.reduce(
    (sum, item) => sum + item.expected_hours,
    0
  );
  const missing = result.metrics.total_missing_values;
  const missingPercent = expected > 0
    ? missing / expected * 100
    : 0;
  const validPercent = 100 - missingPercent;

  let level = 'excellent';
  let label = 'Datenqualität sehr gut';

  if (missingPercent > 1) {
    level = 'critical';
    label = 'Datenlücken beachten';
  } else if (missingPercent > 0.1) {
    level = 'notice';
    label = 'Geringe Datenlücken';
  }

  elements.dataQualitySummary.className =
    `data-quality-summary is-${level}`;
  elements.dataQualitySummary.textContent =
    `${label} · ${formatNumber(validPercent, 2)} % gültige Stundenwerte`;

  elements.dataQualitySummary.title =
    `${formatNumber(missing)} fehlende Einzelwerte von ` +
    `${formatNumber(expected)} erwarteten Stunden.`;

  updatePrintClimateMetadata(result, validPercent);
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function renderChart(result) {
  const distribution = result.temperature_frequency;
  const width = 820;
  const height = 430;
  const margin = { top: 28, right: 28, bottom: 54, left: 62 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const temperatures = distribution.temperature_c;
  const annualCurves = distribution.annual;

  const activeIndices = temperatures
    .map((temperature, index) => ({
      temperature,
      active: annualCurves.some((year) => year.hours[index] >= 0.5),
    }))
    .filter((item) => item.active)
    .map((item) => item.temperature);

  const dataMinimum = activeIndices.length > 0 ? Math.min(...activeIndices) : -25;
  const dataMaximum = activeIndices.length > 0 ? Math.max(...activeIndices) : 35;

  const xMin = Math.floor((Math.min(dataMinimum - 2, result.location.nat_c - 2)) / 5) * 5;
  const xMax = Math.ceil(
    (
      Math.max(
        dataMaximum + 2,
        32,
        Number.isFinite(result.location.tnat13_c)
          ? result.location.tnat13_c + 3
          : 32
      )
    ) / 5
  ) * 5;

  const visibleIndices = temperatures
    .map((temperature, index) => ({ temperature, index }))
    .filter((item) => item.temperature >= xMin && item.temperature <= xMax);

  const visibleAnnualValues = annualCurves.flatMap((year) =>
    visibleIndices.map((item) => year.hours[item.index])
  );
  const visibleMedianValues = visibleIndices.map(
    (item) => distribution.median_hours[item.index]
  );

  const rawYMax = Math.max(...visibleAnnualValues, ...visibleMedianValues, 1);
  const yStep = rawYMax > 400 ? 100 : rawYMax > 200 ? 50 : 25;
  const yMax = Math.ceil(rawYMax / yStep) * yStep;

  const xScale = (temperature) =>
    margin.left + ((temperature - xMin) / (xMax - xMin)) * plotWidth;
  const yScale = (hours) =>
    margin.top + ((yMax - hours) / yMax) * plotHeight;

  const svg = createSvgElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    class: 'duration-chart',
    role: 'img',
    'aria-label': `Stundenhäufigkeit der Außentemperatur für ${result.location.name}`,
  });

  for (let hours = 0; hours <= yMax; hours += yStep) {
    const y = yScale(hours);
    svg.append(createSvgElement('line', {
      x1: margin.left,
      y1: y,
      x2: width - margin.right,
      y2: y,
      class: 'chart-grid',
    }));

    const label = createSvgElement('text', {
      x: margin.left - 9,
      y: y + 4,
      'text-anchor': 'end',
      class: 'chart-label',
    });
    label.textContent = formatNumber(hours);
    svg.append(label);
  }

  for (let temperature = xMin; temperature <= xMax; temperature += 5) {
    const x = xScale(temperature);

    svg.append(createSvgElement('line', {
      x1: x,
      y1: margin.top,
      x2: x,
      y2: height - margin.bottom,
      class: 'chart-grid',
    }));

    const label = createSvgElement('text', {
      x,
      y: height - margin.bottom + 22,
      'text-anchor': 'middle',
      class: 'chart-label',
    });
    label.textContent = temperature;
    svg.append(label);
  }

  annualCurves.forEach((year) => {
    const points = visibleIndices
      .map((item) => `${xScale(item.temperature)},${yScale(year.hours[item.index])}`)
      .join(' ');

    svg.append(createSvgElement('polyline', {
      points,
      class: 'chart-year',
    }));
  });

  const medianPoints = visibleIndices
    .map((item) =>
      `${xScale(item.temperature)},${yScale(distribution.median_hours[item.index])}`
    )
    .join(' ');

  svg.append(createSvgElement('polyline', {
    points: medianPoints,
    class: 'chart-frequency-median',
  }));

  const addVerticalReference = (temperature, className, labelText, labelY) => {
    if (temperature < xMin || temperature > xMax) return;

    const x = xScale(temperature);
    svg.append(createSvgElement('line', {
      x1: x,
      y1: margin.top,
      x2: x,
      y2: height - margin.bottom,
      class: className,
    }));

    const label = createSvgElement('text', {
      x: x + 4,
      y: labelY,
      class: 'chart-label',
    });
    label.textContent = labelText;
    svg.append(label);
  };

  addVerticalReference(
    result.location.nat_c,
    'chart-nat',
    `NAT ${formatNumber(result.location.nat_c, 1)} °C`,
    margin.top + 13
  );
  addVerticalReference(
    15,
    'chart-heating',
    'Heizgrenze 15 °C',
    margin.top + 28
  );

  if (Number.isFinite(result.location.tnat13_c)) {
    addVerticalReference(
      result.location.tnat13_c,
      'chart-tnat13',
      `TNAT,13 ${formatNumber(
        result.location.tnat13_c,
        1
      )} °C`,
      margin.top + 43
    );
  }

  addVerticalReference(
    30,
    'chart-hot',
    'Hitzetag 30 °C',
    margin.top + 58
  );

  svg.append(createSvgElement('line', {
    x1: margin.left,
    y1: height - margin.bottom,
    x2: width - margin.right,
    y2: height - margin.bottom,
    class: 'chart-axis',
  }));
  svg.append(createSvgElement('line', {
    x1: margin.left,
    y1: margin.top,
    x2: margin.left,
    y2: height - margin.bottom,
    class: 'chart-axis',
  }));

  const xLabel = createSvgElement('text', {
    x: margin.left + plotWidth / 2,
    y: height - 10,
    'text-anchor': 'middle',
    class: 'chart-label',
  });
  xLabel.textContent = 'Außentemperatur [°C]';
  svg.append(xLabel);

  const yLabel = createSvgElement('text', {
    x: 16,
    y: margin.top + plotHeight / 2,
    'text-anchor': 'middle',
    transform: `rotate(-90 16 ${margin.top + plotHeight / 2})`,
    class: 'chart-label',
  });
  yLabel.textContent = 'Stunden pro Jahr [h/a]';
  svg.append(yLabel);

  elements.chartWrap.replaceChildren(svg);
}

function renderAnnualTable(result) {
  elements.annualTable.innerHTML = `
    <thead>
      <tr>
        <th>Jahr</th>
        <th>Fehlend</th>
        <th>Minimum</th>
        <th>Maximum</th>
        <th>&lt; 0 °C</th>
        <th>Heizbedarf</th>
        <th>Hitzetage</th>
        <th>Tropennächte</th>
        <th>Vollnutzungsstd.</th>
      </tr>
    </thead>
    <tbody>${result.annual_metrics.map((item) => `
      <tr>
        <td>${item.year}</td>
        <td>${formatNumber(item.missing_values)}</td>
        <td>${formatNumber(item.minimum_hourly_c, 1)} °C</td>
        <td>${formatNumber(item.maximum_hourly_c, 1)} °C</td>
        <td>${formatNumber(item.hours_below_0)}</td>
        <td>${formatNumber(item.heating_demand_hours)}</td>
        <td>${formatNumber(item.hot_days)}</td>
        <td>${formatNumber(item.tropical_nights)}</td>
        <td>${formatNumber(item.full_load_hours)} h</td>
      </tr>`).join('')}
    </tbody>`;
}

function renderComparison() {
  const results = Object.values(state.results);
  elements.comparisonCard.hidden = results.length < 2;
  if (results.length < 2) return;

  elements.comparisonTable.innerHTML = `
    <thead>
      <tr>
        <th>Standort</th>
        <th>NAT</th>
        <th>Vollnutzungsstd.</th>
        <th>&lt; 0 °C</th>
        <th>Heizbedarf</th>
        <th>Hitzetage</th>
        <th>Tropennächte</th>
        <th>Kälteste Stunde</th>
      </tr>
    </thead>
    <tbody>${results.map((result) => `
      <tr>
        <td>${result.location.name}</td>
        <td>${formatNumber(result.location.nat_c, 1)} °C</td>
        <td>${formatNumber(result.metrics.average_full_load_hours)} h/a</td>
        <td>${formatNumber(result.metrics.average_hours_below_0)} h/a</td>
        <td>${formatNumber(result.metrics.average_hot_days, 1)} d/a</td>
        <td>${formatNumber(result.metrics.average_tropical_nights, 1)} N/a</td>
        <td>${formatNumber(result.metrics.absolute_minimum_hourly_c, 1)} °C</td>
      </tr>`).join('')}
    </tbody>`;
}

function readOptionalNumber(element) {
  const value = String(element.value).trim();
  if (value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getHeatingInputs() {
  return {
    annual_consumption_kwh: Number(elements.annualConsumption.value),
    useful_heat_factor: Number(elements.usefulHeatFactor.value),
    hot_water_included: elements.hotWaterIncluded.value === 'yes',
    persons: Number(elements.persons.value),
    heated_area_m2: Number(elements.heatedArea.value),
    building_condition: elements.buildingCondition.value,
    installed_maximum_kw: Number(elements.installedMaximum.value),
    installed_minimum_kw: readOptionalNumber(elements.installedMinimum),
    heating_limit_c: elements.heatingLimitTemperature
      ? clampHeatingLimit(elements.heatingLimitTemperature.value)
      : 15,
    hwb_kwh_m2a: readOptionalNumber(elements.hwbValue),
    bgf_m2: readOptionalNumber(elements.hwbBgf),
  };
}

function heatingMetric(label, value, note = '') {
  return `
    <article class="heating-result">
      <div class="compact-card-heading">
        <span>${label}</span>
        ${infoTip(note)}
      </div>
      <strong>${value}</strong>
    </article>`;
}

function renderHeatingChart(calculation) {
  const curve = calculation.power_curve.required_kw;
  const comparison = calculation.comparison;

  const width = 820;
  const height = 400;
  const margin = { top: 34, right: 36, bottom: 54, left: 62 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const installedMaximum = comparison.installed_maximum_kw;
  const installedMinimum = comparison.installed_minimum_kw;
  const coverage90 =
    comparison.power_for_90_percent_heating_hours_kw;

  const requiredMaximum = Math.max(...curve, 0);
  const rawYMax = Math.max(
    requiredMaximum,
    installedMaximum || 0,
    installedMinimum || 0,
    coverage90 || 0,
    1
  );

  const yStep = rawYMax > 30 ? 10 : rawYMax > 15 ? 5 : 2;
  const yMax = Math.ceil(rawYMax * 1.08 / yStep) * yStep;

  const xScale = (hour) =>
    margin.left + (hour / 8760) * plotWidth;
  const yScale = (power) =>
    margin.top + ((yMax - power) / yMax) * plotHeight;

  const svg = createSvgElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    class: 'duration-chart',
    role: 'img',
    'aria-label': 'Heizleistungs-Dauerlinie',
  });

  for (let power = 0; power <= yMax; power += yStep) {
    const y = yScale(power);

    svg.append(createSvgElement('line', {
      x1: margin.left,
      y1: y,
      x2: width - margin.right,
      y2: y,
      class: 'chart-grid',
    }));

    const label = createSvgElement('text', {
      x: margin.left - 9,
      y: y + 4,
      'text-anchor': 'end',
      class: 'chart-label',
    });
    label.textContent = formatNumber(
      power,
      power < 10 ? 1 : 0
    );
    svg.append(label);
  }

  for (let hour = 0; hour <= 8760; hour += 1000) {
    const x = xScale(hour);

    svg.append(createSvgElement('line', {
      x1: x,
      y1: margin.top,
      x2: x,
      y2: height - margin.bottom,
      class: 'chart-grid',
    }));

    const label = createSvgElement('text', {
      x,
      y: height - margin.bottom + 22,
      'text-anchor': 'middle',
      class: 'chart-label',
    });
    label.textContent = formatNumber(hour);
    svg.append(label);
  }

  const sampledPoints = [];
  const step = 8;

  for (let index = 0; index < curve.length; index += step) {
    sampledPoints.push(
      `${xScale(index + 1)},${yScale(curve[index])}`
    );
  }

  if ((curve.length - 1) % step !== 0) {
    sampledPoints.push(
      `${xScale(curve.length)},` +
      `${yScale(curve[curve.length - 1])}`
    );
  }

  svg.append(createSvgElement('polyline', {
    points: sampledPoints.join(' '),
    class: 'chart-required-power',
  }));

  /*
    Alle Linienbeschriftungen stehen rechts.
    Damit sich die Labels nicht überlagern, bekommen sie gestaffelte Offsets.
  */
  const lineLabels = [];

  if (installedMaximum > 0) {
    lineLabels.push({
      power: installedMaximum,
      className: 'chart-installed-power',
      labelText: `installiert ${formatNumber(installedMaximum, 1)} kW`,
      labelOffset: 5,
    });
  }

  if (installedMinimum > 0) {
    lineLabels.push({
      power: installedMinimum,
      className: 'chart-minimum-power',
      labelText: `Minimum ${formatNumber(installedMinimum, 1)} kW`,
      labelOffset: -13,
    });
  }

  if (coverage90 > 0) {
    lineLabels.push({
      power: coverage90,
      className: 'chart-coverage-90',
      labelText: `90 % ${formatNumber(coverage90, 1)} kW`,
      labelOffset: -30,
    });
  }

  lineLabels.forEach(({ power, className, labelText, labelOffset }) => {
    const y = yScale(power);

    svg.append(createSvgElement('line', {
      x1: margin.left,
      y1: y,
      x2: width - margin.right,
      y2: y,
      class: className,
    }));

    const label = createSvgElement('text', {
      x: width - margin.right - 5,
      y: y - labelOffset,
      'text-anchor': 'end',
      class: 'chart-label',
    });
    label.textContent = labelText;
    svg.append(label);
  });

  svg.append(createSvgElement('line', {
    x1: margin.left,
    y1: height - margin.bottom,
    x2: width - margin.right,
    y2: height - margin.bottom,
    class: 'chart-axis',
  }));

  svg.append(createSvgElement('line', {
    x1: margin.left,
    y1: margin.top,
    x2: margin.left,
    y2: height - margin.bottom,
    class: 'chart-axis',
  }));

  const xLabel = createSvgElement('text', {
    x: margin.left + plotWidth / 2,
    y: height - 10,
    'text-anchor': 'middle',
    class: 'chart-label',
  });
  xLabel.textContent =
    'Stunden eines mittleren Jahres, kalt → warm';
  svg.append(xLabel);

  const yLabel = createSvgElement('text', {
    x: 17,
    y: margin.top + plotHeight / 2,
    'text-anchor': 'middle',
    transform:
      `rotate(-90 17 ${margin.top + plotHeight / 2})`,
    class: 'chart-label',
  });
  yLabel.textContent = 'Heizleistung [kW]';
  svg.append(yLabel);

  elements.heatingChartWrap.replaceChildren(svg);
}

function updateHeatingLimitUi(inputs) {
  if (IS_CLIMATE_TOOL || !elements.heatingLimitTemperature) return inputs;
  const suggestionC = suggestedHeatingLimit({
    annualConsumptionKwh: inputs.annual_consumption_kwh,
    usefulHeatFactor: inputs.useful_heat_factor,
    hotWaterIncluded: inputs.hot_water_included,
    persons: inputs.persons,
    heatedAreaM2: inputs.heated_area_m2,
  });
  const specific = specificRoomHeatFromInputs({
    annualConsumptionKwh: inputs.annual_consumption_kwh,
    usefulHeatFactor: inputs.useful_heat_factor,
    hotWaterIncluded: inputs.hot_water_included,
    persons: inputs.persons,
    heatedAreaM2: inputs.heated_area_m2,
  });
  state.heatingLimitSuggestionC = suggestionC;

  const info = heatingLimitInfo();
  state.heatingLimitManual = Boolean(info.isManual);
  if (!state.heatingLimitManual) {
    elements.heatingLimitTemperature.value = String(suggestionC);
    inputs.heating_limit_c = suggestionC;
  }

  if (elements.heatingLimitSuggestion) {
    elements.heatingLimitSuggestion.textContent = Number.isFinite(specific)
      ? `Vorschlag: ${formatNumber(suggestionC, 1)} °C aus ca. ${formatNumber(specific, 0)} kWh/m²a verbrauchsbezogener Raumwärme.`
      : 'Fallback: 15 °C. Für einen Vorschlag werden Verbrauch und beheizte Nutzfläche benötigt.';
  }
  if (elements.useHeatingLimitSuggestion) {
    elements.useHeatingLimitSuggestion.hidden = !state.heatingLimitManual;
  }
  if (elements.heatingLimitMethodText) {
    elements.heatingLimitMethodText.textContent =
      `Heizgrenze ${formatNumber(inputs.heating_limit_c, 1)} °C`;
  }

  syncHeatingLimitCandidates({
    annualConsumptionKwh: inputs.annual_consumption_kwh,
    usefulHeatFactor: inputs.useful_heat_factor,
    hotWaterIncluded: inputs.hot_water_included,
    persons: inputs.persons,
    heatedAreaM2: inputs.heated_area_m2,
  }, suggestionC);
  return inputs;
}

function renderHeatingCalculation() {
  if (IS_CLIMATE_TOOL || !state.currentResult) return;

  elements.persons.disabled =
    elements.hotWaterIncluded.value !== 'yes';

  try {
    const heatingInputs = updateHeatingLimitUi(getHeatingInputs());
    const calculation = HeatingCore.calculateHeatingLoad(
      state.currentResult,
      heatingInputs
    );
    state.heatingCalculation = calculation;

    const consumption = calculation.consumption;
    const area = calculation.area_method;
    const hwb = calculation.hwb_method;
    const comparison = calculation.comparison;

    /*
      Die drei wichtigsten Ergebnisse stehen direkt unter den
      zugehörigen Eingaben.
    */
    elements.consumptionMainResult.textContent =
      `${formatNumber(consumption.heat_load_kw, 1)} kW`;

    elements.areaMainResult.textContent =
      `${formatNumber(area.minimum_kw, 1)}–` +
      `${formatNumber(area.maximum_kw, 1)} kW`;

    elements.installedMainResult.textContent =
      comparison.installed_minimum_kw !== null
        ? `${formatNumber(comparison.installed_minimum_kw, 1)}–` +
          `${formatNumber(comparison.installed_maximum_kw, 1)} kW`
        : `${formatNumber(comparison.installed_maximum_kw, 1)} kW`;

    elements.hwbMainResult.textContent =
      hwb.heat_load_kw !== null
        ? `${formatNumber(hwb.heat_load_kw, 1)} kW`
        : '–';

    if (hwb.heat_load_kw !== null) {
      elements.printHwbCard.hidden = false;
      elements.printHwbCardValue.textContent =
        `${formatNumber(hwb.heat_load_kw, 1)} kW`;
      elements.printHwbCardDetail.textContent =
        `HWB ${formatNumber(hwb.hwb_kwh_m2a, 0)} kWh/m²a · ` +
        `BGF ${formatNumber(hwb.bgf_m2, 0)} m²`;
    } else {
      elements.printHwbCard.hidden = true;
      elements.printHwbCardValue.textContent = '–';
      elements.printHwbCardDetail.textContent = '–';
    }

    const cards = [];

    if (comparison.dimensioning_factor !== null) {
      cards.push(
        heatingMetric(
          'Leistungsverhältnis',
          `${formatNumber(comparison.dimensioning_factor, 2)} ×`,
          'Installierte Maximalleistung geteilt durch die verbrauchsbasierte Heizlastabschätzung. Ein Vergleichswert, keine automatische Bewertung.'
        ),
        heatingMetric(
          'Auslastung bei NAT',
          `${formatNumber(comparison.utilization_at_nat_percent, 0)} %`,
          'Anteil der installierten Maximalleistung, der bei Normaußentemperatur gemäß der vereinfachten Gebäudekennlinie benötigt würde.'
        ),
        heatingMetric(
          'Theoretische Volllast erst bei',
          `${formatNumber(
            comparison.theoretical_full_load_temperature_c,
            1
          )} °C`,
          'Lineare Fortschreibung: Außentemperatur, bei der die installierte Maximalleistung rechnerisch vollständig benötigt würde.'
        )
      );
    }

    if (comparison.hours_below_minimum !== null) {
      cards.push(
        heatingMetric(
          'Bedarf unter Mindestleistung',
          `${formatNumber(comparison.hours_below_minimum)} h/a`,
          'Hinweis auf mögliches Taktpotenzial. Die Zahl entspricht nicht der Anzahl tatsächlicher Brennerstarts.'
        )
      );
    }

    cards.push(
      heatingMetric(
        'Leistung für 90 % der Heizstunden',
        `${formatNumber(
          comparison.power_for_90_percent_heating_hours_kw,
          1
        )} kW`,
        'Während 90 % der Heizstunden liegt der rechnerische Bedarf höchstens bei dieser Leistung. Die verbleibende Spitzenlast muss bei einer kleineren Auslegung anderweitig gedeckt werden.'
      )
    );

    elements.heatingResultGrid.innerHTML = cards.join('');
    renderHeatingChart(calculation);

    elements.coverageNote.textContent =
      `Die 90-%-Linie zeigt eine reine Stundendeckung: ` +
      `${formatNumber(
        comparison.power_for_90_percent_heating_hours_kw,
        1
      )} kW decken rechnerisch 90 % der Heizstunden ab. ` +
      `Für die verbleibenden kalten Stunden wäre eine verlässlich ` +
      `verfügbare Zusatzwärmequelle notwendig. Die Linie ist eine ` +
      `anschauliche Beratungsgröße und keine Empfehlung zur monovalenten ` +
      `Kesselauslegung.`;

    let interpretation =
      `Die verbrauchsbasierte Abschätzung ergibt ` +
      `${formatNumber(consumption.heat_load_kw, 1)} kW. ` +
      `Die Flächenfaustformel liefert als unabhängige Orientierung ` +
      `${formatNumber(area.minimum_kw, 1)} bis ` +
      `${formatNumber(area.maximum_kw, 1)} kW.`;

    if (comparison.dimensioning_factor !== null) {
      interpretation +=
        ` Die eingetragene Maximalleistung entspricht dem ` +
        `${formatNumber(comparison.dimensioning_factor, 2)}-Fachen ` +
        `der verbrauchsbasierten Abschätzung. Bei NAT wären ` +
        `rechnerisch rund ${formatNumber(
          comparison.utilization_at_nat_percent,
          0
        )} % der installierten Leistung erforderlich.`;
    }

    if (comparison.hours_below_minimum !== null) {
      interpretation +=
        ` Für rund ${formatNumber(
          comparison.hours_below_minimum
        )} Heizstunden liegt der rechnerische Bedarf unter der ` +
        `eingetragenen Mindestleistung. Das weist auf mögliches ` +
        `Taktpotenzial hin, ist aber keine Prognose der tatsächlichen ` +
        `Brennerstarts.`;
    }

    interpretation +=
      ` Die Werte sind eine vereinfachte Beratungsschätzung und keine ` +
      `Norm-Heizlastberechnung.`;

    elements.heatingInterpretation.textContent = interpretation;

    elements.calculationBasisValues.innerHTML = `
      <dl>
        <div>
          <dt>Nutzwärme gesamt</dt>
          <dd>${formatNumber(
            consumption.useful_heat_total_kwh
          )} kWh/a</dd>
        </div>
        <div>
          <dt>Warmwasserabzug</dt>
          <dd>${formatNumber(
            consumption.hot_water_kwh
          )} kWh/a</dd>
        </div>
        <div>
          <dt>Nutzwärme Raumheizung</dt>
          <dd>${formatNumber(
            consumption.room_heat_kwh
          )} kWh/a</dd>
        </div>
        <div>
          <dt>Vollbenutzungsstunden</dt>
          <dd>${formatNumber(
            calculation.assumptions.full_load_hours
          )} h/a</dd>
        </div>
        <div>
          <dt>Heizgrenztemperatur</dt>
          <dd>${formatNumber(
            calculation.assumptions.heating_limit_c,
            1
          )} °C</dd>
        </div>
        <div>
          <dt>Rechnerische Reserve</dt>
          <dd>${
            comparison.reserve_percent !== null
              ? `${formatNumber(
                  comparison.reserve_percent,
                  0
                )} %`
              : '–'
          }</dd>
        </div>
      </dl>`;

    if (calculation.warnings.length > 0) {
      elements.calculationWarning.hidden = false;
      elements.calculationWarning.innerHTML =
        calculation.warnings
          .map((warning) => `<p>${warning}</p>`)
          .join('');
    } else {
      elements.calculationWarning.hidden = true;
      elements.calculationWarning.textContent = '';
    }

    syncSharedInputs();
    syncSharedResult();
  } catch (error) {
    console.error(error);
    elements.calculationWarning.hidden = false;
    elements.calculationWarning.textContent = error.message;
  }
}

function renderResult(result) {
  state.currentResult = result;
  elements.resultsSection.hidden = false;
  elements.resultTitle.textContent = result.location.name;
  elements.resultSubtitle.textContent =
    `Gebäudestandort ${formatNumber(
      result.location.latitude,
      4
    )}° N / ${formatNumber(
      result.location.longitude,
      4
    )}° E · INCA-Raster ${formatNumber(
      result.location.grid_latitude,
      4
    )}° N / ${formatNumber(
      result.location.grid_longitude,
      4
    )}° E`;
  renderLocationCheck(result);
  renderMetrics(result);
  renderDataQuality(result);
  renderChart(result);
  renderAnnualTable(result);
  renderComparison();

  if (elements.heatingClimateSummary) {
    const validYears = result.data?.valid_years ?? result.data?.years?.length ?? 0;
    elements.heatingClimateSummary.innerHTML = `
      <div><span>Normaußentemperatur</span><strong>${formatNumber(result.location?.nat_c, 1)} °C</strong></div>
      <div><span>Klimazeitraum</span><strong>${START_YEAR}–${END_YEAR}</strong></div>
      <div><span>Geländehöhe</span><strong>${elevationLabel(result.location?.location_check?.building?.elevation_m)}</strong></div>
      <div><span>Datenbasis</span><strong>${validYears || '–'} vollständige Jahre</strong></div>
      ${IS_HEATING_TOOL ? `<div><span>Heizgrenze</span><strong>${formatNumber(Number(elements.heatingLimitTemperature?.value ?? 15), 1)} °C</strong></div>` : ''}`;
  }

  elements.heatingLoadCard.hidden = IS_CLIMATE_TOOL;
  if (!IS_CLIMATE_TOOL) renderHeatingCalculation();
  syncSharedResult(result);
  elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function downloadJson() {
  if (!state.currentResult) return;

  const blob = new Blob(
    [JSON.stringify(state.currentResult, null, 2)],
    { type: 'application/json' }
  );

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download =
    `${IS_HEATING_TOOL ? 'heizlast' : 'klima'}_${state.currentResult.location.id}_${START_YEAR}-${END_YEAR}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function runLocations(locations) {
  if (state.busy) return;

  setBusy(true);

  if (locations.length === 1) {
    state.results = {};
  }

  setStatus('Analyse läuft', 'working');
  setProgress(
    0,
    locations.length * (END_YEAR - START_YEAR + 1),
    'Klimadaten werden vorbereitet …'
  );

  const progressState = {
    done: 0,
    total:
      locations.length * (END_YEAR - START_YEAR + 1),
  };

  try {
    for (const location of locations) {
      if (location.address) syncSharedLocation(state.selectedAddress);
      else syncSharedManualLocation(location);

      const result = await loadLocation(
        location,
        progressState
      );
      state.results[location.id] = result;
      renderResult(result);
    }

    setProgress(
      progressState.total,
      progressState.total,
      'Analyse erfolgreich abgeschlossen.'
    );
    setStatus('Analyse abgeschlossen', 'success');
  } catch (error) {
    console.error(error);
    setStatus('Analyse nicht möglich', 'error');
    elements.progressText.textContent =
      `${error.message} Bitte Internetverbindung und Standortdaten prüfen und die Analyse erneut starten.`;
  } finally {
    setBusy(false);
  }
}


[
  elements.annualConsumption,
  elements.usefulHeatFactor,
  elements.hotWaterIncluded,
  elements.persons,
  elements.heatedArea,
  elements.buildingCondition,
  elements.installedMaximum,
  elements.installedMinimum,
  elements.hwbValue,
  elements.hwbBgf,
].forEach((element) => {
  element.addEventListener('input', () => {
    renderHeatingCalculation();
    syncSharedInputs();
  });
  element.addEventListener('change', () => {
    renderHeatingCalculation();
    syncSharedInputs();
  });
});

if (elements.heatingLimitTemperature) {
  const commitHeatingLimitManual = () => {
    const rawValue = Number(elements.heatingLimitTemperature.value);
    if (!Number.isFinite(rawValue)) return;
    const value = clampHeatingLimit(rawValue);
    elements.heatingLimitTemperature.value = String(value);
    state.heatingLimitManual = true;
    projectStore?.setFieldCandidate(
      HEATING_LIMIT_PATH,
      projectModel.ORIGIN.MANUAL,
      value,
      { unit: '°C', source: 'Nutzereingabe Heizlast' }
    );
    renderHeatingCalculation();
  };
  elements.heatingLimitTemperature.addEventListener('change', commitHeatingLimitManual);
  elements.heatingLimitTemperature.addEventListener('blur', commitHeatingLimitManual);
}

elements.useHeatingLimitSuggestion?.addEventListener('click', () => {
  projectStore?.clearFieldCandidate(HEATING_LIMIT_PATH, projectModel.ORIGIN.MANUAL);
  state.heatingLimitManual = false;
  if (elements.heatingLimitTemperature) {
    elements.heatingLimitTemperature.value = String(state.heatingLimitSuggestionC ?? 15);
  }
  renderHeatingCalculation();
});


function printReport() {
  if (!state.currentResult) return;
  renderHeatingCalculation();
  window.print();
}

window.addEventListener('beforeprint', () => {
  if (!state.currentResult) return;
  elements.printReportDate.textContent = currentDateLabel();
  elements.printReportDate2.textContent = currentDateLabel();
  renderHeatingCalculation();
});

elements.printButton?.addEventListener('click', printReport);
elements.printButtonBottom?.addEventListener('click', printReport);
window.addEventListener('energy-tools:prepare-print', () => {
  if (!state.currentResult) return;
  if (!IS_CLIMATE_TOOL) renderHeatingCalculation();
});


const debouncedAddressSearch = debounce(runAddressSearch);

elements.addressSearchInput.addEventListener(
  'input',
  () => {
    // Die bisherige Projektadresse bleibt aktiv, bis tatsächlich ein anderer Treffer
    // ausgewählt und im gemeinsamen Dialog bestätigt wurde. So kann jederzeit gesucht
    // werden, ohne das laufende Projekt bereits während des Tippens zu verändern.
    if (
      state.selectedAddress &&
      elements.addressSearchInput.value !== state.selectedAddress.label
    ) {
      elements.addressSearchStatus.textContent =
        'Andere Adresse suchen – das aktuelle Projekt bleibt bis zur Auswahl unverändert.';
    }
    updateAnalyzeAvailability();
    debouncedAddressSearch();
  }
);

elements.addressSearchInput.addEventListener(
  'keydown',
  (event) => {
    if (event.key === 'Escape') {
      closeAddressSuggestions();
    }
  }
);

elements.clearAddressButton.addEventListener(
  'click',
  () => clearSelectedAddress()
);

document.addEventListener('click', (event) => {
  if (
    !elements.addressSuggestions.contains(event.target) &&
    event.target !== elements.addressSearchInput
  ) {
    closeAddressSuggestions();
  }
});


[
  elements.siteLabelInput,
  elements.latitudeInput,
  elements.longitudeInput,
].forEach((element) => {
  element.addEventListener('input', () => {
    if (!state.selectedAddress) return;

    const latitude = Number(elements.latitudeInput.value);
    const longitude = Number(elements.longitudeInput.value);

    const differs =
      elements.siteLabelInput.value !==
        state.selectedAddress.label ||
      Math.abs(latitude - state.selectedAddress.latitude) >
        0.000001 ||
      Math.abs(longitude - state.selectedAddress.longitude) >
        0.000001;

    if (differs) {
      state.selectedAddress = null;
      state.selectedNatReference = null;
      state.selectedTnat13Reference = null;
      clearMultiKgChoice();
      elements.selectedAddressCard.hidden = true;
      elements.manualLocationMode.checked = true;
      elements.addressSearchStatus.textContent =
        'Standortdaten wurden manuell geändert.';
      updateAnalyzeAvailability();
    }
  });
});


elements.manualLocationMode.addEventListener('change', () => {
  if (elements.manualLocationMode.checked) {
    elements.addressSearchStatus.textContent =
      'Manueller Standortmodus aktiv.';
  } else if (!state.selectedAddress) {
    elements.addressSearchStatus.textContent =
      'Bitte eine Adresse auswählen.';
  }

  updateAnalyzeAvailability();
});

[
  elements.siteLabelInput,
  elements.latitudeInput,
  elements.longitudeInput,
  elements.natInput,
  elements.natReferenceHeightInput,
].forEach((element) => {
  element.addEventListener('input', updateAnalyzeAvailability);
});

elements.locationSelect.addEventListener('change', () => {
  populateLocationInputs(elements.locationSelect.value);
});

elements.retryHeightButton.addEventListener(
  'click',
  retryHeightCheck
);

elements.loadSelectedButton.addEventListener('click', () => {
  try {
    runLocations([readSelectedLocation()]);
  } catch (error) {
    setStatus('Standortdaten prüfen', 'error');
    elements.progressText.textContent = error.message;
  }
});

elements.loadAllButton.addEventListener('click', () => {
  runLocations(Object.values(LOCATIONS));
});

elements.clearCacheButton.addEventListener('click', async () => {
  setBusy(true);
  try {
    await cacheClear();
    state.results = {};
    state.currentResult = null;
    elements.resultsSection.hidden = true;
    elements.heatingLoadCard.hidden = true;
    setProgress(0, 1, 'Zwischenspeicher wurde gelöscht.');
    setStatus('Cache geleert', 'success');
  } catch (error) {
    setStatus('Cache konnte nicht gelöscht werden', 'error');
    elements.progressText.textContent = error.message;
  } finally {
    setBusy(false);
  }
});

elements.downloadButton.addEventListener('click', downloadJson);


window.addEventListener('energy-tools:project-imported', (event) => {
  hydrateSharedProject(event.detail?.project);
});

window.addEventListener('energy-tools:project-reset', () => {
  projectHydrating = true;
  try {
    clearSelectedAddress({ clearInput: true });
    restoreSharedInputs({});
    state.results = {};
    state.currentResult = null;
    state.heatingCalculation = null;
    elements.resultsSection.hidden = true;
    elements.heatingLoadCard.hidden = true;
  } finally {
    projectHydrating = false;
  }
  updateAnalyzeAvailability();
});

async function initializeTool() {
  await initializeClimatePeriod();
  populateLocationInputs(elements.locationSelect.value);
  resetProductionLocationFields();
  try {
    await initializeAddressProvider();
  } finally {
    hydrateSharedProject();
    updateAnalyzeAvailability();
  }
}

initializeTool();
