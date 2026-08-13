'use strict';

(function initEnergyAnchorCore(global) {
  const flowCore = global.EnergyFlowCore;
  const MODEL_VERSION = '0.3.0';

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function compare(baseInputs, candidateInputs) {
    if (!flowCore?.calculate) throw new Error('EnergyFlowCore ist für die verbrauchsverankerte Einsparung erforderlich.');

    const base = flowCore.calculate(baseInputs ?? {});
    const candidate = flowCore.calculate(candidateInputs ?? baseInputs ?? {});
    const physicalBefore = finite(base.plausibility?.calculatedRoomHeatKwh, 0);
    const physicalAfter = finite(candidate.plausibility?.calculatedRoomHeatKwh, physicalBefore);
    const physicalRatio = physicalBefore > 0
      ? clamp(physicalAfter / physicalBefore, 0, 2)
      : 1;
    const realRoomBefore = finite(base.consumption?.roomHeatKwh, 0);
    const realRoomAfter = Math.max(0, realRoomBefore * physicalRatio);
    const usefulSavingsKwh = Math.max(0, realRoomBefore - realRoomAfter);
    const baseEfficiency = Math.max(0.01, finite(base.inputs?.usefulHeatFactor, 1));
    const deliveredSavingsKwh = usefulSavingsKwh / baseEfficiency;
    const correctedHwb = finite(base.consumption?.hwbCorrectedKwhM2a, 0);
    const physicalHwb = finite(base.plausibility?.calculatedHwbKwhM2a, 0);
    const hwbDeviationPercent = correctedHwb > 0 && physicalHwb > 0
      ? (physicalHwb - correctedHwb) / correctedHwb * 100
      : null;

    return {
      modelVersion: MODEL_VERSION,
      base,
      candidate,
      physicalBeforeKwh: physicalBefore,
      physicalAfterKwh: physicalAfter,
      physicalRatio,
      realRoomBeforeKwh: realRoomBefore,
      realRoomAfterKwh: realRoomAfter,
      usefulSavingsKwh,
      deliveredSavingsKwh,
      correctedHwbKwhM2a: correctedHwb || null,
      physicalHwbKwhM2a: physicalHwb || null,
      hwbDeviationPercent,
      available: physicalBefore > 0 && realRoomBefore >= 0,
    };
  }

  global.EnergyConsumptionAnchorCore = Object.freeze({ MODEL_VERSION, compare });
})(typeof window !== 'undefined' ? window : globalThis);
