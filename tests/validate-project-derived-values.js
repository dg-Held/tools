'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const storage = new Map();
const context = {
  console,
  window: null,
  CustomEvent: class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
  dispatchEvent: () => {},
  addEventListener: () => {},
};
context.window = context;
vm.createContext(context);
for (const file of ['shared/js/data-model.js', 'shared/js/project-migrations.js', 'shared/js/value-resolver.js', 'shared/js/project-store.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const store = context.EnergyToolsProjectStore;
const model = context.EnergyToolsDataModel;
const resolver = context.EnergyToolsValueResolver;
const value = (fieldPath) => resolver.value(store.getPath(fieldPath, null), null);
const origin = (fieldPath) => resolver.describe(store.getPath(fieldPath, null)).origin;

// Amtliche Referenz: 100 m² Dachprojektion, 40 m Umfang und 9,6 m Medianhöhe.
store.batch(() => {
  store.setFieldCandidate('building.geometry.footprintArea', model.ORIGIN.OFFICIAL, 100, { unit: 'm²' });
  store.setFieldCandidate('building.geometry.perimeter', model.ORIGIN.OFFICIAL, 40, { unit: 'm' });
  store.setFieldCandidate('building.geometry.heightMedian', model.ORIGIN.OFFICIAL, 9.6, { unit: 'm' });
});
assert.equal(value('building.geometry.storeysAboveGround'), 3);
assert.equal(value('building.geometry.grossFloorArea'), 300);
assert.equal(value('building.geometry.usableFloorArea'), 225);
assert.equal(value('building.geometry.heatedFloorArea'), 225);
assert.equal(value('building.geometry.grossVolume'), 960);
assert.equal(value('building.thermal.heatedSharePercent'), 100);
assert.equal(value('building.thermal.heatedVolume'), 960);
assert.equal(value('building.geometry.reference.grossFloorArea'), 300);
assert.equal(value('building.geometry.reference.grossVolume'), 960);

// Manuelle Geschoßzahl führt BGF/NFL nach; die wirksame Grundfläche bleibt 100 m².
store.setFieldCandidate('building.geometry.storeysAboveGround', model.ORIGIN.MANUAL, 2, { unit: null });
assert.equal(value('building.geometry.grossFloorArea'), 200);
assert.equal(value('building.geometry.usableFloorArea'), 150);
assert.equal(value('building.geometry.topFloorArea'), 100);
assert.equal(value('building.geometry.grossVolume'), 960);
assert.equal(value('building.geometry.reference.grossFloorArea'), 300);

// Bekannte BGF hat Vorrang. Hüllflächen und Volumen folgen der wirksamen Grundfläche BGF/Geschoße.
store.setFieldCandidate('building.geometry.grossFloorArea', model.ORIGIN.MANUAL, 260, { unit: 'm²' });
assert.equal(value('building.geometry.grossFloorArea'), 260);
assert.equal(value('building.geometry.usableFloorArea'), 195);
assert.equal(value('building.geometry.topFloorArea'), 130);
assert.equal(value('building.geometry.roofSlopeArea'), 100);
assert.equal(value('building.geometry.grossVolume'), 1250);
assert.equal(value('building.geometry.exteriorWallGrossArea'), 440);

// Ohne manuelle BGF wird sie aus einer bekannten NFL mit BGF = NFL / 0,75 abgeleitet.
store.clearFieldCandidate('building.geometry.grossFloorArea', model.ORIGIN.MANUAL);
store.setFieldCandidate('building.geometry.usableFloorArea', model.ORIGIN.MANUAL, 180, { unit: 'm²' });
assert.equal(value('building.geometry.grossFloorArea'), 240);
assert.equal(value('building.geometry.usableFloorArea'), 180);
assert.equal(value('building.geometry.topFloorArea'), 120);
assert.equal(value('building.geometry.roofSlopeArea'), 100);
assert.equal(value('building.geometry.grossVolume'), 1150);
assert.equal(value('building.geometry.exteriorWallGrossArea'), 420);
assert.equal(value('building.geometry.windowArea'), 105);
assert.equal(value('building.geometry.opaqueExteriorWallArea'), 315);

// Der gemeinsame Fensterflächenanteil führt Fenster und opake Außenwand nach.
store.setFieldCandidate('building.geometry.windowSharePercent', model.ORIGIN.MANUAL, 30, { unit: '%' });
assert.equal(value('building.geometry.windowArea'), 125);
assert.equal(value('building.geometry.opaqueExteriorWallArea'), 295);

// Die Dachfläche bleibt am amtlichen Dachpolygon und folgt nur der Dachneigung.
store.setFieldCandidate('building.geometry.roofPitch', model.ORIGIN.MANUAL, 30, { unit: '°' });
assert.equal(value('building.geometry.roofSlopeArea'), 120);

// Beheizter Anteil und beheizte Nutzfläche werden bidirektional synchronisiert.
store.setFieldCandidate('building.thermal.heatedSharePercent', model.ORIGIN.MANUAL, 75, { unit: '%' });
assert.equal(value('building.geometry.heatedFloorArea'), 135);
assert.equal(value('building.thermal.heatedSharePercent'), 75);
assert.equal(value('building.thermal.heatedVolume'), 860);

// Zu große beheizte NFL wird auf die verwendete Nutzfläche begrenzt.
store.setFieldCandidate('building.geometry.heatedFloorArea', model.ORIGIN.MANUAL, 220, { unit: 'm²' });
assert.equal(value('building.geometry.heatedFloorArea'), 180);
assert.equal(value('building.thermal.heatedSharePercent'), 100);
assert.equal(origin('building.geometry.heatedFloorArea'), model.ORIGIN.MANUAL);
assert.match(String(resolver.describe(store.getPath('building.geometry.heatedFloorArea')).note), /begrenzt/i);

// Manuelles Bruttovolumen behält Vorrang; konditioniertes Volumen folgt dem beheizten Anteil.
store.setFieldCandidate('building.thermal.heatedSharePercent', model.ORIGIN.MANUAL, 75, { unit: '%' });
store.setFieldCandidate('building.geometry.grossVolume', model.ORIGIN.MANUAL, 1100, { unit: 'm³' });
assert.equal(value('building.geometry.grossVolume'), 1100);
assert.equal(value('building.geometry.reference.grossVolume'), 960);
assert.equal(value('building.thermal.heatedVolume'), 830);

console.log(JSON.stringify({
  passed: true,
  automaticReferenceBgf: value('building.geometry.reference.grossFloorArea'),
  automaticReferenceVolume: value('building.geometry.reference.grossVolume'),
  effectiveBgf: value('building.geometry.grossFloorArea'),
  effectiveNfl: value('building.geometry.usableFloorArea'),
  heatedNfl: value('building.geometry.heatedFloorArea'),
  roofSlopeArea: value('building.geometry.roofSlopeArea'),
  grossVolume: value('building.geometry.grossVolume'),
  heatedVolume: value('building.thermal.heatedVolume'),
}, null, 2));
