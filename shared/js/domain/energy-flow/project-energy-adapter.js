'use strict';

(function initProjectEnergyAdapter(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EnergyProjectEnergyAdapter = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis, function projectEnergyAdapterFactory() {
  const MODEL_VERSION = '0.1.0';

  const DEFAULT_ENVELOPE_DEFINITIONS = Object.freeze([
    { id: 'wall', componentId: 'exteriorWall', dataId: 'wall_external', costModelId: 'wall_wdvs', label: 'Außenwand', areaPath: 'building.geometry.opaqueExteriorWallArea', uPath: 'building.thermal.envelope.exteriorWall.uValue', enabledPath: 'building.thermal.envelope.exteriorWall.enabled', defaultEnabled: true, flowId: 'exteriorWall', boundaryFactor: 1.0, kind: 'insulation' },
    { id: 'top-ceiling', componentId: 'topFloorCeiling', dataId: 'roof_top_ceiling', costModelId: 'top_ceiling', label: 'Oberste Geschoßdecke', areaPath: 'building.geometry.topFloorArea', uPath: 'building.thermal.envelope.topFloorCeiling.uValue', enabledPath: 'building.thermal.envelope.topFloorCeiling.enabled', defaultEnabled: true, flowId: 'topFloorCeiling', boundaryFactor: 0.8, kind: 'insulation' },
    { id: 'roof', componentId: 'roof', dataId: 'roof_top_ceiling', costModelId: 'roof', label: 'Dach / Dachschräge', areaPath: 'building.geometry.roofSlopeArea', uPath: 'building.thermal.envelope.roof.uValue', enabledPath: 'building.thermal.envelope.roof.enabled', defaultEnabled: false, flowId: 'roof', boundaryFactor: 1.0, kind: 'insulation' },
    { id: 'basement', componentId: 'basementCeiling', dataId: 'ceiling_unheated', costModelId: 'basement_ceiling', label: 'Kellerdecke / UG-Decke', areaPath: 'building.geometry.basementCeilingArea', uPath: 'building.thermal.envelope.basementCeiling.uValue', enabledPath: 'building.thermal.envelope.basementCeiling.enabled', defaultEnabled: true, flowId: 'basementCeiling', boundaryFactor: 0.5, kind: 'insulation' },
    { id: 'ground-floor', componentId: 'groundFloor', dataId: 'floor_ground', costModelId: 'ground_floor', label: 'Boden gegen Erdreich', areaPath: 'building.geometry.groundFloorArea', uPath: 'building.thermal.envelope.groundFloor.uValue', enabledPath: 'building.thermal.envelope.groundFloor.enabled', defaultEnabled: false, flowId: 'groundFloor', boundaryFactor: 0.5, kind: 'insulation' },
    { id: 'windows', componentId: 'windows', dataId: 'window_external', costModelId: 'window_replace', label: 'Fenster', areaPath: 'building.geometry.windowArea', uPath: 'building.thermal.envelope.windows.uValue', enabledPath: 'building.thermal.envelope.windows.enabled', defaultEnabled: true, flowId: 'windows', boundaryFactor: 1.0, kind: 'exchange' },
    { id: 'doors', componentId: 'doors', dataId: 'door_external', costModelId: 'door_replace', label: 'Haustür / Außentür', areaPath: 'building.geometry.doorArea', uPath: 'building.thermal.envelope.doors.uValue', enabledPath: 'building.thermal.envelope.doors.enabled', defaultEnabled: true, flowId: 'doors', boundaryFactor: 1.0, kind: 'door' },
  ]);

  function finite(value, fallback = null) {
    if (value === '' || value === null || value === undefined) return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function fieldValue(value, fallback = null) {
    if (value && typeof value === 'object' && value.__type === 'energy-tools-field') return value.value ?? fallback;
    return value ?? fallback;
  }

  function getPath(object, path, fallback = null) {
    let cursor = object;
    for (const key of String(path).split('.').filter(Boolean)) {
      if (cursor === null || cursor === undefined) return fallback;
      cursor = cursor[key];
    }
    return fieldValue(cursor, fallback);
  }

  function periodIdForYear(year, existingUValuesConfig) {
    const y = finite(year, null);
    if (y === null) return null;
    return (existingUValuesConfig?.periods ?? []).find((period) =>
      (period.year_min === undefined || y >= period.year_min)
      && (period.year_max === undefined || y <= period.year_max)
    )?.id ?? null;
  }

  function constructionUValue(project, definition, existingUValuesConfig) {
    const direct = finite(getPath(project, definition.uPath, null), null);
    if (direct !== null && direct > 0) return { value: direct, source: 'Projekt-U-Wert', fallback: false };
    const year = finite(getPath(project, 'building.profile.constructionYear', null), null);
    const periodId = periodIdForYear(year, existingUValuesConfig);
    const key = definition.componentId === 'doors' ? 'exteriorDoor' : definition.componentId;
    const fallback = finite(existingUValuesConfig?.components?.[key]?.values?.[periodId], null);
    return fallback !== null
      ? { value: fallback, source: `Bauperiodenvorschlag ${year ?? ''}`.trim(), fallback: true }
      : { value: null, source: 'U-Wert fehlt', fallback: true };
  }

  function componentEnvelopeRelevant(project, definition) {
    if (!definition.enabledPath) return true;
    return Boolean(getPath(project, definition.enabledPath, definition.defaultEnabled !== false));
  }

  function energyFlowAssumptions(energyFlowDefaults) {
    const a = energyFlowDefaults?.assumptions ?? {};
    return {
      hotWaterKwhPerPerson: finite(a.hot_water_kwh_person_a, 1000),
      internalGainsWM2: finite(a.internal_gains_w_m2, 2.7),
      solarRadiationFactor: finite(a.solar_radiation_factor_kwh_m2a, 175),
      glazingShare: finite(a.glazing_share, 0.7),
      solarUtilizationFactor: finite(a.solar_utilization_factor, 1),
      comparisonGainUtilizationFactor: finite(a.comparison_gain_utilization_factor, 0.55),
      ventilationLossKwhM3a: finite(a.ventilation_loss_kwh_m3a, 10),
      thermalBridgeShare: finite(a.thermal_bridge_share, 0.075),
    };
  }

  function climateForEnergyModel(project, energyFlowDefaults, options = {}) {
    const summary = project?.modules?.klima?.climateSummary;
    const natC = finite(summary?.natC, null);
    const averageFullLoadHours = finite(summary?.metrics?.average_full_load_hours, null);
    if (natC !== null && averageFullLoadHours > 0) {
      return {
        natC,
        averageFullLoadHours,
        balanceTemperatureC: 15,
        period: summary?.period ?? null,
        source: summary?.source ?? 'Projektklima',
        fallback: false,
      };
    }
    const indoorTemperatureC = finite(getPath(project, 'building.thermal.indoorTemperature', energyFlowDefaults?.assumptions?.indoor_temperature_c ?? 22), 22);
    const fallbackNatC = finite(options.fallbackNatC, -12);
    const hgtFallbackKd = finite(options.hgtFallbackKd, 3500);
    const heatingDegreeHoursKh = hgtFallbackKd * 24;
    return {
      natC: fallbackNatC,
      averageFullLoadHours: heatingDegreeHoursKh / Math.max(1, indoorTemperatureC - fallbackNatC),
      balanceTemperatureC: 15,
      period: 'Tirol-Fallback',
      source: `Tirol-Fallback ${new Intl.NumberFormat('de-AT').format(hgtFallbackKd)} Kd/a`,
      fallback: true,
    };
  }

  function energyModelInputs(project, definitions = DEFAULT_ENVELOPE_DEFINITIONS, selected = [], candidate = false, configs = {}) {
    const energyFlowDefaults = configs.energyFlowDefaults ?? null;
    const existingUValuesConfig = configs.existingUValuesConfig ?? null;
    const a = energyFlowDefaults?.assumptions ?? {};
    const heatedFloorAreaM2 = Math.max(0, finite(getPath(project, 'building.geometry.heatedFloorArea', null), finite(getPath(project, 'building.geometry.usableFloorArea', a.heated_floor_area_m2 ?? 120), 120)));
    const grossFloorAreaM2 = Math.max(0, finite(getPath(project, 'building.geometry.grossFloorArea', null), heatedFloorAreaM2 > 0 ? heatedFloorAreaM2 / Math.max(0.1, finite(a.usable_floor_area_factor_percent, 75) / 100) : 0));
    const grossVolumeM3 = Math.max(0, finite(getPath(project, 'building.geometry.grossVolume', null), grossFloorAreaM2 * finite(a.storey_height_m, 3.2)));
    const selectedById = new Map((selected ?? []).map((item) => [item.id, item]));
    const components = (definitions ?? DEFAULT_ENVELOPE_DEFINITIONS)
      .filter((definition) => componentEnvelopeRelevant(project, definition))
      .map((definition) => {
        const item = selectedById.get(definition.id);
        const existing = finite(item?.existingUValue, constructionUValue(project, definition, existingUValuesConfig).value);
        const candidateU = candidate && item && !item.energySavingsManual && finite(item.targetUValue, null) > 0
          ? finite(item.targetUValue, existing)
          : existing;
        return {
          id: definition.componentId,
          label: definition.label,
          enabled: true,
          areaM2: Math.max(0, finite(getPath(project, definition.areaPath, 0), 0)),
          uValue: Math.max(0, finite(candidateU, 0)),
        };
      });
    return {
      annualEnergyKwh: Math.max(0, finite(getPath(project, 'consumption.heating.annualEnergy', 0), 0)),
      usefulHeatFactor: Math.max(0.01, finite(getPath(project, 'systems.heating.usefulHeatFactor', a.useful_heat_factor ?? 0.85), 0.85)),
      hotWaterIncluded: Boolean(getPath(project, 'systems.heating.hotWaterIncluded', a.hot_water_included ?? true)),
      persons: Math.max(0, finite(getPath(project, 'usage.household.persons', a.persons ?? 4), a.persons ?? 4)),
      heatedFloorAreaM2,
      grossFloorAreaM2,
      grossVolumeM3,
      indoorTemperatureC: finite(getPath(project, 'building.thermal.indoorTemperature', a.indoor_temperature_c ?? 22), a.indoor_temperature_c ?? 22),
      heatedSharePercent: finite(getPath(project, 'building.thermal.heatedSharePercent', a.heated_share_percent ?? 100), a.heated_share_percent ?? 100),
      climate: climateForEnergyModel(project, energyFlowDefaults, configs),
      components,
      assumptions: energyFlowAssumptions(energyFlowDefaults),
    };
  }

  function anchoredImpact(project, definitions, selected, configs = {}, anchorCore = null) {
    const core = anchorCore ?? (typeof window !== 'undefined' ? window.EnergyConsumptionAnchorCore : globalThis.EnergyConsumptionAnchorCore);
    if (!core?.compare) throw new Error('EnergyConsumptionAnchorCore fehlt.');
    return core.compare(
      energyModelInputs(project, definitions, selected, false, configs),
      energyModelInputs(project, definitions, selected, true, configs)
    );
  }

  return {
    MODEL_VERSION,
    DEFAULT_ENVELOPE_DEFINITIONS,
    getPath,
    periodIdForYear,
    constructionUValue,
    componentEnvelopeRelevant,
    energyFlowAssumptions,
    climateForEnergyModel,
    energyModelInputs,
    anchoredImpact,
  };
});
