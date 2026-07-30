'use strict';

(function initEnergyToolsProjectStore(global) {
  const STORAGE_KEY = 'energy-tools-project-v1';
  const listeners = new Set();
  const model = global.EnergyToolsDataModel;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
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

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return model.emptyProject();
      return merge(model.emptyProject(), JSON.parse(raw));
    } catch (error) {
      console.warn('Projektdaten konnten nicht geladen werden.', error);
      return model.emptyProject();
    }
  }

  let state = load();

  function notify() {
    const snapshot = clone(state);
    listeners.forEach((listener) => listener(snapshot));
  }

  function save() {
    state.project.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    notify();
  }

  function get() {
    return clone(state);
  }

  function patch(patchValue) {
    state = merge(state, patchValue);
    save();
    return get();
  }

  function setPath(path, value) {
    const parts = String(path).split('.').filter(Boolean);
    if (!parts.length) return get();
    let cursor = state;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const key = parts[index];
      if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
      cursor = cursor[key];
    }
    cursor[parts.at(-1)] = value;
    save();
    return get();
  }

  function reset() {
    state = model.emptyProject();
    save();
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
    state = merge(model.emptyProject(), parsed);
    save();
    return get();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  global.EnergyToolsProjectStore = Object.freeze({
    STORAGE_KEY,
    get,
    patch,
    setPath,
    reset,
    exportJson,
    importJson,
    subscribe,
  });
})(window);
