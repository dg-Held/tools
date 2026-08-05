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
const value = (path) => resolver.value(store.getPath(path, null), null);
const origin = (path) => resolver.describe(store.getPath(path, null)).origin;
const auto = (path) => resolver.describe(store.getPath(path, null)).automaticValue;

// Amtliche Geometrie: 100 m² Dachprojektion, 9,6 m Medianhöhe, Standardmodul 3,2 m.
store.batch(() => {
  store.setFieldCandidate('building.geometry.footprintArea', model.ORIGIN.OFFICIAL, 100, { unit: 'm²' });
  store.setFieldCandidate('building.geometry.heightMedian', model.ORIGIN.OFFICIAL, 9.6, { unit: 'm' });
  store.setFieldCandidate('building.geometry.storeyHeightModule', model.ORIGIN.FALLBACK, 3.2, { unit: 'm' });
  store.setFieldCandidate('building.geometry.usableFloorAreaFactor', model.ORIGIN.FALLBACK, 75, { unit: '%' });
});
assert.equal(value('building.geometry.storeysAboveGround'), 3);
assert.equal(value('building.geometry.grossFloorArea'), 300);
assert.equal(value('building.geometry.usableFloorArea'), 225);
assert.equal(value('building.geometry.heatedFloorArea'), 225);
assert.equal(value('building.geometry.grossVolume'), 960);
assert.equal(value('building.thermal.heatedSharePercent'), 100);
assert.equal(value('building.thermal.heatedVolume'), 960);
assert.equal(value('building.geometry.reference.grossFloorArea'), 300);

// Manuelle Geschoßzahl führt die verwendete BGF/NFL nach; automatische Referenz und Volumen bleiben gleich.
store.setFieldCandidate('building.geometry.storeysAboveGround', model.ORIGIN.MANUAL, 2, { unit: null });
assert.equal(value('building.geometry.grossFloorArea'), 200);
assert.equal(value('building.geometry.usableFloorArea'), 150);
assert.equal(value('building.geometry.heatedFloorArea'), 150);
assert.equal(value('building.geometry.reference.grossFloorArea'), 300);
assert.equal(value('building.geometry.grossVolume'), 960);

// Manuelle BGF unterbricht die verwendete Kette ab BGF; NFL folgt der BGF.
store.setFieldCandidate('building.geometry.grossFloorArea', model.ORIGIN.MANUAL, 260, { unit: 'm²' });
assert.equal(value('building.geometry.grossFloorArea'), 260);
assert.equal(value('building.geometry.usableFloorArea'), 195);
assert.equal(value('building.geometry.heatedFloorArea'), 195);
assert.equal(value('building.geometry.grossVolume'), 960);

// Manuelle NFL unterbricht die Kette; beheizte NFL wird nachgeführt.
store.setFieldCandidate('building.geometry.usableFloorArea', model.ORIGIN.MANUAL, 180, { unit: 'm²' });
assert.equal(value('building.geometry.usableFloorArea'), 180);
assert.equal(value('building.geometry.heatedFloorArea'), 180);

// Zu große beheizte NFL wird auf die Nutzfläche begrenzt.
store.setFieldCandidate('building.geometry.heatedFloorArea', model.ORIGIN.MANUAL, 220, { unit: 'm²' });
assert.equal(value('building.geometry.heatedFloorArea'), 180);
assert.equal(origin('building.geometry.heatedFloorArea'), model.ORIGIN.MANUAL);
assert.match(String(resolver.describe(store.getPath('building.geometry.heatedFloorArea')).note), /begrenzt/i);

// Kleinere beheizte NFL erzeugt einen plausiblen beheizten Anteil und konditioniertes Volumen.
store.setFieldCandidate('building.geometry.heatedFloorArea', model.ORIGIN.MANUAL, 135, { unit: 'm²' });
assert.equal(value('building.thermal.heatedSharePercent'), 75);
assert.equal(value('building.thermal.heatedVolume'), 720);

// Manuelles Bruttovolumen behält Vorrang; automatischer Hintergrundwert bleibt 960 m³.
store.setFieldCandidate('building.geometry.grossVolume', model.ORIGIN.MANUAL, 1100, { unit: 'm³' });
store.setFieldCandidate('building.geometry.grossFloorArea', model.ORIGIN.MANUAL, 320, { unit: 'm²' });
assert.equal(value('building.geometry.grossVolume'), 1100);
assert.equal(auto('building.geometry.grossVolume'), 960);
assert.equal(value('building.thermal.heatedVolume'), 830);

console.log(JSON.stringify({
  passed: true,
  automaticReferenceBgf: value('building.geometry.reference.grossFloorArea'),
  effectiveBgf: value('building.geometry.grossFloorArea'),
  effectiveNfl: value('building.geometry.usableFloorArea'),
  heatedNfl: value('building.geometry.heatedFloorArea'),
  grossVolume: value('building.geometry.grossVolume'),
  automaticGrossVolume: auto('building.geometry.grossVolume'),
  heatedVolume: value('building.thermal.heatedVolume'),
}, null, 2));
