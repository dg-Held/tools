'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared/data/roadmap/cards.json'), 'utf8'));
const relations = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared/data/roadmap/relations.json'), 'utf8'));
const effects = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared/data/measures/measure-effects.json'), 'utf8'));
const ids = new Set(cards.items.map((item) => item.id));

if (ids.size !== cards.items.length) throw new Error('Doppelte Karten-ID im Sanierungsfahrplan.');
relations.relations.forEach((entry) => {
  if (!ids.has(entry.source) || !ids.has(entry.target)) throw new Error(`Ungültige Relation ${entry.id}`);
});
relations.suggestionRules.forEach((rule) => {
  const targets = [...(rule.routeTargets ?? rule.targets ?? []), ...(rule.additionalTargets ?? [])];
  targets.forEach((target) => { if (!ids.has(target)) throw new Error(`Ungültiges Vorschlagsziel ${rule.id}: ${target}`); });
});
Object.keys(effects.items).forEach((id) => { if (!ids.has(id)) throw new Error(`Zusatzwirkung ohne Karte: ${id}`); });

const window = { location: { href: 'http://localhost/tools/sanierungsfahrplan/index.html' } };
window.EnergyToolsPaths = { sharedData: `file://${path.join(ROOT, 'shared/data')}/` };
const context = vm.createContext({
  window,
  console,
  URL,
  fetch: async (url) => ({
    ok: true,
    status: 200,
    json: async () => JSON.parse(fs.readFileSync(String(url).replace('file://', ''), 'utf8')),
  }),
});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared/js/domain/roadmap/roadmap-core.js'), 'utf8'), context);

(async () => {
  const core = window.EnergyRoadmapCore;
  const data = await core.load();

  const project = {
    advice: { reason: 'full', timeHorizon: '3-7', priorities: ['comfort', 'value'] },
    building: { profile: { constructionYear: 1982 } },
    systems: { heating: { energyCarrier: 'oil' } },
    measures: {},
    roadmap: { context: { upcomingWorks: ['roof', 'bathroom'] }, stages: {}, items: {} },
  };
  const suggestion = core.suggest(project, { upcomingWorks: ['roof', 'bathroom'] }, data, { limit: 8 });
  const primary = new Set(suggestion.primary.map((entry) => entry.card.id));
  ['renovation-concept', 'envelope-roof', 'accessible-bath', 'heating-replacement', 'pv-own-use'].forEach((id) => {
    if (!primary.has(id)) throw new Error(`Erwartete Kernkarte fehlt: ${id}`);
  });
  if (primary.has('pollutants')) throw new Error('Schadstoffprüfung soll als Gesprächsimpuls und nicht automatisch in der Route landen.');

  const roadmap = core.buildRoadmap(project, { upcomingWorks: ['roof', 'bathroom'] }, data, { limit: 8 });
  const coverage = core.futureFitPlan(roadmap, data);
  if (!coverage.envelope || !coverage.fossilfree || !coverage.pv) throw new Error('Zukunftsfit-Zielpfad wird nicht ausreichend abgedeckt.');
  if (Object.keys(roadmap.stages).length !== 3) throw new Error('Etappenmodell V0.2 erwartet drei Etappen.');
  if (roadmap.stages['stage-2'].timing.horizon !== '3–7 Jahre') throw new Error('Zeitraum 3–7 Jahre ist nicht einheitlich abgebildet.');

  // Konkreter Beratungsfall: Heizung ist ausdrücklicher Anlass; Dach und Grundriss stehen ohnehin an.
  const heatingProject = {
    advice: { reason: 'heating', timeHorizon: '3-7', priorities: [] },
    building: { profile: { constructionYear: 1982 } },
    systems: { heating: { energyCarrier: 'oil' } },
    measures: {},
    roadmap: { context: { upcomingWorks: ['roof', 'layout'] }, stages: {}, items: {} },
  };
  const heatingRoadmap = core.buildRoadmap(heatingProject, { upcomingWorks: ['roof', 'layout'] }, data, { limit: 8 });
  const byCard = new Map(Object.values(heatingRoadmap.items).map((item) => [item.cardId, item]));
  ['heating-replacement', 'heating-load-check', 'renovation-concept', 'envelope-roof', 'pv-own-use'].forEach((id) => {
    if (byCard.get(id)?.stageId !== 'stage-1') throw new Error(`${id} sollte im Heizungs-Anlassfall in Etappe 1 liegen.`);
  });
  if (byCard.get('future-housing')?.stageId !== 'stage-2') throw new Error('Zukunftsfähige Wohnsituation sollte den Erstaufschlag nicht in Etappe 1 überladen.');
  const stage1Count = Object.values(heatingRoadmap.items).filter((item) => item.stageId === 'stage-1').length;
  if (stage1Count > 5) throw new Error(`Etappe 1 ist im Heizungs-Anlassfall zu voll (${stage1Count} Karten).`);

  // Reihenfolgencheck: Heizung heute, Dach später -> wichtiger Lock-in-Hinweis.
  const checkRoadmap = core.emptyRoadmap('3-7');
  checkRoadmap.items = {
    heating: { id: 'heating', cardId: 'heating-replacement', type: 'measure', stageId: 'stage-1', order: 10 },
    load: { id: 'load', cardId: 'heating-load-check', type: 'planning', stageId: 'stage-1', order: 20 },
    roof: { id: 'roof', cardId: 'envelope-roof', type: 'measure', stageId: 'stage-2', order: 10 },
    pv: { id: 'pv', cardId: 'pv-own-use', type: 'measure', stageId: 'stage-3', order: 10 },
  };
  const checks = core.planChecks(checkRoadmap, data, { max: 10 });
  if (!checks.some((entry) => entry.relationId === 'heating-roof-lockin' && entry.kind === 'warning')) throw new Error('Heizung-vor-Hülle-Konflikt wird nicht erkannt.');
  if (!checks.some((entry) => entry.relationId === 'roof-pv' && entry.kind === 'opportunity')) throw new Error('Verlorene Dach/PV-Synergie wird nicht erkannt.');

  // Verschieben und Feinreihung bleiben deterministisch.
  const ordered = core.moveItem(checkRoadmap, 'pv', 'stage-2', 'roof');
  const stage2 = Object.values(ordered.items).filter((item) => item.stageId === 'stage-2').sort((a, b) => a.order - b.order).map((item) => item.id);
  if (stage2.join(',') !== 'pv,roof') throw new Error(`Drag-&-Drop-Reihenfolge fehlerhaft: ${stage2.join(',')}`);
  const parked = core.moveItem(ordered, 'pv', null);
  if (parked.items.pv.stageId !== null) throw new Error('Karte kann nicht in „Später zuordnen“ verschoben werden.');

  console.log('Sanierungsfahrplan V0.2: Kartenkatalog, Vorschlagspriorität, Etappenlogik, Planungscheck und Reihenfolge bestanden.', {
    cards: cards.items.length,
    relations: relations.relations.length,
    suggestionRules: relations.suggestionRules.length,
    effectProfiles: Object.keys(effects.items).length,
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
