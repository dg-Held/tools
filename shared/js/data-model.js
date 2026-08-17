'use strict';

(function initEnergyToolsDataModel(global) {
  const FIELD_TYPE = 'energy-tools-field';

  const ORIGIN = Object.freeze({
    OFFICIAL: 'official',
    DERIVED: 'derived',
    MANUAL: 'manual',
    FALLBACK: 'fallback',
  });

  const ORIGIN_PRIORITY = Object.freeze([
    ORIGIN.MANUAL,
    ORIGIN.OFFICIAL,
    ORIGIN.DERIVED,
    ORIGIN.FALLBACK,
  ]);

  function nowIso() {
    return new Date().toISOString();
  }

  function hasValue(value) {
    return value !== null && value !== undefined && value !== '';
  }

  function candidate(value, options = {}) {
    return {
      value: value ?? null,
      source: options.source ?? null,
      sourceUrl: options.sourceUrl ?? null,
      dataDate: options.dataDate ?? null,
      method: options.method ?? null,
      modelVersion: options.modelVersion ?? null,
      quality: options.quality ?? null,
      confidence: options.confidence ?? null,
      note: options.note ?? null,
      updatedAt: options.updatedAt ?? nowIso(),
    };
  }

  function pickCandidate(candidates = {}) {
    for (const origin of ORIGIN_PRIORITY) {
      const item = candidates?.[origin];
      if (item && hasValue(item.value)) return { origin, item };
    }
    return { origin: null, item: null };
  }

  function deriveLegacyValues(candidates = {}) {
    const manual = candidates?.[ORIGIN.MANUAL]?.value ?? null;
    let automatic = null;
    for (const origin of [ORIGIN.OFFICIAL, ORIGIN.DERIVED, ORIGIN.FALLBACK]) {
      if (hasValue(candidates?.[origin]?.value)) {
        automatic = candidates[origin].value;
        break;
      }
    }
    return { manual, automatic };
  }

  function finalizeField(fieldValue) {
    const candidates = fieldValue?.candidates ?? {};
    const selected = pickCandidate(candidates);
    const legacy = deriveLegacyValues(candidates);

    return {
      ...fieldValue,
      __type: FIELD_TYPE,
      value: selected.item?.value ?? null,
      origin: selected.origin ?? fieldValue?.origin ?? null,
      source: selected.item?.source ?? null,
      sourceUrl: selected.item?.sourceUrl ?? null,
      dataDate: selected.item?.dataDate ?? null,
      method: selected.item?.method ?? null,
      modelVersion: selected.item?.modelVersion ?? null,
      quality: selected.item?.quality ?? null,
      confidence: selected.item?.confidence ?? null,
      note: selected.item?.note ?? null,
      automaticValue: legacy.automatic,
      manualValue: legacy.manual,
      updatedAt: selected.item?.updatedAt ?? fieldValue?.updatedAt ?? nowIso(),
      candidates,
    };
  }

  function field(value = null, options = {}) {
    const origin = options.origin ?? ORIGIN.MANUAL;
    const candidates = { ...(options.candidates ?? {}) };

    if (hasValue(value) || value === 0) {
      candidates[origin] = candidate(value, options);
    }

    if (hasValue(options.automaticValue) || options.automaticValue === 0) {
      const automaticOrigin = options.automaticOrigin ?? (
        origin === ORIGIN.MANUAL ? ORIGIN.DERIVED : origin
      );
      candidates[automaticOrigin] = candidate(options.automaticValue, {
        ...options,
        source: options.automaticSource ?? options.source,
      });
    }

    if (hasValue(options.manualValue) || options.manualValue === 0) {
      candidates[ORIGIN.MANUAL] = candidate(options.manualValue, {
        ...options,
        source: options.manualSource ?? 'Nutzereingabe',
      });
    }

    return finalizeField({
      __type: FIELD_TYPE,
      unit: options.unit ?? null,
      candidates,
      updatedAt: nowIso(),
    });
  }

  function emptyProject() {
    const now = nowIso();
    return {
      schema: 'energy-tools-project',
      schemaVersion: 2,
      project: {
        title: '',
        id: '',
        addressLabel: '',
        createdAt: now,
        updatedAt: now,
      },
      location: {
        addressRecord: null,
      },
      building: {
        identity: {},
        geometry: {
          estimates: {},
        },
        thermal: {
          envelope: {},
        },
      },
      usage: {
        household: {},
      },
      consumption: {
        heating: {},
      },
      systems: {
        heating: {},
      },
      advice: {
        reason: null,
        timeHorizon: null,
        budgetBand: null,
        budgetEur: null,
        priorities: [],
      },
      economics: {
        assumptions: {},
        energyPriceOverrides: {},
        latestCalculation: null,
      },
      roadmap: {
        version: 1,
        context: { upcomingWorks: [] },
        stages: {},
        items: {},
        updatedAt: null,
      },
      measures: {},
      scenarios: {
        activeId: 'existing',
        items: {
          existing: {
            id: 'existing',
            title: 'Bestand',
            measureIds: [],
          },
        },
      },
      modules: {
        standortpass: {},
        klima: {},
        heizlast: {},
        energiefluss: {},
        wirtschaftlichkeit: {},
        sanierungsfahrplan: {},
      },
      cache: {},
      metadata: {
        app: 'Tools für Energieberatung',
        projectSchema: '2.0',
      },
    };
  }

  global.EnergyToolsDataModel = Object.freeze({
    FIELD_TYPE,
    ORIGIN,
    ORIGIN_PRIORITY,
    candidate,
    field,
    finalizeField,
    pickCandidate,
    emptyProject,
    hasValue,
  });
})(window);
