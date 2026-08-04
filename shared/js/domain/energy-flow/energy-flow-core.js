'use strict';

(function initEnergyFlowCore(global) {
  const MODEL_VERSION = '4.2.0';

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function optionalFinite(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function positive(value, fallback = 0) {
    return Math.max(finite(value, fallback), 0);
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function calculate(inputs) {
    const assumptions = inputs.assumptions ?? {};
    const annualEnergyKwh = positive(inputs.annualEnergyKwh);
    const usefulHeatFactor = clamp(finite(inputs.usefulHeatFactor, 0.85), 0.01, 1);
    const persons = positive(inputs.persons);
    const hotWaterIncluded = Boolean(inputs.hotWaterIncluded);
    const heatedFloorAreaM2 = positive(inputs.heatedFloorAreaM2);
    const grossFloorAreaM2 = positive(inputs.grossFloorAreaM2);
    const grossVolumeM3 = positive(inputs.grossVolumeM3);
    const indoorTemperatureC = finite(inputs.indoorTemperatureC, 20);
    const heatedSharePercent = clamp(finite(inputs.heatedSharePercent, 100), 0, 100);

    const hotWaterKwhPerPerson = positive(assumptions.hotWaterKwhPerPerson, 1000);
    const internalGainsWM2 = positive(assumptions.internalGainsWM2, 2.7);
    const solarRadiationFactor = positive(assumptions.solarRadiationFactor, 175);
    const glazingShare = clamp(finite(assumptions.glazingShare, 0.70), 0, 1);
    const solarUtilizationFactor = clamp(finite(assumptions.solarUtilizationFactor, 0.70), 0, 1);
    const ventilationLossKwhM3a = positive(assumptions.ventilationLossKwhM3a, 10);
    const thermalBridgeShare = clamp(finite(assumptions.thermalBridgeShare, 0.075), 0, 0.5);

    const components = (inputs.components ?? [])
      .map((component) => {
        const areaM2 = positive(component.areaM2);
        const uValue = positive(component.uValue);
        const enabled = Boolean(component.enabled);
        return {
          id: component.id,
          label: component.label,
          enabled,
          areaM2,
          uValue,
          uaWK: enabled ? areaM2 * uValue : 0,
        };
      });

    const activeComponents = components.filter((component) => component.enabled && component.uaWK > 0);
    const totalUaWK = activeComponents.reduce((sum, component) => sum + component.uaWK, 0);
    const windowAreaM2 = components.find((component) => component.id === 'windows')?.areaM2 ?? 0;
    const conditionedVolumeM3 = grossVolumeM3 * heatedSharePercent / 100;

    const roomCorrection = 1 + ((indoorTemperatureC - 20) * 0.06);
    const heatedAreaCorrection = 1 + ((heatedSharePercent - 100) * 0.005);

    const usefulHeatTotalKwh = annualEnergyKwh * usefulHeatFactor;
    const hotWaterKwh = hotWaterIncluded ? persons * hotWaterKwhPerPerson : 0;
    const roomHeatRawKwh = usefulHeatTotalKwh - hotWaterKwh;
    const roomHeatKwh = Math.max(roomHeatRawKwh, 0);
    const systemLossKwh = Math.max(annualEnergyKwh - usefulHeatTotalKwh, 0);

    const internalGainsKwh = internalGainsWM2 * heatedFloorAreaM2 * 8.76;
    const solarGainsKwh = solarRadiationFactor * windowAreaM2 * glazingShare * solarUtilizationFactor;
    const ventilationLossKwh = ventilationLossKwhM3a * conditionedVolumeM3;
    const totalInputsKwh = annualEnergyKwh + internalGainsKwh + solarGainsKwh;

    const residualEnvelopeWithBridgesKwh =
      totalInputsKwh - systemLossKwh - hotWaterKwh - ventilationLossKwh;
    const componentLossKwh = Math.max(residualEnvelopeWithBridgesKwh, 0) / (1 + thermalBridgeShare);
    const thermalBridgeLossKwh = componentLossKwh * thermalBridgeShare;
    const calibrationKwhPerWK = totalUaWK > 0 ? componentLossKwh / totalUaWK : 0;

    const componentResults = components.map((component) => ({
      ...component,
      lossKwh: component.enabled && totalUaWK > 0
        ? component.uaWK * calibrationKwhPerWK
        : 0,
      sharePercent: component.enabled && totalUaWK > 0
        ? component.uaWK / totalUaWK * 100
        : 0,
    }));

    const totalLossesKwh = componentLossKwh + thermalBridgeLossKwh + ventilationLossKwh + systemLossKwh + hotWaterKwh;
    const safeBgf = grossFloorAreaM2 > 0 ? grossFloorAreaM2 : null;
    const safeHeatedArea = heatedFloorAreaM2 > 0 ? heatedFloorAreaM2 : null;
    const hwbConsumptionKwhM2a = safeBgf ? roomHeatKwh / safeBgf : null;
    const hwbCorrectedKwhM2a = hwbConsumptionKwhM2a !== null && roomCorrection > 0 && heatedAreaCorrection > 0
      ? hwbConsumptionKwhM2a / roomCorrection / heatedAreaCorrection
      : null;
    const specificDeliveredKwhM2a = safeHeatedArea ? annualEnergyKwh / safeHeatedArea : null;
    const specificRoomHeatKwhM2a = safeHeatedArea ? roomHeatKwh / safeHeatedArea : null;

    /*
     * Unabhängige Hüllplausibilität:
     * Das gemeinsame Klimatool speichert die mittleren Vollbenutzungsstunden nach
     * Σ max(0, (15 - Ta) / (15 - NAT)). Daraus lassen sich die Heizgradstunden
     * zur Bilanztemperatur 15 °C exakt zurückrechnen.
     *
     * Der Vergleich ist bewusst überschlägig: Transmission + Wärmebrücken +
     * Lüftungsannahme minus interne/solare Gewinne. Er kalibriert sich NICHT am
     * gemessenen Verbrauch und eignet sich deshalb zur Plausibilisierung.
     */
    const climate = inputs.climate ?? {};
    const natC = optionalFinite(climate.natC);
    const averageFullLoadHours = optionalFinite(climate.averageFullLoadHours);
    const balanceTemperatureC = optionalFinite(climate.balanceTemperatureC) ?? 15;
    const climateAvailable = natC !== null
      && averageFullLoadHours !== null
      && averageFullLoadHours > 0
      && balanceTemperatureC > natC
      && totalUaWK > 0;

    let plausibility = {
      available: false,
      natC,
      averageFullLoadHours,
      balanceTemperatureC,
      period: climate.period ?? null,
      source: climate.source ?? null,
      heatingDegreeHoursKh: null,
      transmissionKwh: null,
      thermalBridgesKwh: null,
      ventilationKwh: ventilationLossKwh,
      gainsKwh: internalGainsKwh + solarGainsKwh,
      calculatedRoomHeatKwh: null,
      calculatedDeliveredKwh: null,
      calculatedHwbKwhM2a: null,
      deviationKwh: null,
      deviationPercent: null,
    };

    if (climateAvailable) {
      const heatingDegreeHoursKh = averageFullLoadHours * (balanceTemperatureC - natC);
      const calculatedTransmissionKwh = totalUaWK * heatingDegreeHoursKh / 1000;
      const calculatedThermalBridgesKwh = calculatedTransmissionKwh * thermalBridgeShare;
      const calculatedGrossHeatLossKwh = calculatedTransmissionKwh
        + calculatedThermalBridgesKwh
        + ventilationLossKwh;
      const calculatedRoomHeatKwh = Math.max(
        calculatedGrossHeatLossKwh - internalGainsKwh - solarGainsKwh,
        0
      );
      const calculatedDeliveredKwh = (calculatedRoomHeatKwh + hotWaterKwh) / usefulHeatFactor;
      const deviationKwh = calculatedDeliveredKwh - annualEnergyKwh;
      const deviationPercent = annualEnergyKwh > 0
        ? deviationKwh / annualEnergyKwh * 100
        : null;

      plausibility = {
        ...plausibility,
        available: true,
        heatingDegreeHoursKh,
        transmissionKwh: calculatedTransmissionKwh,
        thermalBridgesKwh: calculatedThermalBridgesKwh,
        calculatedRoomHeatKwh,
        calculatedDeliveredKwh,
        calculatedHwbKwhM2a: safeBgf ? calculatedRoomHeatKwh / safeBgf : null,
        deviationKwh,
        deviationPercent,
      };
    }

    const warnings = [];
    if (roomHeatRawKwh < 0) {
      warnings.push('Der Warmwasserabzug ist größer als die berechnete Nutzwärme. Verbrauch, Nutzungsgrad oder Personenzahl prüfen.');
    }
    if (residualEnvelopeWithBridgesKwh < 0) {
      warnings.push('Die gewählten Eingaben ergeben negative Verluste der Gebäudehülle. Verbrauch, Volumen, Lüftungsannahme oder Nutzungsgrad prüfen.');
    }
    if (!activeComponents.length) {
      warnings.push('Es ist kein Bauteil mit positiver Fläche und positivem U-Wert aktiviert.');
    }
    const upperActive = components.filter((component) => ['topFloorCeiling', 'roof'].includes(component.id) && component.enabled);
    const lowerActive = components.filter((component) => ['basementCeiling', 'groundFloor'].includes(component.id) && component.enabled);
    if (upperActive.length > 1) warnings.push('OGD und Dach sind gleichzeitig aktiv. Das ist nur bei tatsächlich getrennten Teilflächen sinnvoll.');
    if (lowerActive.length > 1) warnings.push('Kellerdecke und Boden/unterste Geschoßdecke sind gleichzeitig aktiv. Teilflächen bitte prüfen.');

    return {
      modelVersion: MODEL_VERSION,
      assumptions: {
        hotWaterKwhPerPerson,
        internalGainsWM2,
        solarRadiationFactor,
        glazingShare,
        solarUtilizationFactor,
        ventilationLossKwhM3a,
        thermalBridgeShare,
      },
      inputs: {
        annualEnergyKwh,
        usefulHeatFactor,
        persons,
        hotWaterIncluded,
        heatedFloorAreaM2,
        grossFloorAreaM2,
        grossVolumeM3,
        conditionedVolumeM3,
        indoorTemperatureC,
        heatedSharePercent,
      },
      corrections: { roomCorrection, heatedAreaCorrection },
      gains: {
        internalKwh: internalGainsKwh,
        solarKwh: solarGainsKwh,
        deliveredKwh: annualEnergyKwh,
        totalKwh: totalInputsKwh,
      },
      losses: {
        componentsKwh: componentLossKwh,
        thermalBridgesKwh: thermalBridgeLossKwh,
        ventilationKwh: ventilationLossKwh,
        systemKwh: systemLossKwh,
        hotWaterKwh,
        totalKwh: totalLossesKwh,
      },
      consumption: {
        usefulHeatTotalKwh,
        roomHeatKwh,
        specificDeliveredKwhM2a,
        specificRoomHeatKwhM2a,
        hwbConsumptionKwhM2a,
        hwbCorrectedKwhM2a,
      },
      envelope: {
        totalUaWK,
        calibrationKwhPerWK,
        components: componentResults,
      },
      plausibility,
      balanceDifferenceKwh: totalInputsKwh - totalLossesKwh,
      warnings,
    };
  }

  global.EnergyFlowCore = Object.freeze({ MODEL_VERSION, calculate });
})(window);
