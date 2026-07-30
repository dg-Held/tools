'use strict';

(function initEnergyToolsDataModel(global) {
  const ORIGIN = Object.freeze({
    OFFICIAL: 'official',
    DERIVED: 'derived',
    MANUAL: 'manual',
    FALLBACK: 'fallback',
  });

  function field(value = null, options = {}) {
    return {
      value,
      unit: options.unit ?? null,
      origin: options.origin ?? ORIGIN.MANUAL,
      source: options.source ?? null,
      sourceUrl: options.sourceUrl ?? null,
      dataDate: options.dataDate ?? null,
      method: options.method ?? null,
      quality: options.quality ?? null,
      automaticValue: options.automaticValue ?? null,
      manualValue: options.manualValue ?? null,
      updatedAt: new Date().toISOString(),
    };
  }

  function emptyProject() {
    return {
      schema: 'energy-tools-project',
      schemaVersion: 1,
      project: {
        title: '',
        id: '',
        addressLabel: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      location: {},
      building: {},
      user: {},
      modules: {
        standortpass: {},
        klimaHeizlast: {},
        energiefluss: {},
        wirtschaftlichkeit: {},
      },
      metadata: {
        app: 'Standortpass Energie & Gebäude',
        appVersion: '1.1.0-prototype',
      },
    };
  }

  global.EnergyToolsDataModel = Object.freeze({ ORIGIN, field, emptyProject });
})(window);
