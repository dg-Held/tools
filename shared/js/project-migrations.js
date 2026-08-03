'use strict';

(function initEnergyToolsProjectMigrations(global) {
  const model = global.EnergyToolsDataModel;
  if (!model) return;

  const VALID_ORIGINS = new Set(Object.values(model.ORIGIN));

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function merge(target, patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;
    const out = { ...(target || {}) };
    for (const [key, value] of Object.entries(patch)) {
      out[key] = value && typeof value === 'object' && !Array.isArray(value)
        ? merge(out[key], value)
        : value;
    }
    return out;
  }

  function looksLikeLegacyField(value) {
    return Boolean(
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      VALID_ORIGINS.has(value.origin) &&
      Object.prototype.hasOwnProperty.call(value, 'value')
    );
  }

  function migrateField(value) {
    if (value?.__type === model.FIELD_TYPE && value.candidates) {
      return model.finalizeField(value);
    }

    const candidates = {};
    const selectedOrigin = VALID_ORIGINS.has(value.origin)
      ? value.origin
      : model.ORIGIN.MANUAL;

    if (model.hasValue(value.value) || value.value === 0) {
      candidates[selectedOrigin] = model.candidate(value.value, value);
    }

    if (model.hasValue(value.automaticValue) || value.automaticValue === 0) {
      const automaticOrigin = selectedOrigin === model.ORIGIN.MANUAL
        ? model.ORIGIN.DERIVED
        : selectedOrigin;
      candidates[automaticOrigin] = model.candidate(value.automaticValue, {
        ...value,
        source: value.automaticSource ?? value.source,
      });
    }

    if (model.hasValue(value.manualValue) || value.manualValue === 0) {
      candidates[model.ORIGIN.MANUAL] = model.candidate(value.manualValue, {
        ...value,
        source: value.manualSource ?? 'Nutzereingabe',
      });
    }

    return model.finalizeField({
      ...value,
      __type: model.FIELD_TYPE,
      candidates,
    });
  }

  function migrateFieldsDeep(value) {
    if (Array.isArray(value)) return value.map(migrateFieldsDeep);
    if (!value || typeof value !== 'object') return value;
    if (value.__type === model.FIELD_TYPE || looksLikeLegacyField(value)) {
      return migrateField(value);
    }

    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = migrateFieldsDeep(item);
    }
    return out;
  }

  function setIfMissing(target, path, value) {
    if (value === undefined || value === null) return;
    const parts = path.split('.');
    let cursor = target;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const key = parts[index];
      if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
      cursor = cursor[key];
    }
    const last = parts.at(-1);
    if (cursor[last] === undefined || cursor[last] === null) cursor[last] = clone(value);
  }

  function migrateLegacyPaths(project) {
    const legacyModule = project.modules?.klimaHeizlast ?? {};
    const legacyInputs = legacyModule.inputs ?? {};

    setIfMissing(project, 'usage.household.persons', project.user?.persons);
    setIfMissing(project, 'building.geometry.heatedFloorArea', project.building?.heatedArea);
    setIfMissing(project, 'consumption.heating.annualEnergy', legacyInputs.annualConsumptionKwh !== undefined
      ? model.field(legacyInputs.annualConsumptionKwh, { unit: 'kWh/a', origin: model.ORIGIN.MANUAL, source: 'Migration Klima & Heizlast' })
      : null);
    setIfMissing(project, 'systems.heating.usefulHeatFactor', legacyInputs.usefulHeatFactor !== undefined
      ? model.field(legacyInputs.usefulHeatFactor, { origin: model.ORIGIN.MANUAL, source: 'Migration Klima & Heizlast' })
      : null);
    setIfMissing(project, 'systems.heating.hotWaterIncluded', legacyInputs.hotWaterIncluded !== undefined
      ? model.field(Boolean(legacyInputs.hotWaterIncluded), { origin: model.ORIGIN.MANUAL, source: 'Migration Klima & Heizlast' })
      : null);
    setIfMissing(project, 'building.thermal.condition', legacyInputs.buildingCondition !== undefined
      ? model.field(legacyInputs.buildingCondition, { origin: model.ORIGIN.MANUAL, source: 'Migration Klima & Heizlast' })
      : null);
    setIfMissing(project, 'systems.heating.installedMaximum', legacyInputs.installedMaximumKw !== undefined
      ? model.field(legacyInputs.installedMaximumKw, { unit: 'kW', origin: model.ORIGIN.MANUAL, source: 'Migration Klima & Heizlast' })
      : null);
    setIfMissing(project, 'systems.heating.installedMinimum', legacyInputs.installedMinimumKw !== undefined && legacyInputs.installedMinimumKw !== null
      ? model.field(legacyInputs.installedMinimumKw, { unit: 'kW', origin: model.ORIGIN.MANUAL, source: 'Migration Klima & Heizlast' })
      : null);
    setIfMissing(project, 'building.thermal.independentHwb', legacyInputs.hwbKwhM2a !== undefined && legacyInputs.hwbKwhM2a !== null
      ? model.field(legacyInputs.hwbKwhM2a, { unit: 'kWh/m²a', origin: model.ORIGIN.MANUAL, source: 'Migration Klima & Heizlast' })
      : null);
    setIfMissing(project, 'building.geometry.grossFloorArea', legacyInputs.bgfM2 !== undefined && legacyInputs.bgfM2 !== null
      ? model.field(legacyInputs.bgfM2, { unit: 'm²', origin: model.ORIGIN.MANUAL, source: 'Migration Klima & Heizlast' })
      : null);

    if (legacyModule.climateSummary && !Object.keys(project.modules?.klima ?? {}).length) {
      project.modules.klima = clone(legacyModule.climateSummary);
    }
    if (legacyModule.resultSummary && !Object.keys(project.modules?.heizlast ?? {}).length) {
      project.modules.heizlast = { resultSummary: clone(legacyModule.resultSummary) };
    }

    delete project.user;
    delete project.building.heatedArea;
    delete project.modules.klimaHeizlast;
    return project;
  }

  function migrate(rawProject) {
    const source = rawProject && typeof rawProject === 'object' ? clone(rawProject) : {};
    const requiresMigration = Number(source.schemaVersion ?? 1) < 2;
    let project = merge(model.emptyProject(), source);
    project = migrateFieldsDeep(project);
    project = migrateLegacyPaths(project);
    project.schema = 'energy-tools-project';
    project.schemaVersion = 2;
    project.metadata = {
      ...(project.metadata ?? {}),
      app: 'Tools für Energieberatung',
      projectSchema: '2.0',
      ...(requiresMigration && !project.metadata?.migratedAt
        ? { migratedAt: new Date().toISOString() }
        : {}),
    };
    return project;
  }

  global.EnergyToolsProjectMigrations = Object.freeze({ migrate, migrateField });
})(window);
