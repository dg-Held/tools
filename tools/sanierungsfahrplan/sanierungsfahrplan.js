'use strict';

(function initSanierungsfahrplan(global) {
  const store = global.EnergyToolsProjectStore;
  const model = global.EnergyToolsDataModel;
  const resolver = global.EnergyToolsValueResolver;
  const paths = global.EnergyToolsPaths;
  const roadmapCore = global.EnergyRoadmapCore;
  const addressManager = global.EnergyToolsAddressManager;
  const geometryService = global.EnergyToolsBuildingGeometryService;

  if (!store || !model || !resolver || !paths || !roadmapCore || !addressManager || !geometryService) {
    console.error('Sanierungsfahrplan: gemeinsame Projektbasis oder Roadmap-Core fehlt.');
    return;
  }

  const $ = (id) => document.getElementById(id);
  const number0 = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 0 });
  const TYPE_LABEL = { measure: 'Maßnahme', planning: 'Planungspunkt', future: 'Zukunftsthema' };
  const PRIORITY_LABEL = {
    costs: '€ Kosten', comfort: '♡ Komfort & Gesundheit', climate: '♻ Klimaschutz',
    independence: '⚡ Autarkie & Sicherheit', value: '⌂ Werterhalt', effort: '⚒ geringer Aufwand',
  };
  const BUDGET_LABEL = { lt25: '< 25 T€', '25-50': '25–50 T€', '50-100': '50–100 T€', gt100: '> 100 T€', open: 'offen' };
  const REASON_LABEL = { costs: 'Kosten senken', renewal: 'Bauteil ohnehin sanieren', heating: 'Heizung erneuern', full: 'Gesamtsanierung', comfort: 'Komfort', open: 'noch offen' };
  const TIME_LABEL = { now: 'jetzt', '1-3': '1–3 Jahre', '3-7': '3–7 Jahre', '3-10': '3–7 Jahre', later: 'langfristig' };
  const RELATION_LABEL = { before: 'vorher berücksichtigen', together: 'sinnvoll gemeinsam', prepare: 'jetzt vorbereiten', check: 'gemeinsam prüfen', avoid_lock_in: 'nicht verbauen', suggest: 'mitdenken' };
  const EFFECT_LABEL = { comfort: 'Komfort', health: 'Wohngesundheit', climate: 'Klimaschutz', independence: 'Unabhängigkeit', value: 'Werterhalt', effort: 'Umsetzungsaufwand', summer: 'Sommerkomfort', ecology: 'Ökologie', resilience: 'Resilienz' };
  const LEVEL_LABEL = { low: 'eher gering', medium: 'positiv', high: 'deutlich positiv', variable: 'objektabhängig' };

  let data = null;
  let energyPrices = null;
  let hybridAddressProvider = null;
  let pendingAddress = null;
  let addressTimer = null;
  let addressSequence = 0;
  let selectedItemId = null;
  let openStageId = null;

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
  function finite(value, fallback = null) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
  function valueAt(project, path, fallback = null) { return roadmapCore.getPath(project, path, fallback); }
  function fieldAt(project, path) {
    let cursor = project;
    for (const key of String(path).split('.').filter(Boolean)) cursor = cursor?.[key];
    return cursor ?? null;
  }
  function sourceOf(field, fallback = 'noch offen') {
    if (!field || typeof field !== 'object' || field.__type !== model.FIELD_TYPE) return fallback;
    const origin = { manual: 'manuell', official: 'amtlich', derived: 'abgeleitet', fallback: 'Fallback' }[field.origin] ?? field.origin;
    return field.source ? `${origin} · ${field.source}` : (origin || fallback);
  }
  function activeUpcoming(project) { return (project?.roadmap?.context?.upcomingWorks ?? []).filter((item) => item !== 'open'); }
  function normalizedRoadmap(project) { return roadmapCore.normalizeRoadmap(project?.roadmap, project?.advice?.timeHorizon); }
  function orderedStages(roadmap) { return Object.values(roadmap?.stages ?? {}).sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0)); }
  function itemsForStage(roadmap, stageId) {
    const typeOrder = { measure: 0, planning: 1, future: 2 };
    return Object.values(roadmap?.items ?? {}).filter((item) => item.stageId === stageId).sort((a, b) => {
      const explicit = Number(a.order ?? Number.POSITIVE_INFINITY) - Number(b.order ?? Number.POSITIVE_INFINITY);
      if (Number.isFinite(explicit) && explicit !== 0) return explicit;
      const cardA = cardById(a.cardId);
      const cardB = cardById(b.cardId);
      return (typeOrder[cardA?.type] ?? 9) - (typeOrder[cardB?.type] ?? 9) || String(cardA?.title ?? a.cardId).localeCompare(String(cardB?.title ?? b.cardId), 'de');
    });
  }
  function itemById(roadmap, itemId) { return roadmap?.items?.[itemId] ?? null; }
  function cardById(cardId) { return data?.cardMap?.get(cardId) ?? null; }

  async function loadJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Daten konnten nicht geladen werden (${response.status}).`);
    return response.json();
  }

  async function loadConfigs() {
    data = await roadmapCore.load();
    energyPrices = await loadJson(`${paths.sharedData}economics/energy-prices.json`);
  }

  function writeManualField(path, value, unit = null) {
    store.setFieldCandidate(path, model.ORIGIN.MANUAL, value, { unit, source: 'Sanierungsfahrplan' });
  }

  function carrierLabel(carrierId) {
    return (energyPrices?.items ?? []).find((item) => item.id === carrierId)?.label ?? (carrierId || '–');
  }

  function populateCarrier(project) {
    const select = $('inputCarrier');
    if (!select) return;
    select.innerHTML = `<option value="">noch offen</option>${(energyPrices?.items ?? []).filter((item) => item.active !== false).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join('')}`;
    select.value = valueAt(project, 'systems.heating.energyCarrier', '') || '';
  }

  function renderChoiceGroup(id, selected, multiple = false) {
    $(id)?.querySelectorAll('button[data-value]').forEach((button) => {
      const active = multiple ? (selected ?? []).includes(button.dataset.value) : selected === button.dataset.value;
      button.classList.toggle('is-selected', active);
    });
  }

  function renderBasis(project) {
    const yearField = fieldAt(project, 'building.profile.constructionYear');
    const areaField = fieldAt(project, 'building.geometry.heatedFloorArea');
    const carrierField = fieldAt(project, 'systems.heating.energyCarrier');
    const year = finite(valueAt(project, 'building.profile.constructionYear', null), null);
    const area = finite(valueAt(project, 'building.geometry.heatedFloorArea', null), null);
    const carrier = valueAt(project, 'systems.heating.energyCarrier', null);
    const energy = finite(valueAt(project, 'consumption.heating.annualEnergy', null), null);
    const heatingYear = finite(valueAt(project, 'systems.heating.installationYear', null), null);

    $('basisYear').textContent = year ? String(year) : '–';
    $('basisYearSource').textContent = sourceOf(yearField);
    $('basisArea').textContent = area ? `${number0.format(area)} m²` : '–';
    $('basisAreaSource').textContent = sourceOf(areaField);
    $('basisHeating').textContent = carrier ? carrierLabel(carrier) : '–';
    $('basisHeatingSource').textContent = sourceOf(carrierField);

    const known = [year, area, carrier].filter((value) => value !== null && value !== undefined && value !== '').length;
    const extras = [energy, heatingYear, project?.building?.identity?.objectId].filter(Boolean).length;
    $('basisData').textContent = known === 3 ? 'gute Basis' : known >= 1 ? 'ausreichend für Start' : 'Stand-alone Einstieg';
    $('basisDataNote').textContent = extras ? `${extras} zusätzliche Projektangabe${extras === 1 ? '' : 'n'} vorhanden` : 'weitere Daten sind optional';
    $('basisQuality').textContent = known === 3 ? 'Basis vorhanden' : `${known} von 3 Kernwerten`;
    $('basisQuality').className = `status-chip ${known === 3 ? 'is-success' : ''}`.trim();

    const missing = [];
    if (!year) missing.push('Baujahr');
    if (!area) missing.push('beheizte Fläche');
    if (!carrier) missing.push('Wärmeversorgung');
    if (!missing.length) {
      $('basisHint').textContent = 'Die Projektbasis reicht für einen guten Erstvorschlag. Weitere Fachdaten werden automatisch genutzt, wenn sie vorhanden sind.';
      $('basisHint').className = 'roadmap-hint is-info';
    } else {
      $('basisHint').textContent = `Der Fahrplan funktioniert trotzdem. ${missing.join(', ')} ${missing.length === 1 ? 'verbessert' : 'verbessern'} den Erstvorschlag.`;
      $('basisHint').className = 'roadmap-hint is-warning';
    }

    if (document.activeElement !== $('inputConstructionYear')) $('inputConstructionYear').value = year ?? '';
    if (document.activeElement !== $('inputArea')) $('inputArea').value = area ?? '';
    if (document.activeElement !== $('inputCarrier')) $('inputCarrier').value = carrier ?? '';
    if (document.activeElement !== $('inputHeatingYear')) $('inputHeatingYear').value = heatingYear ?? '';
    if (document.activeElement !== $('inputEnergy')) $('inputEnergy').value = energy ?? '';
  }

  function renderFramework(project) {
    const advice = project?.advice ?? {};
    renderChoiceGroup('reasonChoices', advice.reason ?? null);
    renderChoiceGroup('timeChoices', advice.timeHorizon === '3-10' ? '3-7' : (advice.timeHorizon ?? null));
    renderChoiceGroup('budgetChoices', advice.budgetBand ?? null);
    renderChoiceGroup('priorityChoices', Array.isArray(advice.priorities) ? advice.priorities : [], true);
    renderChoiceGroup('upcomingChoices', project?.roadmap?.context?.upcomingWorks ?? [], true);

    const set = [advice.reason, advice.timeHorizon, advice.budgetBand].filter(Boolean).length;
    $('frameworkStatus').textContent = set >= 2 ? 'Rahmen gesetzt' : 'noch ergänzen';
    $('frameworkStatus').className = `status-chip ${set >= 2 ? 'is-success' : ''}`.trim();
  }

  function futureFitLabel(dimension) {
    return { envelope: 'Hülle', technique: 'Technik', fossilfree: 'fossilfrei', pv: 'PV' }[dimension] ?? dimension;
  }

  function dragPayload(event) {
    return event.dataTransfer?.getData('text/plain') || '';
  }

  function handleRouteDrop(payload, stageId, beforeItemId = null) {
    if (!payload || !stageId) return;
    if (payload.startsWith('roadmap-item:')) {
      const itemId = payload.slice('roadmap-item:'.length);
      if (beforeItemId && itemId === beforeItemId) return;
      selectedItemId = itemId;
      openStageId = stageId;
      store.setPath('roadmap', roadmapCore.moveItem(store.get().roadmap, itemId, stageId, beforeItemId));
      return;
    }
    if (payload.startsWith('roadmap-card:')) {
      const cardId = payload.slice('roadmap-card:'.length);
      addCardToStage(cardId, stageId, beforeItemId);
    }
  }

  function bindRouteDragAndDrop(host) {
    host.querySelectorAll('[data-route-item]').forEach((button) => {
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', `roadmap-item:${button.dataset.routeItem}`);
        button.classList.add('is-dragging');
      });
      button.addEventListener('dragend', () => button.classList.remove('is-dragging'));
      button.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        button.classList.add('is-drop-before');
      });
      button.addEventListener('dragleave', () => button.classList.remove('is-drop-before'));
      button.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        button.classList.remove('is-drop-before');
        const stage = button.closest('[data-stage-id]');
        handleRouteDrop(dragPayload(event), stage?.dataset.stageId, button.dataset.routeItem);
      });
    });

    host.querySelectorAll('[data-stage-id]').forEach((stage) => {
      stage.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        stage.classList.add('is-drag-over');
      });
      stage.addEventListener('dragleave', (event) => {
        if (!stage.contains(event.relatedTarget)) stage.classList.remove('is-drag-over');
      });
      stage.addEventListener('drop', (event) => {
        event.preventDefault();
        stage.classList.remove('is-drag-over');
        handleRouteDrop(dragPayload(event), stage.dataset.stageId, null);
      });
    });
  }

  function renderRoute(project) {
    const roadmap = normalizedRoadmap(project);
    const stages = orderedStages(roadmap);
    const items = Object.values(roadmap.items ?? {});
    const host = $('renovationRoute');

    if (!items.length) {
      host.innerHTML = '<p class="empty-route">Rahmen prüfen und anschließend den Fahrplan vorbereiten.</p>';
      $('routeStatus').textContent = 'noch nicht vorbereitet';
      $('routeStatus').className = 'status-chip';
    } else {
      const stageMarkup = stages.map((stage, index) => {
        const stageItems = itemsForStage(roadmap, stage.id);
        const shown = stageItems.slice(0, 5);
        return `<div class="route-stage" data-stage-id="${escapeHtml(stage.id)}" data-stage-order="${index + 1}">
          <div class="route-node"></div>
          <strong>${escapeHtml(stage.title)}</strong>
          <small>${escapeHtml(stage.timing?.horizon ?? '')}</small>
          <div class="route-card-list">${shown.map((item) => {
            const card = cardById(item.cardId);
            return `<button class="route-item ${selectedItemId === item.id ? 'is-selected' : ''}" draggable="true" data-route-item="${escapeHtml(item.id)}" title="Ziehen zum Verschieben oder anklicken für Details" type="button">${escapeHtml(card?.title ?? item.cardId)}</button>`;
          }).join('')}${stageItems.length > shown.length ? `<span class="route-more">+ ${stageItems.length - shown.length} weitere</span>` : ''}</div>
        </div>`;
      }).join('');
      host.innerHTML = `<svg class="route-curve" aria-hidden="true" viewBox="0 0 1000 110" preserveAspectRatio="none"><defs><linearGradient id="roadmapRouteGradient" x1="0" x2="1"><stop offset="0%" stop-color="var(--color-primary-dark)"/><stop offset="38%" stop-color="var(--color-primary)"/><stop offset="72%" stop-color="var(--color-primary-light)"/><stop offset="100%" stop-color="var(--color-secondary)"/></linearGradient></defs><path d="M55 55 C155 32 245 78 335 55 S520 32 615 55 S800 78 945 55" fill="none" stroke="url(#roadmapRouteGradient)" stroke-width="5" stroke-linecap="round"/></svg><div class="route-end route-end--today"><div class="route-node"></div><strong>HEUTE</strong><small>Bestand</small></div>${stageMarkup}<div class="route-end route-end--target"><div class="route-node"></div><strong>ZUKUNFTSFIT</strong><small>2050</small></div>`;
      $('routeStatus').textContent = `${stages.length} Etappen · ${items.length} Karten`;
      $('routeStatus').className = 'status-chip is-success';
      host.querySelectorAll('[data-route-item]').forEach((button) => button.addEventListener('click', () => selectItem(button.dataset.routeItem)));
      bindRouteDragAndDrop(host);
    }

    const coverage = roadmapCore.futureFitPlan(roadmap, data);
    const stageMap = new Map(stages.map((stage) => [stage.id, stage]));
    $('futureFitPlan').innerHTML = ['envelope', 'technique', 'fossilfree', 'pv'].map((dimension) => {
      const stage = stageMap.get(coverage[dimension]);
      const stateClass = stage ? 'is-done' : 'is-needs';
      return `<div class="future-step ${stateClass}"><i>${stage ? (stage.order ?? '•') : '!'}</i><span>${escapeHtml(futureFitLabel(dimension))}</span><small>${stage ? escapeHtml(stage.timing?.horizon ?? stage.title) : 'offen'}</small></div>`;
    }).join('');
  }

  function typeBadge(card) {
    const css = card?.type === 'planning' ? 'is-planning' : card?.type === 'future' ? 'is-future' : '';
    return `<span class="card-type-badge ${css}">${escapeHtml(TYPE_LABEL[card?.type] ?? card?.type ?? '')}</span>`;
  }

  function renderCardDetail(project, roadmap, item) {
    if (!item) return '<p class="roadmap-empty-note">Karte auswählen, um die Beratungsdetails zu sehen.</p>';
    const card = cardById(item.cardId);
    if (!card) return '<p class="roadmap-empty-note">Kartendaten fehlen.</p>';
    const stages = orderedStages(roadmap);
    const relations = roadmapCore.relevantRelations(card.id, roadmap, data, { max: 3 });
    const stageIndex = stages.findIndex((stage) => stage.id === item.stageId);
    const relationMarkup = relations.length ? `<div class="card-relations">${relations.map((entry) => `<div class="relation-note"><b>${escapeHtml(RELATION_LABEL[entry.relation] ?? entry.relation)}</b><span>${escapeHtml(entry.customerText || entry.reason)}</span></div>`).join('')}</div>` : '';
    const reasonMarkup = item.suggestionReason ? `<p><strong>Warum vorgeschlagen?</strong> ${escapeHtml(item.suggestionReason)}</p>` : '';
    return `<div class="card-detail-panel">
      <div class="card-detail-head"><div><h3>${escapeHtml(card.title)}</h3></div>${typeBadge(card)}</div>
      <p>${escapeHtml(card.summary)}</p>
      ${reasonMarkup}
      ${(card.details ?? []).length ? `<ul class="card-detail-points">${card.details.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>` : ''}
      ${relationMarkup}
      <div class="card-actions">
        <select aria-label="Etappe zuordnen" data-stage-select="${escapeHtml(item.id)}"><option value="">noch nicht eingeplant</option>${stages.map((stage) => `<option value="${escapeHtml(stage.id)}" ${stage.id === item.stageId ? 'selected' : ''}>${escapeHtml(stage.title)} · ${escapeHtml(stage.timing?.horizon ?? '')}</option>`).join('')}</select>
        <button data-move-earlier="${escapeHtml(item.id)}" type="button" ${stageIndex <= 0 ? 'disabled' : ''}>← früher</button>
        <button data-move-later="${escapeHtml(item.id)}" type="button" ${stageIndex < 0 || stageIndex >= stages.length - 1 ? 'disabled' : ''}>später →</button>
        <button class="remove-card" data-remove-item="${escapeHtml(item.id)}" type="button">entfernen</button>
      </div>
    </div>`;
  }

  function bindStageDetailActions(project, roadmap) {
    $('stageDetails').querySelectorAll('[data-stage-item]').forEach((button) => {
      button.addEventListener('click', () => selectItem(button.dataset.stageItem));
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', `roadmap-item:${button.dataset.stageItem}`);
      });
      button.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        button.classList.add('is-drop-before');
      });
      button.addEventListener('dragleave', () => button.classList.remove('is-drop-before'));
      button.addEventListener('drop', (event) => {
        event.preventDefault();
        button.classList.remove('is-drop-before');
        const payload = dragPayload(event);
        const stageId = button.closest('[data-stage-id]')?.dataset.stageId;
        handleRouteDrop(payload, stageId, button.dataset.stageItem);
      });
    });
    $('stageDetails').querySelectorAll('[data-stage-select]').forEach((select) => select.addEventListener('change', () => {
      store.setPath('roadmap', roadmapCore.moveItem(store.get().roadmap, select.dataset.stageSelect, select.value || null));
    }));
    $('stageDetails').querySelectorAll('[data-move-earlier]').forEach((button) => button.addEventListener('click', () => moveRelative(button.dataset.moveEarlier, -1)));
    $('stageDetails').querySelectorAll('[data-move-later]').forEach((button) => button.addEventListener('click', () => moveRelative(button.dataset.moveLater, 1)));
    $('stageDetails').querySelectorAll('[data-remove-item]').forEach((button) => button.addEventListener('click', () => {
      if (selectedItemId === button.dataset.removeItem) selectedItemId = null;
      store.setPath('roadmap', roadmapCore.moveItem(store.get().roadmap, button.dataset.removeItem, null));
    }));
    $('stageDetails').querySelectorAll('.stage-accordion').forEach((details) => details.addEventListener('toggle', () => {
      if (!details.open) return;
      openStageId = details.dataset.stageId;
      $('stageDetails').querySelectorAll('.stage-accordion').forEach((other) => { if (other !== details) other.open = false; });
    }));
  }

  function renderStages(project) {
    const roadmap = normalizedRoadmap(project);
    const stages = orderedStages(roadmap);
    const allItems = Object.values(roadmap.items ?? {});
    if (!allItems.length) {
      $('stageDetails').innerHTML = '<p class="roadmap-empty-note">Noch keine Etappen vorbereitet.</p>';
      $('unassignedBlock').hidden = true;
      return;
    }

    if (selectedItemId && !itemById(roadmap, selectedItemId)) selectedItemId = null;
    if (!openStageId || !stages.some((stage) => stage.id === openStageId)) openStageId = stages[0]?.id ?? null;
    if (!selectedItemId) selectedItemId = itemsForStage(roadmap, openStageId)[0]?.id ?? allItems[0]?.id ?? null;
    const selected = itemById(roadmap, selectedItemId);
    if (selected?.stageId) openStageId = selected.stageId;

    $('stageDetails').innerHTML = stages.map((stage) => {
      const stageItems = itemsForStage(roadmap, stage.id);
      const detail = selected?.stageId === stage.id ? renderCardDetail(project, roadmap, selected) : (stageItems.length ? '<p class="roadmap-empty-note">Eine Karte auswählen, um nur die aktuell benötigten Details zu öffnen.</p>' : '<p class="roadmap-empty-note">Noch keine Karte in dieser Etappe.</p>');
      return `<details class="stage-accordion" data-stage-id="${escapeHtml(stage.id)}" ${stage.id === openStageId ? 'open' : ''}>
        <summary><div><strong>${escapeHtml(stage.title)}</strong><span>${escapeHtml(stage.timing?.horizon ?? '')}</span></div><b>${stageItems.length} ${stageItems.length === 1 ? 'Karte' : 'Karten'}</b></summary>
        <div class="stage-body"><div class="stage-item-list">${stageItems.map((item) => `<button class="stage-item-button ${selectedItemId === item.id ? 'is-selected' : ''}" draggable="true" data-stage-item="${escapeHtml(item.id)}" type="button">${escapeHtml(cardById(item.cardId)?.title ?? item.cardId)}</button>`).join('')}</div>${detail}</div>
      </details>`;
    }).join('');

    bindStageDetailActions(project, roadmap);

    const unassigned = allItems.filter((item) => !item.stageId).sort((a, b) => Number(a.order ?? 999999) - Number(b.order ?? 999999));
    $('unassignedBlock').hidden = !unassigned.length;
    $('unassignedList').innerHTML = unassigned.map((item) => `<div class="unassigned-item" draggable="true" data-unassigned-drag="${escapeHtml(item.id)}"><strong>${escapeHtml(cardById(item.cardId)?.title ?? item.cardId)}</strong><select aria-label="${escapeHtml(cardById(item.cardId)?.title ?? item.cardId)} einer Etappe zuordnen" data-unassigned-select="${escapeHtml(item.id)}"><option value="">Später zuordnen</option>${stages.map((stage) => `<option value="${escapeHtml(stage.id)}">${escapeHtml(stage.title)} · ${escapeHtml(stage.timing?.horizon ?? '')}</option>`).join('')}</select></div>`).join('');
    $('unassignedList').querySelectorAll('[data-unassigned-select]').forEach((select) => select.addEventListener('change', () => {
      if (!select.value) return;
      selectedItemId = select.dataset.unassignedSelect;
      openStageId = select.value;
      store.setPath('roadmap', roadmapCore.moveItem(store.get().roadmap, select.dataset.unassignedSelect, select.value));
    }));
    $('unassignedList').querySelectorAll('[data-unassigned-drag]').forEach((item) => item.addEventListener('dragstart', (event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `roadmap-item:${item.dataset.unassignedDrag}`);
    }));
  }

  function selectItem(itemId) {
    const roadmap = normalizedRoadmap(store.get());
    const item = itemById(roadmap, itemId);
    selectedItemId = itemId;
    if (item?.stageId) openStageId = item.stageId;
    renderRoute(store.get());
    renderStages(store.get());
    $('stageDetailsCard')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  function moveRelative(itemId, direction) {
    const project = store.get();
    const roadmap = normalizedRoadmap(project);
    const item = itemById(roadmap, itemId);
    const stages = orderedStages(roadmap);
    const index = stages.findIndex((stage) => stage.id === item?.stageId);
    const nextStage = stages[index + direction];
    if (!nextStage) return;
    openStageId = nextStage.id;
    selectedItemId = itemId;
    store.setPath('roadmap', roadmapCore.moveItem(roadmap, itemId, nextStage.id));
  }

  function renderAdditionalSuggestions(project) {
    const roadmap = normalizedRoadmap(project);
    const active = new Set(Object.values(roadmap.items ?? {}).map((item) => item.cardId));
    const context = { upcomingWorks: activeUpcoming(project) };
    const suggestions = roadmapCore.suggest(project, context, data, { limit: 8 }).additional.filter((entry) => !active.has(entry.card.id));
    $('suggestionCount').textContent = suggestions.length ? `+ ${suggestions.length}` : '–';
    const top = suggestions.slice(0, 3);
    $('additionalSuggestions').innerHTML = top.length ? top.map((entry) => `<button class="suggestion-chip" draggable="true" data-add-card="${escapeHtml(entry.card.id)}" title="Anklicken oder in eine Etappe ziehen" type="button">${escapeHtml(entry.card.title)}</button>`).join('') : '<span class="roadmap-empty-note">Aktuell keine weiteren automatischen Hinweise.</span>';
    $('additionalSuggestions').querySelectorAll('[data-add-card]').forEach((button) => {
      button.addEventListener('click', () => addCard(button.dataset.addCard));
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer.effectAllowed = 'copyMove';
        event.dataTransfer.setData('text/plain', `roadmap-card:${button.dataset.addCard}`);
      });
    });
  }

  function renderCatalog(project) {
    const roadmap = normalizedRoadmap(project);
    const active = new Set(Object.values(roadmap.items ?? {}).map((item) => item.cardId));
    const categories = [...(data.cards.categories ?? [])].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
    $('catalogGroups').innerHTML = categories.map((category) => {
      const cards = (data.cards.items ?? []).filter((item) => item.category === category.id);
      return `<details class="catalog-group"><summary>${escapeHtml(category.label)} · ${cards.length}</summary><div class="catalog-group-grid">${cards.map((card) => `<div class="catalog-card ${active.has(card.id) ? 'is-active' : ''}"><strong>${escapeHtml(card.title)}</strong><small>${escapeHtml(TYPE_LABEL[card.type] ?? card.type)}</small><button data-catalog-add="${escapeHtml(card.id)}" type="button" ${active.has(card.id) ? 'disabled' : ''}>${active.has(card.id) ? 'bereits im Fahrplan' : '+ zum Fahrplan'}</button></div>`).join('')}</div></details>`;
    }).join('');
    $('catalogGroups').querySelectorAll('[data-catalog-add]').forEach((button) => button.addEventListener('click', () => addCard(button.dataset.catalogAdd)));
  }

  function addCard(cardId) {
    const card = cardById(cardId);
    if (!card) return;
    const next = roadmapCore.addCard(store.get().roadmap, cardId, card.type);
    const added = Object.values(next.items).find((item) => item.cardId === cardId);
    if (added) selectedItemId = added.id;
    store.setPath('roadmap', next);
  }

  function addCardToStage(cardId, stageId, beforeItemId = null) {
    const card = cardById(cardId);
    if (!card || !stageId) return;
    let next = roadmapCore.addCard(store.get().roadmap, cardId, card.type);
    const added = Object.values(next.items).find((item) => item.cardId === cardId);
    if (!added) return;
    next = roadmapCore.moveItem(next, added.id, stageId, beforeItemId);
    selectedItemId = added.id;
    openStageId = stageId;
    store.setPath('roadmap', next);
  }

  function renderReasons(project) {
    const roadmap = normalizedRoadmap(project);
    const checks = roadmapCore.planChecks(roadmap, data, { max: 4 });
    if (!checks.length) {
      $('reasonList').innerHTML = '<div class="plan-check-ok"><strong>✓ Keine wesentlichen Reihenfolgekonflikte erkannt.</strong><p>Synergien innerhalb derselben Etappe bleiben in den Kartendetails sichtbar.</p></div>';
      return;
    }
    $('reasonList').innerHTML = checks.map((entry) => {
      const label = entry.kind === 'warning' ? 'Wichtig prüfen' : 'Synergie prüfen';
      const css = entry.kind === 'warning' ? 'is-warning' : 'is-opportunity';
      return `<div class="reason-item ${css}"><strong>${escapeHtml(label)}</strong><p>${escapeHtml(entry.text)}</p></div>`;
    }).join('');
  }

  function cardsForEffect(project, dimensions) {
    const roadmap = normalizedRoadmap(project);
    const activeCards = Object.values(roadmap.items ?? {}).map((item) => cardById(item.cardId)).filter(Boolean);
    return activeCards.filter((card) => {
      const effect = data.effects.items?.[card.id] ?? {};
      return dimensions.some((dimension) => ['high', 'medium'].includes(effect[dimension]));
    });
  }

  function renderEffects(project) {
    const priorities = project?.advice?.priorities ?? [];
    if (!priorities.length) {
      $('priorityImpactList').innerHTML = '<p class="roadmap-empty-note">Kundenprioritäten sind noch offen. Zusatzwirkungen bleiben im Katalog erhalten und werden nicht zu einem Gesamtscore verrechnet.</p>';
    } else {
      const rows = priorities.slice(0, 3).map((priority) => {
        let text = '';
        if (priority === 'costs') text = 'Kosten und Förderung werden ergänzt, sobald gemeinsame Economics-Daten vorhanden sind; die technische Reihenfolge bleibt davon unabhängig.';
        if (priority === 'effort') text = 'Arbeiten werden nach Möglichkeit gebündelt, damit Bauteile, Gerüste und Leitungswege nicht mehrfach angegriffen werden müssen.';
        const dims = priority === 'comfort' ? ['comfort', 'health', 'summer'] : priority === 'climate' ? ['climate', 'ecology'] : priority === 'independence' ? ['independence'] : priority === 'value' ? ['value', 'resilience'] : [];
        if (!text && dims.length) {
          const cards = cardsForEffect(project, dims).slice(0, 3);
          text = cards.length ? `Im aktuellen Fahrplan besonders sichtbar bei: ${cards.map((card) => card.title).join(', ')}.` : 'Im aktuellen Fahrplan noch nicht durch eine eindeutig zugeordnete Zusatzwirkung hervorgehoben.';
        }
        return `<div class="priority-impact"><strong>${escapeHtml(PRIORITY_LABEL[priority] ?? priority)}</strong><p>${escapeHtml(text)}</p></div>`;
      });
      $('priorityImpactList').innerHTML = rows.join('');
    }

    const roadmap = normalizedRoadmap(project);
    const all = new Map();
    Object.values(roadmap.items ?? {}).forEach((item) => {
      const effect = data.effects.items?.[item.cardId] ?? {};
      Object.entries(effect).forEach(([dimension, level]) => {
        if (!['high', 'medium'].includes(level)) return;
        const current = all.get(dimension);
        if (!current || (current === 'medium' && level === 'high')) all.set(dimension, level);
      });
    });
    $('allEffects').innerHTML = all.size ? `<div class="effect-grid">${[...all.entries()].map(([dimension, level]) => `<span class="effect-chip"><strong>${escapeHtml(EFFECT_LABEL[dimension] ?? dimension)}</strong> · ${escapeHtml(LEVEL_LABEL[level] ?? level)}</span>`).join('')}</div>` : '<p class="roadmap-empty-note">Noch keine qualitativen Zusatzwirkungen aus ausgewählten Karten.</p>';
  }

  function render(project) {
    renderBasis(project);
    renderFramework(project);
    renderRoute(project);
    renderStages(project);
    renderAdditionalSuggestions(project);
    renderCatalog(project);
    renderReasons(project);
    renderEffects(project);
    updateAddressAnalysisState(project);
    renderGeometryStatus(project);
  }

  function bindChoices() {
    [['reasonChoices', 'advice.reason'], ['timeChoices', 'advice.timeHorizon'], ['budgetChoices', 'advice.budgetBand']].forEach(([id, path]) => {
      $(id).querySelectorAll('button[data-value]').forEach((button) => button.addEventListener('click', () => store.setPath(path, button.dataset.value)));
    });
    $('priorityChoices').querySelectorAll('button[data-value]').forEach((button) => button.addEventListener('click', () => {
      const priorities = store.get().advice?.priorities ?? [];
      const value = button.dataset.value;
      store.setPath('advice.priorities', priorities.includes(value) ? priorities.filter((item) => item !== value) : [...priorities, value]);
    }));
    $('upcomingChoices').querySelectorAll('button[data-value]').forEach((button) => button.addEventListener('click', () => {
      const value = button.dataset.value;
      const current = store.get().roadmap?.context?.upcomingWorks ?? [];
      let next;
      if (value === 'open') next = current.includes('open') ? [] : ['open'];
      else {
        const clean = current.filter((item) => item !== 'open');
        next = clean.includes(value) ? clean.filter((item) => item !== value) : [...clean, value];
      }
      store.setPath('roadmap.context.upcomingWorks', next);
    }));
  }

  function bindBasisInputs() {
    $('inputConstructionYear').addEventListener('change', () => writeManualField('building.profile.constructionYear', finite($('inputConstructionYear').value, null), 'Jahr'));
    $('inputArea').addEventListener('change', () => writeManualField('building.geometry.heatedFloorArea', finite($('inputArea').value, null), 'm²'));
    $('inputCarrier').addEventListener('change', () => writeManualField('systems.heating.energyCarrier', $('inputCarrier').value || null));
    $('inputHeatingYear').addEventListener('change', () => writeManualField('systems.heating.installationYear', finite($('inputHeatingYear').value, null), 'Jahr'));
    $('inputEnergy').addEventListener('change', () => writeManualField('consumption.heating.annualEnergy', finite($('inputEnergy').value, null), 'kWh/a'));
  }

  function prepareRoadmap() {
    const project = store.get();
    const originalUpcoming = project.roadmap?.context?.upcomingWorks ?? [];
    const context = { upcomingWorks: originalUpcoming.filter((item) => item !== 'open') };
    const next = roadmapCore.buildRoadmap(project, context, data, { limit: 8 });
    next.context.upcomingWorks = [...originalUpcoming];
    const firstStage = orderedStages(next)[0]?.id ?? null;
    const firstItem = Object.values(next.items ?? {}).find((item) => item.stageId === firstStage) ?? Object.values(next.items ?? {})[0];
    selectedItemId = firstItem?.id ?? null;
    openStageId = firstItem?.stageId ?? firstStage;
    store.batch(() => {
      store.setPath('roadmap', next);
      store.setPath('modules.sanierungsfahrplan.lastPreparedAt', new Date().toISOString());
    });
    $('prepareRoadmapHint').textContent = 'Erstvorschlag erstellt. Karten können per Drag & Drop oder über die Detailsteuerung verschoben und ergänzt werden.';
    $('routeCard')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  function updateAddressAnalysisState(project = store.get()) {
    const button = $('roadmapAnalyzeLocation');
    const hint = $('roadmapAnalysisHint');
    const address = pendingAddress ?? project.location?.addressRecord;
    const hasAddress = Boolean(address && Number.isFinite(Number(address.latitude)) && Number.isFinite(Number(address.longitude)));
    const hasGeometry = Boolean(project.building?.identity?.objectId || finite(valueAt(project, 'building.geometry.footprintArea', null), null) > 0);
    button.disabled = !hasAddress;
    button.textContent = hasGeometry ? 'Standort aktualisieren' : 'Standort analysieren';
    hint.textContent = !hasAddress ? 'Zuerst eine Adresse auswählen.' : hasGeometry ? 'Gebäudegeometrie ist vorhanden und kann bei Bedarf aktualisiert werden.' : 'Adresse ist gewählt. Die Gebäudeanalyse ist hilfreich, aber für den Fahrplan nicht zwingend.';
  }

  function renderGeometryStatus(project = store.get()) {
    const chip = $('geometryStatus');
    const objectId = project.building?.identity?.objectId;
    const area = finite(valueAt(project, 'building.geometry.footprintArea', null), null);
    if (objectId || area > 0) {
      chip.textContent = objectId ? `TIRIS Gebäude ${objectId}` : 'Projektgeometrie vorhanden';
      chip.className = 'status-chip is-success';
    } else {
      chip.textContent = project.project?.addressLabel ? 'Adresse gewählt' : 'noch kein Standort';
      chip.className = 'status-chip';
    }
  }

  function preserveManualFields(next, previous) {
    if (Array.isArray(next)) return clone(next);
    if (!next || typeof next !== 'object') return clone(next);
    const out = clone(next);
    Object.entries(previous ?? {}).forEach(([key, old]) => {
      if (resolver.isField(old)) {
        const manual = old.candidates?.[model.ORIGIN.MANUAL];
        if (!manual) return;
        const base = resolver.isField(out[key]) ? out[key] : model.field(null, { unit: old.unit ?? null });
        base.candidates = { ...(base.candidates ?? {}), [model.ORIGIN.MANUAL]: clone(manual) };
        out[key] = model.finalizeField(base);
      } else if (old && typeof old === 'object' && !Array.isArray(old)) {
        out[key] = preserveManualFields(out[key] ?? {}, old);
      }
    });
    return out;
  }

  function applyBuildingFeature(feature, mode = 'manual') {
    const current = store.get();
    const next = geometryService.toProjectBuilding(feature, mode);
    store.setPath('building', preserveManualFields(next, current.building));
    $('roadmapBuildingCandidates').hidden = true;
    pendingAddress = null;
  }

  function renderBuildingCandidates(result) {
    const host = $('roadmapBuildingCandidates');
    if (!result.features.length) { host.hidden = true; return; }
    host.hidden = false;
    host.innerHTML = `<strong>Gebäude bitte prüfen</strong>${result.features.map((feature, index) => {
      const item = geometryService.candidateSummary(feature, index);
      return `<button type="button" data-building-index="${index}"><strong>${escapeHtml(item.label)}</strong><small>${item.areaM2 !== null ? `${number0.format(item.areaM2)} m² Dachprojektion` : ''}${Number.isFinite(item.distanceM) ? ` · ca. ${number0.format(item.distanceM)} m` : ''}</small></button>`;
    }).join('')}`;
    host.querySelectorAll('[data-building-index]').forEach((button) => button.addEventListener('click', () => applyBuildingFeature(result.features[Number(button.dataset.buildingIndex)], 'manual')));
  }

  async function loadGeometry(address) {
    $('geometryStatus').textContent = 'Gebäude wird zugeordnet …';
    try {
      const result = await geometryService.findCandidates(address, { maxRadiusM: 30 });
      if (result.automaticallySelected) applyBuildingFeature(result.automaticallySelected, 'automatic');
      else renderBuildingCandidates(result);
    } catch (error) {
      $('roadmapAddressStatus').textContent = `Adresse übernommen; TIRIS-Gebäude konnte nicht geladen werden: ${error.message}`;
    }
  }

  function compactAddress(address) {
    const keys = ['id','label','street','house_number','postal_code','municipality','municipality_code','locality','latitude','longitude','address_latitude','address_longitude','coordinate_kind','cadastral_municipality_number','cadastral_municipality_numbers','source','source_id','dataset_date','license','address_code','subcode','tiris_layer_id','tiris_layer_label'];
    const out = {};
    keys.forEach((key) => { if (address?.[key] !== undefined && address?.[key] !== null) out[key] = clone(address[key]); });
    return out;
  }

  async function selectAddress(address) {
    const permission = await addressManager.requestSelection(address);
    if (!permission.allowed) return;
    $('roadmapAddressStatus').textContent = 'Adresse wird mit TIRIS live abgeglichen …';
    let resolution = { address, usedFallback: true };
    try { resolution = await hybridAddressProvider.resolve(address); } catch (error) { console.warn(error); }
    const selected = resolution.address || address;
    const source = selected.source || 'Gemeinsame Adresssuche';
    store.patch({
      project: { addressLabel: selected.label },
      location: {
        addressRecord: compactAddress(selected),
        address: model.field(selected.label, { origin: model.ORIGIN.OFFICIAL, source, dataDate: selected.dataset_date ?? null }),
        latitude: model.field(Number(selected.latitude), { unit: '°', origin: model.ORIGIN.OFFICIAL, source }),
        longitude: model.field(Number(selected.longitude), { unit: '°', origin: model.ORIGIN.OFFICIAL, source }),
        municipality: model.field(selected.municipality || null, { origin: model.ORIGIN.OFFICIAL, source }),
        municipalityCode: model.field(selected.municipality_code || null, { origin: model.ORIGIN.OFFICIAL, source }),
      },
    });
    $('roadmapAddressInput').value = selected.label;
    $('roadmapAddressResults').hidden = true;
    $('roadmapAddressStatus').textContent = resolution.usedFallback ? (resolution.warning || 'BEV-Adresse übernommen; kein eindeutiger TIRIS-Live-Treffer.') : 'TIRIS-Live-Adresse übernommen.';
    pendingAddress = selected;
    updateAddressAnalysisState(store.get());
  }

  function renderAddressResults(results, guidance = '') {
    const host = $('roadmapAddressResults');
    if (!results.length) { host.hidden = !guidance; host.innerHTML = guidance ? `<small>${escapeHtml(guidance)}</small>` : ''; return; }
    host.hidden = false;
    host.innerHTML = results.map((address, index) => `<button type="button" data-address-index="${index}"><strong>${escapeHtml(address.label)}</strong><small>${escapeHtml(address.source || 'Adressvorschlag')}</small></button>`).join('');
    host.querySelectorAll('[data-address-index]').forEach((button) => button.addEventListener('click', () => selectAddress(results[Number(button.dataset.addressIndex)])));
  }

  async function searchAddress(query) {
    const sequence = ++addressSequence;
    const q = query.trim();
    if (q.length < 3) { renderAddressResults([], 'Mindestens drei Zeichen eingeben.'); return; }
    try {
      const result = await hybridAddressProvider.search(q, { limit: 8 });
      if (sequence !== addressSequence) return;
      renderAddressResults(result.results ?? [], result.guidance ?? '');
      $('roadmapAddressStatus').textContent = result.results?.length ? 'Adresse auswählen. Die TIRIS-Gebäudeanalyse kann danach optional ergänzt werden.' : (result.guidance || 'Keine Adresse gefunden.');
    } catch (error) {
      if (sequence !== addressSequence) return;
      renderAddressResults([], error.message);
    }
  }

  async function initAddress() {
    const local = new global.BevLocalAddressProvider();
    const live = new global.TirisLiveAddressProvider();
    hybridAddressProvider = new global.HybridAddressProvider({ suggestionProvider: local, liveProvider: live });
    try { await hybridAddressProvider.init(); } catch (error) { $('roadmapAddressStatus').textContent = `Adressindex konnte nicht geladen werden: ${error.message}`; }
    $('roadmapAddressInput').value = store.get().project?.addressLabel || '';
    $('roadmapAddressInput').addEventListener('input', () => { clearTimeout(addressTimer); addressTimer = setTimeout(() => searchAddress($('roadmapAddressInput').value), 280); });
    pendingAddress = store.get().location?.addressRecord ?? null;
    $('roadmapAnalyzeLocation').addEventListener('click', async () => { const address = pendingAddress ?? store.get().location?.addressRecord; if (address) await loadGeometry(address); });
  }

  function buildPrintReport(project = store.get()) {
    const roadmap = normalizedRoadmap(project);
    const stages = orderedStages(roadmap);
    const priorities = (project.advice?.priorities ?? []).map((id) => PRIORITY_LABEL[id] ?? id).join(' · ') || 'offen';
    const reasons = [...$('reasonList').querySelectorAll('.reason-item')].slice(0, 3).map((node) => node.textContent.trim());
    $('roadmapPrintReport').innerHTML = `<div class="print-roadmap-title"><p class="eyebrow">Sanierungsfahrplan · V0.2</p><h1>${escapeHtml(project.project?.title || 'Sanierungsfahrplan')}</h1><p>${escapeHtml(project.project?.addressLabel || 'Standort noch offen')}</p><small>Anlass: ${escapeHtml(REASON_LABEL[project.advice?.reason] ?? 'offen')} · Zeitraum: ${escapeHtml(TIME_LABEL[project.advice?.timeHorizon] ?? 'offen')} · Budget: ${escapeHtml(BUDGET_LABEL[project.advice?.budgetBand] ?? 'offen')}</small><p><strong>Schwerpunkte:</strong> ${escapeHtml(priorities)}</p></div>
      <h2>Bestand → gewählte Etappen → Zukunftsfit 2050</h2>
      <div class="print-route">${stages.map((stage) => `<section class="print-stage"><h3>${escapeHtml(stage.title)}</h3><small>${escapeHtml(stage.timing?.horizon ?? '')}</small><ul>${itemsForStage(roadmap, stage.id).map((item) => `<li>${escapeHtml(cardById(item.cardId)?.title ?? item.cardId)}</li>`).join('')}</ul></section>`).join('')}</div>
      <p><strong>Zielbild:</strong> zukunftsfähige Gebäudehülle → effiziente Gebäudetechnik → fossilfreie / erneuerbare Wärmeversorgung → PV</p>
      <div class="print-key-message"><h2>Planungscheck</h2>${reasons.length ? `<ul>${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>` : '<p>Reihenfolge im Beratungsgespräch weiter konkretisieren.</p>'}</div>
      <p><small>V0.2: Kosten-, Energie- und Referenz-Erneuerungsdarstellung wird aus den gemeinsamen Fachservices ergänzt. Der Fahrplan ist bereits ohne diese Berechnungen nutzbar.</small></p>`;
  }

  async function init() {
    try {
      await loadConfigs();
      populateCarrier(store.get());
      bindChoices();
      bindBasisInputs();
      $('prepareRoadmapButton').addEventListener('click', prepareRoadmap);
      $('printRoadmapBottomButton').addEventListener('click', () => { buildPrintReport(); global.dispatchEvent(new CustomEvent('energy-tools:prepare-print')); requestAnimationFrame(() => global.print()); });
      global.addEventListener('energy-tools:prepare-print', () => buildPrintReport());
      await initAddress();
      store.subscribe((project) => render(project));
      render(store.get());
    } catch (error) {
      console.error(error);
      $('basisHint').textContent = `Sanierungsfahrplan konnte nicht vollständig geladen werden: ${error.message}`;
      $('basisHint').className = 'roadmap-hint is-warning';
    }
  }

  init();
})(window);
