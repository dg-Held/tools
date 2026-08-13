'use strict';
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8');

const tools=['standortpass','klima','heizlast','energiefluss-v4','bauteil-sanierung','wirtschaftlichkeit'];
for(const tool of tools){
  const html=read(`tools/${tool}/index.html`);
  assert(html.includes('project-header'),`${tool}: gemeinsamer Projektkopf fehlt`);
  assert(html.includes('Methode und Datenbasis'),`${tool}: gemeinsame Methodenbezeichnung fehlt`);
}
const bauteil=read('tools/bauteil-sanierung/index.html');
const bauteilJs=read('tools/bauteil-sanierung/bauteil-sanierung.js');
const econ=read('tools/wirtschaftlichkeit/index.html');
const econJs=read('tools/wirtschaftlichkeit/wirtschaftlichkeit.js');
const climateCss=read('shared/css/climate-heating.css');
const siteCss=read('tools/standortpass/standortpass.css');

assert(!bauteil.includes('Sowiesokosten'),'Bauteil: alter sichtbarer Begriff Sowiesokosten noch vorhanden');
assert(!econ.includes('Sowiesokosten'),'Wirtschaftlichkeit: alter sichtbarer Begriff Sowiesokosten noch vorhanden');
assert(bauteil.includes('Referenz-Erneuerung'),'Bauteil: Referenz-Erneuerung fehlt');
assert((econ + econJs).includes('Referenz-Erneuerung'),'Wirtschaftlichkeit: Referenz-Erneuerung fehlt');
assert(bauteilJs.includes("economics/financial-defaults.json"),'Bauteil: zentrale Finanzannahmen fehlen');
assert(econJs.includes("economics/financial-defaults.json"),'Wirtschaftlichkeit: zentrale Finanzannahmen fehlen');
assert(bauteilJs.includes('scheduleSelectedMeasureSync'),'Bauteil: automatische Maßnahmensynchronisierung fehlt');
assert(bauteilJs.includes('scheduleAutomaticPackageRefresh'),'Bauteil: automatische Paketaktualisierung fehlt');
assert(climateCss.includes('.chart-year') && climateCss.includes('stroke: var(--color-primary);'),'Klima: Jahreslinien verwenden nicht die zentrale Primärfarbe');
assert(siteCss.includes('.print-risk-card--hit') && siteCss.includes('background: var(--color-secondary-soft);'),'Standortpass: Flächentreffer im Druck nicht sekundär/berry');
assert(siteCss.includes('.print-risk-card--clear') && siteCss.includes('background: var(--color-primary-soft);'),'Standortpass: unauffällige Druckkarte nicht primär/türkis');

console.log('Cross-Tool-Kompatibilität: Projektkopf, Begriffe, Finanzdaten, Auto-Sync und Farblogik bestanden.');
