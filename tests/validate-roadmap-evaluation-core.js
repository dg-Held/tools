'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const window = {};
const context = vm.createContext({ window, globalThis: window, console, Intl, Date, Math, Number, Object, Array, Map, Set, JSON });
[
  'shared/js/domain/measures/envelope-renovation-core.js',
  'shared/js/domain/energy-flow/energy-flow-core.js',
  'shared/js/domain/energy-flow/project-energy-adapter.js',
  'shared/js/domain/economics/energy-anchor-core.js',
  'shared/js/domain/economics/renewal-horizon-core.js',
  'shared/js/domain/roadmap/roadmap-evaluation-core.js',
].forEach((rel) => vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), context, { filename: rel }));

const cards = readJson('shared/data/roadmap/cards.json');
const cardsData = { cardMap: new Map(cards.items.map((item) => [item.id, item])) };
const configs = {
  energyFlowDefaults: readJson('shared/data/standards/energy-flow-v4-defaults.json'),
  existingUValuesConfig: readJson('shared/data/building/existing-u-values.json'),
  envelopeTargets: readJson('shared/data/measures/envelope-targets.json'),
  renovationCosts: readJson('shared/data/costs/renovation-costs.json'),
  systemCosts: readJson('shared/data/costs/system-costs.json'),
  componentLifetimes: readJson('shared/data/standards/economics/component-lifetimes.json'),
  referenceConditions: readJson('shared/data/economics/reference-condition-defaults.json'),
  emissionFactors: readJson('shared/data/emissions/emission-factors.json'),
};

const project = {
  building: {
    profile: { constructionYear: 1982 },
    geometry: {
      heatedFloorArea: 180,
      usableFloorArea: 180,
      grossFloorArea: 220,
      grossVolume: 650,
      opaqueExteriorWallArea: 220,
      topFloorArea: 110,
      roofSlopeArea: 0,
      basementCeilingArea: 110,
      groundFloorArea: 0,
      windowArea: 32,
      doorArea: 2,
    },
    thermal: {
      envelope: {
        exteriorWall: { enabled: true, uValue: 0.9 },
        topFloorCeiling: { enabled: true, uValue: 0.7 },
        roof: { enabled: false },
        basementCeiling: { enabled: true, uValue: 0.8 },
        groundFloor: { enabled: false },
        windows: { enabled: true, uValue: 2.4 },
        doors: { enabled: true, uValue: 2.5 },
      },
    },
  },
  usage: { household: { persons: 4 } },
  consumption: { heating: { annualEnergy: 24000 } },
  systems: { heating: { usefulHeatFactor: 0.85, hotWaterIncluded: true, energyCarrier: 'oil' } },
  modules: { klima: {}, wirtschaftlichkeit: { measureDrafts: {} } },
  economics: {
    latestCalculation: {
      selectedMeasureIds: ['heating'],
      measureResults: {
        heating: { id: 'heating', fullInvestmentEur: 30000, fundingEur: 5000, referenceCostEur: 17000, referenceYear: 2, referenceMode: 'renewal', targetCarrierId: 'electricity', targetEfficiency: 3.2, systemLabel: 'Luft/Wasser-Wärmepumpe' },
      },
    },
  },
  measures: {},
};

const roadmap = {
  stages: {
    s1: { id: 's1', title: 'Etappe 1', order: 1, timing: { horizon: 'jetzt' } },
    s2: { id: 's2', title: 'Etappe 2', order: 2, timing: { horizon: '3–7 Jahre' } },
    s3: { id: 's3', title: 'Etappe 3', order: 3, timing: { horizon: 'später' } },
  },
  items: {
    a: { id: 'a', cardId: 'envelope-wall', type: 'measure', stageId: 's1', order: 10 },
    b: { id: 'b', cardId: 'envelope-windows', type: 'measure', stageId: 's2', order: 10 },
    c: { id: 'c', cardId: 'heating-replacement', type: 'measure', stageId: 's3', order: 10 },
  },
};

const result = window.EnergyRoadmapEvaluationCore.evaluate(project, roadmap, cardsData, configs, {
  projectEnergyAdapter: window.EnergyProjectEnergyAdapter,
  anchorCore: window.EnergyConsumptionAnchorCore,
  measureCore: window.EnvelopeRenovationCore,
  renewalHorizonCore: window.EnergyRenewalHorizonCore,
});

if (!result.energy.available) throw new Error('Sequenzielle Energiewirkung ist nicht verfügbar.');
if (!(result.energy.rows[0].cumulativeSavingsKwh > 0)) throw new Error('Etappe 1 sollte eine positive Hüllwirkung haben.');
if (!(result.energy.rows[1].cumulativeSavingsKwh > result.energy.rows[0].cumulativeSavingsKwh)) throw new Error('Etappe 2 muss auf dem sanierten Zustand aus Etappe 1 aufbauen.');
if (!(result.energy.rows[2].cumulativeEnergyAfterKwh < result.energy.rows[1].cumulativeEnergyAfterKwh)) throw new Error('Konkretes Ziel-Heizsystem wird nicht in der Folgeetappe berücksichtigt.');
if (!(result.costs.rows[0].fullInvestmentEur > 0)) throw new Error('Zentrale Richtkosten der Hülle fehlen.');
if (Math.round(result.costs.rows[2].fullInvestmentEur) !== 30000) throw new Error('Gemeinsames Wirtschaftlichkeitsergebnis für Heizung wurde nicht übernommen.');
if (Math.round(result.costs.rows[2].netInvestmentEur) !== 25000) throw new Error('Maßnahmenbezogene Förderung aus dem gemeinsamen Wirtschaftlichkeitsergebnis fehlt.');

console.log('Sanierungsfahrplan V0.3: sequenzielle Energie-/CO2-Wirkung und etappenbezogene Kostenintegration bestanden.', {
  energyStages: result.energy.rows.map((row) => Math.round(row.cumulativeEnergyAfterKwh ?? 0)),
  knownInvestment: Math.round(result.costs.fullInvestmentEur),
  heatingNet: Math.round(result.costs.rows[2].netInvestmentEur),
});
