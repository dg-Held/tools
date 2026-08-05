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

store.batch(() => {
  store.setFieldCandidate('building.geometry.grossFloorArea', model.ORIGIN.MANUAL, 300, { unit: 'm²' });
  store.setFieldCandidate('building.geometry.storeysAboveGround', model.ORIGIN.MANUAL, 3, { unit: null });
  store.setFieldCandidate('building.geometry.heightMedian', model.ORIGIN.OFFICIAL, 9.6, { unit: 'm' });
});
let project = store.get();
assert.equal(resolver.value(project.building.geometry.grossVolume), 960);
assert.equal(resolver.describe(project.building.geometry.grossVolume).origin, model.ORIGIN.DERIVED);

store.setFieldCandidate('building.geometry.grossFloorArea', model.ORIGIN.MANUAL, 360, { unit: 'm²' });
project = store.get();
assert.equal(resolver.value(project.building.geometry.grossVolume), 1150); // 360 / 3 * 9.6 = 1152 -> 1,150 m³

store.setFieldCandidate('building.geometry.grossVolume', model.ORIGIN.MANUAL, 1200, { unit: 'm³' });
store.setFieldCandidate('building.geometry.grossFloorArea', model.ORIGIN.MANUAL, 390, { unit: 'm²' });
project = store.get();
assert.equal(resolver.value(project.building.geometry.grossVolume), 1200, 'Manuelles Volumen muss Vorrang behalten.');
assert.equal(resolver.describe(project.building.geometry.grossVolume).automaticValue, 1250); // 390 / 3 * 9.6 = 1248 -> 1,250 m³
console.log(JSON.stringify({ passed: true, volume: resolver.value(project.building.geometry.grossVolume), automaticVolume: resolver.describe(project.building.geometry.grossVolume).automaticValue }, null, 2));
