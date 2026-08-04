'use strict';
const assert = require('node:assert/strict');
const core = require('../shared/js/domain/measures/envelope-renovation-core.js');
const economics = require('../shared/js/domain/economics/economics-core.js');

const nextU = core.uValueAfterInsulation(1.2, 0.035, 16);
assert.ok(Math.abs(nextU - 0.18502202643171808) < 1e-8);
const required = core.requiredThicknessCm(1.2, 0.2, 0.035);
assert.ok(Math.abs(required - 14.5833333333) < 1e-8);
const variants = core.createVariants({
  areaM2: 200,
  existingUValue: 1.2,
  lambdaWmk: 0.035,
  maximumThicknessCm: 20,
  thicknessStepCm: 2,
  existingLossKwh: 12000,
  annualEfficiency: 0.85,
  renewalContext: 'renewal_due',
  baseCostEurM2: 180,
  variableCostEurM2Cm: 2.5,
  sunkCostEurM2: 100,
  subsidyMode: 'none',
  energyPriceEurKwh: 0.14,
  emissionFactorKgKwh: 0.25,
});
assert.equal(variants.length, 11);
assert.equal(variants[0].investment.fullInvestmentEur, 20000);
assert.equal(variants[8].thicknessCm, 16);
assert.ok(variants[8].energy.deliveredSavingsKwh > 10000);
assert.equal(core.roundToStep(52490, 500), 52500);

const assumptions = { periodYears: 30, interestRatePercent: 2 };
const testVariant = {
  capitalComponents: [{ initialCost: 20000, replacementCost: 20000, lifetimeYears: 40, capitalPriceFactor: 1.02, disposalCost: 0 }],
  consumptionCosts: [{ annualCost: 500, priceFactor: 1.02 }],
  operationCosts: [],
};
const result = economics.calculateVariant(testVariant, assumptions);
assert.ok(result.totalPresentValue > 20000);
console.log(JSON.stringify({ passed: true, nextU, requiredCm: required, variants: variants.length, totalPresentValue: result.totalPresentValue }, null, 2));
