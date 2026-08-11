'use strict';

/*
 * Diagnosewerkzeug für die Praxisvalidierung des unabhängigen „HWB aus U-Werten“.
 * Die Fälle sind bewusst anonymisiert und enthalten nur die numerischen Größen,
 * die für den Methodenvergleich benötigt werden. Sie legen NOCH KEINEN fachlichen
 * Sollwert fest. Der produktive Energiefluss-Rechenkern bleibt unverändert.
 */

const assert = require('node:assert/strict');

const cases = [
  {
    id: 'A', kind: 'real + Energieausweis',
    correctedHwb: 51.20798319327731, bgf: 3400,
    uaAfterWallSemantics: 1368.5, nat: -10.5, fullLoadHours: 2047.2094957983195,
    ventilation: 88000, internalGains: 60312.6, solarGains: 49000,
    expectedCurrentAfterWallSemantics: 16.31953818248161,
    expectedNoExplicitGains: 48.47030288836397,
  },
  {
    id: 'B', kind: 'real + Energieausweis',
    correctedHwb: 181.5237583774927, bgf: 131,
    uaAfterWallSemantics: 287.5, nat: -12.8, fullLoadHours: 2284.9590698869474,
    ventilation: 3969.9, internalGains: 3074.76, solarGains: 2450,
    expectedCurrentAfterWallSemantics: 137.9951566299755,
    expectedNoExplicitGains: 180.16889708799076,
  },
  {
    id: 'C', kind: 'theoretischer Testfall',
    correctedHwb: 177.82738095238093, bgf: 150,
    uaAfterWallSemantics: 474.5, nat: -12.7, fullLoadHours: 2024.9456162970603,
    ventilation: 4100, internalGains: 2838.24, solarGains: 3062.5,
    expectedCurrentAfterWallSemantics: 178.73716455577377,
    expectedNoExplicitGains: 218.07543122244044,
  },
  {
    id: 'D', kind: 'real, ohne Energieausweis',
    correctedHwb: 159.07459374796056, bgf: 220,
    uaAfterWallSemantics: 594, nat: -12.5, fullLoadHours: 2101.98,
    ventilation: 9405, internalGains: 3902.58, solarGains: 8575,
    expectedCurrentAfterWallSemantics: 153.81114339772728,
    expectedNoExplicitGains: 210.527416125,
  },
];

function close(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

const diagnostics = cases.map((item) => {
  const hgt15 = item.fullLoadHours * (15 - item.nat);
  const transmission = item.uaAfterWallSemantics * hgt15 / 1000;
  const bridges = transmission * 0.075;
  const grossLossBeforeGains = transmission + bridges + item.ventilation;
  const gains = item.internalGains + item.solarGains;
  const currentHwb = Math.max(grossLossBeforeGains - gains, 0) / item.bgf;
  const noExplicitGainsHwb = grossLossBeforeGains / item.bgf;
  const targetRoomHeat = item.correctedHwb * item.bgf;
  const gainUtilizationRequired = gains > 0
    ? (grossLossBeforeGains - targetRoomHeat) / gains
    : null;

  close(currentHwb, item.expectedCurrentAfterWallSemantics);
  close(noExplicitGainsHwb, item.expectedNoExplicitGains);

  return {
    id: item.id,
    kind: item.kind,
    correctedHwb: Number(item.correctedHwb.toFixed(1)),
    currentHwb: Number(currentHwb.toFixed(1)),
    noExplicitGainsHwb: Number(noExplicitGainsHwb.toFixed(1)),
    gainUtilizationRequired: gainUtilizationRequired === null
      ? null
      : Number(gainUtilizationRequired.toFixed(3)),
  };
});

console.log(JSON.stringify({
  passed: true,
  note: 'Diagnose – kein produktiver Sollwert. Negative bzw. >1 liegende erforderliche Gewinnnutzungsgrade zeigen, dass ein einzelner pauschaler Gewinnfaktor die vier Fälle nicht konsistent erklärt.',
  diagnostics,
}, null, 2));
