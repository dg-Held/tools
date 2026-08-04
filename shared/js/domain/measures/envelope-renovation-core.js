'use strict';

(function initEnvelopeRenovationCore(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EnvelopeRenovationCore = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis, function envelopeFactory() {
  const MODEL_VERSION = '0.1.0';
  const EPSILON = 1e-12;

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function optionalFinite(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function roundToStep(value, step) {
    const number = optionalFinite(value);
    const increment = finite(step, 0);
    if (number === null || !(increment > 0)) return number;
    return Math.round(number / increment) * increment;
  }

  function ceilToStep(value, step) {
    const number = optionalFinite(value);
    const increment = finite(step, 0);
    if (number === null || !(increment > 0)) return number;
    return Math.ceil((number - EPSILON) / increment) * increment;
  }

  function uValueAfterInsulation(existingUValue, lambdaWmk, thicknessCm) {
    const uExisting = finite(existingUValue, 0);
    const lambda = finite(lambdaWmk, 0);
    const thicknessM = Math.max(0, finite(thicknessCm, 0)) / 100;
    if (!(uExisting > 0) || !(lambda > 0)) return null;
    return 1 / ((1 / uExisting) + (thicknessM / lambda));
  }

  function requiredThicknessCm(existingUValue, targetUValue, lambdaWmk) {
    const uExisting = finite(existingUValue, 0);
    const uTarget = finite(targetUValue, 0);
    const lambda = finite(lambdaWmk, 0);
    if (!(uExisting > 0) || !(uTarget > 0) || !(lambda > 0)) return null;
    if (uTarget >= uExisting) return 0;
    return Math.max(0, lambda * ((1 / uTarget) - (1 / uExisting)) * 100);
  }

  function surfaceTemperatureC({ indoorTemperatureC, boundaryTemperatureC, uValue, internalSurfaceResistanceM2KW }) {
    const indoor = finite(indoorTemperatureC, 20);
    const boundary = finite(boundaryTemperatureC, 0);
    const u = finite(uValue, 0);
    const rsi = finite(internalSurfaceResistanceM2KW, 0.13);
    if (!(u > 0) || !(rsi >= 0)) return null;
    return indoor - u * (indoor - boundary) * rsi;
  }

  function usefulLossFromClimate({ areaM2, uValue, heatingDegreeHoursKh, boundaryFactor = 1 }) {
    const area = Math.max(0, finite(areaM2, 0));
    const u = Math.max(0, finite(uValue, 0));
    const hdh = Math.max(0, finite(heatingDegreeHoursKh, 0));
    const factor = clamp(finite(boundaryFactor, 1), 0, 1.5);
    return area * u * hdh * factor / 1000;
  }

  function usefulLossFromCalibratedBaseline({ existingLossKwh, existingUValue, newUValue }) {
    const baseline = Math.max(0, finite(existingLossKwh, 0));
    const oldU = finite(existingUValue, 0);
    const nextU = finite(newUValue, 0);
    if (!(oldU > 0) || !(nextU >= 0)) return null;
    return baseline * nextU / oldU;
  }

  function energyEffect({
    areaM2,
    existingUValue,
    newUValue,
    existingLossKwh = null,
    heatingDegreeHoursKh = null,
    boundaryFactor = 1,
    annualEfficiency = 0.85,
  }) {
    const eta = finite(annualEfficiency, 0);
    const oldU = finite(existingUValue, 0);
    const nextU = finite(newUValue, 0);
    if (!(oldU > 0) || !(nextU > 0) || !(eta > 0)) {
      return { available: false, method: null, existingUsefulKwh: null, newUsefulKwh: null, usefulSavingsKwh: null, deliveredSavingsKwh: null };
    }

    let method = null;
    let existingUseful = null;
    let nextUseful = null;
    const calibrated = optionalFinite(existingLossKwh);
    const hdh = optionalFinite(heatingDegreeHoursKh);

    if (calibrated !== null && calibrated >= 0) {
      method = 'energy-flow-calibrated';
      existingUseful = calibrated;
      nextUseful = usefulLossFromCalibratedBaseline({ existingLossKwh: calibrated, existingUValue: oldU, newUValue: nextU });
    } else if (hdh !== null && hdh > 0) {
      method = 'climate-u-a';
      existingUseful = usefulLossFromClimate({ areaM2, uValue: oldU, heatingDegreeHoursKh: hdh, boundaryFactor });
      nextUseful = usefulLossFromClimate({ areaM2, uValue: nextU, heatingDegreeHoursKh: hdh, boundaryFactor });
    }

    if (existingUseful === null || nextUseful === null) {
      return { available: false, method: null, existingUsefulKwh: null, newUsefulKwh: null, usefulSavingsKwh: null, deliveredSavingsKwh: null };
    }

    const usefulSavings = Math.max(0, existingUseful - nextUseful);
    return {
      available: true,
      method,
      existingUsefulKwh: existingUseful,
      newUsefulKwh: nextUseful,
      usefulSavingsKwh: usefulSavings,
      deliveredSavingsKwh: usefulSavings / eta,
    };
  }

  function investmentForThickness({
    thicknessCm,
    areaM2,
    baseCostEurM2,
    variableCostEurM2Cm,
    sunkCostEurM2,
    renewalContext,
  }) {
    const thickness = Math.max(0, finite(thicknessCm, 0));
    const area = Math.max(0, finite(areaM2, 0));
    const base = Math.max(0, finite(baseCostEurM2, 0));
    const variable = Math.max(0, finite(variableCostEurM2Cm, 0));
    const sunkRate = Math.max(0, finite(sunkCostEurM2, 0));
    const isRenewal = renewalContext === 'renewal_due';

    if (thickness <= EPSILON) {
      const referenceCost = isRenewal ? area * sunkRate : 0;
      return {
        fullInvestmentEur: referenceCost,
        sunkCostEur: isRenewal ? referenceCost : 0,
        energeticAdditionalEur: 0,
      };
    }

    const full = area * (base + variable * thickness);
    const sunk = isRenewal ? Math.min(full, area * sunkRate) : 0;
    return {
      fullInvestmentEur: full,
      sunkCostEur: sunk,
      energeticAdditionalEur: Math.max(0, full - sunk),
    };
  }

  function subsidyForInvestment({ mode, value, basis, fullInvestmentEur, energeticAdditionalEur, maximumEur = null }) {
    const numeric = Math.max(0, finite(value, 0));
    const base = basis === 'energetic' ? energeticAdditionalEur : fullInvestmentEur;
    let subsidy = 0;
    if (mode === 'percent') subsidy = base * numeric / 100;
    if (mode === 'amount') subsidy = numeric;
    const maximum = optionalFinite(maximumEur);
    if (maximum !== null && maximum >= 0) subsidy = Math.min(subsidy, maximum);
    return Math.max(0, Math.min(subsidy, fullInvestmentEur));
  }

  function createThicknesses(maximumCm = 30, stepCm = 2) {
    const maximum = Math.max(0, finite(maximumCm, 30));
    const step = Math.max(0.1, finite(stepCm, 2));
    const result = [];
    for (let thickness = 0; thickness <= maximum + EPSILON; thickness += step) {
      result.push(Number(thickness.toFixed(6)));
    }
    return result;
  }

  function createVariants(inputs) {
    const thicknesses = inputs.thicknessesCm ?? createThicknesses(inputs.maximumThicknessCm, inputs.thicknessStepCm);
    return thicknesses.map((thicknessCm) => {
      const newUValue = uValueAfterInsulation(inputs.existingUValue, inputs.lambdaWmk, thicknessCm);
      const energy = energyEffect({
        areaM2: inputs.areaM2,
        existingUValue: inputs.existingUValue,
        newUValue,
        existingLossKwh: inputs.existingLossKwh,
        heatingDegreeHoursKh: inputs.heatingDegreeHoursKh,
        boundaryFactor: inputs.boundaryFactor,
        annualEfficiency: inputs.annualEfficiency,
      });
      const investment = investmentForThickness({
        thicknessCm,
        areaM2: inputs.areaM2,
        baseCostEurM2: inputs.baseCostEurM2,
        variableCostEurM2Cm: inputs.variableCostEurM2Cm,
        sunkCostEurM2: inputs.sunkCostEurM2,
        renewalContext: inputs.renewalContext,
      });
      const subsidy = subsidyForInvestment({
        mode: inputs.subsidyMode,
        value: inputs.subsidyValue,
        basis: inputs.subsidyBasis,
        maximumEur: inputs.subsidyMaximumEur,
        ...investment,
      });
      const energyCostSavingsEurA = energy.available && optionalFinite(inputs.energyPriceEurKwh) !== null
        ? energy.deliveredSavingsKwh * finite(inputs.energyPriceEurKwh, 0)
        : null;
      const co2SavingsKgA = energy.available && optionalFinite(inputs.emissionFactorKgKwh) !== null
        ? energy.deliveredSavingsKwh * finite(inputs.emissionFactorKgKwh, 0)
        : null;
      return {
        id: `thickness-${String(thicknessCm).replace('.', '-')}`,
        thicknessCm,
        newUValue,
        energy,
        investment,
        subsidyEur: subsidy,
        paymentAfterSubsidyEur: Math.max(0, investment.fullInvestmentEur - subsidy),
        relevantOwnInvestmentEur: Math.max(0, investment.energeticAdditionalEur - subsidy),
        energyCostSavingsEurA,
        co2SavingsKgA,
      };
    });
  }

  return {
    MODEL_VERSION,
    finite,
    optionalFinite,
    roundToStep,
    ceilToStep,
    uValueAfterInsulation,
    requiredThicknessCm,
    surfaceTemperatureC,
    usefulLossFromClimate,
    energyEffect,
    investmentForThickness,
    subsidyForInvestment,
    createThicknesses,
    createVariants,
  };
});
