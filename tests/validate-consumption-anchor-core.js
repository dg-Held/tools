'use strict';

global.window = globalThis;
require('../shared/js/domain/energy-flow/energy-flow-core.js');
require('../shared/js/domain/economics/energy-anchor-core.js');

const core = globalThis.EnergyConsumptionAnchorCore;
if (!core) throw new Error('EnergyConsumptionAnchorCore fehlt.');

const assumptions = {
  hotWaterKwhPerPerson: 1000,
  internalGainsWM2: 2.7,
  solarRadiationFactor: 175,
  glazingShare: 0.7,
  solarUtilizationFactor: 1,
  comparisonGainUtilizationFactor: 0.55,
  ventilationLossKwhM3a: 10,
  thermalBridgeShare: 0.075,
};
const common = {
  annualEnergyKwh: 20000,
  usefulHeatFactor: 0.85,
  hotWaterIncluded: false,
  persons: 0,
  heatedFloorAreaM2: 140,
  grossFloorAreaM2: 180,
  grossVolumeM3: 520,
  indoorTemperatureC: 20,
  heatedSharePercent: 100,
  climate: { natC: -12, averageFullLoadHours: 2625, balanceTemperatureC: 15, source: 'Testklima' },
  assumptions,
};
const base = {
  ...common,
  components: [
    { id: 'exteriorWall', label: 'Außenwand', enabled: true, areaM2: 180, uValue: 1.2 },
    { id: 'windows', label: 'Fenster', enabled: true, areaM2: 30, uValue: 2.2 },
    { id: 'topFloorCeiling', label: 'OGD', enabled: true, areaM2: 90, uValue: 0.8 },
  ],
};
const candidate = {
  ...common,
  components: base.components.map((item) => item.id === 'exteriorWall' ? { ...item, uValue: 0.2 } : { ...item }),
};
const result = core.compare(base, candidate);
if (!(result.available && result.physicalRatio > 0 && result.physicalRatio < 1)) throw new Error('Physikalischer Maßnahmenfaktor ist nicht plausibel.');
if (!(result.realRoomAfterKwh < result.realRoomBeforeKwh)) throw new Error('Verbrauchsverankerter Raumwärmebedarf sinkt nicht.');
if (!(result.deliveredSavingsKwh > 0 && result.deliveredSavingsKwh < base.annualEnergyKwh)) throw new Error('Verbrauchsverankerte Einsparung ist nicht plausibel begrenzt.');
console.log('OK consumption-anchor', {
  ratio: Number(result.physicalRatio.toFixed(4)),
  deliveredSavingsKwh: Math.round(result.deliveredSavingsKwh),
  hwbDeviationPercent: Math.round(result.hwbDeviationPercent ?? 0),
});
