'use strict';

(function initEnergyEconomicsCore(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EnergyEconomicsCore = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis, function economicsFactory() {
  const MODEL_VERSION = '1.2.0';
  const NORM_REFERENCE = 'ÖNORM B 8110-4:2024-04-15 · ÖNORM M 7140:2021-01 · ÖNORM EN 15459-1:2017';
  const EPSILON = 1e-12;

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function nonNegative(value, fallback = 0) {
    return Math.max(0, finite(value, fallback));
  }

  function factorFromPercent(percent) {
    return 1 + finite(percent, 0) / 100;
  }

  function presentValue(cost, priceFactor, interestFactor, year) {
    const k = finite(cost, 0);
    const p = finite(priceFactor, 1);
    const q = finite(interestFactor, 1);
    const a = nonNegative(year, 0);
    if (q <= 0) throw new RangeError('Der Zinsfaktor muss größer als 0 sein.');
    return k * ((p / q) ** a);
  }

  function presentValueInitial(initialCost) {
    return finite(initialCost, 0);
  }

  function recurringPresentValueThrough(annualCost, priceFactor, interestFactor, years) {
    const k = finite(annualCost, 0);
    const p = finite(priceFactor, 1);
    const q = finite(interestFactor, 1);
    const t = nonNegative(years, 0);
    if (q <= 0) throw new RangeError('Der Zinsfaktor muss größer als 0 sein.');
    const r = p / q;
    if (Math.abs(r - 1) < EPSILON) return t * k;
    return k * r * (1 - r ** t) / (1 - r);
  }

  function replacementYears(lifetimeYears, periodYears) {
    const lifetime = nonNegative(lifetimeYears, 0);
    const period = nonNegative(periodYears, 0);
    if (!(lifetime > 0) || !(period > 0)) return [];
    const years = [];
    for (let year = lifetime; year < period - EPSILON; year += lifetime) years.push(year);
    return years;
  }

  function disposalYears(lifetimeYears, periodYears) {
    const lifetime = nonNegative(lifetimeYears, 0);
    const period = nonNegative(periodYears, 0);
    if (!(lifetime > 0) || !(period > 0)) return [];
    const years = [];
    for (let year = lifetime; year <= period + EPSILON; year += lifetime) years.push(Math.min(year, period));
    return years;
  }

  function presentValueReplacements({ cost, priceFactor = 1, interestFactor = 1, lifetimeYears, periodYears }) {
    return replacementYears(lifetimeYears, periodYears)
      .reduce((sum, year) => sum + presentValue(cost, priceFactor, interestFactor, year), 0);
  }

  function elapsedShareAtPeriodEnd(lifetimeYears, periodYears) {
    const lifetime = nonNegative(lifetimeYears, 0);
    const period = nonNegative(periodYears, 0);
    if (!(lifetime > 0) || !(period > 0)) return 0;
    const completed = Math.floor((period + EPSILON) / lifetime);
    const elapsed = period - completed * lifetime;
    if (Math.abs(elapsed) < EPSILON) return 0;
    return Math.min(1, Math.max(0, elapsed / lifetime));
  }

  function presentValueDisposal({ cost, priceFactor = 1, interestFactor = 1, lifetimeYears, periodYears }) {
    const full = disposalYears(lifetimeYears, periodYears)
      .reduce((sum, year) => sum + presentValue(cost, priceFactor, interestFactor, year), 0);
    const share = elapsedShareAtPeriodEnd(lifetimeYears, periodYears);
    const proportional = share > 0
      ? presentValue(cost * share, priceFactor, interestFactor, periodYears)
      : 0;
    return full + proportional;
  }

  function presentValueResidual({ initialCost, replacementCost = initialCost, priceFactor = 1, interestFactor = 1, lifetimeYears, periodYears }) {
    const lifetime = nonNegative(lifetimeYears, 0);
    const period = nonNegative(periodYears, 0);
    if (!(lifetime > 0) || !(period > 0)) return 0;
    const exactMultiple = Math.abs(period / lifetime - Math.round(period / lifetime)) < EPSILON;
    if (exactMultiple) return 0;

    if (lifetime > period) {
      const remainingShare = 1 - period / lifetime;
      return presentValue(nonNegative(initialCost) * remainingShare, priceFactor, interestFactor, period);
    }

    const completed = Math.floor(period / lifetime);
    const elapsedSinceReplacement = period - completed * lifetime;
    const remainingShare = 1 - elapsedSinceReplacement / lifetime;
    return presentValue(nonNegative(replacementCost) * remainingShare, priceFactor, interestFactor, period);
  }

  function componentCapitalPresentValue(component, periodYears, interestFactor) {
    const period = nonNegative(periodYears, 0);
    const startYear = nonNegative(component.startYear, 0);
    const lifetime = nonNegative(component.lifetimeYears, 0);
    const capitalP = component.capitalPriceFactor ?? 1;
    const disposalP = component.disposalPriceFactor ?? capitalP;
    const initialCost = nonNegative(component.initialCost, 0);
    const replacementCost = nonNegative(component.replacementCost ?? component.initialCost, 0);
    const disposalCost = nonNegative(component.disposalCost ?? 0, 0);

    if (startYear > period + EPSILON) {
      return { initial: 0, replacements: 0, disposal: 0, residual: 0, total: 0 };
    }

    const initial = presentValue(initialCost, capitalP, interestFactor, startYear);
    let replacements = 0;
    let disposal = 0;
    let lastInstallYear = startYear;
    let lastInstallCost = initialCost;

    if (lifetime > 0) {
      for (let year = startYear + lifetime; year < period - EPSILON; year += lifetime) {
        replacements += presentValue(replacementCost, capitalP, interestFactor, year);
        disposal += presentValue(disposalCost, disposalP, interestFactor, year);
        lastInstallYear = year;
        lastInstallCost = replacementCost;
      }
    }

    let residual = 0;
    if (lifetime > 0 && period > lastInstallYear + EPSILON) {
      const elapsed = period - lastInstallYear;
      const remainingShare = Math.max(0, Math.min(1, 1 - elapsed / lifetime));
      if (remainingShare > EPSILON) {
        residual = presentValue(lastInstallCost * remainingShare, capitalP, interestFactor, period);
        disposal += presentValue(disposalCost * (elapsed / lifetime), disposalP, interestFactor, period);
      } else if (Math.abs(elapsed - lifetime) < EPSILON) {
        disposal += presentValue(disposalCost, disposalP, interestFactor, period);
      }
    }

    return { initial, replacements, disposal, residual, total: initial + replacements + disposal - residual };
  }

  function recurringPresentValueRange(annualCost, priceFactor, interestFactor, startYear, endYear) {
    const start = Math.max(0, nonNegative(startYear, 0));
    const end = Math.max(start, nonNegative(endYear, 0));
    return recurringPresentValueThrough(annualCost, priceFactor, interestFactor, end)
      - recurringPresentValueThrough(annualCost, priceFactor, interestFactor, start);
  }

  function annualGroupPresentValue(items, periodYears, interestFactor) {
    const details = (items ?? []).map((item) => {
      const startYear = Math.min(nonNegative(item.startYear, 0), periodYears);
      const endYear = Math.min(nonNegative(item.endYear ?? periodYears, periodYears), periodYears);
      const present = recurringPresentValueRange(
        item.annualCost,
        item.priceFactor ?? 1,
        interestFactor,
        startYear,
        endYear
      );
      return { ...item, startYear, endYear, presentValue: present };
    });
    return { details, total: details.reduce((sum, item) => sum + item.presentValue, 0) };
  }

  function timedCapitalEventPresentValue(event, interestFactor) {
    const year = nonNegative(event?.year, 0);
    return presentValue(
      finite(event?.amount, 0),
      event?.priceFactor ?? 1,
      interestFactor,
      year
    );
  }

  function timedCapitalEventsPresentValue(events, interestFactor) {
    const details = (events ?? []).map((event) => ({
      ...event,
      year: nonNegative(event?.year, 0),
      presentValue: timedCapitalEventPresentValue(event, interestFactor),
    }));
    return { details, total: details.reduce((sum, item) => sum + item.presentValue, 0) };
  }

  function calculateVariant(variant, assumptions = {}) {
    const periodYears = nonNegative(assumptions.periodYears, 0);
    const interestFactor = assumptions.interestFactor ?? factorFromPercent(assumptions.interestRatePercent ?? 0);
    const capitalDetails = (variant.capitalComponents ?? []).map((component) => ({
      id: component.id ?? null,
      label: component.label ?? null,
      ...componentCapitalPresentValue(component, periodYears, interestFactor),
    }));
    const componentCapital = capitalDetails.reduce((sum, item) => sum + item.total, 0);
    const timedCapital = timedCapitalEventsPresentValue(variant.capitalEvents, interestFactor);
    const capital = componentCapital + timedCapital.total;
    const consumption = annualGroupPresentValue(variant.consumptionCosts, periodYears, interestFactor);
    const operation = annualGroupPresentValue(variant.operationCosts, periodYears, interestFactor);
    const total = capital + consumption.total + operation.total;
    return {
      id: variant.id ?? null,
      label: variant.label ?? null,
      periodYears,
      interestFactor,
      capital: { details: capitalDetails, timedEvents: timedCapital.details, componentTotal: componentCapital, total: capital },
      consumption,
      operation,
      totalPresentValue: total,
      annuity: calculateAnnuity(total, interestFactor, periodYears),
    };
  }

  function calculateAnnuity(totalPresentValue, interestFactor, periodYears) {
    const b = finite(totalPresentValue, 0);
    const q = finite(interestFactor, 1);
    const t = nonNegative(periodYears, 0);
    if (!(t > 0)) return 0;
    if (Math.abs(q - 1) < EPSILON) return b / t;
    return b * (q - 1) / (1 - q ** (-t));
  }

  function capitalEventPresentValueThrough(variant, assumptions, timeYears) {
    const q = assumptions.interestFactor ?? factorFromPercent(assumptions.interestRatePercent ?? 0);
    const t = nonNegative(timeYears, 0);
    let total = 0;
    for (const event of variant.capitalEvents ?? []) {
      const year = nonNegative(event?.year, 0);
      if (year <= t + EPSILON && year <= nonNegative(assumptions.periodYears, t) + EPSILON) {
        total += timedCapitalEventPresentValue(event, q);
      }
    }
    for (const component of variant.capitalComponents ?? []) {
      const startYear = nonNegative(component.startYear, 0);
      if (startYear > t + EPSILON) continue;
      const capitalP = component.capitalPriceFactor ?? 1;
      total += presentValue(nonNegative(component.initialCost, 0), capitalP, q, startYear);
      const lifetime = nonNegative(component.lifetimeYears, 0);
      if (!(lifetime > 0)) continue;
      const replacementCost = component.replacementCost ?? component.initialCost ?? 0;
      const disposalCost = component.disposalCost ?? 0;
      const disposalP = component.disposalPriceFactor ?? capitalP;
      for (let year = startYear + lifetime; year <= t + EPSILON; year += lifetime) {
        if (year < assumptions.periodYears - EPSILON) {
          total += presentValue(replacementCost, capitalP, q, year);
        }
        total += presentValue(disposalCost, disposalP, q, year);
      }
    }
    return total;
  }

  function annualPresentValueThroughVariant(variant, assumptions, timeYears) {
    const q = assumptions.interestFactor ?? factorFromPercent(assumptions.interestRatePercent ?? 0);
    const t = nonNegative(timeYears, 0);
    const items = [...(variant.consumptionCosts ?? []), ...(variant.operationCosts ?? [])];
    return items.reduce((sum, item) => {
      const startYear = Math.min(nonNegative(item.startYear, 0), t);
      const endYear = Math.min(nonNegative(item.endYear ?? t, t), t);
      if (endYear <= startYear + EPSILON) return sum;
      return sum + recurringPresentValueRange(item.annualCost, item.priceFactor ?? 1, q, startYear, endYear);
    }, 0);
  }

  function costAtTimeAverage(variant, assumptions, timeYears) {
    const full = calculateVariant(variant, assumptions);
    return full.capital.total + annualPresentValueThroughVariant(variant, assumptions, timeYears);
  }

  function costAtTimeCumulative(variant, assumptions, timeYears) {
    return capitalEventPresentValueThrough(variant, assumptions, timeYears)
      + annualPresentValueThroughVariant(variant, assumptions, timeYears);
  }

  function interpolateCrossing(y0, y1, d0, d1) {
    if (Math.abs(d1 - d0) < EPSILON) return y1;
    return y0 + (0 - d0) * (y1 - y0) / (d1 - d0);
  }

  function findCrossings(candidate, reference, assumptions, method = 'cumulative') {
    const periodYears = Math.max(0, Math.floor(nonNegative(assumptions.periodYears, 0)));
    const costAt = method === 'average' ? costAtTimeAverage : costAtTimeCumulative;
    const crossings = [];
    let previousYear = 0;
    let previousDifference = costAt(candidate, assumptions, 0) - costAt(reference, assumptions, 0);

    for (let year = 1; year <= periodYears; year += 1) {
      const difference = costAt(candidate, assumptions, year) - costAt(reference, assumptions, year);
      const crossedDown = previousDifference > 0 && difference <= 0;
      const crossedUp = previousDifference < 0 && difference >= 0;
      if (crossedDown || crossedUp) {
        crossings.push({
          type: crossedDown ? 'amortisation' : 'deamortisation',
          year: interpolateCrossing(previousYear, year, previousDifference, difference),
          fromDifference: previousDifference,
          toDifference: difference,
        });
      }
      previousYear = year;
      previousDifference = difference;
    }
    return crossings;
  }

  function differenceSeries(candidate, reference, assumptions, method = 'cumulative', stepYears = 1) {
    const periodYears = nonNegative(assumptions.periodYears, 0);
    const step = Math.max(0.25, finite(stepYears, 1));
    const costAt = method === 'average' ? costAtTimeAverage : costAtTimeCumulative;
    const points = [];
    for (let year = 0; year < periodYears - EPSILON; year += step) {
      const candidateCost = costAt(candidate, assumptions, year);
      const referenceCost = costAt(reference, assumptions, year);
      points.push({
        year,
        candidateCost,
        referenceCost,
        advantage: referenceCost - candidateCost,
      });
    }
    const candidateCost = costAt(candidate, assumptions, periodYears);
    const referenceCost = costAt(reference, assumptions, periodYears);
    points.push({
      year: periodYears,
      candidateCost,
      referenceCost,
      advantage: referenceCost - candidateCost,
    });
    return points;
  }

  function durableAdvantageYear(candidate, reference, assumptions, method = 'cumulative') {
    const crossings = findCrossings(candidate, reference, assumptions, method);
    const endYear = nonNegative(assumptions.periodYears, 0);
    const costAt = method === 'average' ? costAtTimeAverage : costAtTimeCumulative;
    const endDifference = costAt(candidate, assumptions, endYear) - costAt(reference, assumptions, endYear);
    if (!(endDifference < -EPSILON)) return null;
    const amortisations = crossings.filter((entry) => entry.type === 'amortisation');
    return amortisations.length ? amortisations.at(-1).year : 0;
  }

  function compareVariants(candidate, reference, assumptions, method = 'cumulative') {
    const candidateResult = calculateVariant(candidate, assumptions);
    const referenceResult = calculateVariant(reference, assumptions);
    const crossings = findCrossings(candidate, reference, assumptions, method);
    return {
      candidate: candidateResult,
      reference: referenceResult,
      deltaPresentValue: candidateResult.totalPresentValue - referenceResult.totalPresentValue,
      advantagePresentValue: referenceResult.totalPresentValue - candidateResult.totalPresentValue,
      deltaAnnuity: candidateResult.annuity - referenceResult.annuity,
      advantageAnnuity: referenceResult.annuity - candidateResult.annuity,
      crossings,
      durableAdvantageYear: durableAdvantageYear(candidate, reference, assumptions, method),
      series: differenceSeries(candidate, reference, assumptions, method, assumptions.seriesStepYears ?? 1),
    };
  }

  function energyCostCapitalizationFactor(energyPriceFactor, interestFactor, periodYears) {
    return recurringPresentValueThrough(1, energyPriceFactor, interestFactor, periodYears);
  }

  function usefulEnergyPrice(endEnergyPrice, annualEfficiency) {
    const eta = finite(annualEfficiency, 0);
    if (!(eta > 0)) throw new RangeError('Der Nutzwärmefaktor muss größer als 0 sein.');
    return finite(endEnergyPrice, 0) / eta;
  }

  function simplifiedOptimalInsulationThickness(inputs) {
    const lambda = finite(inputs.lambdaWmk, 0);
    const heatingDegreeDays = finite(inputs.heatingDegreeDaysKd, 0);
    const usefulPrice = inputs.usefulEnergyPriceEurKwh ?? usefulEnergyPrice(inputs.endEnergyPriceEurKwh, inputs.annualEfficiency);
    const priceFactor = inputs.energyPriceFactor ?? factorFromPercent(inputs.energyPriceRatePercent ?? 0);
    const interestFactor = inputs.interestFactor ?? factorFromPercent(inputs.interestRatePercent ?? 0);
    const periodYears = nonNegative(inputs.periodYears, 0);
    const volumePrice = finite(inputs.insulationVolumePriceEurM3, 0);
    const baseResistance = finite(inputs.baseResistanceM2KW, 0);
    if (!(lambda > 0) || !(heatingDegreeDays > 0) || !(volumePrice > 0) || !(periodYears > 0)) {
      throw new RangeError('Für die vereinfachte Optimierung fehlen positive Eingabewerte.');
    }
    const capitalization = energyCostCapitalizationFactor(priceFactor, interestFactor, periodYears);
    const rootTerm = heatingDegreeDays * 24 * usefulPrice * capitalization
      / (lambda * 1000 * volumePrice);
    const raw = lambda * (Math.sqrt(Math.max(rootTerm, 0)) - baseResistance);
    return {
      optimalThicknessM: Math.max(0, raw),
      rawOptimalThicknessM: raw,
      usefulEnergyPriceEurKwh: usefulPrice,
      energyCostCapitalizationFactor: capitalization,
      baseResistanceM2KW: baseResistance,
      limitations: [
        'nur opake Bauteile gegen Außenluft',
        'eine einzelne veränderbare wärmeschutztechnisch wirksame Schicht',
        'ohne Förderung, Instandhaltung, Entsorgung und Geometrieänderung',
        'nicht für erdberührte Bauteile',
      ],
    };
  }

  return {
    MODEL_VERSION,
    NORM_REFERENCE,
    factorFromPercent,
    presentValue,
    presentValueInitial,
    recurringPresentValueThrough,
    recurringPresentValueRange,
    presentValueReplacements,
    presentValueDisposal,
    presentValueResidual,
    timedCapitalEventPresentValue,
    timedCapitalEventsPresentValue,
    calculateVariant,
    calculateAnnuity,
    costAtTimeAverage,
    costAtTimeCumulative,
    findCrossings,
    differenceSeries,
    durableAdvantageYear,
    compareVariants,
    energyCostCapitalizationFactor,
    usefulEnergyPrice,
    simplifiedOptimalInsulationThickness,
  };
});
