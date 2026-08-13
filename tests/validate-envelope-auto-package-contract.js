'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'tools/bauteil-sanierung/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'tools/bauteil-sanierung/bauteil-sanierung.js'), 'utf8');
const measureCore = require(path.join(root, 'shared/js/domain/measures/envelope-renovation-core.js'));
const economicsCore = require(path.join(root, 'shared/js/domain/economics/economics-core.js'));
const targets = JSON.parse(fs.readFileSync(path.join(root, 'shared/data/measures/envelope-targets.json'), 'utf8'));
const costs = JSON.parse(fs.readFileSync(path.join(root, 'shared/data/costs/renovation-costs.json'), 'utf8'));

for (const id of [
  'generateAutoPackages',
  'autoPreparedValue',
  'autoProposalValue',
  'autoPackageValue',
  'autoRecommendedCount',
  'autoEconomicCount',
  'autoAmbitiousCount',
  'autoPackageDetailsBody',
  'thermalEnvelopeRelevant',
]) {
  assert(html.includes(`id="${id}"`), `HTML-Vertrag fehlt: ${id}`);
}

for (const token of [
  'function createAutomaticPackages(options = {})',
  'function scheduleSelectedMeasureSync(delay = 320)',
  'function syncSelectedMeasureToProject({ reviewed = false, announce = false } = {})',
  "'reviewed-in-tool'",
  "'edited-after-review'",
  'function automaticProposalFingerprint(project)',
  "status: 'automatic-proposal'",
  "reviewStatus: 'not-reviewed'",
  'envelope-package-recommended',
  'envelope-package-economic',
  'envelope-package-ambitious',
  'thermalEnvelopeRelevant',
  'thermalEnvelope:',
  'result.readiness.considered === false',
]) {
  assert(app.includes(token), `JS-Vertrag fehlt: ${token}`);
}

const target = targets.components.wall_external;
const cost = costs.models.find((item) => item.id === 'wall_wdvs');
assert(target && cost, 'Testdaten Außenwand fehlen.');

const inputs = {
  areaM2: 180,
  existingUValue: 1.2,
  lambdaWmk: 0.035,
  existingLossKwh: null,
  heatingDegreeHoursKh: 82000,
  boundaryFactor: 1,
  annualEfficiency: 0.85,
  renewalContext: 'renewal_due',
  baseCostEurM2: cost.base_cost_eur_m2,
  variableCostEurM2Cm: cost.variable_cost_eur_m2_cm,
  sunkCostEurM2: cost.sunk_cost_eur_m2,
  fundingEntries: [],
  energyPriceEurKwh: 0.12,
  emissionFactorKgKwh: 0.271,
  lifetimeYears: 40,
  periodYears: 30,
  interestRatePercent: 3,
  energyEscalationPercent: 3,
  investmentEscalationPercent: 2,
};

const variants = measureCore.createVariants({
  ...inputs,
  maximumThicknessCm: 30,
  thicknessStepCm: 2,
});
const required = measureCore.requiredThicknessCm(inputs.existingUValue, target.recommended, inputs.lambdaWmk);
const recommendedCm = measureCore.ceilToStep(required, 2);
const recommended = variants.find((item) => item.thicknessCm === recommendedCm);
assert(recommended && recommended.thicknessCm > 0, 'Mindeststandard muss als echte Maßnahme entstehen.');
assert(recommended.newUValue <= target.recommended + 1e-9, 'Mindeststandard verfehlt Ziel-U-Wert.');

const q = economicsCore.factorFromPercent(inputs.interestRatePercent);
const pEnergy = economicsCore.factorFromPercent(inputs.energyEscalationPercent);
const pInvestment = economicsCore.factorFromPercent(inputs.investmentEscalationPercent);
function economics(variant) {
  return economicsCore.calculateVariant({
    id: variant.id,
    capitalComponents: variant.investment.fullInvestmentEur > 0 ? [{
      initialCost: variant.investment.fullInvestmentEur,
      replacementCost: variant.investment.fullInvestmentEur,
      lifetimeYears: inputs.lifetimeYears,
      capitalPriceFactor: pInvestment,
    }] : [],
    consumptionCosts: [{
      annualCost: variant.energy.newUsefulKwh / inputs.annualEfficiency * inputs.energyPriceEurKwh,
      priceFactor: pEnergy,
    }],
    operationCosts: [],
  }, { periodYears: inputs.periodYears, interestFactor: q });
}

const economicCandidates = variants.filter((item) => item.thicknessCm > 0 && item.energy.available)
  .map((item) => ({ item, result: economics(item) }));
assert(economicCandidates.length > 0, 'Wirtschaftliche Varianten fehlen trotz vollständiger Grundlage.');
const optimum = economicCandidates.reduce((best, entry) => entry.result.totalPresentValue < best.result.totalPresentValue ? entry : best);
assert(optimum.item.thicknessCm > 0, 'Kostenoptimum darf keine Null-Maßnahme sein.');

const packageIds = {
  recommended: 'envelope-package-recommended',
  economic: 'envelope-package-economic',
  ambitious: 'envelope-package-ambitious',
};
assert(new Set(Object.values(packageIds)).size === 3, 'Paket-IDs müssen eindeutig sein.');

console.log('Automatische Maßnahmenpakete: Vertrag und Beispielrechnung bestanden.');
