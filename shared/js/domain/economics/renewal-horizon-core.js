'use strict';

(function initRenewalHorizonCore(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EnergyRenewalHorizonCore = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis, function renewalHorizonFactory() {
  const MODEL_VERSION = '0.1.0';

  function finite(value, fallback = null) {
    if (value === '' || value === null || value === undefined) return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function calculate(options = {}) {
    const currentYear = finite(options.currentYear, new Date().getFullYear());
    const explicitOffset = finite(options.explicitOffsetYears, null);
    if (options.explicitConfirmed && explicitOffset !== null) {
      return { years: Math.max(0, explicitOffset), source: 'concrete', basis: 'konkreter Sanierungs-/Ersatztermin' };
    }

    const explicitCalendarYear = finite(options.explicitCalendarYear, null);
    if (options.explicitConfirmed && explicitCalendarYear !== null) {
      return { years: Math.max(0, explicitCalendarYear - currentYear), source: 'concrete', basis: 'konkreter Sanierungs-/Ersatztermin' };
    }

    const lifetimeYears = finite(options.lifetimeYears, null);
    const conditionFactor = Math.max(0.5, finite(options.condition?.horizon_factor, finite(options.conditionFactor, 1)));
    if (!(lifetimeYears > 0)) return { years: null, source: 'open', basis: 'typische Nutzungsdauer fehlt' };

    const lastRenewalYear = finite(options.lastRenewalYear, null);
    const constructionYear = finite(options.constructionYear, null);
    const baseYear = lastRenewalYear ?? constructionYear;
    if (!(baseYear > 0)) return { years: null, source: 'open', basis: 'Bauteilalter / Erneuerungsjahr offen' };

    const typicalHorizon = lifetimeYears * conditionFactor;
    const age = Math.max(0, currentYear - baseYear);
    return {
      years: Math.max(0, typicalHorizon - age),
      source: lastRenewalYear !== null ? 'renewal-year-condition' : 'building-age-fallback',
      basis: lastRenewalYear !== null
        ? 'letztes Erneuerungsjahr + typische Nutzungsdauer + Zustand'
        : 'Gebäudealter-Fallback + typische Nutzungsdauer + Zustand',
    };
  }

  return { MODEL_VERSION, calculate };
});
