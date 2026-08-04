'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const existing = JSON.parse(fs.readFileSync(path.join(base, 'shared/data/building/existing-u-values.json'), 'utf8'));
const evaluation = JSON.parse(fs.readFileSync(path.join(base, 'shared/data/building/envelope-evaluation.json'), 'utf8'));
function period(year) {
  return existing.periods.find((p) => year >= (p.year_min ?? -Infinity) && year <= (p.year_max ?? Infinity));
}
assert.equal(period(1970).id, '1960_1981');
assert.equal(existing.components.exteriorWall.values[period(1970).id], 1.2);
assert.equal(existing.components.windows.values[period(1970).id], 3.0);
assert.equal(existing.components.topFloorCeiling.values[period(2005).id], 0.2);
assert.equal(existing.components.basementCeiling.values[period(2005).id], 0.4);
assert.equal(evaluation.components.exteriorWall.recommended, 0.2);
assert.equal(evaluation.components.roof.ambitious, 0.13);
console.log(JSON.stringify({ passed: true, dataDate: existing.data_date, checks: 6 }, null, 2));
