'use strict';

/* =========================================================
   ENERGIEFLUSS-TOOL – BERECHNUNGEN
========================================================= */

const $ = (id) => document.getElementById(id);

const nfInput = $('nf');
const heatedInput = $('beh');
const personsInput = $('pers');
const roomTemperatureInput = $('rt');
const heatingEnergyInput = $('hz');
const hotWaterInput = $('ww');
const efficiencyInput = $('jng');
const windowShareInput = $('windowShare');
const dateInput = $('date');

const number0 = new Intl.NumberFormat('de-AT', {
  maximumFractionDigits: 0
});

const number1 = new Intl.NumberFormat('de-AT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

const number3 = new Intl.NumberFormat('de-AT', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3
});


function numericValue(element, fallback = 0) {
  const value = Number(element.value);
  return Number.isFinite(value) ? value : fallback;
}


function setText(id, value) {
  const element = $(id);

  if (element) {
    element.textContent = value;
  }
}


function setBar(id, value, maximum) {
  const element = $(id);

  if (!element) {
    return;
  }

  const safeMaximum = Math.max(maximum, 1);
  const safeValue = Math.max(value, 0);
  const width = Math.min((safeValue / safeMaximum) * 100, 100);

  element.style.width = `${width}%`;
}


function setTodayIfEmpty() {
  if (dateInput.value) {
    return;
  }

  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60_000;
  const localDate = new Date(today.getTime() - timezoneOffset);

  dateInput.value = localDate.toISOString().slice(0, 10);
}


function calculate() {
  const nf = Math.max(numericValue(nfInput), 0);
  const heatedPercent = numericValue(heatedInput, 100);
  const persons = Math.max(numericValue(personsInput), 0);
  const roomTemperature = numericValue(roomTemperatureInput, 20);
  const heatingEnergy = Math.max(numericValue(heatingEnergyInput), 0);
  const efficiency = Math.min(Math.max(numericValue(efficiencyInput, 0.85), 0.01), 1);
  const windowShare = Math.max(numericValue(windowShareInput, 0.25), 0);

  /*
    Grundannahmen
  */
  const grossFloorArea = nf * 1.20;
  const windowArea = grossFloorArea * windowShare;
  const glassArea = windowArea * 0.70;
  const buildingVolume = grossFloorArea * 3.0;

  /*
    Korrekturfaktoren
  */
  const roomCorrection = 1 + ((roomTemperature - 20) * 0.06);
  const heatedAreaCorrection = 1 + ((heatedPercent - 100) * 0.005);

  /*
    Energieeinträge
    2,7 W/m² × 8.760 h ÷ 1.000 = 2,7 × 8,76 kWh/m²a
  */
  const internalGains = 2.7 * nf * 8.76;

  /*
    Vereinfachte solare Gewinne:
    Qs = 175 × AFenster × 0,70
  */
  const solarGains = 175 * windowArea * 0.70;
  const totalInputs = internalGains + solarGains + heatingEnergy;

  /*
    Verluste
  */
  const ventilationLoss = 10 * buildingVolume;
  const systemLoss = heatingEnergy - (heatingEnergy * efficiency);
  const hotWaterLoss = hotWaterInput.value === 'inkl'
    ? persons * 1000
    : 0;

  /*
    Wärmebrücken als Zuschlag von 7,5 % auf die Bauteilverluste.

    Rest = Bauteile + Wärmebrücken
         = Bauteile × 1,075

    Daher:
    Bauteile = Rest ÷ 1,075
  */
  const remainingEnvelopeLoss =
    totalInputs - ventilationLoss - systemLoss - hotWaterLoss;

  const componentLoss = remainingEnvelopeLoss / 1.075;
  const thermalBridgeLoss = componentLoss * 0.075;

  const totalLosses =
    componentLoss +
    thermalBridgeLoss +
    ventilationLoss +
    systemLoss +
    hotWaterLoss;

  /*
    HWB
  */
  const safeGrossFloorArea = grossFloorArea || 1;
  const hwbConsumption =
    ((heatingEnergy * efficiency) - hotWaterLoss) / safeGrossFloorArea;

  const safeRoomCorrection = roomCorrection || 1;
  const safeHeatedAreaCorrection = heatedAreaCorrection || 1;

  const hwbCorrected =
    hwbConsumption / safeRoomCorrection / safeHeatedAreaCorrection;


  /* Grunddaten ausgeben */
  setText('behLabel', `${number0.format(heatedPercent)} %`);
  setText('bgf', number0.format(grossFloorArea));
  setText('bgf2', `${number0.format(grossFloorArea)} m²`);
  setText('windowArea', number1.format(windowArea));
  setText('glassArea', number1.format(glassArea));
  setText('volumen', number0.format(buildingVolume));
  setText('krw', number3.format(roomCorrection));
  setText('kbf', number3.format(heatedAreaCorrection));

  /* Einträge */
  setText('ig', number0.format(internalGains));
  setText('sg', number0.format(solarGains));
  setText('he', number0.format(heatingEnergy));
  setText('sumEin', number0.format(totalInputs));

  /* Verluste */
  setText('wb', number0.format(thermalBridgeLoss));
  setText('lf', number0.format(ventilationLoss));
  setText('anl', number0.format(systemLoss));
  setText('wwl', number0.format(hotWaterLoss));
  setText('bt', number0.format(componentLoss));
  setText('sumVer', number0.format(totalLosses));

  /* HWB */
  setText('hwbv', `${number0.format(hwbConsumption)} kWh/m²a`);
  setText('hwbk', `${number0.format(hwbCorrected)} kWh/m²a`);
  setText('enb', `${number0.format(totalInputs)} kWh`);

  /* Balken */
  setBar('igb', internalGains, totalInputs);
  setBar('sgb', solarGains, totalInputs);
  setBar('heb', heatingEnergy, totalInputs);
  setBar('sumEinB', totalInputs, totalInputs);

  setBar('wbb', thermalBridgeLoss, totalLosses);
  setBar('lfb', ventilationLoss, totalLosses);
  setBar('anlb', systemLoss, totalLosses);
  setBar('wwlb', hotWaterLoss, totalLosses);
  setBar('btb', componentLoss, totalLosses);
  setBar('sumVerB', totalLosses, totalLosses);

  /* Warmwasserzeile nur anzeigen, wenn sie verwendet wird. */
  $('wwlossblock').hidden = hotWaterLoss <= 0;

  /* Plausibilitätswarnung */
  $('plausibilityWarning').hidden = remainingEnvelopeLoss >= 0;
}


/* Jede Änderung löst sofort eine neue Berechnung aus. */
document
  .querySelectorAll('.energy-tool-sheet input, .energy-tool-sheet select')
  .forEach((element) => {
    element.addEventListener('input', calculate);
    element.addEventListener('change', calculate);
  });


$('printButton').addEventListener('click', () => {
  window.print();
});


/*
  Falls die alte Hausgrafik noch nicht in den neuen Ordner kopiert wurde,
  wird nur der dezente Platzhalter angezeigt.
*/
const houseGraphic = $('houseGraphic');

houseGraphic.addEventListener('error', () => {
  houseGraphic.hidden = true;
});


setTodayIfEmpty();
calculate();
