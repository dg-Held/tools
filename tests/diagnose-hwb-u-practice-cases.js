'use strict';

/*
 * Praxisdiagnose für den unabhängigen „HWB aus U-Werten“.
 * Die Fälle sind anonymisiert. Sie dokumentieren sowohl den früheren Ansatz
 * (HGT15 + vollständiger Gewinnabzug) als auch den festgelegten V1.0-Methodenstand
 * (Raumtemperaturbezug + 55 % Gewinnnutzung). Die Referenzwerte sind
 * Beratungskontrollen und keine normativen Sollwerte.
 */

const assert = require('node:assert/strict');

const cases = [
  {
    id: 'A', kind: 'real + Energieausweis',
    referenceHwb: 48.0, bgf: 3400,
    ua: 1368.5, nat: -10.5, fullLoadHours: 2047.2094957983195,
    ventilation: 88000, internalGains: 60312.6, solarGains: 49000,
    expectedCandidate: 36.987996011121325,
  },
  {
    id: 'B', kind: 'real + Energieausweis / Verbrauchsreferenz',
    referenceHwb: 181.5237583774927, bgf: 131,
    ua: 287.5, nat: -12.8, fullLoadHours: 2284.9590698869474,
    ventilation: 3969.9, internalGains: 3074.76, solarGains: 2450,
    expectedCandidate: 194.7089592082849,
  },
  {
    id: 'C', kind: 'theoretischer Testfall',
    referenceHwb: 177.82738095238093, bgf: 150,
    ua: 474.5, nat: -12.7, fullLoadHours: 2024.9456162970603,
    ventilation: 4100, internalGains: 2838.24, solarGains: 3062.5,
    expectedCandidate: 244.64135875157706,
  },
  {
    id: 'D', kind: 'real, ohne Energieausweis',
    referenceHwb: 159.07459374796056, bgf: 220,
    ua: 594, nat: -12.5, fullLoadHours: 2101.98,
    ventilation: 9405, internalGains: 3902.58, solarGains: 8575,
    expectedCandidate: 222.040444775,
  },
  {
    id: 'E', kind: 'real + Bestands-Energieausweis',
    referenceHwb: 79.3, bgf: 580,
    ua: 500.5, nat: -12.6, fullLoadHours: 2014,
    ventilation: 16800, internalGains: 10289, solarGains: 12250,
    expectedCandidate: 72.23512131896554,
  },
];

const indoorTemperatureC = 22;
const gainUtilizationFactor = 0.55;

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

const diagnostics = cases.map((item) => {
  const hgt15 = item.fullLoadHours * (15 - item.nat);
  const transmission15 = item.ua * hgt15 / 1000;
  const bridges15 = transmission15 * 0.075;
  const gains = item.internalGains + item.solarGains;
  const formerHwb = Math.max(transmission15 + bridges15 + item.ventilation - gains, 0) / item.bgf;

  const hgtCandidate = item.fullLoadHours * (indoorTemperatureC - item.nat);
  const transmissionCandidate = item.ua * hgtCandidate / 1000;
  const bridgesCandidate = transmissionCandidate * 0.075;
  const utilizedGains = gains * gainUtilizationFactor;
  const candidateHwb = Math.max(
    transmissionCandidate + bridgesCandidate + item.ventilation - utilizedGains,
    0
  ) / item.bgf;

  close(candidateHwb, item.expectedCandidate);

  return {
    id: item.id,
    kind: item.kind,
    referenceHwb: Number(item.referenceHwb.toFixed(1)),
    formerHwb: Number(formerHwb.toFixed(1)),
    candidateHwb: Number(candidateHwb.toFixed(1)),
    candidateDeviationPercent: Number(((candidateHwb - item.referenceHwb) / item.referenceHwb * 100).toFixed(1)),
  };
});

console.log(JSON.stringify({
  passed: true,
  method: {
    indoorTemperatureC,
    gainUtilizationFactor,
    note: 'V1.0-Beratungsmodell; keine Norm-HWB-Berechnung. Weitere reale Energieausweise können den Regressionssatz in V1.x ergänzen.',
  },
  diagnostics,
}, null, 2));
