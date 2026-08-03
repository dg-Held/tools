'use strict';

(function initEnergyToolsProjectStore(global) {
  const STORAGE_KEY = 'energy-tools-project-v1';
  const listeners = new Set();
  const model = global.EnergyToolsDataModel;
  const migrations = global.EnergyToolsProjectMigrations;
  const resolver = global.EnergyToolsValueResolver;

  if (!model || !migrations || !resolver) {
    console.error('Project Store: Data Model, Migration oder Value Resolver fehlt.');
    return;
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function merge(target, patch) {
    if (!isPlainObject(patch)) return clone(patch);
    const out = isPlainObject(target) ? { ...target } : {};
    for (const [key, value] of Object.entries(patch)) {
      out[key] = isPlainObject(value)
        ? merge(out[key], value)
        : clone(value);
    }
    return out;
  }

  function normalize(project) {
    return resolver.resolveDeep(migrations.migrate(project));
  }

  function load() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return normalize(model.emptyProject());
      return normalize(JSON.parse(raw));
    } catch (error) {
      console.warn('Projektdaten konnten nicht geladen werden.', error);
      return normalize(model.emptyProject());
    }
  }

  let state = load();
  let batchDepth = 0;
  let changedInBatch = false;

  function notify() {
    const snapshot = clone(state);
    listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('Fehler in Project-Store-Abonnent.', error);
      }
    });
    global.dispatchEvent(new CustomEvent('energy-tools:project-changed', {
      detail: { project: snapshot },
    }));
  }

  function persist({ notifyListeners = true } = {}) {
    state.project.updatedAt = new Date().toISOString();
    state = normalize(state);
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Projektdaten konnten nicht gespeichert werden.', error);
      global.dispatchEvent(new CustomEvent('energy-tools:storage-error', {
        detail: { error },
      }));
      throw error;
    }

    if (batchDepth > 0) {
      changedInBatch = true;
    } else if (notifyListeners) {
      notify();
    }
  }

  function get() {
    return clone(state);
  }

  function getPath(path, fallback = undefined) {
    const parts = String(path).split('.').filter(Boolean);
    let cursor = state;
    for (const part of parts) {
      if (cursor === null || cursor === undefined) return fallback;
      cursor = cursor[part];
    }
    return cursor === undefined ? fallback : clone(cursor);
  }

  function patch(patchValue) {
    state = merge(state, patchValue);
    persist();
    return get();
  }

  function setPath(path, value) {
    const parts = String(path).split('.').filter(Boolean);
    if (!parts.length) return get();
    let cursor = state;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const key = parts[index];
      if (!isPlainObject(cursor[key])) cursor[key] = {};
      cursor = cursor[key];
    }
    cursor[parts.at(-1)] = clone(value);
    persist();
    return get();
  }

  function setFieldCandidate(path, origin, value, options = {}) {
    const current = getPath(path, null);
    const next = resolver.withCandidate(current, origin, value, options);
    return setPath(path, next);
  }

  function clearFieldCandidate(path, origin = model.ORIGIN.MANUAL) {
    const current = getPath(path, null);
    if (!resolver.isField(current)) return get();
    return setPath(path, resolver.withoutCandidate(current, origin));
  }


  function assignPathWithoutPersist(path, value) {
    const parts = String(path).split('.').filter(Boolean);
    if (!parts.length) return;
    let cursor = state;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const key = parts[index];
      if (!isPlainObject(cursor[key])) cursor[key] = {};
      cursor = cursor[key];
    }
    cursor[parts.at(-1)] = clone(value);
  }

  function setFieldCandidates(updates = []) {
    for (const update of updates) {
      if (!update?.path || !update?.origin) continue;
      const current = getPath(update.path, null);
      const next = resolver.withCandidate(
        current,
        update.origin,
        update.value,
        update.options ?? {}
      );
      assignPathWithoutPersist(update.path, next);
    }
    persist();
    return get();
  }

  function reset() {
    state = normalize(model.emptyProject());
    persist();
    return get();
  }

  function newProject({ title = '', id = '' } = {}) {
    state = normalize(model.emptyProject());
    state.project.title = title;
    state.project.id = id;
    persist();
    return get();
  }

  function exportJson() {
    return JSON.stringify(state, null, 2);
  }

  function importJson(text) {
    const parsed = JSON.parse(text);
    if (parsed?.schema !== 'energy-tools-project') {
      throw new Error('Die Datei ist kein kompatibles Energie-Tools-Projekt.');
    }
    state = normalize(parsed);
    persist();
    return get();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function batch(callback) {
    batchDepth += 1;
    try {
      return callback();
    } finally {
      batchDepth -= 1;
      if (batchDepth === 0 && changedInBatch) {
        changedInBatch = false;
        notify();
      }
    }
  }

  global.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || event.newValue === null) return;
    try {
      state = normalize(JSON.parse(event.newValue));
      notify();
    } catch (error) {
      console.warn('Externe Projektänderung konnte nicht übernommen werden.', error);
    }
  });

  global.EnergyToolsProjectStore = Object.freeze({
    STORAGE_KEY,
    get,
    getPath,
    patch,
    setPath,
    setFieldCandidate,
    clearFieldCandidate,
    setFieldCandidates,
    reset,
    newProject,
    exportJson,
    importJson,
    subscribe,
    batch,
  });
})(window);
