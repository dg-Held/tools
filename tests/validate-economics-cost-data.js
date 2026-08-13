'use strict';

const fs = require('fs');
const path = require('path');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));

const renovation = read('shared/data/costs/renovation-costs.json');
const systems = read('shared/data/costs/system-costs.json');
const lifetimes = read('shared/data/standards/economics/component-lifetimes.json');

const requiredEnvelope = ['wall_wdvs','wall_ventilated','top_ceiling','roof','basement_ceiling','ground_floor','window_replace','door_replace'];
const requiredSystems = ['heat_pump_air','heat_pump_ground','heat_pump_water','pellet_heating','district_heat_connection','radiator_replace','floor_heating','hot_water_boiler','buffer_freshwater','solar_thermal','system_adjustment','ventilation_single_room','ventilation_decentral','ventilation_central','pv_standard','battery_storage'];

const models = new Map((renovation.models || []).map((item) => [item.id, item]));
const systemItems = new Map((systems.items || []).map((item) => [item.id, item]));
const lifetimeItems = lifetimes.items || [];

for (const id of requiredEnvelope) {
  const item = models.get(id);
  if (!item) throw new Error(`Kostenmodell fehlt: ${id}`);
  const range = item.range_eur_m2;
  if (!(range && Number.isFinite(range.low) && Number.isFinite(range.middle) && Number.isFinite(range.high) && range.low <= range.middle && range.middle <= range.high)) throw new Error(`Kostenband unplausibel: ${id}`);
  if (!item.reference || !['renewal','none','project_specific'].includes(item.reference.mode)) throw new Error(`Referenzlogik fehlt: ${id}`);
  if (!lifetimeItems.some((life) => life.cost_model_id === id && life.active !== false && Number(life.years) > 0)) throw new Error(`Lebensdauer fehlt: ${id}`);
}

for (const id of requiredSystems) {
  const item = systemItems.get(id);
  if (!item) throw new Error(`Systemkosten fehlen: ${id}`);
  const range = item.range;
  if (!(range && Number.isFinite(range.low) && Number.isFinite(range.middle) && Number.isFinite(range.high) && range.low <= range.middle && range.middle <= range.high)) throw new Error(`Systemkostenband unplausibel: ${id}`);
}

if (!String(renovation.internal_plausibility || '').includes('intern')) throw new Error('Interne BKI-Plausibilisierung ist nicht transparent dokumentiert.');
if (models.get('roof')?.reference?.default_cost <= 0) throw new Error('Dach-Referenzkosten fehlen.');
if (models.get('top_ceiling')?.reference?.mode !== 'none') throw new Error('OGD soll keine automatische Referenz-Erneuerung erhalten.');
if (models.get('basement_ceiling')?.reference?.mode !== 'none') throw new Error('Kellerdecke soll keine automatische Referenz-Erneuerung erhalten.');

console.log('OK economics-cost-data', {
  renovationVersion: renovation.version,
  systemVersion: systems.version,
  lifetimeVersion: lifetimes.version,
  envelopeModels: requiredEnvelope.length,
  systemModels: requiredSystems.length,
  region: 'Tirol / interne Plausibilisierung',
});
