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

  function finiteNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function roundToStep(value, step) {
    const number = finiteNumber(value);
    if (number === null || !(step > 0)) return number;
    return Math.round(number / step) * step;
  }

  function applySharedBuildingDerivations() {
    function selected(path, fallback = null) {
      return finiteNumber(resolver.value(getPath(path, null), fallback));
    }

    function sameCandidate(path, origin, value, method) {
      const current = getPath(path, null);
      const candidate = resolver.isField(current) ? current.candidates?.[origin] : null;
      return finiteNumber(candidate?.value) === finiteNumber(value) && (method === undefined || candidate?.method === method);
    }

    function setCandidate(path, origin, value, options = {}) {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return;
      if (sameCandidate(path, origin, value, options.method)) return;
      const current = getPath(path, null);
      assignPathWithoutPersist(path, resolver.withCandidate(current, origin, value, options));
    }

    const footprintArea = selected('building.geometry.footprintArea');
    const medianHeight = selected('building.geometry.heightMedian');
    const storeyHeightModule = selected('building.geometry.storeyHeightModule', 3.2) ?? 3.2;
    const usableFloorAreaFactor = selected('building.geometry.usableFloorAreaFactor', 75) ?? 75;

    const automaticStoreys = medianHeight > 0
      ? Math.max(1, Math.round(medianHeight / storeyHeightModule))
      : null;
    const automaticGrossFloorArea = footprintArea > 0 && automaticStoreys > 0
      ? roundToStep(footprintArea * automaticStoreys, 10)
      : null;
    const automaticUsableFloorArea = automaticGrossFloorArea > 0
      ? roundToStep(automaticGrossFloorArea * usableFloorAreaFactor / 100, 5)
      : null;
    const automaticGrossVolume = footprintArea > 0 && medianHeight > 0
      ? roundToStep(footprintArea * medianHeight, 10)
      : null;

    const referenceSource = 'Gemeinsame Gebäudeautomatik';
    if (automaticStoreys !== null) setCandidate('building.geometry.reference.storeysAboveGround', model.ORIGIN.DERIVED, automaticStoreys, {
      unit: null,
      source: referenceSource,
      method: 'Medianhöhe / Höhenmodul, ganzzahlig gerundet',
      modelVersion: 'building-geometry-v1.2',
      quality: 'automatische Referenz ohne manuelle Korrekturen',
    });
    if (automaticGrossFloorArea !== null) setCandidate('building.geometry.reference.grossFloorArea', model.ORIGIN.DERIVED, automaticGrossFloorArea, {
      unit: 'm²', source: referenceSource, method: 'Dachprojektion × automatische Geschoßzahl', modelVersion: 'building-geometry-v1.2', quality: 'automatische Referenz',
    });
    if (automaticUsableFloorArea !== null) {
      setCandidate('building.geometry.reference.usableFloorArea', model.ORIGIN.DERIVED, automaticUsableFloorArea, {
        unit: 'm²', source: referenceSource, method: 'automatische BGF × Nutzflächenfaktor', modelVersion: 'building-geometry-v1.2', quality: 'automatische Referenz',
      });
      setCandidate('building.geometry.reference.heatedFloorArea', model.ORIGIN.DERIVED, automaticUsableFloorArea, {
        unit: 'm²', source: referenceSource, method: 'automatische Nutzfläche als Erstannahme', modelVersion: 'building-geometry-v1.2', quality: 'automatische Referenz',
      });
    }
    if (automaticGrossVolume !== null) setCandidate('building.geometry.reference.grossVolume', model.ORIGIN.DERIVED, automaticGrossVolume, {
      unit: 'm³', source: referenceSource, method: 'Dachprojektion × Medianhöhe', modelVersion: 'building-geometry-v1.2', quality: 'äußeres geometrisches Bruttovolumen',
    });

    // Verwendete Kette: manuelle Werte behalten Vorrang, abgeleitete Nachfolger werden aktualisiert.
    if (automaticStoreys !== null) setCandidate('building.geometry.storeysAboveGround', model.ORIGIN.DERIVED, automaticStoreys, {
      unit: null,
      source: 'Gemeinsame Gebäudeableitung',
      method: 'Medianhöhe / Höhenmodul, ganzzahlig gerundet',
      modelVersion: 'building-geometry-v1.2',
      quality: 'Orientierungswert; manuelle Geschoßzahl hat Vorrang',
    });

    const effectiveStoreys = selected('building.geometry.storeysAboveGround', automaticStoreys);
    const derivedGrossFloorArea = footprintArea > 0 && effectiveStoreys > 0
      ? roundToStep(footprintArea * effectiveStoreys, 10)
      : null;
    if (derivedGrossFloorArea !== null) setCandidate('building.geometry.grossFloorArea', model.ORIGIN.DERIVED, derivedGrossFloorArea, {
      unit: 'm²', source: 'Gemeinsame Gebäudeableitung', method: 'Dachprojektion × verwendete Geschoßzahl', modelVersion: 'building-geometry-v1.2', quality: 'Orientierungswert; manuelle BGF hat Vorrang',
    });

    const effectiveGrossFloorArea = selected('building.geometry.grossFloorArea', derivedGrossFloorArea);
    const derivedUsableFloorArea = effectiveGrossFloorArea > 0
      ? roundToStep(effectiveGrossFloorArea * usableFloorAreaFactor / 100, 5)
      : null;
    if (derivedUsableFloorArea !== null) setCandidate('building.geometry.usableFloorArea', model.ORIGIN.DERIVED, derivedUsableFloorArea, {
      unit: 'm²', source: 'Gemeinsame Gebäudeableitung', method: 'verwendete BGF × Nutzflächenfaktor', modelVersion: 'building-geometry-v1.2', quality: 'Orientierungswert; manuelle Nutzfläche hat Vorrang',
    });

    const effectiveUsableFloorArea = selected('building.geometry.usableFloorArea', derivedUsableFloorArea);
    if (effectiveUsableFloorArea > 0) {
      const heatedPath = 'building.geometry.heatedFloorArea';
      const heatedField = getPath(heatedPath, null);
      const heatedManual = resolver.isField(heatedField) ? heatedField.candidates?.[model.ORIGIN.MANUAL] : null;
      if (finiteNumber(heatedManual?.value) > effectiveUsableFloorArea) {
        const originalValue = finiteNumber(heatedManual.value);
        const next = resolver.withCandidate(heatedField, model.ORIGIN.MANUAL, effectiveUsableFloorArea, {
          ...(heatedManual ?? {}),
          unit: 'm²',
          source: heatedManual?.source ?? 'Nutzereingabe',
          note: `Auf die Nutzfläche begrenzt; vorherige Eingabe ${originalValue} m².`,
        });
        assignPathWithoutPersist(heatedPath, next);
      }
      setCandidate(heatedPath, model.ORIGIN.DERIVED, effectiveUsableFloorArea, {
        unit: 'm²', source: 'Gemeinsame Gebäudeableitung', method: 'verwendete Nutzfläche als Erstannahme; maximal gleich Nutzfläche', modelVersion: 'building-geometry-v1.2', quality: 'Orientierungswert; manuelle beheizte Nutzfläche hat Vorrang bis zur Nutzfläche',
      });
    }

    const effectiveHeatedFloorArea = selected('building.geometry.heatedFloorArea', effectiveUsableFloorArea);
    if (effectiveUsableFloorArea > 0 && effectiveHeatedFloorArea !== null) {
      const heatedShare = Math.max(0, Math.min(100, effectiveHeatedFloorArea / effectiveUsableFloorArea * 100));
      setCandidate('building.thermal.heatedSharePercent', model.ORIGIN.DERIVED, Math.round(heatedShare), {
        unit: '%', source: 'Gemeinsame Gebäudeableitung', method: 'beheizte Nutzfläche / Nutzfläche', modelVersion: 'building-geometry-v1.2', quality: 'Orientierungswert; manuelle Angabe hat Vorrang',
      });
    }

    // Äußeres geometrisches Volumen hängt nicht von der Geschoßzahl oder einer manuellen BGF ab.
    if (automaticGrossVolume !== null) setCandidate('building.geometry.grossVolume', model.ORIGIN.DERIVED, automaticGrossVolume, {
      unit: 'm³', source: 'Gemeinsame Gebäudeableitung', method: 'Dachprojektion × Medianhöhe', modelVersion: 'building-geometry-v1.2', quality: 'äußeres geometrisches Bruttovolumen; manueller Volumenwert hat Vorrang',
    });

    // Separates konditioniertes Volumen für spätere Heizlast-/Lüftungsanwendungen.
    const effectiveGrossVolume = selected('building.geometry.grossVolume', automaticGrossVolume);
    const effectiveHeatedShare = selected('building.thermal.heatedSharePercent', 100);
    if (effectiveGrossVolume > 0 && effectiveHeatedShare !== null) {
      setCandidate('building.thermal.heatedVolume', model.ORIGIN.DERIVED, roundToStep(effectiveGrossVolume * Math.max(0, Math.min(100, effectiveHeatedShare)) / 100, 10), {
        unit: 'm³', source: 'Gemeinsame Gebäudeableitung', method: 'geometrisches Bruttovolumen × beheizter Anteil', modelVersion: 'building-geometry-v1.2', quality: 'überschlägiges konditioniertes Volumen; noch kein normatives Luftvolumen',
      });
    }
  }

  function persist({ notifyListeners = true } = {}) {
    state.project.updatedAt = new Date().toISOString();
    applySharedBuildingDerivations();
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
