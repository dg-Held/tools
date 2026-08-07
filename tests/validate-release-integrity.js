'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const runtimePages = [
  'index.html',
  'pages/tools.html',
  'pages/about.html',
  'pages/kontakt.html',
  'tools/standortpass/index.html',
  'tools/klima/index.html',
  'tools/heizlast/index.html',
  'tools/energiefluss-v4/index.html',
  'tools/bauteil-sanierung/index.html',
];
const toolPages = runtimePages.filter((item) => item.startsWith('tools/'));
const warnings = [];
const errors = [];

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function text(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

function cleanLocalReference(ref) {
  if (!ref) return null;
  const trimmed = ref.trim();
  if (!trimmed || trimmed.startsWith('#') || /^(https?:|mailto:|tel:|data:|javascript:)/i.test(trimmed)) return null;
  return trimmed.split('#')[0].split('?')[0];
}

function checkHtmlReferences(rel) {
  const source = text(rel);
  const dir = path.dirname(path.join(ROOT, rel));
  const attrRegex = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = attrRegex.exec(source))) {
    const ref = cleanLocalReference(match[1]);
    if (!ref) continue;
    const target = path.resolve(dir, ref);
    if (!fs.existsSync(target)) errors.push(`${rel}: lokale Referenz fehlt: ${match[1]}`);
  }
}

function checkCssReferences(rel) {
  const source = text(rel);
  const dir = path.dirname(path.join(ROOT, rel));
  const importRegex = /@import\s+(?:url\()?\s*["']?([^"')\s;]+)["']?\)?/gi;
  let match;
  while ((match = importRegex.exec(source))) {
    const ref = cleanLocalReference(match[1]);
    if (!ref) continue;
    const target = path.resolve(dir, ref);
    if (!fs.existsSync(target)) errors.push(`${rel}: @import fehlt: ${match[1]}`);
  }
  const urlRegex = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  while ((match = urlRegex.exec(source))) {
    const ref = cleanLocalReference(match[1]);
    if (!ref || ref.startsWith('var(')) continue;
    const target = path.resolve(dir, ref);
    if (!fs.existsSync(target)) errors.push(`${rel}: CSS-Datei/Asset fehlt: ${match[1]}`);
  }
}

for (const rel of runtimePages) {
  assert(exists(rel), `Runtime-Seite fehlt: ${rel}`);
  if (!exists(rel)) continue;
  const source = text(rel);
  assert(/rel=["']icon["'][^>]*favicon\.svg|favicon\.svg[^>]*rel=["']icon["']/i.test(source), `${rel}: favicon.svg nicht eingebunden`);
  checkHtmlReferences(rel);
}

// HTML-IDs müssen pro Seite eindeutig sein. data-*-Attribute mit „-id“ zählen ausdrücklich nicht als IDs.
for (const rel of runtimePages) {
  if (!exists(rel)) continue;
  const source = text(rel);
  const ids = [];
  const idRegex = /(?:^|\s)id\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = idRegex.exec(source))) ids.push(match[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  assert(duplicates.length === 0, `${rel}: doppelte HTML-ID(s): ${duplicates.join(', ')}`);
}

for (const rel of toolPages) {
  const source = text(rel);
  assert(source.includes('data-project-header'), `${rel}: gemeinsamer Projektkopf fehlt`);
  assert(source.includes('shared-address-card'), `${rel}: gemeinsame Standortkarte fehlt`);
  assert(source.includes('Methode und Datenbasis'), `${rel}: „Methode und Datenbasis“ fehlt`);
  assert(/Drucken \/ PDF/.test(source), `${rel}: Druckaktion fehlt`);
}

const requiredSharedFiles = [
  'assets/svg/favicon.svg',
  'styles.css',
  'shared/css/tokens.css',
  'shared/css/components.css',
  'shared/css/print.css',
  'shared/js/data-model.js',
  'shared/js/project-store.js',
  'shared/js/value-resolver.js',
  'shared/js/project-header.js',
  'shared/js/project-address-manager.js',
  'shared/js/domain/economics/economics-core.js',
  'shared/js/domain/measures/envelope-renovation-core.js',
  'shared/data/addresses/manifest.json',
  'shared/data/climate/inca/manifest.json',
];
for (const rel of requiredSharedFiles) assert(exists(rel), `Zentrale Datei fehlt: ${rel}`);

const toolCard = text('pages/tools.html');
const renovationHtml = text('tools/bauteil-sanierung/index.html');
const renovationJs = text('tools/bauteil-sanierung/bauteil-sanierung.js');
assert(!/V0\.8/.test(toolCard + renovationHtml + renovationJs), 'Bauteil & Sanierung enthält noch öffentliche V0.8-Bezeichnungen.');
assert(/<span class="tool-status">Verfügbar · V1\.0<\/span><h2>Bauteil &amp; Sanierung<\/h2>/i.test(toolCard), 'Tools-Seite weist Bauteil & Sanierung nicht als V1.0 aus.');

const energyHtml = text('tools/energiefluss-v4/index.html');
assert(energyHtml.includes('Fensterflächenanteil'), 'Energiefluss: Fensterflächenanteil fehlt.');
assert(energyHtml.includes('HWB aus U-Werten'), 'Energiefluss: einheitliche Kennzahl „HWB aus U-Werten“ fehlt.');
assert(renovationHtml.includes('Für thermische Hülle relevant'), 'Bauteil: gemeinsamer Hüllstatus fehlt in der Oberfläche.');
assert(renovationJs.includes('building.thermal.envelope.'), 'Bauteil: gemeinsamer Hüllstatus-Pfad fehlt.');
assert(renovationJs.includes('HGT_FALLBACK_TIROL) * 24'), 'Bauteil: rechnerischer HGT-Stand-alone-Fallback fehlt.');

// Zentrale Farbverwaltung: Hex/RGB-Literale außerhalb tokens.css nur als Warnung melden.
const cssFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.css')) cssFiles.push(full);
  }
})(ROOT);
for (const file of cssFiles) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  checkCssReferences(rel);
  if (rel === 'shared/css/tokens.css') continue;
  const source = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const literals = source.match(/#[0-9a-f]{3,8}\b|\brgba?\(\s*\d/gi) || [];
  if (literals.length) warnings.push(`${rel}: feste Farbliterale außerhalb tokens.css: ${[...new Set(literals)].join(', ')}`);
}

// Alle verwendeten CSS-Variablen müssen zentral definiert sein.
const cssVariableDefinitions = new Set();
const cssVariableUses = new Set();
for (const file of cssFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/(--[\w-]+)\s*:/g)) cssVariableDefinitions.add(match[1]);
  for (const match of source.matchAll(/var\((--[\w-]+)/g)) cssVariableUses.add(match[1]);
}
const undefinedCssVariables = [...cssVariableUses].filter((name) => !cssVariableDefinitions.has(name));
assert(undefinedCssVariables.length === 0, `CSS: undefinierte zentrale Variable(n): ${undefinedCssVariables.join(', ')}`);

// JSON-Dateien müssen syntaktisch lesbar sein. Große Datenpakete dürfen im kompakten Strukturpaket fehlen, vorhandene Dateien aber nie defekt sein.
const jsonFiles = [];
(function collectJson(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJson(full);
    else if (entry.isFile() && entry.name.endsWith('.json')) jsonFiles.push(full);
  }
})(ROOT);
for (const file of jsonFiles) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${path.relative(ROOT, file).replace(/\\/g, '/')}: ungültiges JSON (${error.message})`);
  }
}

// Kompaktes Strukturpaket darf große Datenpakete absichtlich auslassen; Produktion nicht.
if (exists('shared/data/addresses/manifest.json')) {
  const manifest = JSON.parse(text('shared/data/addresses/manifest.json'));
  const chunkPaths = [...new Set(Object.values(manifest.chunks || {}))];
  const missing = chunkPaths.filter((rel) => !exists(path.posix.join('shared/data/addresses', rel)));
  if (missing.length) {
    if (exists('shared/data/addresses/prefix/etc.txt')) {
      warnings.push(`Adressdaten: ${missing.length}/${chunkPaths.length} Chunk-Dateien fehlen im kompakten Strukturpaket (etc.txt vorhanden). Im Produktionsordner müssen alle Manifest-Chunks vorhanden sein.`);
    } else {
      errors.push(`Adressdaten: ${missing.length}/${chunkPaths.length} Manifest-Chunks fehlen.`);
    }
  }
}

if (exists('shared/data/climate/inca/manifest.json')) {
  const manifest = JSON.parse(text('shared/data/climate/inca/manifest.json'));
  const years = manifest.years || [];
  const missing = years.filter((year) => !exists(`shared/data/climate/inca/yearly/${year}.json`));
  if (missing.length) {
    if (exists('shared/data/climate/inca/yearly/etc.txt')) {
      warnings.push(`INCA: Jahrespakete ${missing.join(', ')} fehlen im kompakten Strukturpaket (etc.txt vorhanden). Im Produktionsordner müssen alle im Manifest genannten Jahre vorhanden sein.`);
    } else {
      errors.push(`INCA: Jahresmanifest(e) fehlen: ${missing.join(', ')}`);
    }
  }
}

warn(!exists('assets/svg/48x48.svg'), 'Altdatei assets/svg/48x48.svg ist noch vorhanden und wird nicht benötigt.');
warn(!exists('tools/manifest.json'), 'Altdatei tools/manifest.json ist noch vorhanden und wird von der aktuellen Runtime nicht verwendet.');

if (warnings.length) {
  console.log('WARNUNGEN:');
  for (const item of warnings) console.log(`- ${item}`);
}
if (errors.length) {
  console.error('FEHLER:');
  for (const item of errors) console.error(`- ${item}`);
  process.exit(1);
}
console.log(`Release-Integrität OK: ${runtimePages.length} Runtime-Seiten, ${jsonFiles.length} JSON-Dateien, HTML-IDs, CSS-Variablen, lokale Referenzen und zentrale Verträge geprüft.`);
