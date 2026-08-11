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
    const STOREY_HEIGHT_MODULE_M = 3.2;
    const USABLE_TO_GROSS_FACTOR = 0.75;
    const DEFAULT_WINDOW_SHARE_PERCENT = 20;

    function selected(path, fallback = null) {
      return finiteNumber(resolver.value(getPath(path, null), fallback));
    }

    function candidate(path, origin) {
      const current = getPath(path, null);
      return resolver.isField(current) ? current.candidates?.[origin] ?? null : null;
    }

    function candidateNumber(path, origin) {
      return finiteNumber(candidate(path, origin)?.value);
    }

    function sameCandidate(path, origin, value, method) {
      const currentCandidate = candidate(path, origin);
      return finiteNumber(currentCandidate?.value) === finiteNumber(value)
        && (method === undefined || currentCandidate?.method === method);
    }

    function setCandidate(path, origin, value, options = {}) {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return;
      if (sameCandidate(path, origin, value, options.method)) return;
      const current = getPath(path, null);
      assignPathWithoutPersist(path, resolver.withCandidate(current, origin, value, options));
    }

    function setOrClearCandidate(path, origin, value, options = {}) {
      const current = getPath(path, null);
      const next = value === null || value === undefined || value === ''
        ? resolver.withoutCandidate(current, origin)
        : resolver.withCandidate(current, origin, value, options);
      assignPathWithoutPersist(path, next);
    }

    function timestamp(candidateValue) {
      const value = Date.parse(candidateValue?.updatedAt || '');
      return Number.isFinite(value) ? value : 0;
    }

    // Diese zwei Werte sind bewusste, feste Erstannahmen des Standortpasses.
    // Alte manuelle Varianten werden entfernt, damit alle Tools dieselbe Kette verwenden.
    setOrClearCandidate('building.geometry.storeyHeightModule', model.ORIGIN.MANUAL, null);
    setOrClearCandidate('building.geometry.usableFloorAreaFactor', model.ORIGIN.MANUAL, null);
    setCandidate('building.geometry.storeyHeightModule', model.ORIGIN.FALLBACK, STOREY_HEIGHT_MODULE_M, {
      unit: 'm', source: 'Gemeinsame Gebäudeableitung', method: 'feste Beratungsannahme', modelVersion: 'building-geometry-v1.5',
    });
    setCandidate('building.geometry.usableFloorAreaFactor', model.ORIGIN.FALLBACK, USABLE_TO_GROSS_FACTOR * 100, {
      unit: '%', source: 'Gemeinsame Gebäudeableitung', method: 'feste Beratungsannahme; kein allgemeiner Normwert', modelVersion: 'building-geometry-v1.5',
    });
    setCandidate('building.geometry.windowSharePercent', model.ORIGIN.FALLBACK, DEFAULT_WINDOW_SHARE_PERCENT, {
      unit: '%', source: 'Gemeinsame Gebäudeableitung', method: 'Fensteranteil an der technischen Brutto-Fassade', modelVersion: 'building-geometry-v1.5',
    });

    const footprintArea = selected('building.geometry.footprintArea');
    const perimeter = selected('building.geometry.perimeter');
    const medianHeight = selected('building.geometry.heightMedian');
    const windowSharePercent = Math.max(0, Math.min(100, selected('building.geometry.windowSharePercent', DEFAULT_WINDOW_SHARE_PERCENT) ?? DEFAULT_WINDOW_SHARE_PERCENT));
    const roofPitch = Math.max(0, Math.min(89, selected('building.geometry.roofPitch', 0) ?? 0));

    const automaticStoreys = medianHeight > 0
      ? Math.max(1, Math.round(medianHeight / STOREY_HEIGHT_MODULE_M))
      : null;
    const automaticGrossFloorArea = footprintArea > 0 && automaticStoreys > 0
      ? roundToStep(footprintArea * automaticStoreys, 10)
      : null;
    const automaticUsableFloorArea = automaticGrossFloorArea > 0
      ? roundToStep(automaticGrossFloorArea * USABLE_TO_GROSS_FACTOR, 5)
      : null;
    const automaticExteriorWall = perimeter > 0 && medianHeight > 0
      ? roundToStep(perimeter * medianHeight, 10)
      : null;
    const automaticWindowArea = automaticExteriorWall > 0
      ? roundToStep(automaticExteriorWall * DEFAULT_WINDOW_SHARE_PERCENT / 100, 5)
      : null;
    const automaticOpaqueExteriorWall = automaticExteriorWall > 0 && automaticWindowArea !== null
      ? Math.max(0, roundToStep(automaticExteriorWall - automaticWindowArea, 5))
      : null;
    const automaticGrossVolume = footprintArea > 0 && medianHeight > 0
      ? roundToStep(footprintArea * medianHeight, 10)
      : null;

    const referenceSource = 'Gemeinsame Gebäudeautomatik';
    const referenceOptions = { source: referenceSource, modelVersion: 'building-geometry-v1.5', quality: 'automatische Referenz ohne manuelle Korrekturen' };
    if (automaticStoreys !== null) setCandidate('building.geometry.reference.storeysAboveGround', model.ORIGIN.DERIVED, automaticStoreys, {
      ...referenceOptions, unit: 'Geschoße', method: 'Medianhöhe / 3,2 m, ganzzahlig gerundet',
    });
    if (automaticGrossFloorArea !== null) setCandidate('building.geometry.reference.grossFloorArea', model.ORIGIN.DERIVED, automaticGrossFloorArea, {
      ...referenceOptions, unit: 'm²', method: 'Dachprojektion × automatische Geschoßzahl',
    });
    if (automaticUsableFloorArea !== null) {
      setCandidate('building.geometry.reference.usableFloorArea', model.ORIGIN.DERIVED, automaticUsableFloorArea, {
        ...referenceOptions, unit: 'm²', method: 'automatische BGF × 0,75',
      });
      setCandidate('building.geometry.reference.heatedFloorArea', model.ORIGIN.DERIVED, automaticUsableFloorArea, {
        ...referenceOptions, unit: 'm²', method: 'automatische Nutzfläche × 100 % beheizter Anteil',
      });
    }
    if (automaticExteriorWall !== null) setCandidate('building.geometry.reference.exteriorWallGrossArea', model.ORIGIN.DERIVED, automaticExteriorWall, {
      ...referenceOptions, unit: 'm²', method: 'TIRIS-Umfang × Medianhöhe',
    });
    if (automaticWindowArea !== null) setCandidate('building.geometry.reference.windowArea', model.ORIGIN.DERIVED, automaticWindowArea, {
      ...referenceOptions, unit: 'm²', method: 'automatische Brutto-Fassade × 20 %',
    });
    if (automaticOpaqueExteriorWall !== null) setCandidate('building.geometry.reference.opaqueExteriorWallArea', model.ORIGIN.DERIVED, automaticOpaqueExteriorWall, {
      ...referenceOptions, unit: 'm²', method: 'automatische Brutto-Fassade − Fensterfläche',
    });
    if (footprintArea > 0) {
      for (const [key, method] of [
        ['topFloorArea', 'Dachprojektion'],
        ['basementCeilingArea', 'Dachprojektion'],
        ['groundFloorArea', 'Dachprojektion'],
        ['roofSlopeArea', 'Dachprojektion bei 0°'],
      ]) {
        setCandidate(`building.geometry.reference.${key}`, model.ORIGIN.DERIVED, roundToStep(footprintArea, 10), {
          ...referenceOptions, unit: 'm²', method,
        });
      }
    }
    if (automaticGrossVolume !== null) setCandidate('building.geometry.reference.grossVolume', model.ORIGIN.DERIVED, automaticGrossVolume, {
      ...referenceOptions, unit: 'm³', method: 'Dachprojektion × Medianhöhe', quality: 'äußeres geometrisches Bruttovolumen',
    });

    // Verwendete Kette: Geschoße und NFL sind die wichtigsten Prüfeingaben.
    if (automaticStoreys !== null) setCandidate('building.geometry.storeysAboveGround', model.ORIGIN.DERIVED, automaticStoreys, {
      unit: 'Geschoße', source: 'Gemeinsame Gebäudeableitung', method: 'Medianhöhe / 3,2 m, ganzzahlig gerundet', modelVersion: 'building-geometry-v1.5', quality: 'Orientierungswert; manuelle Geschoßzahl hat Vorrang',
    });
    const effectiveStoreys = selected('building.geometry.storeysAboveGround', automaticStoreys);
    const manualGrossFloorArea = candidateNumber('building.geometry.grossFloorArea', model.ORIGIN.MANUAL);
    const manualUsableFloorArea = candidateNumber('building.geometry.usableFloorArea', model.ORIGIN.MANUAL);
    const grossFromManualUsable = manualUsableFloorArea > 0 && !(manualGrossFloorArea > 0)
      ? roundToStep(manualUsableFloorArea / USABLE_TO_GROSS_FACTOR, 10)
      : null;
    const grossFromStoreys = footprintArea > 0 && effectiveStoreys > 0
      ? roundToStep(footprintArea * effectiveStoreys, 10)
      : null;
    const derivedGrossFloorArea = grossFromManualUsable ?? grossFromStoreys;
    if (derivedGrossFloorArea !== null) setCandidate('building.geometry.grossFloorArea', model.ORIGIN.DERIVED, derivedGrossFloorArea, {
      unit: 'm²', source: 'Gemeinsame Gebäudeableitung',
      method: grossFromManualUsable !== null ? 'manuelle Nutzfläche / 0,75' : 'Dachprojektion × verwendete Geschoßzahl',
      modelVersion: 'building-geometry-v1.5', quality: 'Orientierungswert; bekannte manuelle BGF hat Vorrang',
    });

    const effectiveGrossFloorArea = selected('building.geometry.grossFloorArea', derivedGrossFloorArea);
    const derivedUsableFloorArea = effectiveGrossFloorArea > 0
      ? roundToStep(effectiveGrossFloorArea * USABLE_TO_GROSS_FACTOR, 5)
      : null;
    if (derivedUsableFloorArea !== null) setCandidate('building.geometry.usableFloorArea', model.ORIGIN.DERIVED, derivedUsableFloorArea, {
      unit: 'm²', source: 'Gemeinsame Gebäudeableitung', method: 'verwendete BGF × 0,75', modelVersion: 'building-geometry-v1.5', quality: 'Orientierungswert; manuelle Nutzfläche hat Vorrang',
    });
    const effectiveUsableFloorArea = selected('building.geometry.usableFloorArea', derivedUsableFloorArea);

    // Beheizter Anteil und beheizte Nutzfläche werden synchron gehalten.
    const sharePath = 'building.thermal.heatedSharePercent';
    const heatedPath = 'building.geometry.heatedFloorArea';
    const manualShareCandidate = candidate(sharePath, model.ORIGIN.MANUAL);
    const manualHeatedCandidate = candidate(heatedPath, model.ORIGIN.MANUAL);
    let manualShare = finiteNumber(manualShareCandidate?.value);
    let manualHeated = finiteNumber(manualHeatedCandidate?.value);
    const heatedWasDerivedFromShare = /Nutzfläche × manueller beheizter Anteil/i.test(String(manualHeatedCandidate?.method || ''));
    const shareIsNewer = heatedWasDerivedFromShare || timestamp(manualShareCandidate) >= timestamp(manualHeatedCandidate);

    if (effectiveUsableFloorArea > 0 && (manualShare !== null || manualHeated !== null)) {
      if (manualShare !== null && (manualHeated === null || shareIsNewer)) {
        manualShare = Math.max(0, Math.min(100, manualShare));
        manualHeated = roundToStep(effectiveUsableFloorArea * manualShare / 100, 5);
        setOrClearCandidate(heatedPath, model.ORIGIN.MANUAL, manualHeated, {
          unit: 'm²', source: manualShareCandidate?.source ?? 'Gemeinsame Gebäudeableitung', method: 'Nutzfläche × manueller beheizter Anteil', modelVersion: 'building-geometry-v1.5',
        });
      } else if (manualHeated !== null) {
        manualHeated = Math.max(0, Math.min(effectiveUsableFloorArea, manualHeated));
        manualShare = Math.round(manualHeated / effectiveUsableFloorArea * 100);
        setOrClearCandidate(heatedPath, model.ORIGIN.MANUAL, manualHeated, {
          ...(manualHeatedCandidate ?? {}), unit: 'm²', source: manualHeatedCandidate?.source ?? 'Nutzereingabe',
          note: finiteNumber(manualHeatedCandidate?.value) > effectiveUsableFloorArea ? 'Auf die verwendete Nutzfläche begrenzt.' : manualHeatedCandidate?.note ?? null,
        });
        setOrClearCandidate(sharePath, model.ORIGIN.MANUAL, manualShare, {
          unit: '%', source: manualHeatedCandidate?.source ?? 'Gemeinsame Gebäudeableitung', method: 'manuelle beheizte Nutzfläche / verwendete Nutzfläche', modelVersion: 'building-geometry-v1.5',
        });
      }
    }

    const effectiveManualShare = candidateNumber(sharePath, model.ORIGIN.MANUAL);
    const derivedHeatedFloorArea = effectiveUsableFloorArea > 0
      ? roundToStep(effectiveUsableFloorArea * Math.max(0, Math.min(100, effectiveManualShare ?? 100)) / 100, 5)
      : null;
    if (derivedHeatedFloorArea !== null) setCandidate(heatedPath, model.ORIGIN.DERIVED, derivedHeatedFloorArea, {
      unit: 'm²', source: 'Gemeinsame Gebäudeableitung', method: 'verwendete Nutzfläche × beheizter Anteil', modelVersion: 'building-geometry-v1.5', quality: 'Orientierungswert',
    });
    const effectiveHeatedFloorArea = selected(heatedPath, derivedHeatedFloorArea);
    if (effectiveUsableFloorArea > 0 && effectiveHeatedFloorArea !== null) {
      const heatedShare = Math.max(0, Math.min(100, effectiveHeatedFloorArea / effectiveUsableFloorArea * 100));
      setCandidate(sharePath, model.ORIGIN.DERIVED, Math.round(heatedShare), {
        unit: '%', source: 'Gemeinsame Gebäudeableitung', method: 'beheizte Nutzfläche / verwendete Nutzfläche', modelVersion: 'building-geometry-v1.5', quality: 'Orientierungswert',
      });
    }

    // Fassaden- und Geschoßflächen folgen der aus BGF und Geschoßzahl verwendeten Grundfläche; das Dach bleibt am TIRIS-Polygon.
    const effectiveFootprint = effectiveGrossFloorArea > 0 && effectiveStoreys > 0
      ? effectiveGrossFloorArea / effectiveStoreys
      : footprintArea;
    const footprintScale = footprintArea > 0 && effectiveFootprint > 0
      ? Math.sqrt(effectiveFootprint / footprintArea)
      : 1;
    const derivedExteriorWall = perimeter > 0 && medianHeight > 0
      ? roundToStep(perimeter * footprintScale * medianHeight, 10)
      : null;
    if (derivedExteriorWall !== null) setCandidate('building.geometry.exteriorWallGrossArea', model.ORIGIN.DERIVED, derivedExteriorWall, {
      unit: 'm²', source: 'Gemeinsame Gebäudeableitung', method: 'TIRIS-Umfang × √(verwendete Grundfläche / TIRIS-Dachprojektion) × Medianhöhe', modelVersion: 'building-geometry-v1.5', quality: 'Orientierungswert; ähnliche Gebäudeform angenommen',
    });
    const effectiveExteriorWall = selected('building.geometry.exteriorWallGrossArea', derivedExteriorWall);
    const derivedWindowArea = effectiveExteriorWall > 0
      ? roundToStep(effectiveExteriorWall * windowSharePercent / 100, 5)
      : null;
    if (derivedWindowArea !== null) setCandidate('building.geometry.windowArea', model.ORIGIN.DERIVED, derivedWindowArea, {
      unit: 'm²', source: 'Gemeinsame Gebäudeableitung', method: 'verwendete technische Brutto-Fassade × Fensteranteil', modelVersion: 'building-geometry-v1.5', quality: 'Orientierungswert',
    });
    const effectiveWindowArea = selected('building.geometry.windowArea', derivedWindowArea);
    if (effectiveExteriorWall > 0 && effectiveWindowArea !== null) setCandidate('building.geometry.opaqueExteriorWallArea', model.ORIGIN.DERIVED, Math.max(0, effectiveExteriorWall - effectiveWindowArea), {
      unit: 'm²', source: 'Gemeinsame Gebäudeableitung', method: 'technische Brutto-Fassade − Fensterfläche; Nutzerwert Außenwand ist opak', modelVersion: 'building-geometry-v1.5', quality: 'Orientierungswert',
    });

    if (effectiveFootprint > 0) {
      const roundedFootprint = roundToStep(effectiveFootprint, 10);
      for (const [path, method] of [
        ['building.geometry.topFloorArea', 'verwendete BGF / Geschoße'],
        ['building.geometry.basementCeilingArea', 'verwendete BGF / Geschoße'],
        ['building.geometry.groundFloorArea', 'verwendete BGF / Geschoße'],
      ]) {
        setCandidate(path, model.ORIGIN.DERIVED, roundedFootprint, {
          unit: 'm²', source: 'Gemeinsame Gebäudeableitung', method, modelVersion: 'building-geometry-v1.5', quality: 'Orientierungswert',
        });
      }
    }

    if (footprintArea > 0) {
      const roofSlopeArea = roofPitch < 89
        ? roundToStep(footprintArea / Math.cos(roofPitch * Math.PI / 180), 10)
        : null;
      if (roofSlopeArea !== null) setCandidate('building.geometry.roofSlopeArea', model.ORIGIN.DERIVED, roofSlopeArea, {
        unit: 'm²', source: 'Gemeinsame Gebäudeableitung', method: 'TIRIS-Dachprojektion / cos(Dachneigung)', modelVersion: 'building-geometry-v1.5', quality: 'Orientierungswert; unabhängig von NFL, BGF und Geschoßzahl',
      });
    }

    const derivedGrossVolume = effectiveFootprint > 0 && medianHeight > 0
      ? roundToStep(effectiveFootprint * medianHeight, 10)
      : automaticGrossVolume;
    if (derivedGrossVolume !== null) setCandidate('building.geometry.grossVolume', model.ORIGIN.DERIVED, derivedGrossVolume, {
      unit: 'm³', source: 'Gemeinsame Gebäudeableitung', method: 'verwendete Grundfläche × Medianhöhe', modelVersion: 'building-geometry-v1.5', quality: 'äußeres geometrisches Bruttovolumen; manueller Volumenwert hat Vorrang',
    });
    const effectiveGrossVolume = selected('building.geometry.grossVolume', derivedGrossVolume);
    const effectiveHeatedShare = selected(sharePath, 100);
    if (effectiveGrossVolume > 0 && effectiveHeatedShare !== null) setCandidate('building.thermal.heatedVolume', model.ORIGIN.DERIVED, roundToStep(effectiveGrossVolume * Math.max(0, Math.min(100, effectiveHeatedShare)) / 100, 10), {
      unit: 'm³', source: 'Gemeinsame Gebäudeableitung', method: 'geometrisches Bruttovolumen × beheizter Anteil', modelVersion: 'building-geometry-v1.5', quality: 'überschlägiges konditioniertes Volumen; kein normatives Luftvolumen',
    });
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
