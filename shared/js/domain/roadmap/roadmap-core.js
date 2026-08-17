'use strict';

(function initRoadmapCore(global) {
  const paths = global.EnergyToolsPaths;
  if (!paths) return;

  const MODEL_VERSION = 'roadmap-core-v0.1';
  const DATA_URLS = Object.freeze({
    cards: `${paths.sharedData}roadmap/cards.json`,
    relations: `${paths.sharedData}roadmap/relations.json`,
    effects: `${paths.sharedData}measures/measure-effects.json`,
  });

  let cache = null;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function fieldValue(value, fallback = null) {
    if (value && typeof value === 'object' && value.__type === 'energy-tools-field') {
      return value.value ?? fallback;
    }
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

  async function loadJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Roadmap-Daten konnten nicht geladen werden (${response.status}).`);
    return response.json();
  }

  async function load() {
    if (cache) return cache;
    const [cards, relations, effects] = await Promise.all([
      loadJson(DATA_URLS.cards),
      loadJson(DATA_URLS.relations),
      loadJson(DATA_URLS.effects),
    ]);
    cache = {
      cards,
      relations,
      effects,
      cardMap: new Map((cards.items ?? []).map((item) => [item.id, item])),
      categoryMap: new Map((cards.categories ?? []).map((item) => [item.id, item])),
    };
    return cache;
  }

  function defaultStages(timeHorizon = null) {
    const variants = {
      now: [
        ['stage-1', 'Etappe 1', 'jetzt'],
        ['stage-2', 'Etappe 2', '2–5 Jahre'],
        ['stage-3', 'Etappe 3', '5–10 Jahre'],
      ],
      '1-3': [
        ['stage-1', 'Etappe 1', '1–3 Jahre'],
        ['stage-2', 'Etappe 2', '3–7 Jahre'],
        ['stage-3', 'Etappe 3', 'später'],
      ],
      '3-10': [
        ['stage-1', 'Etappe 1', '0–3 Jahre'],
        ['stage-2', 'Etappe 2', '3–7 Jahre'],
        ['stage-3', 'Etappe 3', '7–10 Jahre'],
      ],
      later: [
        ['stage-1', 'Etappe 1', 'bei nächster Erneuerung'],
        ['stage-2', 'Etappe 2', 'mittelfristig'],
        ['stage-3', 'Etappe 3', 'langfristig'],
      ],
    };
    const rows = variants[timeHorizon] ?? variants.now;
    return Object.fromEntries(rows.map(([id, title, label], index) => [id, {
      id,
      title,
      order: index + 1,
      timing: { mode: 'relative', horizon: label, fromYear: null, toYear: null },
      note: '',
    }]));
  }

  function emptyRoadmap(timeHorizon = null) {
    return {
      version: 1,
      context: { upcomingWorks: [] },
      stages: defaultStages(timeHorizon),
      items: {},
      updatedAt: null,
    };
  }

  function normalizeRoadmap(value, timeHorizon = null) {
    const base = emptyRoadmap(timeHorizon);
    const source = value && typeof value === 'object' ? clone(value) : {};
    return {
      ...base,
      ...source,
      context: { ...base.context, ...(source.context ?? {}) },
      stages: Object.keys(source.stages ?? {}).length ? source.stages : base.stages,
      items: source.items ?? {},
    };
  }

  function projectMeasureTokens(project) {
    const result = new Set();
    function walk(value, key = '') {
      if (!value || typeof value !== 'object') return;
      if (key) result.add(String(key));
      if (Array.isArray(value)) {
        value.forEach((item) => walk(item));
        return;
      }
      ['id', 'componentId', 'dataId', 'kind'].forEach((prop) => {
        if (value[prop] !== undefined && value[prop] !== null) result.add(String(value[prop]));
      });
      Object.entries(value).forEach(([childKey, child]) => walk(child, childKey));
    }
    walk(project?.measures ?? {});
    return result;
  }

  function isFossilHeating(project) {
    const carrier = getPath(project, 'systems.heating.energyCarrier', null);
    return carrier ? ['oil', 'gas'].includes(String(carrier)) : false;
  }

  function pvState(project) {
    const installed = Boolean(project?.systems?.pv?.installed || project?.modules?.pv?.resultSummary);
    return installed ? 'installed' : 'not-known-or-missing';
  }

  function requiresMajorWork(context) {
    const major = new Set(['roof', 'facade', 'windows', 'heating', 'bathroom', 'layout', 'electrical']);
    return (context?.upcomingWorks ?? []).some((item) => major.has(item));
  }

  function triggerMatches(trigger, project, context) {
    if (trigger.upcomingWork && !(context?.upcomingWorks ?? []).includes(trigger.upcomingWork)) return false;
    if (trigger.adviceReason && project?.advice?.reason !== trigger.adviceReason) return false;
    if (trigger.priority && !(project?.advice?.priorities ?? []).includes(trigger.priority)) return false;
    if (trigger.fossilHeating !== undefined && isFossilHeating(project) !== trigger.fossilHeating) return false;
    if (trigger.pvState && pvState(project) !== trigger.pvState) return false;
    if (trigger.requiresMajorWork !== undefined && requiresMajorWork(context) !== trigger.requiresMajorWork) return false;
    if (trigger.constructionYearBefore !== undefined) {
      const year = Number(getPath(project, 'building.profile.constructionYear', NaN));
      if (!Number.isFinite(year) || !(year < Number(trigger.constructionYearBefore))) return false;
    }
    return true;
  }

  function suggestionWeight(priority) {
    if (priority === 'important') return 50;
    if (priority === 'recommended') return 30;
    return 15;
  }

  function suggest(project, context, data, options = {}) {
    const limit = Math.max(1, Number(options.limit ?? 10));
    const scores = new Map();
    const reasons = new Map();
    const add = (cardId, weight, reason) => {
      if (!data.cardMap.has(cardId)) return;
      scores.set(cardId, (scores.get(cardId) ?? 0) + weight);
      if (reason && !reasons.has(cardId)) reasons.set(cardId, reason);
    };

    (data.relations.suggestionRules ?? []).forEach((rule) => {
      if (!triggerMatches(rule.trigger ?? {}, project, context)) return;
      const base = suggestionWeight(rule.priority);
      (rule.targets ?? []).forEach((cardId, index) => add(cardId, Math.max(1, base - index), rule.reason));
    });

    const tokens = projectMeasureTokens(project);
    (data.cards.items ?? []).forEach((item) => {
      const linked = (item.projectMeasureIds ?? []).some((id) => tokens.has(String(id)));
      if (linked) add(item.id, 80, 'Bereits aus dem gemeinsamen Projektstand vorbereitet.');
    });

    const upcoming = context?.upcomingWorks ?? [];
    if (!upcoming.length) {
      const year = Number(getPath(project, 'building.profile.constructionYear', NaN));
      if (Number.isFinite(year) && year < 2000) {
        ['envelope-wall', 'envelope-roof', 'envelope-windows'].forEach((id, index) => add(id, 22 - index, 'Orientierender Erstvorschlag aus Bauperiode und Zielbild.'));
      }
      add('building-check', 24, 'Eigenständiger Einstieg ohne vorangehende Tools.');
      add('energy-certificate', 17, 'Energetische Ausgangslage und Nachweise bei Bedarf klären.');
    }

    if (upcoming.length >= 2) add('renovation-concept', 45, 'Mehrere anstehende Arbeiten sollten in einem Gesamtkonzept verbunden werden.');

    const sorted = [...scores.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([cardId]) => ({ card: data.cardMap.get(cardId), reason: reasons.get(cardId) ?? '' }));

    return {
      primary: sorted.slice(0, limit),
      additional: sorted.slice(limit),
      all: sorted,
    };
  }

  const UPCOMING_PRIMARY = Object.freeze({
    roof: 'envelope-roof',
    facade: 'envelope-wall',
    windows: 'envelope-windows',
    heating: 'heating-replacement',
    bathroom: 'accessible-bath',
    layout: 'future-housing',
    electrical: 'electrical-infrastructure',
    outdoor: 'outdoor-quality',
  });

  function stageIds(stages) {
    return Object.values(stages ?? {}).sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0)).map((item) => item.id);
  }

  function chooseStage(card, context, stages, selectedIds) {
    const ids = stageIds(stages);
    const first = ids[0] ?? 'stage-1';
    const second = ids[1] ?? first;
    const third = ids[2] ?? second;
    const works = context?.upcomingWorks ?? [];

    const directWork = Object.entries(UPCOMING_PRIMARY).find(([, cardId]) => cardId === card.id)?.[0];
    if (directWork && works.includes(directWork)) return first;

    if (card.type === 'planning' || card.category === 'foundation') return first;
    if (card.category === 'envelope' || card.category === 'resilience') return works.some((w) => ['roof', 'facade', 'windows'].includes(w)) ? first : second;
    if (card.category === 'heating') {
      if (works.includes('heating')) return first;
      return [...selectedIds].some((id) => dataEnvelopeId(id)) ? third : second;
    }
    if (card.id === 'pv-own-use') return works.includes('roof') ? first : third;
    if (card.category === 'electricity') return works.includes('electrical') ? first : third;
    if (['living', 'accessibility', 'health_ecology', 'safety'].includes(card.category)) return first;
    return second;
  }

  function dataEnvelopeId(cardId) {
    return ['envelope-wall', 'envelope-roof', 'envelope-basement', 'envelope-windows', 'thermal-bridges', 'airtightness'].includes(cardId);
  }

  function buildRoadmap(project, context, data, options = {}) {
    const current = normalizeRoadmap(project?.roadmap, project?.advice?.timeHorizon);
    const stages = defaultStages(project?.advice?.timeHorizon);
    const suggestions = suggest(project, context, data, { limit: options.limit ?? 10 });
    const items = {};
    const selectedIds = new Set(suggestions.primary.map((entry) => entry.card.id));

    suggestions.primary.forEach((entry, index) => {
      const card = entry.card;
      const itemId = `roadmap-item-${String(index + 1).padStart(2, '0')}`;
      items[itemId] = {
        id: itemId,
        cardId: card.id,
        type: card.type,
        stageId: chooseStage(card, context, stages, selectedIds),
        linkedMeasureIds: [],
        preparations: [],
        source: 'suggested',
        suggestionReason: entry.reason,
        note: '',
      };
    });

    return {
      ...current,
      version: 1,
      context: { ...(current.context ?? {}), upcomingWorks: [...(context?.upcomingWorks ?? [])] },
      stages,
      items,
      updatedAt: new Date().toISOString(),
    };
  }

  function relationEntries(cardId, data) {
    return (data.relations.relations ?? []).filter((entry) => entry.source === cardId || entry.target === cardId);
  }

  function selectedCardIds(roadmap) {
    return new Set(Object.values(roadmap?.items ?? {}).map((item) => item.cardId));
  }

  function relevantRelations(cardId, roadmap, data, options = {}) {
    const selected = selectedCardIds(roadmap);
    const max = Math.max(1, Number(options.max ?? 4));
    const rows = relationEntries(cardId, data)
      .map((entry) => {
        const otherId = entry.source === cardId ? entry.target : entry.source;
        return { ...entry, otherId, otherCard: data.cardMap.get(otherId) ?? null, otherSelected: selected.has(otherId) };
      })
      .sort((a, b) => {
        const weight = { important: 0, recommended: 1, hint: 2 };
        return (weight[a.strength] ?? 9) - (weight[b.strength] ?? 9) || Number(b.otherSelected) - Number(a.otherSelected);
      });
    return rows.slice(0, max);
  }

  function addCard(roadmap, cardId, type = null) {
    const next = normalizeRoadmap(roadmap);
    if (Object.values(next.items).some((item) => item.cardId === cardId)) return next;
    const number = Object.keys(next.items).length + 1;
    const id = `roadmap-item-${String(number).padStart(2, '0')}-${Date.now().toString(36)}`;
    next.items[id] = { id, cardId, type, stageId: null, linkedMeasureIds: [], preparations: [], source: 'manual', note: '' };
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function moveItem(roadmap, itemId, stageId) {
    const next = normalizeRoadmap(roadmap);
    if (!next.items[itemId]) return next;
    next.items[itemId].stageId = stageId || null;
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function removeItem(roadmap, itemId) {
    const next = normalizeRoadmap(roadmap);
    delete next.items[itemId];
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function futureFitPlan(roadmap, data) {
    const coverage = { envelope: null, technique: null, fossilfree: null, pv: null };
    const orderedStages = stageIds(roadmap?.stages ?? {});
    Object.values(roadmap?.items ?? {}).forEach((item) => {
      const card = data.cardMap.get(item.cardId);
      if (!card || !item.stageId) return;
      (card.futureFit ?? []).forEach((dimension) => {
        if (!(dimension in coverage)) return;
        const old = coverage[dimension];
        if (!old || orderedStages.indexOf(item.stageId) < orderedStages.indexOf(old)) coverage[dimension] = item.stageId;
      });
    });
    return coverage;
  }

  global.EnergyRoadmapCore = Object.freeze({
    MODEL_VERSION,
    DATA_URLS,
    load,
    fieldValue,
    getPath,
    defaultStages,
    emptyRoadmap,
    normalizeRoadmap,
    suggest,
    buildRoadmap,
    relevantRelations,
    addCard,
    moveItem,
    removeItem,
    futureFitPlan,
  });
})(window);
