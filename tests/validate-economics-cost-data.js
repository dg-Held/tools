'use strict';

const fs = require('fs');
const path = require('path');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));

const renovation = read('shared/data/costs/renovation-costs.json');
const systems = read('shared/data/costs/system-costs.json');
const lifetimes = read('shared/data/standards/economics/component-lifetimes.json');
const conditions = read('shared/data/economics/reference-condition-defaults.json');

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


const heatingReferenceLife = Number(systems.reference_strategy?.heat_generator?.typical_lifetime_years);
if (!(heatingReferenceLife > 0)) throw new Error('Referenz-Nutzungsdauer Wärmeerzeuger fehlt.');
if (systems.reference_strategy?.heat_generator?.replacement_cost_basis !== 'selected_future_fit_system_middle_cost') throw new Error('Referenz-Kostenbasis Wärmeerzeuger ist nicht transparent hinterlegt.');

if (!String(renovation.internal_plausibility || '').includes('intern')) throw new Error('Interne BKI-Plausibilisierung ist nicht transparent dokumentiert.');
if (models.get('roof')?.reference?.default_cost <= 0) throw new Error('Dach-Referenzkosten fehlen.');
if (models.get('top_ceiling')?.reference?.mode !== 'none') throw new Error('OGD soll keine automatische Referenz-Erneuerung erhalten.');
if (models.get('basement_ceiling')?.reference?.mode !== 'none') throw new Error('Kellerdecke soll keine automatische Referenz-Erneuerung erhalten.');
if (models.get('wall_ventilated')?.range_eur_m2?.low !== 200 || models.get('wall_ventilated')?.range_eur_m2?.high !== 400) throw new Error('Freigegebenes VHF-Kostenband fehlt.');
if (models.get('window_replace')?.frame_costs_eur_m2?.wood_aluminium?.middle !== 1200) throw new Error('Rahmenmaterialspezifische Fensterkosten fehlen.');
if (systemItems.get('ventilation_single_room')?.range?.low !== 2750) throw new Error('Freigegebene Untergrenze Einzelraumlüftung fehlt.');
if (systemItems.get('heat_pump_air')?.maintenance_percent_initial_per_year !== 3) throw new Error('Wartungsdefault Wärmepumpe fehlt.');
for (const id of ['wall_wdvs','top_ceiling','roof','basement_ceiling']) { const life = lifetimeItems.find((x)=>x.cost_model_id===id); if (Number(life?.maintenance_percent_initial_per_year ?? 0) !== 0) throw new Error(`Passive Wartung muss 0 % sein: ${id}`); }
if ((conditions.states||[]).map((x)=>x.id).join(',') !== 'maintained,age_appropriate,damaged') throw new Error('Zustandslogik Erneuerungshorizont unvollständig.');
if (models.get('wall_wdvs')?.reference?.condition_cost_mode !== 'range') throw new Error('Fassaden-Referenzumfang reagiert nicht auf Zustand.');
if (models.get('roof')?.reference?.condition_cost_mode !== 'range') throw new Error('Dach-Referenzumfang reagiert nicht auf Zustand.');
for (const [id,key] of [['maintained','low'],['age_appropriate','middle'],['damaged','high']]) {
  const state=(conditions.states||[]).find((x)=>x.id===id);
  if (state?.reference_cost_key !== key) throw new Error(`Zustands-Referenzkostenstufe fehlt: ${id}`);
}


console.log('OK economics-cost-data', {
  renovationVersion: renovation.version,
  systemVersion: systems.version,
  lifetimeVersion: lifetimes.version,
  envelopeModels: requiredEnvelope.length,
  systemModels: requiredSystems.length,
  region: 'Tirol / interne Plausibilisierung',
});
