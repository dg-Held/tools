'use strict';
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8');

const tools=['standortpass','klima','heizlast','energiefluss-v4','bauteil-sanierung','wirtschaftlichkeit','sanierungsfahrplan'];
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
const roadmap=read('tools/sanierungsfahrplan/index.html');
const roadmapJs=read('tools/sanierungsfahrplan/sanierungsfahrplan.js');
const migrations=read('shared/js/project-migrations.js');
assert(roadmap.includes('Autarkie &amp; Sicherheit') && econ.includes('Autarkie &amp; Sicherheit'),'Beratungspriorität Autarkie & Sicherheit nicht einheitlich');
assert(roadmap.includes('geringer Aufwand') && econ.includes('geringer Aufwand'),'Beratungspriorität geringer Aufwand nicht einheitlich');
assert(roadmap.includes('data-value="3-7"') && econ.includes('data-value="3-7"'),'Zeitraum 3–7 Jahre nicht einheitlich');
assert(!roadmap.includes('data-value="3-10"') && !econ.includes('data-value="3-10"'),'alter sichtbarer Zeitraum 3–10 Jahre noch vorhanden');
assert(migrations.includes("project.advice.timeHorizon === '3-10'") && migrations.includes("project.advice.timeHorizon = '3-7'"),'Migration 3-10 → 3-7 fehlt');
assert(roadmapJs.includes("independence: 'Autarkie & Sicherheit'") && roadmapJs.includes("effort: 'geringer Aufwand'"),'Mehr-als-Energie-Bezeichnungen nicht an gemeinsame Prioritäten angepasst');
assert(econJs.includes("label: 'Heizungstausch'"),'Wirtschaftlichkeit: sichtbare Heizungskarte nicht auf Heizungstausch vereinheitlicht');

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
