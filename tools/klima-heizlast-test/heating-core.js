'use strict';

(function initHeatingCore(global) {
  const HEATING_LIMIT_C = 15;

  const BUILDING_RANGES = {
    unsanierter_altbau: {
      label: 'Unsanierter Altbau',
      minimum_w_m2: 120,
      maximum_w_m2: 160,
    },
    teilsanierter_bestand: {
      label: 'Teilsanierter Bestand',
      minimum_w_m2: 80,
      maximum_w_m2: 120,
    },
    sanierter_bestand: {
      label: 'Sanierter Bestand',
      minimum_w_m2: 50,
      maximum_w_m2: 80,
    },
    neuerer_standard: {
      label: 'Neuerer Standard / Neubau',
      minimum_w_m2: 40,
      maximum_w_m2: 70,
    },
  };

  function finite(value, fallback = null) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function positive(value, fallback = 0) {
    const number = finite(value, fallback);
    return Math.max(number, 0);
  }

  function quantileSorted(sortedValues, probability) {
    if (!Array.isArray(sortedValues) || sortedValues.length === 0) {
      return null;
    }

    if (sortedValues.length === 1) {
      return sortedValues[0];
    }

    const position = (sortedValues.length - 1) * probability;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const weight = position - lower;

    return (
      sortedValues[lower] * (1 - weight) +
      sortedValues[upper] * weight
    );
  }

  function calculateHeatingLoad(climateResult, inputs) {
    if (!climateResult?.metrics || !climateResult?.duration_curve) {
      throw new Error('Für die Heizlastabschätzung fehlen Klimadaten.');
    }

    const fullLoadHours = positive(
      climateResult.metrics.average_full_load_hours
    );

    if (!(fullLoadHours > 0)) {
      throw new Error('Die klimatischen Vollbenutzungsstunden sind ungültig.');
    }

    const natC = finite(climateResult.location?.nat_c);
    if (!(natC < HEATING_LIMIT_C)) {
      throw new Error('Die Normaußentemperatur ist ungültig.');
    }

    const annualConsumptionKwh = positive(inputs.annual_consumption_kwh);
    const usefulHeatFactor = positive(inputs.useful_heat_factor, 1);
    const persons = positive(inputs.persons);
    const hotWaterIncluded = Boolean(inputs.hot_water_included);

    const usefulHeatTotalKwh =
      annualConsumptionKwh * usefulHeatFactor;

    const hotWaterKwh = hotWaterIncluded
      ? persons * 1000
      : 0;

    const roomHeatRawKwh = usefulHeatTotalKwh - hotWaterKwh;
    const roomHeatKwh = Math.max(roomHeatRawKwh, 0);
    const consumptionLoadKw = roomHeatKwh / fullLoadHours;

    const heatedAreaM2 = positive(inputs.heated_area_m2);
    const buildingRange =
      BUILDING_RANGES[inputs.building_condition] ??
      BUILDING_RANGES.teilsanierter_bestand;

    const areaLoadMinimumKw =
      heatedAreaM2 * buildingRange.minimum_w_m2 / 1000;
    const areaLoadMaximumKw =
      heatedAreaM2 * buildingRange.maximum_w_m2 / 1000;
    const areaLoadMiddleKw =
      (areaLoadMinimumKw + areaLoadMaximumKw) / 2;

    const hwbKwhM2a = positive(inputs.hwb_kwh_m2a);
    const bgfM2 = positive(inputs.bgf_m2);
    const hwbAnnualHeatKwh = hwbKwhM2a > 0 && bgfM2 > 0
      ? hwbKwhM2a * bgfM2
      : null;
    const hwbLoadKw = hwbAnnualHeatKwh !== null
      ? hwbAnnualHeatKwh / fullLoadHours
      : null;

    /*
      Für den Kesselvergleich wird vorrangig die Verbrauchsmethode verwendet.
      Fehlt sie, dient die Mitte der Flächenbandbreite als Rückfallebene.
    */
    const referenceMethod = consumptionLoadKw > 0
      ? 'verbrauch'
      : 'flaeche_mittel';
    const referenceLoadKw = consumptionLoadKw > 0
      ? consumptionLoadKw
      : areaLoadMiddleKw;

    const installedMaximumKw = positive(inputs.installed_maximum_kw);
    const installedMinimumRaw = finite(inputs.installed_minimum_kw);
    const installedMinimumKw =
      installedMinimumRaw !== null && installedMinimumRaw > 0
        ? installedMinimumRaw
        : null;

    const dimensioningFactor =
      installedMaximumKw > 0 && referenceLoadKw > 0
        ? installedMaximumKw / referenceLoadKw
        : null;

    const reservePercent =
      dimensioningFactor !== null
        ? (dimensioningFactor - 1) * 100
        : null;

    const utilizationAtNatPercent =
      installedMaximumKw > 0 && referenceLoadKw > 0
        ? referenceLoadKw / installedMaximumKw * 100
        : null;

    const theoreticalFullLoadTemperatureC =
      dimensioningFactor !== null
        ? HEATING_LIMIT_C -
          dimensioningFactor * (HEATING_LIMIT_C - natC)
        : null;

    const medianTemperatures =
      climateResult.duration_curve.median_c
        .map((value) => Number(value))
        .filter(Number.isFinite);

    const requiredPowerCurveKw = medianTemperatures.map((temperature) => {
      const relativeLoad = Math.max(
        0,
        (HEATING_LIMIT_C - temperature) /
          (HEATING_LIMIT_C - natC)
      );
      return referenceLoadKw * relativeLoad;
    });

    const heatingPowersAscending = requiredPowerCurveKw
      .filter((power) => power > 0)
      .sort((a, b) => a - b);

    const heatingHours = heatingPowersAscending.length;

    /*
      Leistung zur Abdeckung eines Anteils der Heizstunden:
      90 % bedeutet, dass während 90 % der Stunden mit Heizbedarf
      die benötigte Leistung höchstens diesem Wert entspricht.
      Die kältesten 10 % der Heizstunden liegen darüber.
    */
    const powerFor90PercentHoursKw = quantileSorted(
      heatingPowersAscending,
      0.90
    );
    const hoursAbove90PercentPower =
      powerFor90PercentHoursKw !== null
        ? requiredPowerCurveKw.filter(
            (power) => power > powerFor90PercentHoursKw
          ).length
        : null;

    const hoursAboveInstalledMaximum =
      installedMaximumKw > 0
        ? requiredPowerCurveKw.filter(
            (power) => power > installedMaximumKw
          ).length
        : null;

    const hoursBelowMinimum =
      installedMinimumKw !== null
        ? requiredPowerCurveKw.filter(
            (power) =>
              power > 0 && power < installedMinimumKw
          ).length
        : null;

    const shareBelowMinimumPercent =
      hoursBelowMinimum !== null && heatingHours > 0
        ? hoursBelowMinimum / heatingHours * 100
        : null;

    const minimumPowerThresholdTemperatureC =
      installedMinimumKw !== null && referenceLoadKw > 0
        ? HEATING_LIMIT_C -
          (installedMinimumKw / referenceLoadKw) *
            (HEATING_LIMIT_C - natC)
        : null;

    const warnings = [];

    if (roomHeatRawKwh < 0) {
      warnings.push(
        'Der berechnete Warmwasseranteil ist größer als die Nutzwärme. Verbrauch, Faktor oder Personenzahl prüfen.'
      );
    }

    if (
      installedMinimumKw !== null &&
      installedMaximumKw > 0 &&
      installedMinimumKw > installedMaximumKw
    ) {
      warnings.push(
        'Die minimale Leistung ist größer als die installierte Maximalleistung.'
      );
    }

    return {
      assumptions: {
        heating_limit_c: HEATING_LIMIT_C,
        hot_water_kwh_per_person: 1000,
        full_load_hours: fullLoadHours,
        nat_c: natC,
      },
      consumption: {
        annual_consumption_kwh: annualConsumptionKwh,
        useful_heat_factor: usefulHeatFactor,
        useful_heat_total_kwh: usefulHeatTotalKwh,
        hot_water_kwh: hotWaterKwh,
        room_heat_raw_kwh: roomHeatRawKwh,
        room_heat_kwh: roomHeatKwh,
        heat_load_kw: consumptionLoadKw,
      },
      area_method: {
        heated_area_m2: heatedAreaM2,
        building_condition: inputs.building_condition,
        label: buildingRange.label,
        minimum_w_m2: buildingRange.minimum_w_m2,
        maximum_w_m2: buildingRange.maximum_w_m2,
        minimum_kw: areaLoadMinimumKw,
        maximum_kw: areaLoadMaximumKw,
        middle_kw: areaLoadMiddleKw,
      },
      hwb_method: {
        hwb_kwh_m2a: hwbKwhM2a,
        bgf_m2: bgfM2,
        annual_heat_kwh: hwbAnnualHeatKwh,
        heat_load_kw: hwbLoadKw,
      },
      comparison: {
        reference_method: referenceMethod,
        reference_load_kw: referenceLoadKw,
        installed_maximum_kw: installedMaximumKw,
        installed_minimum_kw: installedMinimumKw,
        dimensioning_factor: dimensioningFactor,
        reserve_percent: reservePercent,
        utilization_at_nat_percent: utilizationAtNatPercent,
        theoretical_full_load_temperature_c:
          theoreticalFullLoadTemperatureC,
        minimum_power_threshold_temperature_c:
          minimumPowerThresholdTemperatureC,
        heating_hours: heatingHours,
        hours_above_installed_maximum:
          hoursAboveInstalledMaximum,
        hours_below_minimum: hoursBelowMinimum,
        share_below_minimum_percent:
          shareBelowMinimumPercent,
        power_for_90_percent_heating_hours_kw:
          powerFor90PercentHoursKw,
        hours_above_90_percent_power:
          hoursAbove90PercentPower,
      },
      power_curve: {
        hour_rank: medianTemperatures.map(
          (_, index) => index + 1
        ),
        required_kw: requiredPowerCurveKw,
      },
      warnings,
    };
  }

  global.HeatingCore = {
    BUILDING_RANGES,
    HEATING_LIMIT_C,
    calculateHeatingLoad,
  };
})(window);
