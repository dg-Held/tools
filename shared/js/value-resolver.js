'use strict';

(function initEnergyToolsValueResolver(global) {
  const model = global.EnergyToolsDataModel;
  if (!model) return;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function isField(value) {
    return Boolean(value && typeof value === 'object' && value.__type === model.FIELD_TYPE);
  }

  function resolveField(fieldValue) {
    return isField(fieldValue) ? model.finalizeField(fieldValue) : fieldValue;
  }

  function resolveDeep(value) {
    if (Array.isArray(value)) return value.map(resolveDeep);
    if (!value || typeof value !== 'object') return value;
    if (isField(value)) return resolveField(value);
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = resolveDeep(item);
    return out;
  }

  function value(fieldOrValue, fallback = null) {
    if (!isField(fieldOrValue)) {
      return fieldOrValue ?? fallback;
    }
    const resolved = resolveField(fieldOrValue);
    return resolved.value ?? fallback;
  }

  function automaticValue(fieldOrValue, fallback = null) {
    if (!isField(fieldOrValue)) return fallback;
    return resolveField(fieldOrValue).automaticValue ?? fallback;
  }

  function manualValue(fieldOrValue, fallback = null) {
    if (!isField(fieldOrValue)) return fallback;
    return resolveField(fieldOrValue).manualValue ?? fallback;
  }

  function describe(fieldOrValue) {
    if (!isField(fieldOrValue)) {
      return { value: fieldOrValue ?? null, origin: null, source: null, isManual: false };
    }
    const resolved = resolveField(fieldOrValue);
    return {
      value: resolved.value,
      unit: resolved.unit ?? null,
      origin: resolved.origin,
      source: resolved.source,
      sourceUrl: resolved.sourceUrl,
      dataDate: resolved.dataDate,
      method: resolved.method,
      modelVersion: resolved.modelVersion,
      quality: resolved.quality,
      confidence: resolved.confidence,
      note: resolved.note,
      automaticValue: resolved.automaticValue,
      manualValue: resolved.manualValue,
      isManual: resolved.origin === model.ORIGIN.MANUAL,
      candidates: clone(resolved.candidates),
    };
  }

  function withCandidate(fieldOrValue, origin, nextValue, options = {}) {
    const base = isField(fieldOrValue)
      ? clone(fieldOrValue)
      : model.field(null, { unit: options.unit ?? null });
    base.unit = options.unit ?? base.unit ?? null;
    base.candidates = { ...(base.candidates ?? {}) };

    if (nextValue === null || nextValue === undefined || nextValue === '') {
      delete base.candidates[origin];
    } else {
      base.candidates[origin] = model.candidate(nextValue, options);
    }
    return model.finalizeField(base);
  }

  function withoutCandidate(fieldOrValue, origin) {
    return withCandidate(fieldOrValue, origin, null);
  }

  global.EnergyToolsValueResolver = Object.freeze({
    isField,
    resolveField,
    resolveDeep,
    value,
    automaticValue,
    manualValue,
    describe,
    withCandidate,
    withoutCandidate,
  });
})(window);
