'use strict';

const assert = require('node:assert/strict');
const econ = require('../shared/js/domain/economics/economics-core.js');

function close(actual, expected, tolerance, label) {
  const difference = Math.abs(actual - expected);
  assert.ok(difference <= tolerance, `${label}: ${actual} statt ${expected} (Δ ${difference})`);
  return { label, actual, expected, difference, passed: true };
}

const assumptionsA = {
  periodYears: 40,
  interestFactor: 1.025,
};

const variant1 = {
  id: '30cm',
  capitalComponents: [{
    id: 'insulation-difference',
    initialCost: 105 * 170 * (0.30 - 0.10),
    replacementCost: 105 * 170 * (0.30 - 0.10),
    disposalCost: 5 * 170 * (0.30 - 0.10),
    lifetimeYears: 40,
    capitalPriceFactor: 1.035,
    disposalPriceFactor: 1.03,
  }],
  consumptionCosts: [],
  operationCosts: [],
};

const variant2 = {
  id: '10cm',
  capitalComponents: [],
  consumptionCosts: [{
    id: 'energy-difference',
    annualCost: 0.45 * (20.2 - 17.9) * 175,
    priceFactor: 1.03,
  }],
  operationCosts: [],
};

const result1 = econ.calculateVariant(variant1, assumptionsA);
const result2 = econ.calculateVariant(variant2, assumptionsA);
const averageCrossings = econ.findCrossings(variant1, variant2, assumptionsA, 'average');
const cumulativeCrossings = econ.findCrossings(variant1, variant2, assumptionsA, 'cumulative');

const checks = [];
checks.push(close(result1.capital.details[0].initial, 3570.0000, 0.00005, 'A.4.1 Anfangsinvestition'));
checks.push(close(result1.capital.details[0].disposal, 206.5301, 0.0001, 'A.4.2 Entsorgung'));
checks.push(close(result1.totalPresentValue, 3776.5301, 0.0001, 'A.4.3 Summe Variante 1'));
checks.push(close(result2.consumption.total, 8017.6522, 0.0001, 'A.4.4 Verbrauchskosten Variante 2'));
checks.push(close(result2.totalPresentValue - result1.totalPresentValue, 4241.1221, 0.0001, 'A.4.5 Gesamtkostendifferenz'));
checks.push(close(result1.annuity, 150.4427, 0.0001, 'A.5 Annuität Variante 1'));
checks.push(close(result2.annuity, 319.3931, 0.0001, 'A.5 Annuität Variante 2'));
checks.push(close(averageCrossings[0].year, 19.8128, 0.0001, 'A.6 Amortisation Durchschnittsmethode'));
checks.push(close(cumulativeCrossings[0].year, 18.7772, 0.0001, 'A.7 Amortisation Kumulationsmethode'));

const b1 = econ.simplifiedOptimalInsulationThickness({
  lambdaWmk: 0.031,
  heatingDegreeDaysKd: 4282,
  endEnergyPriceEurKwh: 0.25,
  annualEfficiency: 2.5,
  energyPriceFactor: 1.03,
  interestFactor: 1.0219,
  periodYears: 50,
  insulationVolumePriceEurM3: 115,
  baseResistanceM2KW: 0.13 + 0.20 / 2.3 + 0.04,
});
checks.push(close(b1.usefulEnergyPriceEurKwh, 0.1000, 0.00005, 'B.3 Nutzenergiepreis'));
checks.push(close(b1.energyCostCapitalizationFactor, 61.5489, 0.0001, 'B.3 Verzinsungsfaktor'));
checks.push(close(b1.baseResistanceM2KW, 0.2570, 0.0001, 'B.3 Basiswiderstand'));
checks.push(close(b1.optimalThicknessM, 0.4050, 0.0001, 'B.3 optimale Dicke'));

const b2 = econ.simplifiedOptimalInsulationThickness({
  lambdaWmk: 0.043,
  heatingDegreeDaysKd: 3614,
  endEnergyPriceEurKwh: 0.10,
  annualEfficiency: 0.7,
  energyPriceFactor: 1.03,
  interestFactor: 1.0219,
  periodYears: 50,
  insulationVolumePriceEurM3: 430,
  baseResistanceM2KW: 0.13 + 0.25 / 0.260 + 0.02 / 0.200 + 0.04,
});
checks.push(close(b2.usefulEnergyPriceEurKwh, 0.1429, 0.0001, 'B.4 Nutzenergiepreis'));
checks.push(close(b2.energyCostCapitalizationFactor, 61.5489, 0.0001, 'B.4 Verzinsungsfaktor'));
checks.push(close(b2.baseResistanceM2KW, 1.2315, 0.0001, 'B.4 Basiswiderstand'));
checks.push(close(b2.optimalThicknessM, 0.2232, 0.0001, 'B.4 optimale Dicke'));

checks.push(close(econ.recurringPresentValueThrough(100, 1.02, 1.02, 30), 3000, 0.000001, 'Sonderfall Preisfaktor = Zinsfaktor'));
checks.push(close(econ.presentValueReplacements({ cost: 1000, priceFactor: 1, interestFactor: 1, lifetimeYears: 10, periodYears: 30 }), 2000, 0.000001, 'Wiederbeschaffung nicht am Periodenende'));
checks.push(close(econ.presentValueDisposal({ cost: 100, priceFactor: 1, interestFactor: 1, lifetimeYears: 10, periodYears: 30 }), 300, 0.000001, 'Entsorgung inklusive Periodenende'));
checks.push(close(econ.presentValueResidual({ initialCost: 4000, priceFactor: 1, interestFactor: 1, lifetimeYears: 40, periodYears: 30 }), 1000, 0.000001, 'Linearer Restwert'));

const report = {
  modelVersion: econ.MODEL_VERSION,
  normReference: econ.NORM_REFERENCE,
  generatedAt: new Date().toISOString(),
  passed: true,
  checks,
};
console.log(JSON.stringify(report, null, 2));
