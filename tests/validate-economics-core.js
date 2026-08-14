'use strict';

const assert = require('node:assert/strict');
const core = require('../shared/js/domain/economics/economics-core.js');

function near(actual, expected, tolerance = 1e-6, message = '') {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message} expected ${expected}, got ${actual}`);
}

const q = core.factorFromPercent(2.5);
const p = core.factorFromPercent(2.0);
near(core.presentValue(1000, p, q, 5), 1000 * ((1.02 / 1.025) ** 5), 1e-9, 'presentValue');

const event = { year: 5, amount: 10000, priceFactor: p };
near(core.timedCapitalEventPresentValue(event, q), 10000 * ((1.02 / 1.025) ** 5), 1e-9, 'timed event');

const reference = {
  capitalEvents: [{ id: 'ref-renewal', year: 10, amount: 20000, priceFactor: p }],
  consumptionCosts: [{ annualCost: 2500, priceFactor: core.factorFromPercent(2.7) }],
  operationCosts: [],
};

const candidate = {
  capitalEvents: [
    { id: 'investment', year: 0, amount: 30000, priceFactor: 1 },
    { id: 'funding', year: 0, amount: -5000, priceFactor: 1 },
  ],
  consumptionCosts: [{ annualCost: 1400, priceFactor: core.factorFromPercent(2.7) }],
  operationCosts: [],
};

const assumptions = { periodYears: 30, interestRatePercent: 2.5 };
const comparison = core.compareVariants(candidate, reference, assumptions, 'cumulative');
assert.equal(comparison.series[0].year, 0);
assert.equal(comparison.series.at(-1).year, 30);
assert.ok(Number.isFinite(comparison.advantagePresentValue));
assert.ok(Array.isArray(comparison.crossings));

const calculated = core.calculateVariant(candidate, assumptions);
assert.equal(calculated.capital.timedEvents.length, 2);
near(calculated.capital.total, 25000, 1e-9, 'year-zero funding event');

const delayed = core.calculateVariant({capitalComponents:[],capitalEvents:[],consumptionCosts:[],operationCosts:[{annualCost:100,priceFactor:1,startYear:5}]},{periodYears:10,interestRatePercent:0});
near(delayed.operation.total, 500, 1e-9, 'delayed annual operation costs');

console.log('Economics Core V1.2: Basis-, Ereignis-, zeitversetzte Betriebs- und Vergleichstests bestanden.');
