'use strict';

/* =========================================================
   STANDORTPASS – V1.6 · GEMEINSAME DATENBASIS

   Testet bewusst:
   1) gemeinsame Hybrid-Adresssuche: BEV-Vorschläge + TIRIS-Live-Abgleich
   2) TIRIS Katastralgemeinde aus der Standortkoordinate
   3) BEV und TIRIS technisch vergleichen
   4) TIRIS Gebäude FeatureServer mit Punkt-in-Polygon-Zuordnung
   5) TIRIS Orthofoto als visuelle Kontrolle
   6) bestehende TIRIS-DGM-Höhenfunktion
   7) GeoLand/voibos Sonnenstand + nutzerfreundliches SVG aus DTM/DSM und Sonnenbahnen
   8) öffentliche TIRIS-Dienste auf Wärmenetz-/Versorgungslayer prüfen
   9) TIRIS WASSER: bestehende Anlagen, rechtliche Flächen, Schutzgebiete und Messstellen sauber trennen
   10) relevante WASSER-Treffer mit Entfernung, Attributen und vorhandenen WIS-Detaillinks ausgeben
   11) direkten tirisMaps-Standortlink aus der amtlichen Adresskoordinate in EPSG:31254 erzeugen
   12) amtliche Überflutungsflächen HQ30/HQ100/HQ300 direkt am Gebäude/Standort prüfen
   13) TIRIS NATURGEFAHREN dynamisch nach relevanten Gefahren-/Hinweisflächen prüfen
   14) TIRIS KLIMAKARTEN INNTAL als optionale Beratungsinformation erkunden
   15) WebOffice-interne IDs der drei Energiethemen dokumentieren
   16) dokumentierte WebOffice Service API (synservice) sessionfrei auf öffentliche Abfragemöglichkeit prüfen

   Standortpass-spezifische Logik; allgemeine Projekt-, Adress- und Höhenfunktionen liegen unter shared/.
========================================================= */

const $ = (id) => document.getElementById(id);

const TIRIS_BASIS_URL =
  'https://gis.tirol.gv.at/arcgis/rest/services/' +
  'Service_Public/ogd_basis/MapServer';

const TIRIS_BUILDING_QUERY_URL =
  'https://services3.arcgis.com/hG7UfxX49PQ8XkXh/' +
  'arcgis/rest/services/Gebaeude/FeatureServer/0/query';

const TIRIS_ADDRESS_TEST_LAYERS = [
  { id: 13, label: 'Adressen · NS ADR_PT' },
  { id: 19, label: 'AGWR Gebäudeadressen · Gebäude gr 5000' },
  { id: 22, label: 'AGWR Grundstücksadressen · Adresse gr 5000' },
];

const TIRIS_KG_LAYER_ID = 39;

const TIRIS_ORTHOPHOTO_WMS_URL =
  'https://gis.tirol.gv.at/arcgis/services/' +
  'Service_Public/orthofoto/MapServer/WMSServer';

const GEOLAND_SUN_URL = 'https://voibos.rechenraum.com/voibos/voibos';


const TIRIS_PUBLIC_FOLDER_URL =
  'https://gis.tirol.gv.at/arcgis/rest/services/Service_Public';

const TIRIS_HEAT_DISCOVERY_SERVICES = [
  { label: 'INFRASTRUKTUR', url: `${TIRIS_PUBLIC_FOLDER_URL}/ogd_infrastruktur/MapServer` },
  { label: 'RAUMORDNUNG', url: `${TIRIS_PUBLIC_FOLDER_URL}/ogd_raumordnung/MapServer` },
];

const HEAT_KEYWORDS = [
  'wärme', 'waerme', 'fernwärme', 'fernwaerme', 'nahwärme', 'nahwaerme',
  'anergie', 'heiz', 'energie', 'versorgung', 'biomasse',
];

// Test 16: Die drei exakten tirisMaps-Themen sind durch Nutzerabfragen bekannt.
// Deshalb durchsuchen wir bei Bedarf den gesamten öffentlich erreichbaren ArcGIS-Servicebaum
// und verwenden Themenname + beobachtete Feld-Aliase als Fingerabdruck.
const TIRIS_ARCGIS_ROOT_URL = 'https://gis.tirol.gv.at/arcgis/rest/services';

const ENERGY_LAYER_TARGETS = [
  {
    id: 'heat_areas',
    label: 'Wärmenetz-Gebiete',
    namePatterns: ['wärmenetz-gebiete', 'wärmenetz gebiete', 'wärmenetzgebiet', 'wärmenetz - versorgungsgebiet', 'waermenetz-gebiete', 'waermenetz gebiete', 'waermenetz - versorgungsgebiet'],
    serviceHints: ['wärme', 'waerme', 'energie', 'netz', 'tmap', 'master'],
    fieldAliases: ['typ', 'versorgungsgebiet', 'stand', 'erfassungsmaßstab', 'kontakt'],
  },
  {
    id: 'heat_plants',
    label: 'Wärmeerzeugungsanlagen',
    namePatterns: ['wärmeerzeugungsanlagen', 'waermeerzeugungsanlagen', 'wärmeerzeugungsanlage', 'waermeerzeugungsanlage'],
    serviceHints: ['wärme', 'waerme', 'energie', 'heiz', 'tmap', 'master'],
    fieldAliases: ['energieträger', 'energietraeger', 'betreiber', 'anlage', 'name', 'typ', 'stand'],
  },
  {
    id: 'solar_building',
    label: 'Solarpotential pro Jahr – Gebäude',
    namePatterns: ['solarpotential pro jahr - gebäude', 'solarpotenzial pro jahr - gebäude', 'solarpotential pro jahr gebäude', 'solarpotenzial pro jahr gebäude', 'solarpotential pro jahr - gebaude', 'solarpotenzial pro jahr - gebaude', 'solarstatistik', 'eignungsflächen', 'eignungsflaechen'],
    serviceHints: ['solar', 'energie', 'tmap', 'master'],
    fieldAliases: ['dachfläche', 'dachflache', '700', '900', '1100', '1300', '1500', 'stand', 'erfassungsmaßstab'],
  },
];

const ENERGY_SCAN_SERVICE_TYPES = new Set(['MapServer', 'FeatureServer']);
const ENERGY_SCAN_CONCURRENCY = 5;


// Test 17: aus tirisMaps/Firefox-Netzwerkanalyse bestätigte WebOffice-Fingerprints.
// Diese IDs sind interne Projekt-/Query-Kennungen und werden NICHT als öffentliche API behauptet.
const TIRIS_WEBOFFICE_BASE_URL = 'https://maps.tirol.gv.at';
const TIRIS_WEBOFFICE_PROJECT = 'tmap_master';

const WEBOFFICE_ENERGY_TARGETS = [
  {
    id: 'heat_areas',
    label: 'Wärmenetz-Gebiete',
    toc_id: '16274_1',
    internal_query_id: '16341',
    datacontainer: 'Wärmenetz-Gebiet',
    sample: { keyname: 'NAME', keyvalue: 'Wärmenetz Innsbruck' },
    returnkeys: ['TYP', 'NAME', 'STAND', 'EMASST', 'URL_BIOWAERM'],
    query_candidates: ['16341', 'Waermenetz-Gebiet', 'Wärmenetz-Gebiet'],
  },
  {
    id: 'heat_plants',
    label: 'Wärmeerzeugungsanlagen',
    toc_id: '16274_0',
    internal_query_id: '16632',
    datacontainer: 'Wärmeerzeugungsanlage',
    sample: { keyname: 'ANLAGENNR', keyvalue: '1985' },
    returnkeys: ['OBJEKT', 'ANLAGENNR', 'NAME', 'KONTAKT', 'ADRESSE_BETREIBER', 'TELEFON_FESTNETZ', 'TELEFON_MOBIL', 'E_MAIL', 'ADRESSE_HEIZANLAGE', 'STAND', 'EMASST'],
    query_candidates: ['16632', 'Waermeerzeugungsanlage', 'Wärmeerzeugungsanlage'],
  },
  {
    id: 'solar_building',
    label: 'Solarpotential pro Jahr – Gebäude',
    toc_id: '2976_1',
    internal_query_id: '3077',
    datacontainer: 'Solarpotenzial / Jahr (Gebäudeumriss)',
    sample: { keyname: 'OBJECTID', keyvalue: '360113' },
    returnkeys: ['SOLYEAR_BIS_700', 'SOLYEAR_700_BIS_900', 'SOLYEAR_900_BIS_1100', 'SOLYEAR_1100_BIS_1300', 'SOLYEAR_1300_BIS_1500', 'SOLYEAR_1500_MEHR', 'STAND', 'EMASST'],
    query_candidates: ['3077', 'Solarpotenzial_Jahr_Gebaeudeumriss', 'Solarpotenzial / Jahr (Gebäudeumriss)'],
  },
];

const TIRIS_WATER_URL =
  'https://gis.tirol.gv.at/arcgis/rest/services/' +
  'Service_Public/ogd_wasser/MapServer';

const ENVIRONMENTAL_HEAT_KEYWORDS = [
  'erdwärmesonde', 'erdwaermesonde',
  'grundwasserentnahme', 'grundwasserrückgabe', 'grundwasserrueckgabe',
  'grundwassersonde', 'schutz', 'schongebiet',
  'messstelle - grundwasser', 'messort grundwasser',
];

const ENVIRONMENTAL_HEAT_NEARBY_RADIUS_M = 500;


const TIRIS_NATURAL_HAZARDS_URL =
  'https://gis.tirol.gv.at/arcgis/rest/services/' +
  'Service_Public/ogd_naturgefahren/MapServer';

const TIRIS_CLIMATE_INNTAL_URL =
  'https://gis.tirol.gv.at/arcgis/rest/services/' +
  'Service_Public/klims_map/MapServer';

const CLIMATE_ANALYSIS_KEYWORDS = [
  'klimaanalyse', 'klimakarte', 'planhinweis', 'pet', 'hitze', 'waerme', 'wärme',
  'nacht', 'lufttemperatur', 'kaltluft', 'leitbahn', 'einwirk', 'produktion',
  'belastung', 'thermisch', 'tag'
];

const FLOOD_HQ_SERVICES = [
  { key: 'HQ30', label: 'HQ30', scenario: 30, category: 1, url: 'https://services3.arcgis.com/hG7UfxX49PQ8XkXh/arcgis/rest/services/Ueberflutungsflaechen_HQ30/FeatureServer' },
  { key: 'HQ100', label: 'HQ100', scenario: 100, category: 2, url: 'https://services3.arcgis.com/hG7UfxX49PQ8XkXh/arcgis/rest/services/Ueberflutungsflaechen_HQ100/FeatureServer' },
  { key: 'HQ300', label: 'HQ300', scenario: 300, category: 3, url: 'https://services3.arcgis.com/hG7UfxX49PQ8XkXh/arcgis/rest/services/Ueberflutungsflaechen_HQ300/FeatureServer' },
];

const NATURAL_HAZARD_KEYWORDS = [
  'gefahrenzone', 'wildbach', 'lawine', 'mure', 'rutsch', 'stein',
  'hinweisbereich', 'funktionsbereich', 'überflut', 'ueberflut',
  'besondere gefährd', 'besondere gefaehrd'
];

const TIRIS_SPORT_URL =
  'https://gis.tirol.gv.at/arcgis/rest/services/' +
  'Service_Public/ogd_sport/MapServer';

const HERITAGE_KEYWORDS = [
  'archäolog', 'archaeolog', 'ensemble', 'kunstkataster', 'kulturgut', 'denkmal'
];

const BDA_DENKMALLISTE_PAGE =
  'https://www.bda.gv.at/service/unterschutzstellung/denkmalverzeichnis/denkmalliste-gemaess-3-dmsg.html';

// Test-URL für Tirol 2026. Im Produktivbetrieb wird der aktuelle Link jährlich automatisch
// von der BDA-Seite ermittelt oder als kleine versionierte lokale Datei gespiegelt.
const BDA_TYROL_CSV_2026 =
  'https://www.bda.gv.at/dam/jcr%3A51eeca38-0b23-49f5-8eec-0880ff513471/~Tir._2026raw%2BID_4943POS.csv';

const TIRIS_SOLAR_BUILDING_VIEW_URL =
  'https://maps.tirol.gv.at/externalcall.jsp?client=core&group_id=TMAPS-Gast&language=de&project=tmap_master&stateID=cec56936-19bb-45f9-8491-a9581526158d&user=guest';

const SOLAR_WMS_CANDIDATES = [
  {
    label: 'Land Tirol · Energiequellen WMS',
    url: 'https://gis.tirol.gv.at/arcgis/services/INSPIRE/AT_0024_33_Energiequellen/MapServer/WMSServer',
    historical: false,
  },
  {
    label: 'SOLAR TIROL · historischer Eignungsflächen-WMS',
    url: 'https://haleconnect.com/ows/services/org.892.7a0dbd38-05b0-485c-911c-a03ddbbf01d5_wms',
    historical: true,
  },
];

// Radonschutzverordnung Anlage 1 · Tirol. Alle Tiroler Gemeinden sind Radonvorsorgegebiet;
// diese GKZ sind zusätzlich als Radonschutzgebiet festgelegt.
const RADON_PROTECTION_TYROL_GKZ = new Set([
  '70903','70808','70809','70605','70810','70812','70202','70813','70815',
  '70208','70920','70211','70823','70214','70616','70825','70216','70218',
  '70219','70220','70217','70221','70830','70223','70834','70836',
]);

const RADON_RIS_URL =
  'https://ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Anlage=1&Gesetzesnummer=20011323';

const RADON_INFO_ENERGIE_TIROL_URL =
  'https://www.energieagentur.tirol/uploads/tx_bh/608/infoblatt_radon_web_nov_2020.pdf';

const BUILDING_FIELDS = [
  'OBJECTID',
  'GEMNR',
  'STAND',
  'GEB_HOEHE_MAX',
  'GEB_HOEHE_MEDIAN',
  'DOM_MAX',
  'DOM_MEDIAN',
  'UPDATETIMESTAMP',
  'Shape__Area',
  'Shape__Length',
].join(',');

let addressRegistry = null;
let bevSuggestionProvider = null;
let tirisLiveAddressProvider = null;
let hybridAddressProvider = null;
let selectedAddress = null;
let buildingFeatures = [];
let selectedBuildingId = null;
let selectedBuildingSelectionMode = null;
let naturalHazardsServiceMetadataCache = null;
let addressSearchTimer = null;
let addressSearchSequence = 0;
let addressModuleReadyPromise = null;
let pendingAddressChangeAction = 'initial';
let selectedKgResult = null;
let buildingMapDrawToken = 0;

const number0 = new Intl.NumberFormat('de-AT', {
  maximumFractionDigits: 0,
});

const number1 = new Intl.NumberFormat('de-AT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function setStatus(element, text, state = 'muted') {
  element.textContent = text;
  element.classList.remove(
    'is-working',
    'is-error',
    'is-success',
    'status-chip--muted'
  );

  if (state === 'working') element.classList.add('is-working');
  else if (state === 'error') element.classList.add('is-error');
  else if (state === 'success') element.classList.add('is-success');
  else element.classList.add('status-chip--muted');
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundTo(value, step) {
  const number = finiteNumber(value);
  if (number === null) return null;
  return Math.round(number / step) * step;
}

function formatArea(value, decimals = 1) {
  const number = finiteNumber(value);
  if (number === null) return '–';
  return `${decimals === 0 ? number0.format(number) : number1.format(number)} m²`;
}

function formatLength(value, decimals = 1) {
  const number = finiteNumber(value);
  if (number === null) return '–';
  return `${decimals === 0 ? number0.format(number) : number1.format(number)} m`;
}

function formatDate(value) {
  if (value === null || value === undefined || value === '') return '–';

  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

async function fetchJson(url, timeoutMs = 18000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();

    if (payload?.error) {
      throw new Error(payload.error.message || 'ArcGIS-Dienst meldet einen Fehler.');
    }

    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}

/* ---------------------------------------------------------
   1. Gemeinsame Hybrid-Adresssuche

   - BEV lokal liefert schnelle Vorschläge während der Eingabe.
   - Erst nach Auswahl wird die Adresse live mit TIRIS abgeglichen.
   - Ist TIRIS nicht erreichbar oder kein eindeutiger Treffer vorhanden,
     bleibt der BEV-Datensatz als dokumentierter Fallback verwendbar.
--------------------------------------------------------- */

function normalizeText(value) {
  if (window.AddressProviderCore?.normalizeText) {
    return window.AddressProviderCore.normalizeText(value);
  }
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('de-AT')
    .replace(/\s+/g, ' ');
}

function sqlLiteral(value) {
  return String(value ?? '').replaceAll("'", "''");
}

function closeSharedAddressSuggestions() {
  const box = $('tirisLiveAddressResults');
  box.hidden = true;
  box.innerHTML = '';
  $('tirisLiveAddressInput').setAttribute('aria-expanded', 'false');
}

function addressSourceLabel(record, provider = '') {
  const source = String(record?.source ?? '').trim();
  if (source) return source;
  if (String(provider).includes('tiris')) return 'Land Tirol / TIRIS live';
  if (String(provider).includes('bev')) return 'BEV – lokaler Adressindex';
  return 'Gemeinsame Adresssuche';
}

async function resolveAndSelectAddress(record, options = {}) {
  if (!record) return false;

  const status = $('tirisLiveAddressStatus');
  const note = $('tirisParsedAddress');
  setStatus(status, 'TIRIS-Abgleich …', 'working');
  note.textContent = 'BEV-Vorschlag gewählt · Adresse und Koordinate werden live mit TIRIS abgeglichen.';

  let resolved = {
    address: record,
    mode: options.provider || 'shared-address',
    usedFallback: false,
    warning: null,
  };

  if (typeof hybridAddressProvider?.resolve === 'function') {
    try {
      resolved = await hybridAddressProvider.resolve(record);
    } catch (error) {
      console.warn('TIRIS-Live-Abgleich fehlgeschlagen.', error);
      resolved = {
        address: record,
        mode: options.provider || 'bev-fallback',
        usedFallback: true,
        warning: `TIRIS-Live-Abgleich nicht verfügbar: ${error.message}. Die BEV-Stichtagsadresse wird verwendet.`,
      };
    }
  }

  const addressDecision = await window.EnergyToolsAddressManager?.requestSelection(resolved.address)
    ?? { allowed: true, action: 'initial' };
  if (!addressDecision.allowed) {
    const current = window.EnergyToolsAddressManager?.currentAddress();
    if (current?.label) $('tirisLiveAddressInput').value = current.label;
    closeSharedAddressSuggestions();
    setStatus(status, 'unverändert', 'success');
    note.textContent = 'Adresswechsel abgebrochen. Das bisherige Projekt bleibt unverändert.';
    return false;
  }

  pendingAddressChangeAction = addressDecision.action || 'initial';
  selectAddress(resolved.address, resolved.mode || options.provider || 'shared-address');

  if (resolved.usedFallback) {
    setStatus(status, 'BEV-Fallback', 'error');
    note.textContent = resolved.warning || 'Kein eindeutiger TIRIS-Live-Treffer. Die BEV-Stichtagsadresse wird verwendet.';
  } else {
    setStatus(status, 'TIRIS bestätigt', 'success');
    note.textContent = 'Adresse und Koordinate wurden live mit TIRIS bestätigt.';
  }
  return true;
}

function renderSharedAddressSuggestions(searchResult, options = {}) {
  const resultBox = $('tirisLiveAddressResults');
  const records = searchResult?.results ?? [];
  resultBox.innerHTML = '';

  if (records.length === 0) {
    resultBox.hidden = true;
    $('tirisLiveAddressInput').setAttribute('aria-expanded', 'false');
    $('tirisParsedAddress').textContent = searchResult?.guidance || 'Keine passende Adresse gefunden.';
    setStatus($('tirisLiveAddressStatus'), 'kein Treffer', 'error');
    return [];
  }

  records.forEach((record, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'suggestion-button';
    button.setAttribute('role', 'option');
    button.dataset.sharedAddressIndex = String(index);

    const sourceText = String(record.source ?? '').includes('TIRIS')
      ? `${record.source} · Adresscode ${record.source_id || record.address_code || '–'}`
      : `BEV-Vorschlag · TIRIS-Live-Check beim Auswählen · Adresscode ${record.source_id || '–'}`;

    button.innerHTML = `
      <strong>${escapeHtml(record.label)}</strong>
      <small>${escapeHtml(sourceText)}</small>
    `;
    button.addEventListener('click', () => resolveAndSelectAddress(record));
    resultBox.appendChild(button);
  });

  resultBox.hidden = false;
  $('tirisLiveAddressInput').setAttribute('aria-expanded', 'true');
  setStatus(
    $('tirisLiveAddressStatus'),
    records.length === 1 ? '1 Vorschlag' : `${records.length} Vorschläge`,
    'success'
  );

  if (options.autoSelectBest) {
    const expected = normalizeText(options.expectedLabel || $('tirisLiveAddressInput').value);
    const exact = records.find((record) => normalizeText(record.label) === expected);
    const chosen = exact || (records.length === 1 ? records[0] : null);
    if (chosen) return resolveAndSelectAddress(chosen, { provider: options.provider });
  }

  return records;
}

async function searchSharedAddress(options = {}) {
  if (!addressRegistry) {
    try { await initAddressModule(); } catch { return []; }
  }
  if (!addressRegistry) return [];

  const sequence = ++addressSearchSequence;
  const input = $('tirisLiveAddressInput');
  // Nur die Suchkopie normalisieren. Der sichtbare Text bleibt während des Tippens unverändert,
  // damit insbesondere ein Leerzeichen nach der Postleitzahl nicht verschwindet.
  const query = String(options.query ?? input.value).trim();

  if (query.length < 3) {
    closeSharedAddressSuggestions();
    $('tirisParsedAddress').textContent = 'Mindestens drei Zeichen eingeben. Die gewählte Adresse wird live mit TIRIS abgeglichen.';
    setStatus($('tirisLiveAddressStatus'), 'bereit');
    return [];
  }

  setStatus($('tirisLiveAddressStatus'), 'sucht …', 'working');
  $('tirisParsedAddress').textContent = 'Schnelle Vorschläge aus dem lokalen BEV-Index werden gesucht …';

  try {
    const result = await addressRegistry.search(query, { limit: 12 });
    if (sequence !== addressSearchSequence) return [];
    $('rawTirisLiveAddress').textContent = pretty({ query, result });
    const rendered = renderSharedAddressSuggestions(result, options);
    return await Promise.resolve(rendered);
  } catch (error) {
    if (sequence !== addressSearchSequence) return [];
    closeSharedAddressSuggestions();
    setStatus($('tirisLiveAddressStatus'), 'Fehler', 'error');
    $('tirisParsedAddress').textContent = `Adresssuche nicht verfügbar: ${error.message}`;
    $('rawTirisLiveAddress').textContent = pretty({ query, error: error.message });
    return [];
  }
}

function buildKgQueryUrl(address) {
  const geometry = {
    x: address.longitude,
    y: address.latitude,
    spatialReference: { wkid: 4326 },
  };
  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    geometry: JSON.stringify(geometry),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'false',
  });
  return `${TIRIS_BASIS_URL}/${TIRIS_KG_LAYER_ID}/query?${params.toString()}`;
}

async function loadKatastralgemeinde(address) {
  $('liveAddressChecks').hidden = false;
  $('kgResult').textContent = 'wird geprüft …';
  selectedKgResult = null;

  try {
    const metadataUrl = `${TIRIS_BASIS_URL}/${TIRIS_KG_LAYER_ID}?f=pjson`;
    const queryUrl = buildKgQueryUrl(address);
    const [metadata, query] = await Promise.all([
      fetchJson(metadataUrl),
      fetchJson(queryUrl),
    ]);

    const features = Array.isArray(query.features) ? query.features : [];
    const attrs = features[0]?.attributes ?? null;
    const fields = Array.isArray(metadata.fields) ? metadata.fields.map((field) => field.name) : [];

    selectedKgResult = { metadata_url: metadataUrl, metadata, query_url: queryUrl, query };
    $('rawKg').textContent = pretty(selectedKgResult);

    if (!attrs) {
      $('kgResult').innerHTML = '<strong>Kein KG-Treffer</strong><small>Rohdaten prüfen.</small>';
      return;
    }

    const likelyNumberKey = Object.keys(attrs).find((key) => /^(KGNR|KG_NR|KGNUMMER|KAT.*NR)$/i.test(key));
    const likelyNameKey = Object.keys(attrs).find((key) => /^(KGNAME|KG_NAME|KAT.*NAME|NAME)$/i.test(key));
    const likelyNumber = likelyNumberKey ? attrs[likelyNumberKey] : null;
    const likelyName = likelyNameKey ? attrs[likelyNameKey] : null;

    if (likelyNumber !== null && likelyNumber !== undefined) {
      address.cadastral_municipality_number = String(likelyNumber);
      address.cadastral_municipality_numbers = [String(likelyNumber)];
      $('rawAddress').textContent = pretty(address);
    }

    $('kgResult').innerHTML = `
      <strong>${escapeHtml(likelyName ?? 'KG-Polygon getroffen')}</strong>
      <small>${likelyNumberKey ? `${escapeHtml(likelyNumberKey)} = ${escapeHtml(likelyNumber)}` : 'KG-Nummer noch nicht automatisch erkannt'}</small>
      <small>Felder: ${escapeHtml(fields.join(', '))}</small>
    `;

    window.dispatchEvent(new CustomEvent('standortpass:kg-loaded', {
      detail: { name: likelyName ?? null, number: likelyNumber ?? null, attributes: attrs }
    }));
  } catch (error) {
    $('rawKg').textContent = pretty({ error: error.message });
    $('kgResult').innerHTML = `<strong>KG-Abfrage fehlgeschlagen</strong><small>${escapeHtml(error.message)}</small>`;
  }
}

async function compareSelectedAddressWithBev(address) {
  $('liveAddressChecks').hidden = false;

  if (!bevSuggestionProvider) {
    $('bevComparisonResult').innerHTML = '<strong>BEV noch nicht bereit</strong><small>Vergleich wird nach Initialisierung möglich.</small>';
    return;
  }

  try {
    const result = await bevSuggestionProvider.search(address.label, { limit: 12 });
    const records = result.results ?? [];
    const match = records.find((record) =>
      address.address_code && String(record.source_id) === String(address.address_code)
    ) ?? records.find((record) =>
      normalizeText(record.street) === normalizeText(address.street) &&
      normalizeText(record.house_number) === normalizeText(address.house_number) &&
      String(record.postal_code) === String(address.postal_code)
    );

    if (!match) {
      $('rawBevComparison').textContent = pretty({ query: address.label, results: records });
      $('bevComparisonResult').innerHTML = '<strong>Kein eindeutiger BEV-Vergleich</strong><small>Live-Adresse kann trotzdem verwendet werden.</small>';
      return;
    }

    const distance = haversineMeters(
      address.latitude,
      address.longitude,
      match.latitude,
      match.longitude
    );

    const comparison = {
      tiris: address,
      bev: match,
      same_address_code: String(match.source_id) === String(address.address_code),
      coordinate_difference_m: distance,
    };
    $('rawBevComparison').textContent = pretty(comparison);
    $('bevComparisonResult').innerHTML = `
      <strong>${comparison.same_address_code ? 'ADRCD identisch ✓' : 'Adresscode abweichend'}</strong>
      <small>TIRIS ${escapeHtml(address.address_code ?? '–')} · BEV ${escapeHtml(match.source_id ?? '–')}</small>
      <small>Koordinatendifferenz ca. ${number1.format(distance)} m</small>
    `;
  } catch (error) {
    $('rawBevComparison').textContent = pretty({ error: error.message });
    $('bevComparisonResult').innerHTML = `<strong>BEV-Vergleich fehlgeschlagen</strong><small>${escapeHtml(error.message)}</small>`;
  }
}

/* ---------------------------------------------------------
   1d. Gemeinsame Adressmodule initialisieren
--------------------------------------------------------- */

async function initAddressModule() {
  if (addressModuleReadyPromise) return addressModuleReadyPromise;

  addressModuleReadyPromise = (async () => {
    try {
    if (
      !window.AddressProviderCore ||
      !window.BevLocalAddressProvider ||
      !window.TirisLiveAddressProvider ||
      !window.HybridAddressProvider
    ) {
      throw new Error('Gemeinsame Adressprovider-Dateien fehlen oder wurden nicht geladen.');
    }

    bevSuggestionProvider = new window.BevLocalAddressProvider({
      baseUrl: window.EnergyToolsPaths?.addresses ?? '../../shared/data/addresses',
    });
    tirisLiveAddressProvider = new window.TirisLiveAddressProvider();
    hybridAddressProvider = new window.HybridAddressProvider({
      suggestionProvider: bevSuggestionProvider,
      liveProvider: tirisLiveAddressProvider,
    });

    addressRegistry = new window.AddressProviderCore.AddressProviderRegistry();
    addressRegistry.register(hybridAddressProvider);
    await addressRegistry.init();

    const info = addressRegistry.info();
    setStatus($('tirisLiveAddressStatus'), 'bereit', 'success');
    $('tirisParsedAddress').textContent =
      `${number0.format(info.address_count)} BEV-Adressen · Stand ${info.dataset_date ?? '–'} · ausgewählte Adressen werden live mit TIRIS bestätigt.`;

    if (selectedAddress) compareSelectedAddressWithBev(selectedAddress);
    } catch (error) {
      addressModuleReadyPromise = null;
      setStatus($('tirisLiveAddressStatus'), 'Adressmodul Fehler', 'error');
      $('tirisParsedAddress').textContent = error.message;
      console.error(error);
      return null;
    }
  })();

  return addressModuleReadyPromise;
}

function selectAddress(record, provider = 'bev') {
  selectedAddress = record;
  buildingFeatures = [];
  selectedBuildingId = null;
  selectedBuildingSelectionMode = null;
  if ($('solarObserverMode')) $('solarObserverMode').value = 'auto';

  $('tirisLiveAddressInput').value = record.label;
  closeSharedAddressSuggestions();

  const sourceLabel = addressSourceLabel(record, provider);
  const stand = record.dataset_date ? ` · Stand ${record.dataset_date}` : '';
  const updated = record.updated_at ? ` · aktualisiert ${record.updated_at}` : '';

  $('selectedAddressLabel').textContent = record.label;
  $('selectedAddressMeta').textContent =
    `${record.latitude.toFixed(6)}, ${record.longitude.toFixed(6)} · ` +
    `${record.coordinate_kind === 'building' ? 'Gebäudekoordinate' : 'Adress-/Zugangskoordinate'} · ` +
    `${sourceLabel}${stand}${updated}`;
  $('selectedAddressCard').hidden = false;
  $('liveAddressChecks').hidden = false;

  $('rawAddress').textContent = pretty(record);

  $('loadBuildingButton').disabled = false;
  $('loadBuildingAreaButton').disabled = false;
  $('testTirisAddressLayersButton').disabled = false;
  $('loadTerrainButton').disabled = false;
  $('loadSolarButton').disabled = false;
  $('testEnvironmentalHeatButton').disabled = false;
  $('testHazardButton').disabled = false;
  $('testSolarMapButton').disabled = false;
  $('testHeritageButton').disabled = false;
  $('testRadonButton').disabled = false;
  $('testClimateAnalysisButton').disabled = false;
  setStatus($('buildingStatus'), 'bereit');
  setStatus($('terrainStatus'), 'bereit');
  setStatus($('solarStatus'), 'bereit');
  setStatus($('environmentalHeatStatus'), 'bereit');
  setStatus($('hazardStatus'), 'bereit');
  setStatus($('solarMapStatus'), 'bereit');
  setStatus($('heritageStatus'), 'bereit');
  setStatus($('radonStatus'), 'bereit');
  setStatus($('climateAnalysisStatus'), 'bereit');

  resetBuildingOutput();
  resetTirisAddressLayerOutput();
  resetTerrainOutput();
  resetSolarOutput();
  resetEnvironmentalHeatOutput();
  resetHazardOutput();
  resetSolarMapOutput();
  resetHeritageOutput();
  resetRadonOutput();
  resetClimateAnalysisOutput();

  const addressChangeAction = pendingAddressChangeAction;
  pendingAddressChangeAction = 'initial';
  window.dispatchEvent(new CustomEvent('standortpass:address-selected', {
    detail: { record: JSON.parse(JSON.stringify(record)), provider, addressChangeAction }
  }));

  loadKatastralgemeinde(record);
  compareSelectedAddressWithBev(record);
}

function clearAddress() {
  addressSearchSequence += 1;
  selectedAddress = null;
  selectedKgResult = null;
  $('tirisLiveAddressInput').value = '';
  $('selectedAddressCard').hidden = true;
  $('liveAddressChecks').hidden = true;
  closeSharedAddressSuggestions();
  $('rawAddress').textContent = '–';
  $('rawTirisLiveAddress').textContent = '–';
  $('rawKg').textContent = '–';
  $('rawBevComparison').textContent = '–';
  $('loadBuildingButton').disabled = true;
  $('loadBuildingAreaButton').disabled = true;
  $('testTirisAddressLayersButton').disabled = true;
  $('loadTerrainButton').disabled = true;
  $('loadSolarButton').disabled = true;
  $('testEnvironmentalHeatButton').disabled = true;
  $('testHazardButton').disabled = true;
  $('testSolarMapButton').disabled = true;
  $('testHeritageButton').disabled = true;
  $('testRadonButton').disabled = true;
  $('testClimateAnalysisButton').disabled = true;
  setStatus($('buildingStatus'), 'Adresse fehlt');
  setStatus($('terrainStatus'), 'Adresse fehlt');
  setStatus($('solarStatus'), 'Adresse fehlt');
  setStatus($('environmentalHeatStatus'), 'Adresse fehlt');
  setStatus($('hazardStatus'), 'Adresse fehlt');
  setStatus($('solarMapStatus'), 'Adresse fehlt');
  setStatus($('heritageStatus'), 'Adresse fehlt');
  setStatus($('radonStatus'), 'Adresse fehlt');
  setStatus($('climateAnalysisStatus'), 'Adresse fehlt');
  setStatus($('tirisLiveAddressStatus'), addressRegistry ? 'bereit' : 'nicht geprüft', addressRegistry ? 'success' : 'muted');
  $('tirisParsedAddress').textContent = 'Mindestens drei Zeichen eingeben. Die gewählte Adresse wird live mit TIRIS abgeglichen.';
  resetBuildingOutput();
  resetTirisAddressLayerOutput();
  resetTerrainOutput();
  resetSolarOutput();
  resetEnvironmentalHeatOutput();
  resetHazardOutput();
  resetSolarMapOutput();
  resetHeritageOutput();
  resetRadonOutput();
  resetClimateAnalysisOutput();
  window.dispatchEvent(new CustomEvent('standortpass:address-cleared'));
}

/* ---------------------------------------------------------
   2. TIRIS BASIS Metadaten
--------------------------------------------------------- */

async function testBasisService() {
  const status = $('basisStatus');
  const resultBox = $('basisResult');

  setStatus(status, 'prüft …', 'working');
  resultBox.hidden = true;

  try {
    const payload = await fetchJson(`${TIRIS_BASIS_URL}?f=pjson`);
    $('rawBasis').textContent = pretty(payload);

    const layers = Array.isArray(payload.layers) ? payload.layers : [];
    const addressLayers = layers.filter((layer) =>
      /adress|adresse/i.test(String(layer.name ?? ''))
    );

    const layerText = addressLayers.length > 0
      ? `<ul class="service-layer-list">${addressLayers
          .map((layer) => `<li><strong>ID ${layer.id}</strong> · ${escapeHtml(layer.name)}</li>`)
          .join('')}</ul>`
      : '<p>In der Servicebeschreibung wurde kein Layername mit „Adresse“ gefunden. Die Rohantwort ist unten einsehbar.</p>';

    resultBox.innerHTML = `
      <h3>Service erreichbar</h3>
      <p><strong>${layers.length}</strong> Layer in der Servicebeschreibung. Davon ${addressLayers.length} mit „Adresse“ im Namen.</p>
      ${layerText}
      <p class="field-status">Nächster Schritt bei Treffern: Felder und Query-Eignung des konkreten Layers testen.</p>
    `;
    resultBox.hidden = false;
    setStatus(status, 'erreichbar', 'success');
  } catch (error) {
    $('rawBasis').textContent = pretty({ error: error.message });
    resultBox.innerHTML = `
      <h3>Browserabruf fehlgeschlagen</h3>
      <p>${escapeHtml(error.message)}</p>
      <p class="field-status">Das kann auf Dienstunterbrechung, CORS oder einen geänderten Endpunkt hinweisen.</p>
    `;
    resultBox.hidden = false;
    setStatus(status, 'Fehler', 'error');
  }
}

/* ---------------------------------------------------------
   2b. TIRIS Adress-Layer: Felder + Standortabfrage
--------------------------------------------------------- */

function buildTirisPointQueryUrl(layerId, address, radiusM = 30) {
  const geometry = {
    x: address.longitude,
    y: address.latitude,
    spatialReference: { wkid: 4326 },
  };

  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    geometry: JSON.stringify(geometry),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    distance: String(radiusM),
    units: 'esriSRUnit_Meter',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    returnZ: 'false',
    returnM: 'false',
  });

  return `${TIRIS_BASIS_URL}/${layerId}/query?${params.toString()}`;
}

async function testTirisAddressLayers() {
  if (!selectedAddress) return;

  const resultBox = $('tirisAddressLayerResult');
  resultBox.hidden = false;
  resultBox.innerHTML = '<p class="field-status">Adress-Layer werden geprüft …</p>';

  const allResults = [];
  const cards = [];

  for (const layer of TIRIS_ADDRESS_TEST_LAYERS) {
    try {
      const metadataUrl = `${TIRIS_BASIS_URL}/${layer.id}?f=pjson`;
      const metadata = await fetchJson(metadataUrl);
      const queryUrl = buildTirisPointQueryUrl(layer.id, selectedAddress, 30);
      const query = await fetchJson(queryUrl);

      const fields = Array.isArray(metadata.fields)
        ? metadata.fields.map((field) => field.name)
        : [];
      const features = Array.isArray(query.features) ? query.features : [];
      const firstAttrs = features[0]?.attributes ?? null;

      allResults.push({
        layer,
        metadata_url: metadataUrl,
        metadata,
        query_url: queryUrl,
        query,
      });

      cards.push(`
        <div class="layer-test-card">
          <h4>ID ${layer.id} · ${escapeHtml(metadata.name || layer.label)}</h4>
          <p><strong>${features.length}</strong> Treffer innerhalb 30 m · Query ${metadata.capabilities?.includes('Query') || query ? 'möglich' : 'unklar'}</p>
          <p class="layer-fields"><strong>Felder:</strong> ${escapeHtml(fields.join(', ') || 'keine Feldliste geliefert')}</p>
          <p class="layer-fields"><strong>Erster Treffer:</strong> ${escapeHtml(firstAttrs ? JSON.stringify(firstAttrs) : '–')}</p>
        </div>
      `);
    } catch (error) {
      allResults.push({ layer, error: error.message });
      cards.push(`
        <div class="layer-test-card">
          <h4>ID ${layer.id} · ${escapeHtml(layer.label)}</h4>
          <p class="field-status">Fehler: ${escapeHtml(error.message)}</p>
        </div>
      `);
    }
  }

  $('rawTirisAddresses').textContent = pretty(allResults);
  resultBox.innerHTML = `
    <h3>TIRIS-Adresslayer am gewählten Standort</h3>
    <p>Entscheidend sind jetzt die Feldnamen und ob eine eindeutige Adresse/Adresskennung enthalten ist.</p>
    ${cards.join('')}
  `;
}

function resetTirisAddressLayerOutput() {
  $('tirisAddressLayerResult').hidden = true;
  $('tirisAddressLayerResult').innerHTML = '';
  $('rawTirisAddresses').textContent = '–';
}

/* ---------------------------------------------------------
   3. TIRIS Gebäude FeatureServer
--------------------------------------------------------- */

function buildBuildingQueryUrl(address, radiusM = null) {
  const geometry = {
    x: address.longitude,
    y: address.latitude,
    spatialReference: { wkid: 4326 },
  };

  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    geometry: JSON.stringify(geometry),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: BUILDING_FIELDS,
    returnGeometry: 'true',
    outSR: '4326',
    returnZ: 'false',
    returnM: 'false',
  });

  if (radiusM !== null && Number(radiusM) > 0) {
    params.set('distance', String(radiusM));
    params.set('units', 'esriSRUnit_Meter');
  }

  return `${TIRIS_BUILDING_QUERY_URL}?${params.toString()}`;
}

async function fetchBuildingsAtRadius(radiusM = null) {
  const url = buildBuildingQueryUrl(selectedAddress, radiusM);
  const payload = await fetchJson(url);
  return {
    radius_m: radiusM,
    request_url: url,
    response: payload,
    features: Array.isArray(payload.features) ? payload.features : [],
  };
}

function prepareBuildingFeatures(features) {
  return features
    .map((feature) => ({
      ...feature,
      _distance: approximateFeatureDistance(feature, selectedAddress),
    }))
    .sort((a, b) => a._distance - b._distance);
}

function showBuildingFeatures(features, matchText, options = {}) {
  buildingFeatures = prepareBuildingFeatures(features);
  renderBuildingCandidates();
  drawBuildingGeometry(buildingFeatures);
  $('buildingResults').hidden = false;
  $('buildingMatchInfo').textContent = matchText;
  $('noSuitableBuildingButton').hidden = !options.allowNoBuilding;

  setStatus(
    $('buildingStatus'),
    buildingFeatures.length === 1 ? '1 Gebäude' : `${buildingFeatures.length} Gebäude`,
    'success'
  );

  if (buildingFeatures.length === 1 && options.autoSelectSingle !== false) {
    selectBuilding(buildingFeatures[0].attributes?.OBJECTID, 'automatic');
  }
}

async function loadBuildings() {
  if (!selectedAddress) return;

  const status = $('buildingStatus');
  setStatus(status, 'ordnet zu …', 'working');
  resetBuildingOutput(false);

  const attempts = [];

  try {
    const exact = await fetchBuildingsAtRadius(null);
    attempts.push(exact);

    if (exact.features.length === 1) {
      $('rawBuildings').textContent = pretty({ mode: 'automatic', attempts });
      showBuildingFeatures(
        exact.features,
        'Eindeutiger Treffer: Der gewählte Adress-/Gebäudepunkt liegt direkt im TIRIS-Dachpolygon.'
      );
      return;
    }

    if (exact.features.length > 1) {
      $('rawBuildings').textContent = pretty({ mode: 'automatic', attempts });
      showBuildingFeatures(
        exact.features,
        'Mehrere Polygone schneiden die BEV-Gebäudekoordinate. Bitte das passende Gebäude anklicken.'
      );
      return;
    }

    const fallback15 = await fetchBuildingsAtRadius(15);
    attempts.push(fallback15);

    if (fallback15.features.length > 0) {
      $('rawBuildings').textContent = pretty({ mode: 'automatic', attempts });
      showBuildingFeatures(
        fallback15.features,
        `Kein direkter Polygon-Treffer. ${fallback15.features.length} Kandidat(en) innerhalb 15 m – bitte prüfen.`,
        { autoSelectSingle: false, allowNoBuilding: true }
      );
      return;
    }

    const maxRadius = Number($('buildingRadius').value) || 30;
    if (maxRadius > 15) {
      const fallbackMax = await fetchBuildingsAtRadius(maxRadius);
      attempts.push(fallbackMax);

      if (fallbackMax.features.length > 0) {
        $('rawBuildings').textContent = pretty({ mode: 'automatic', attempts });
        showBuildingFeatures(
          fallbackMax.features,
          `Kein Treffer bis 15 m. ${fallbackMax.features.length} Kandidat(en) innerhalb ${maxRadius} m – bitte prüfen.`,
          { autoSelectSingle: false, allowNoBuilding: true }
        );
        return;
      }
    }

    $('rawBuildings').textContent = pretty({ mode: 'automatic', attempts });
    setStatus(status, 'keine Geometrie', 'muted');
    $('buildingResults').hidden = false;
    $('buildingCandidateList').innerHTML =
      '<p class="field-status">Kein geeignetes Dachpolygon gefunden. Die Standortprüfung läuft trotzdem weiter.</p>';
    drawBuildingGeometry([]);
    $('buildingMatchInfo').textContent = 'Keine Gebäudegeometrie verfügbar – kein Blocker für die übrigen Standortmodule.';
    $('noBuildingNote').hidden = false;
  } catch (error) {
    $('rawBuildings').textContent = pretty({ error: error.message, attempts });
    setStatus(status, 'Fehler', 'error');
    $('buildingResults').hidden = false;
    $('buildingCandidateList').innerHTML =
      `<p class="field-status">Gebäudeabruf fehlgeschlagen: ${escapeHtml(error.message)}</p>`;
  }
}

async function loadBuildingArea() {
  if (!selectedAddress) return;

  const status = $('buildingStatus');
  const radius = Number($('buildingRadius').value) || 30;
  setStatus(status, 'lädt Umgebung …', 'working');
  resetBuildingOutput(false);

  try {
    const attempt = await fetchBuildingsAtRadius(radius);
    $('rawBuildings').textContent = pretty({ mode: 'manual_area', attempts: [attempt] });

    if (attempt.features.length === 0) {
      setStatus(status, 'keine Geometrie', 'muted');
      $('buildingResults').hidden = false;
      $('buildingCandidateList').innerHTML =
        `<p class="field-status">Im Umkreis von ${radius} m wurde kein Gebäude gefunden. Standortmodule bleiben nutzbar.</p>`;
      drawBuildingGeometry([]);
      $('noBuildingNote').hidden = false;
      return;
    }

    showBuildingFeatures(
      attempt.features,
      `Manuelle Umkreissuche: ${attempt.features.length} Gebäude innerhalb ${radius} m.`,
      { autoSelectSingle: false, allowNoBuilding: true }
    );
  } catch (error) {
    $('rawBuildings').textContent = pretty({ error: error.message });
    setStatus(status, 'Fehler', 'error');
  }
}

function renderBuildingCandidates() {
  const list = $('buildingCandidateList');
  list.innerHTML = '';

  buildingFeatures.forEach((feature, index) => {
    const attrs = feature.attributes ?? {};
    const area = finiteNumber(attrs.Shape__Area);
    const distance = Number.isFinite(feature._distance) ? feature._distance : null;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'candidate-button';
    button.dataset.objectId = attrs.OBJECTID;
    button.innerHTML = `
      <strong>Gebäude ${index + 1}${attrs.OBJECTID ? ` · ID ${attrs.OBJECTID}` : ''}</strong>
      <small>${area !== null ? `ca. ${number0.format(roundTo(area, 10))} m²` : 'Fläche –'}${distance !== null ? ` · Mittelpunkt ca. ${number0.format(distance)} m` : ''}</small>
    `;
    button.addEventListener('click', () => selectBuilding(attrs.OBJECTID, 'manual'));
    list.appendChild(button);
  });
}

function selectBuilding(objectId, selectionMode = 'manual') {
  const feature = buildingFeatures.find(
    (item) => String(item.attributes?.OBJECTID) === String(objectId)
  );

  if (!feature) return;

  selectedBuildingId = feature.attributes?.OBJECTID;
  selectedBuildingSelectionMode = selectionMode;
  if ($('solarObserverMode')) $('solarObserverMode').value = 'auto';

  document.querySelectorAll('.candidate-button').forEach((button) => {
    button.classList.toggle(
      'is-selected',
      String(button.dataset.objectId) === String(selectedBuildingId)
    );
  });

  document.querySelectorAll('.building-shape').forEach((shape) => {
    shape.classList.toggle(
      'is-selected',
      String(shape.dataset.objectId) === String(selectedBuildingId)
    );
  });

  showSelectedBuilding(feature);
  $('buildingResults').classList.add('has-selection');
  $('buildingResults').classList.remove('is-editing');
  resetSolarOutput();
  if (selectedAddress) setStatus($('solarStatus'), 'bereit');
  window.dispatchEvent(new CustomEvent('standortpass:building-selected', {
    detail: {
      feature: JSON.parse(JSON.stringify(feature)),
      selectionMode: selectedBuildingSelectionMode,
    }
  }));
}

function restoreBuildingSnapshot(snapshot) {
  const feature = snapshot?.feature || snapshot;
  if (!feature?.attributes || !feature?.geometry) return false;

  showBuildingFeatures(
    [JSON.parse(JSON.stringify(feature))],
    'Gespeicherte Gebäudeauswahl aus dem gemeinsamen Projekt wiederhergestellt.',
    { autoSelectSingle: false, allowNoBuilding: true }
  );
  const objectId = feature.attributes?.OBJECTID;
  selectBuilding(objectId, snapshot?.selectionMode || 'restored');
  setStatus($('buildingStatus'), 'gespeichert', 'success');
  return Boolean(selectedBuildingId !== null && selectedBuildingId !== undefined);
}

function showSelectedBuilding(feature) {
  $('noBuildingNote').hidden = true;
  const attrs = feature.attributes ?? {};
  const area = finiteNumber(attrs.Shape__Area);
  const length = finiteNumber(attrs.Shape__Length);
  const medianHeight = finiteNumber(attrs.GEB_HOEHE_MEDIAN);
  const maxHeight = finiteNumber(attrs.GEB_HOEHE_MAX);

  $('selectedBuildingTitle').textContent = attrs.OBJECTID
    ? `TIRIS-Objekt ${attrs.OBJECTID}`
    : 'TIRIS-Gebäude';
  $('metricAreaRaw').textContent = formatArea(area, 1);
  $('metricAreaRounded').textContent = area === null
    ? '–'
    : `ca. ${number0.format(roundTo(area, 10))} m²`;
  $('metricLengthRaw').textContent = formatLength(length, 1);
  if ($('metricLengthRounded')) $('metricLengthRounded').textContent = length === null ? '–' : `ca. ${number0.format(roundTo(length, 1))} m`;
  $('metricHeightMedian').textContent = formatLength(medianHeight, 1);
  $('metricHeightMax').textContent = formatLength(maxHeight, 1);
  $('metricStand').textContent = formatDate(attrs.STAND);
  $('metricUpdated').textContent = formatDate(attrs.UPDATETIMESTAMP);

  const plausibleMedian =
    medianHeight !== null && medianHeight >= 2.5 && medianHeight <= 60;

  if (length !== null && plausibleMedian) {
    const wallRaw = length * medianHeight;
    $('wallPreview').textContent =
      `Brutto-Außenwand orientierend ca. ${number0.format(roundTo(wallRaw, 10))} m²`;
  } else {
    $('wallPreview').textContent =
      'Keine Testableitung – Medianhöhe derzeit nicht plausibel/verfügbar.';
  }

  $('selectedBuildingPanel').hidden = false;
}

function resetBuildingOutput(clearRaw = true) {
  buildingFeatures = [];
  selectedBuildingId = null;
  selectedBuildingSelectionMode = null;
  $('buildingResults').hidden = true;
  $('buildingResults').classList.remove('has-selection', 'is-editing');
  $('selectedBuildingPanel').hidden = true;
  $('buildingCandidateList').innerHTML = '';
  $('noSuitableBuildingButton').hidden = true;
  $('buildingSvg').innerHTML = '';
  $('buildingComparisonResult').hidden = true;
  $('noBuildingNote').hidden = true;
  $('orthophotoImage').hidden = true;
  $('orthophotoImage').removeAttribute('src');
  $('orthophotoStatus').textContent = 'Orthofoto wird mit der Geometrie geladen.';
  $('rawOrthophoto').textContent = '–';
  $('buildingMatchInfo').textContent = 'Zuerst wird geprüft, ob der gewählte Adress-/Gebäudepunkt direkt in einem TIRIS-Dachpolygon liegt.';
  if (clearRaw) $('rawBuildings').textContent = '–';
}

function approximateFeatureDistance(feature, address) {
  const points = geometryPoints(feature.geometry);
  if (points.length === 0) return Number.POSITIVE_INFINITY;

  const centroid = points.reduce(
    (acc, point) => ({ x: acc.x + point[0], y: acc.y + point[1] }),
    { x: 0, y: 0 }
  );

  centroid.x /= points.length;
  centroid.y /= points.length;

  return haversineMeters(
    address.latitude,
    address.longitude,
    centroid.y,
    centroid.x
  );
}

function geometryPoints(geometry) {
  const rings = Array.isArray(geometry?.rings) ? geometry.rings : [];
  return rings.flat().filter(
    (point) => Array.isArray(point) && point.length >= 2 &&
      Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]))
  );
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const rad = (value) => (value * Math.PI) / 180;
  const earth = 6371000;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MAP_VIEW_PRESETS = {
  '250': { label: 'ca. 1:250', groundWidthM: 40 },
  '500': { label: 'ca. 1:500', groundWidthM: 80 },
  '750': { label: 'ca. 1:750', groundWidthM: 120 },
};

function mapViewPreset() {
  return MAP_VIEW_PRESETS[$('orthophotoScale')?.value] ?? MAP_VIEW_PRESETS['500'];
}

function boundsAroundPoint(latitude, longitude, groundWidthM, aspect = 520 / 360) {
  const latRad = (latitude * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLon = Math.max(111320 * Math.cos(latRad), 1);
  const groundHeightM = groundWidthM / aspect;
  const halfLon = (groundWidthM / 2) / metersPerDegLon;
  const halfLat = (groundHeightM / 2) / metersPerDegLat;

  return {
    minX: longitude - halfLon,
    maxX: longitude + halfLon,
    minY: latitude - halfLat,
    maxY: latitude + halfLat,
    groundWidthM,
    groundHeightM,
  };
}

function expandBoundsToInclude(bounds, points, marginFactor = 1.08) {
  if (!points.length) return bounds;

  let { minX, minY, maxX, maxY } = bounds;
  points.forEach(([x, y]) => {
    minX = Math.min(minX, Number(x));
    maxX = Math.max(maxX, Number(x));
    minY = Math.min(minY, Number(y));
    maxY = Math.max(maxY, Number(y));
  });

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const halfX = ((maxX - minX) / 2) * marginFactor;
  const halfY = ((maxY - minY) / 2) * marginFactor;
  return {
    ...bounds,
    minX: centerX - halfX,
    maxX: centerX + halfX,
    minY: centerY - halfY,
    maxY: centerY + halfY,
  };
}

function buildOrthophotoWmsUrl(minX, minY, maxX, maxY, srs = 'EPSG:4326') {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: 'Image_Aktuell_RGB',
    STYLES: '',
    SRS: srs,
    BBOX: `${minX},${minY},${maxX},${maxY}`,
    WIDTH: '1040',
    HEIGHT: '720',
    FORMAT: 'image/jpeg',
    TRANSPARENT: 'false',
  });
  return `${TIRIS_ORTHOPHOTO_WMS_URL}?${params.toString()}`;
}

function loadOrthophotoForBounds(minX, minY, maxX, maxY, viewInfo = {}, srs = 'EPSG:4326') {
  const image = $('orthophotoImage');
  const status = $('orthophotoStatus');
  const url = buildOrthophotoWmsUrl(minX, minY, maxX, maxY, srs);

  $('rawOrthophoto').textContent = pretty({
    service: 'TIRIS Orthofoto WMS',
    layer: 'Image_Aktuell_RGB',
    srs,
    bbox: [minX, minY, maxX, maxY],
    view: viewInfo,
    request_url: url,
  });

  image.hidden = true;
  status.textContent = 'Orthofoto wird geladen …';
  image.onload = () => {
    image.hidden = false;
    const preset = mapViewPreset();
    const shownWidth = Number(viewInfo.actual_ground_width_m ?? preset.groundWidthM);
    const extended = shownWidth > preset.groundWidthM + 1;
    status.textContent = extended
      ? `TIRIS Orthofoto geladen · Ausschnitt automatisch auf ca. ${number0.format(shownWidth)} m erweitert.`
      : `TIRIS Orthofoto geladen · Ausschnitt ${preset.label} (${number0.format(preset.groundWidthM)} m Breite).`;
  };
  image.onerror = () => {
    image.hidden = true;
    status.textContent = 'Orthofoto konnte nicht geladen werden – bitte WMS prüfen.';
  };
  image.src = url;
}

function buildProjectedBuildingQueryUrl(features) {
  const objectIds = features
    .map((feature) => feature?.attributes?.OBJECTID)
    .filter((value) => value !== null && value !== undefined)
    .join(',');
  if (!objectIds) return null;
  const params = new URLSearchParams({
    f: 'json',
    objectIds,
    outFields: 'OBJECTID',
    returnGeometry: 'true',
    outSR: '31254',
    returnZ: 'false',
    returnM: 'false',
  });
  return `${TIRIS_BUILDING_QUERY_URL}?${params.toString()}`;
}

function projectedBoundsAroundPoint(x, y, groundWidthM, aspect = 13 / 9) {
  const groundHeightM = groundWidthM / aspect;
  return {
    minX: x - groundWidthM / 2,
    maxX: x + groundWidthM / 2,
    minY: y - groundHeightM / 2,
    maxY: y + groundHeightM / 2,
    groundWidthM,
    groundHeightM,
  };
}

function expandProjectedBoundsToInclude(bounds, points, marginFactor = 1.08, aspect = 13 / 9) {
  if (!points.length) return bounds;
  let minX = bounds.minX;
  let minY = bounds.minY;
  let maxX = bounds.maxX;
  let maxY = bounds.maxY;
  points.forEach(([x, y]) => {
    minX = Math.min(minX, Number(x));
    maxX = Math.max(maxX, Number(x));
    minY = Math.min(minY, Number(y));
    maxY = Math.max(maxY, Number(y));
  });

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  let width = Math.max(bounds.groundWidthM, (maxX - minX) * marginFactor);
  let height = Math.max(bounds.groundHeightM, (maxY - minY) * marginFactor);

  // BBOX und Bildfläche behalten exakt dasselbe Seitenverhältnis.
  if (width / height < aspect) width = height * aspect;
  else height = width / aspect;

  return {
    minX: centerX - width / 2,
    maxX: centerX + width / 2,
    minY: centerY - height / 2,
    maxY: centerY + height / 2,
    groundWidthM: width,
    groundHeightM: height,
  };
}

function drawProjectedBuildingSvg(svg, features, bounds, projectedAddress) {
  const width = 520;
  const height = 360;
  const { minX, minY, maxX, maxY } = bounds;
  const project = ([x, y]) => {
    const px = ((x - minX) / (maxX - minX || 1)) * width;
    const py = height - ((y - minY) / (maxY - minY || 1)) * height;
    return [px, py];
  };

  features.forEach((feature) => {
    const objectId = feature.attributes?.OBJECTID;
    const rings = Array.isArray(feature.geometry?.rings) ? feature.geometry.rings : [];
    rings.forEach((ring) => {
      if (!Array.isArray(ring) || ring.length < 3) return;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const d = ring.map((point, index) => {
        const [x, y] = project(point);
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(' ') + ' Z';
      path.setAttribute('d', d);
      path.setAttribute('class', 'building-shape');
      if (String(objectId) === String(selectedBuildingId)) path.classList.add('is-selected');
      path.dataset.objectId = objectId;
      path.addEventListener('click', () => selectBuilding(objectId));
      svg.appendChild(path);
    });
  });

  if (projectedAddress) {
    const [cx, cy] = project([projectedAddress.x, projectedAddress.y]);
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx.toFixed(2));
    circle.setAttribute('cy', cy.toFixed(2));
    circle.setAttribute('r', '6');
    circle.setAttribute('class', 'address-point');
    svg.appendChild(circle);
  }
}

async function drawBuildingGeometry(features) {
  const svg = $('buildingSvg');
  const token = ++buildingMapDrawToken;
  svg.innerHTML = '';

  if (!selectedAddress || features.length === 0) {
    if (features.length === 0) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', '260');
      text.setAttribute('y', '180');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#526562');
      text.textContent = 'Keine Geometrie verfügbar';
      svg.appendChild(text);
    }
    return;
  }

  const preset = mapViewPreset();

  try {
    // Für die Kartenkontrolle verwenden Orthofoto UND Gebäudegeometrie dieselbe
    // amtliche Tiroler Projektion EPSG:31254. Damit vermeiden wir Browser-/WMS-
    // Abweichungen aus unterschiedlichen Koordinatensystemen.
    const [projectedAddress, projectedBuildings] = await Promise.all([
      fetchProjectedTirisAddressPoint(selectedAddress),
      (async () => {
        const url = buildProjectedBuildingQueryUrl(features);
        if (!url) return { url: null, features: [] };
        const payload = await fetchJson(url);
        return { url, features: Array.isArray(payload?.features) ? payload.features : [] };
      })(),
    ]);
    if (token !== buildingMapDrawToken) return;
    if (!projectedAddress || projectedBuildings.features.length === 0) {
      throw new Error('Projizierte Kartenkontrolle nicht verfügbar.');
    }

    const points = projectedBuildings.features.flatMap((feature) => geometryPoints(feature.geometry));
    points.push([projectedAddress.x, projectedAddress.y]);
    let bounds = projectedBoundsAroundPoint(projectedAddress.x, projectedAddress.y, preset.groundWidthM);
    bounds = expandProjectedBoundsToInclude(bounds, points, 1.06);

    loadOrthophotoForBounds(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, {
      preset: preset.label,
      requested_ground_width_m: preset.groundWidthM,
      actual_ground_width_m: bounds.groundWidthM,
      projected_address_layer: projectedAddress.layer_id,
      projected_building_query: projectedBuildings.url,
    }, 'EPSG:31254');
    drawProjectedBuildingSvg(svg, projectedBuildings.features, bounds, projectedAddress);
  } catch (error) {
    if (token !== buildingMapDrawToken) return;
    $('orthophotoStatus').textContent = `Kartenkontrolle konnte nicht gemeinsam projiziert werden: ${error.message}`;
    $('orthophotoImage').hidden = true;
  }
}

/* ---------------------------------------------------------
   3b. Vergleich gegen bekannte Gebäudeabmessungen
--------------------------------------------------------- */

function selectedBuildingFeature() {
  return buildingFeatures.find(
    (item) => String(item.attributes?.OBJECTID) === String(selectedBuildingId)
  ) ?? null;
}

function percentDifference(actual, reference) {
  if (!Number.isFinite(actual) || !Number.isFinite(reference) || reference === 0) {
    return null;
  }
  return ((actual / reference) - 1) * 100;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '–';
  const sign = value > 0 ? '+' : '';
  return `${sign}${number1.format(value)} %`;
}

function readOptionalNumber(id) {
  const raw = String($(id).value ?? '').trim().replace(',', '.');
  if (raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function compareBuildingGeometry() {
  const feature = selectedBuildingFeature();
  if (!feature) return;

  const attrs = feature.attributes ?? {};
  const roofArea = finiteNumber(attrs.Shape__Area);
  const roofPerimeter = finiteNumber(attrs.Shape__Length);
  const medianHeight = finiteNumber(attrs.GEB_HOEHE_MEDIAN);

  const knownFootprint = readOptionalNumber('knownFootprint');
  const knownPerimeter = readOptionalNumber('knownPerimeter');
  const knownHeight = readOptionalNumber('knownHeight');
  const knownWallArea = readOptionalNumber('knownWallArea');

  const wallTest = roofPerimeter !== null && medianHeight !== null
    ? roofPerimeter * medianHeight
    : null;


  const results = [
    {
      label: 'Dachprojektion vs. EG-/Grundfläche',
      value: roofArea !== null && knownFootprint !== null
        ? formatPercent(percentDifference(roofArea, knownFootprint))
        : '–',
      note: roofArea !== null && knownFootprint !== null
        ? `${formatArea(roofArea)} gegenüber ${formatArea(knownFootprint, 0)}`
        : 'Vergleichswert fehlt',
    },
    {
      label: 'Dachumfang vs. Fassadenumfang',
      value: roofPerimeter !== null && knownPerimeter !== null
        ? formatPercent(percentDifference(roofPerimeter, knownPerimeter))
        : '–',
      note: roofPerimeter !== null && knownPerimeter !== null
        ? `${formatLength(roofPerimeter)} gegenüber ${formatLength(knownPerimeter, 0)}`
        : 'Vergleichswert fehlt',
    },
    {
      label: 'Medianhöhe vs. bekannte Höhe',
      value: medianHeight !== null && knownHeight !== null
        ? formatPercent(percentDifference(medianHeight, knownHeight))
        : '–',
      note: medianHeight !== null && knownHeight !== null
        ? `${formatLength(medianHeight)} gegenüber ${formatLength(knownHeight, 1)}`
        : 'Vergleichswert fehlt',
    },
    {
      label: 'Test-Außenwand vs. bekannte Außenwand',
      value: wallTest !== null && knownWallArea !== null
        ? formatPercent(percentDifference(wallTest, knownWallArea))
        : '–',
      note: wallTest !== null && knownWallArea !== null
        ? `${formatArea(wallTest)} gegenüber ${formatArea(knownWallArea, 0)}`
        : 'Vergleichswert fehlt',
    },
  ];

  $('buildingComparisonResult').innerHTML = `
    <div class="comparison-grid">
      ${results.map((item) => `
        <div class="comparison-item">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
          <small>${escapeHtml(item.note)}</small>
        </div>
      `).join('')}
    </div>
  `;
  $('buildingComparisonResult').hidden = false;
}

function clearValidation() {
  ['knownFootprint', 'knownPerimeter', 'knownHeight', 'knownWallArea']
    .forEach((id) => { $(id).value = ''; });
  $('buildingComparisonResult').hidden = true;
  $('buildingComparisonResult').innerHTML = '';
}

function continueWithoutBuildingGeometry() {
  selectedBuildingId = null;
  selectedBuildingSelectionMode = null;
  if ($('solarObserverMode')) $('solarObserverMode').value = 'auto';
  document.querySelectorAll('.candidate-button').forEach((button) => {
    button.classList.remove('is-selected');
  });
  document.querySelectorAll('.building-shape').forEach((shape) => {
    shape.classList.remove('is-selected');
  });
  $('selectedBuildingPanel').hidden = true;
  $('noBuildingNote').hidden = false;
  setStatus($('buildingStatus'), 'keine Geometrie', 'muted');
  $('buildingMatchInfo').textContent = 'Bewusst ohne Gebäudepolygon fortfahren. Die übrigen Standortmodule bleiben verfügbar.';
  resetSolarOutput();
  if (selectedAddress) setStatus($('solarStatus'), 'bereit');
  window.dispatchEvent(new CustomEvent('standortpass:building-cleared'));
}


function editSelectedBuilding() {
  if (!selectedAddress) return;
  const radiusSelect = $('buildingRadius');
  if (Number(radiusSelect.value) < 30) radiusSelect.value = '30';
  loadBuildingArea().then(() => {
    $('buildingResults').classList.add('is-editing');
    $('buildingResults').classList.remove('has-selection');
    $('buildingResults').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

/* ---------------------------------------------------------
   4. Bestehendes TIRIS-DGM-Modul
--------------------------------------------------------- */

async function loadTerrain() {
  if (!selectedAddress) return;

  const status = $('terrainStatus');
  setStatus(status, 'lädt …', 'working');
  resetTerrainOutput(false);

  try {
    if (!window.LocationCore?.fetchElevation) {
      throw new Error('Gemeinsamer Standortservice wurde nicht geladen.');
    }

    const result = await window.LocationCore.fetchElevation(
      selectedAddress.latitude,
      selectedAddress.longitude
    );

    $('rawTerrain').textContent = pretty(result);
    $('terrainHeight').textContent = `${number1.format(result.elevation_m)} m ü. A.`;
    $('terrainMeta').textContent =
      `${result.source} · Layer ${result.layer_name ?? result.layer_id ?? '–'}`;
    $('terrainResult').hidden = false;
    setStatus(status, 'erfolgreich', 'success');
  } catch (error) {
    $('rawTerrain').textContent = pretty({ error: error.message });
    $('terrainHeight').textContent = '–';
    $('terrainMeta').textContent = error.message;
    $('terrainResult').hidden = false;
    setStatus(status, 'Fehler', 'error');
  }
}

function resetTerrainOutput(clearRaw = true) {
  $('terrainResult').hidden = true;
  if (clearRaw) $('rawTerrain').textContent = '–';
}

/* ---------------------------------------------------------
   5. GeoLand / voibos Sonnenstand + eigenes SVG
--------------------------------------------------------- */

function selectedBuildingFeature() {
  return buildingFeatures.find(
    (feature) => String(feature.attributes?.OBJECTID) === String(selectedBuildingId)
  ) ?? null;
}

function solarObserverHeight() {
  if ($('solarObserverMode')?.value === 'ground') {
    return { height: 2, source: '2 m über Gelände' };
  }

  const feature = selectedBuildingFeature();
  const medianHeight = finiteNumber(feature?.attributes?.GEB_HOEHE_MEDIAN);
  if (medianHeight !== null && medianHeight >= 2.5 && medianHeight <= 60) {
    return {
      height: medianHeight,
      source: `Dachniveau orientierend · TIRIS-Medianhöhe ${number1.format(medianHeight)} m`,
    };
  }

  return { height: 2, source: 'kein Gebäude/Höhenwert · 2 m über Gelände' };
}

function buildGeoLandSunUrl(address, observerHeight) {
  const params = new URLSearchParams({
    name: 'sonnengang',
    Koordinate: `${address.longitude},${address.latitude}`,
    CRS: '4326',
    Datum: '03-20-12:00',
    H: String(observerHeight),
    Output: 'JSONDownload',
  });

  return `${GEOLAND_SUN_URL}?${params.toString()}`;
}

function formatSunHours(value) {
  if (value === null || value === undefined || value === '') return '–';
  return String(value);
}

function numericSolarValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function svgEl(name, attributes = {}, text = null) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  if (text !== null) element.textContent = String(text);
  return element;
}

function appendSvgPath(svg, d, className) {
  if (!d) return;
  svg.appendChild(svgEl('path', { d, class: className }));
}

function linePathFromHorizon(horizon, valueKey, project, minimum = 0) {
  const parts = [];
  let drawing = false;

  horizon.forEach((entry) => {
    const azimuth = numericSolarValue(entry?.azimuth);
    const value = numericSolarValue(entry?.[valueKey]);
    if (azimuth === null || value === null || value < minimum) {
      drawing = false;
      return;
    }

    const [x, y] = project(azimuth, value);
    parts.push(`${drawing ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    drawing = true;
  });

  return parts.join(' ');
}

function areaUnderHorizonPath(horizon, valueKey, project) {
  const valid = horizon
    .map((entry) => ({
      azimuth: numericSolarValue(entry?.azimuth),
      value: numericSolarValue(entry?.[valueKey]),
    }))
    .filter((item) => item.azimuth !== null && item.value !== null);

  if (valid.length < 2) return '';
  const first = valid[0];
  const last = valid[valid.length - 1];
  const [x0, y0] = project(first.azimuth, 0);
  const [x1, y1] = project(last.azimuth, 0);
  const top = valid.map((item, index) => {
    const [x, y] = project(item.azimuth, Math.max(0, item.value));
    return `${index === 0 ? 'L' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');

  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} ${top} L ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

function areaBetweenHorizonsPath(horizon, lowerKey, upperKey, project) {
  const valid = horizon
    .map((entry) => {
      const azimuth = numericSolarValue(entry?.azimuth);
      const lower = numericSolarValue(entry?.[lowerKey]);
      const upper = numericSolarValue(entry?.[upperKey]);
      if (azimuth === null || lower === null || upper === null) return null;
      return { azimuth, lower: Math.max(0, lower), upper: Math.max(0, upper) };
    })
    .filter(Boolean);

  if (valid.length < 2) return '';

  const upper = valid.map((item, index) => {
    const [x, y] = project(item.azimuth, Math.max(item.lower, item.upper));
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');

  const lower = [...valid].reverse().map((item) => {
    const [x, y] = project(item.azimuth, item.lower);
    return `L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');

  return `${upper} ${lower} Z`;
}

function visualSolarHorizon(horizon) {
  let clampedCount = 0;
  const visual = horizon.map((entry) => {
    const dtm = numericSolarValue(entry?.hoehenwinkelDTM);
    const dsm = numericSolarValue(entry?.hoehenwinkelDSM);
    if (dtm === null || dsm === null || dsm >= dtm) return { ...entry, hoehenwinkelDSM_plot: dsm };
    clampedCount += 1;
    return { ...entry, hoehenwinkelDSM_plot: dtm };
  });
  return { visual, clampedCount };
}

function drawSolarChart(payload, observerInfo) {
  const svg = $('solarChart');
  const horizon = Array.isArray(payload?.horizont)
    ? [...payload.horizont].sort((a, b) => Number(a.azimuth) - Number(b.azimuth))
    : [];
  const { visual: visualHorizon, clampedCount } = visualSolarHorizon(horizon);

  svg.innerHTML = '';
  if (horizon.length === 0) {
    svg.appendChild(svgEl('text', {
      x: 410,
      y: 215,
      'text-anchor': 'middle',
      class: 'solar-chart-empty',
    }, 'Keine Horizontdaten verfügbar'));
    return;
  }

  const width = 820;
  const height = 430;
  const margin = { left: 52, right: 18, top: 20, bottom: 48 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const valueKeys = [
    'hoehenwinkelDTM',
    'hoehenwinkelDSM_plot',
    'hoehenwinkelSommersonnwende',
    'hoehenwinkelAbfragedatum',
    'hoehenwinkelWintersonnwende',
  ];
  const values = [];
  visualHorizon.forEach((entry) => {
    valueKeys.forEach((key) => {
      const value = numericSolarValue(entry?.[key]);
      if (value !== null && value >= 0) values.push(value);
    });
  });

  const maxValue = values.length ? Math.max(...values) : 60;
  const yMax = Math.min(90, Math.max(60, Math.ceil((maxValue + 3) / 10) * 10));

  const project = (azimuth, elevation) => {
    const x = margin.left + (azimuth / 360) * plotWidth;
    const y = margin.top + plotHeight - (Math.max(0, Math.min(yMax, elevation)) / yMax) * plotHeight;
    return [x, y];
  };

  const grid = svgEl('g', { class: 'solar-grid' });
  for (let elevation = 0; elevation <= yMax; elevation += 10) {
    const [x0, y] = project(0, elevation);
    const [x1] = project(360, elevation);
    grid.appendChild(svgEl('line', { x1: x0, y1: y, x2: x1, y2: y }));
    grid.appendChild(svgEl('text', {
      x: margin.left - 10,
      y: y + 4,
      'text-anchor': 'end',
    }, `${elevation}°`));
  }

  const directions = [
    [0, 'N'], [45, 'NO'], [90, 'O'], [135, 'SO'], [180, 'S'],
    [225, 'SW'], [270, 'W'], [315, 'NW'], [360, 'N'],
  ];
  directions.forEach(([azimuth, label]) => {
    const [x, y0] = project(azimuth, 0);
    const [, yTop] = project(azimuth, yMax);
    grid.appendChild(svgEl('line', { x1: x, y1: yTop, x2: x, y2: y0, class: 'solar-grid-vertical' }));
    grid.appendChild(svgEl('text', {
      x,
      y: height - 18,
      'text-anchor': 'middle',
      class: 'solar-direction-label',
    }, label));
  });
  svg.appendChild(grid);

  appendSvgPath(svg, areaUnderHorizonPath(visualHorizon, 'hoehenwinkelDTM', project), 'solar-area solar-area--dtm');
  appendSvgPath(svg, areaBetweenHorizonsPath(visualHorizon, 'hoehenwinkelDTM', 'hoehenwinkelDSM_plot', project), 'solar-area solar-area--dsm');
  appendSvgPath(svg, linePathFromHorizon(visualHorizon, 'hoehenwinkelDTM', project), 'solar-horizon-line solar-horizon-line--dtm');
  appendSvgPath(svg, linePathFromHorizon(visualHorizon, 'hoehenwinkelDSM_plot', project), 'solar-horizon-line solar-horizon-line--dsm');

  appendSvgPath(svg, linePathFromHorizon(horizon, 'hoehenwinkelSommersonnwende', project, 0), 'solar-sun-path solar-sun-path--summer');
  appendSvgPath(svg, linePathFromHorizon(horizon, 'hoehenwinkelAbfragedatum', project, 0), 'solar-sun-path solar-sun-path--equinox-outline');
  appendSvgPath(svg, linePathFromHorizon(horizon, 'hoehenwinkelAbfragedatum', project, 0), 'solar-sun-path solar-sun-path--equinox');
  appendSvgPath(svg, linePathFromHorizon(horizon, 'hoehenwinkelWintersonnwende', project, 0), 'solar-sun-path solar-sun-path--winter');

  const axis = svgEl('g', { class: 'solar-axis' });
  const [xLeft, yBase] = project(0, 0);
  const [xRight] = project(360, 0);
  axis.appendChild(svgEl('line', { x1: xLeft, y1: yBase, x2: xRight, y2: yBase }));
  svg.appendChild(axis);

  $('solarChartHeight').textContent = observerInfo.source;
  $('solarChartNote').textContent =
    `${payload?.datengrundlage ?? 'GeoLand'} · Befliegungsjahr ${payload?.flugjahr ?? '–'} · ` +
    `Grau zeigt den Geländehorizont; Türkis nur die zusätzliche Verschattung durch Oberflächenobjekte. ` +
    `Frühling/Herbst basiert auf dem GeoLand-Abfragedatum 20. März.` +
    (clampedCount ? ` ${clampedCount} minimale numerische Abweichung(en) wurden ausschließlich für die Grafik bereinigt.` : '');
  $('solarChartCard').hidden = false;
}

async function loadSolar() {
  if (!selectedAddress) return;

  const status = $('solarStatus');
  const resultBox = $('solarResult');
  setStatus(status, 'lädt …', 'working');
  resetSolarOutput(false);

  const observerInfo = solarObserverHeight();
  const url = buildGeoLandSunUrl(selectedAddress, observerInfo.height);

  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }

    const contentType = response.headers.get('content-type') ?? '';
    const text = await response.text();
    let payload;

    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`Antwort ist kein JSON (${contentType || 'Content-Type unbekannt'}).`);
    }

    const horizon = Array.isArray(payload?.horizont) ? payload.horizont : [];
    const monthly = payload?.['sonnenstunden pro tag im monatsmittel'] ?? {};
    const sample = horizon.filter((entry) => [0, 90, 180, 270].includes(Number(entry?.azimuth)));

    $('rawSolar').textContent = pretty({
      request_url: url,
      observer: observerInfo,
      equinox_reference: '03-20-12:00',
      response: payload,
    });

    drawSolarChart(payload, observerInfo);

    const monthRows = [
      ['Jänner', monthly.januar],
      ['März', monthly.maerz],
      ['Juni', monthly.juni],
      ['September', monthly.september],
      ['Dezember', monthly.dezember],
    ].map(([label, value]) => `<div><span>${label}</span><strong>${escapeHtml(formatSunHours(value))}</strong></div>`).join('');

    const sampleRows = sample.map((entry) => `
      <tr>
        <td>${escapeHtml(entry.azimuth)}°</td>
        <td>${escapeHtml(entry.hoehenwinkelDTM ?? '–')}°</td>
        <td>${escapeHtml(entry.hoehenwinkelDSM ?? '–')}°</td>
        <td>${escapeHtml(entry.entfernungDTM ?? '–')} m</td>
        <td>${escapeHtml(entry.entfernungDSM ?? '–')} m</td>
      </tr>
    `).join('');

    resultBox.innerHTML = `
      <div class="solar-summary-grid">
        <div><span>Status</span><strong>${escapeHtml(payload?.abfragestatus ?? '–')}</strong></div>
        <div><span>Bezugshöhe</span><strong>${number1.format(observerInfo.height)} m</strong></div>
        <div><span>Abfragehöhe</span><strong>${escapeHtml(payload?.abfragehoehe ?? '–')}</strong></div>
        <div><span>Datengrundlage</span><strong>${escapeHtml(payload?.datengrundlage ?? '–')}</strong></div>
        <div><span>Befliegungsjahr</span><strong>${escapeHtml(payload?.flugjahr ?? '–')}</strong></div>
        <div><span>Horizontwerte</span><strong>${number0.format(horizon.length)}</strong></div>
      </div>
      <h3>Theoretische Sonnenscheindauer · Auswahl</h3>
      <div class="solar-month-grid">${monthRows}</div>
      <details class="solar-test-details">
        <summary>Technische Horizont-Stichprobe</summary>
        <div class="table-scroll">
          <table class="test-table">
            <thead><tr><th>Azimut</th><th>Gelände DTM/DGM</th><th>Oberfläche DSM/DOM</th><th>Distanz Gelände</th><th>Distanz Oberfläche</th></tr></thead>
            <tbody>${sampleRows || '<tr><td colspan="5">Keine Horizontwerte gefunden.</td></tr>'}</tbody>
          </table>
        </div>
        <p class="geometry-note">Serviceversion: ${escapeHtml(payload?.voibos ?? '–')}</p>
      </details>
    `;
    resultBox.hidden = false;
    setStatus(status, payload?.abfragestatus === 'erfolgreich' ? 'erfolgreich' : 'Antwort erhalten', 'success');
  } catch (error) {
    $('rawSolar').textContent = pretty({ request_url: url, error: error.message });
    $('solarChartCard').hidden = true;
    resultBox.innerHTML = `
      <h3>Direkter Browserabruf fehlgeschlagen</h3>
      <p>${escapeHtml(error.message)}</p>
      <p class="geometry-note">Die übrigen Standortmodule bleiben davon unabhängig nutzbar.</p>
    `;
    resultBox.hidden = false;
    setStatus(status, 'Fehler', 'error');
  }
}

function resetSolarOutput(clearRaw = true) {
  $('solarResult').hidden = true;
  $('solarResult').innerHTML = '';
  $('solarChartCard').hidden = true;
  $('solarChart').innerHTML = '';
  if (clearRaw) $('rawSolar').textContent = '–';
}

/* ---------------------------------------------------------
   6. Wärmeversorgung – öffentliche TIRIS-Dienste entdecken
--------------------------------------------------------- */

function normalizedDiscoveryText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('de-AT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll('ß', 'ss');
}

function matchesHeatKeyword(value) {
  const text = normalizedDiscoveryText(value);
  return HEAT_KEYWORDS.some((keyword) => text.includes(normalizedDiscoveryText(keyword)));
}

function candidateLayersFromService(payload) {
  return (Array.isArray(payload?.layers) ? payload.layers : [])
    .filter((layer) => matchesHeatKeyword(layer?.name))
    .map((layer) => ({
      id: layer.id,
      name: layer.name,
      type: layer.type ?? null,
      parentLayerId: layer.parentLayerId ?? null,
      subLayerIds: layer.subLayerIds ?? null,
      geometryType: layer.geometryType ?? null,
    }));
}

function encodeArcgisServiceName(name) {
  return String(name ?? '')
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function arcgisServiceUrl(service) {
  return `${TIRIS_ARCGIS_ROOT_URL}/${encodeArcgisServiceName(service.name)}/${service.type}`;
}

async function mapConcurrent(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runner() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = { error: error.message };
      }
    }
  }

  const count = Math.min(Math.max(1, limit), Math.max(1, items.length));
  await Promise.all(Array.from({ length: count }, () => runner()));
  return results;
}

function uniqueArcgisServices(services) {
  const map = new Map();
  (services || []).forEach((service) => {
    if (!service?.name || !ENERGY_SCAN_SERVICE_TYPES.has(service?.type)) return;
    const key = `${service.name}|${service.type}`;
    if (!map.has(key)) map.set(key, { name: service.name, type: service.type });
  });
  return [...map.values()];
}

function energyServiceIsPriority(service) {
  const text = normalizedDiscoveryText(service?.name);
  return ENERGY_LAYER_TARGETS.some((target) =>
    target.serviceHints.some((hint) => text.includes(normalizedDiscoveryText(hint)))
  );
}

function energyLayerNameScore(target, serviceName, layerName, path = '') {
  const layerText = normalizedDiscoveryText(`${layerName} ${path}`);
  const serviceText = normalizedDiscoveryText(serviceName);
  let score = 0;

  target.namePatterns.forEach((pattern) => {
    const normalized = normalizedDiscoveryText(pattern);
    if (layerText === normalized) score = Math.max(score, 120);
    else if (layerText.includes(normalized)) score = Math.max(score, 90);
  });

  if (target.id === 'heat_areas' && layerText.includes('warmenetz') && layerText.includes('gebiet')) score = Math.max(score, 80);
  if (target.id === 'heat_areas' && layerText.includes('versorgungsgebiet') && target.serviceHints.some((hint) => serviceText.includes(normalizedDiscoveryText(hint)))) score = Math.max(score, 45);
  if (target.id === 'heat_plants' && layerText.includes('warmeerzeug') && layerText.includes('anlage')) score = Math.max(score, 80);
  if (target.id === 'solar_building' && layerText.includes('solar') && layerText.includes('jahr') && layerText.includes('gebaude')) score = Math.max(score, 80);
  if (target.id === 'solar_building' && (layerText.includes('solarstatistik') || (layerText.includes('solar') && layerText.includes('eignung')))) score = Math.max(score, 55);

  target.serviceHints.forEach((hint) => {
    if (serviceText.includes(normalizedDiscoveryText(hint))) score += 2;
  });
  return score;
}

function layerFieldFingerprint(target, layerMetadata) {
  const fields = Array.isArray(layerMetadata?.fields) ? layerMetadata.fields : [];
  const searchable = fields.map((field) => ({
    name: field.name,
    alias: field.alias ?? field.name,
    normalized: normalizedDiscoveryText(`${field.alias ?? ''} ${field.name ?? ''}`),
  }));
  const matched = [];

  target.fieldAliases.forEach((clue) => {
    const normalized = normalizedDiscoveryText(clue);
    const match = searchable.find((field) => field.normalized.includes(normalized));
    if (match) matched.push({ clue, name: match.name, alias: match.alias });
  });

  let bonus = matched.length * 6;
  if (target.id === 'heat_areas' && matched.length >= 4) bonus += 35;
  if (target.id === 'solar_building') {
    const hasRoof = searchable.some((field) => field.normalized.includes('dachflache'));
    const thresholdHits = ['700', '900', '1100', '1300', '1500']
      .filter((threshold) => searchable.some((field) => field.normalized.includes(threshold))).length;
    if (hasRoof && thresholdHits >= 4) bonus += 50;
  }
  if (target.id === 'heat_plants' && matched.some((item) => normalizedDiscoveryText(item.alias).includes('energietrager'))) bonus += 25;

  return { matched, bonus, fields };
}

async function collectArcgisServiceDirectory(status) {
  const root = await fetchJson(`${TIRIS_ARCGIS_ROOT_URL}?f=pjson`, 20000);
  const folders = Array.isArray(root?.folders) ? root.folders : [];
  const allServices = [...(Array.isArray(root?.services) ? root.services : [])];
  const folderResults = [];
  let finished = 0;

  const results = await mapConcurrent(folders, ENERGY_SCAN_CONCURRENCY, async (folder) => {
    const folderUrl = `${TIRIS_ARCGIS_ROOT_URL}/${encodeURIComponent(folder)}?f=pjson`;
    try {
      const payload = await fetchJson(folderUrl, 18000);
      const services = (Array.isArray(payload?.services) ? payload.services : []).map((service) => ({
        ...service,
        name: String(service?.name ?? '').includes('/') ? service.name : `${folder}/${service.name}`,
      }));
      return {
        folder,
        url: folderUrl,
        services,
      };
    } catch (error) {
      return { folder, url: folderUrl, services: [], error: error.message };
    } finally {
      finished += 1;
      setStatus(status, `Ordner ${finished}/${folders.length}`, 'working');
    }
  });

  results.forEach((entry) => {
    folderResults.push({
      folder: entry?.folder ?? '–',
      service_count: entry?.services?.length ?? 0,
      error: entry?.error ?? null,
    });
    if (Array.isArray(entry?.services)) allServices.push(...entry.services);
  });

  return {
    folders,
    folderResults,
    services: uniqueArcgisServices(allServices),
  };
}

async function scanArcgisServiceForEnergyTargets(service) {
  const url = arcgisServiceUrl(service);
  const payload = await fetchJson(`${url}?f=pjson`, 18000);
  const layers = Array.isArray(payload?.layers) ? payload.layers : [];
  const candidates = [];

  layers.forEach((layer) => {
    const path = buildLayerParentPath(layers, layer);
    ENERGY_LAYER_TARGETS.forEach((target) => {
      const nameScore = energyLayerNameScore(target, service.name, layer?.name, path);
      if (nameScore < 20) return;
      candidates.push({
        target_id: target.id,
        target_label: target.label,
        service_name: service.name,
        service_type: service.type,
        service_url: url,
        layer_id: layer.id,
        layer_name: layer.name,
        layer_path: path,
        layer_type: layer.type ?? null,
        geometry_type: layer.geometryType ?? null,
        name_score: nameScore,
      });
    });
  });

  return candidates;
}

async function enrichEnergyCandidate(candidate) {
  const target = ENERGY_LAYER_TARGETS.find((item) => item.id === candidate.target_id);
  const layerUrl = `${candidate.service_url}/${candidate.layer_id}`;
  try {
    const metadata = await fetchJson(`${layerUrl}?f=pjson`, 15000);
    const fingerprint = layerFieldFingerprint(target, metadata);
    return {
      ...candidate,
      layer_url: layerUrl,
      metadata,
      matched_fields: fingerprint.matched,
      field_bonus: fingerprint.bonus,
      total_score: candidate.name_score + fingerprint.bonus + (metadata?.type === 'Feature Layer' ? 8 : 0),
    };
  } catch (error) {
    return {
      ...candidate,
      layer_url: layerUrl,
      matched_fields: [],
      field_bonus: 0,
      total_score: candidate.name_score,
      metadata_error: error.message,
    };
  }
}

function buildPointRadiusLayerQueryUrl(layerUrl, radiusM = 20000) {
  const point = {
    x: selectedAddress.longitude,
    y: selectedAddress.latitude,
    spatialReference: { wkid: 4326 },
  };
  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    geometry: JSON.stringify(point),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    returnZ: 'false',
    returnM: 'false',
    resultRecordCount: '200',
    distance: String(radiusM),
    units: 'esriSRUnit_Meter',
  });
  return `${layerUrl}/query?${params.toString()}`;
}

function attributeFromFieldAlias(candidate, attributes, aliasNeedles) {
  const fields = Array.isArray(candidate?.metadata?.fields) ? candidate.metadata.fields : [];
  for (const needle of aliasNeedles) {
    const normalizedNeedle = normalizedDiscoveryText(needle);
    const field = fields.find((item) =>
      normalizedDiscoveryText(`${item.alias ?? ''} ${item.name ?? ''}`).includes(normalizedNeedle)
    );
    if (field && attributes?.[field.name] !== undefined && attributes?.[field.name] !== null && attributes?.[field.name] !== '') {
      return { value: attributes[field.name], field };
    }
  }
  return null;
}

function formatEnergyRawValue(value, field = null) {
  if (value === null || value === undefined || value === '') return '–';
  if (field?.type === 'esriFieldTypeDate') return formatArcgisDate(value) ?? String(value);
  return String(value);
}

function solarBuildingBins(candidate, attributes) {
  const fields = Array.isArray(candidate?.metadata?.fields) ? candidate.metadata.fields : [];
  return fields
    .filter((field) => {
      const text = normalizedDiscoveryText(`${field.alias ?? ''} ${field.name ?? ''}`);
      return text.includes('dachflache') && /700|900|1100|1300|1500/.test(text);
    })
    .map((field) => ({
      field: field.name,
      label: field.alias ?? field.name,
      value: finiteNumber(attributes?.[field.name]),
    }))
    .filter((item) => item.value !== null);
}

async function queryEnergyCandidateAtLocation(candidate) {
  if (!selectedAddress || candidate?.metadata?.type !== 'Feature Layer') return null;
  let queryUrl;
  if (candidate.target_id === 'heat_plants') {
    queryUrl = buildPointRadiusLayerQueryUrl(candidate.layer_url, 20000);
  } else {
    const reference = hazardReferenceGeometry();
    queryUrl = buildHazardSpatialQueryUrl(candidate.layer_url, reference, {
      returnGeometry: candidate.target_id === 'heat_plants',
      resultRecordCount: 100,
    });
  }

  try {
    const response = await fetchJson(queryUrl, 18000);
    const features = Array.isArray(response?.features) ? response.features : [];
    const result = {
      query_url: queryUrl,
      count: features.length,
      first_attributes: features[0]?.attributes ?? null,
      response_fields: response?.fields ?? null,
    };
    if (candidate.target_id === 'heat_plants') {
      const nearby = features.map((feature) => ({
        distance_m: pointFeatureDistanceM(selectedAddress, feature),
        attributes: feature.attributes ?? {},
      })).sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity));
      result.nearby = nearby.slice(0, 5);
    }
    return result;
  } catch (error) {
    return { query_url: queryUrl, count: 0, error: error.message };
  }
}

function energyCandidateConfidence(candidate) {
  if ((candidate?.total_score ?? 0) >= 150) return 'sehr hoch';
  if ((candidate?.total_score ?? 0) >= 100) return 'hoch';
  if ((candidate?.total_score ?? 0) >= 65) return 'mittel';
  return 'Hinweis';
}

function energyLocationDetailsHtml(candidate) {
  const query = candidate?.location_query;
  if (!query) return '<small>Noch keine Standortabfrage möglich.</small>';
  if (query.error) return `<small>Layer gefunden, Standortabfrage fehlgeschlagen: ${escapeHtml(query.error)}</small>`;
  if (!query.count) return '<small>Layer gefunden · kein Treffer bei der Standortabfrage.</small>';

  const attrs = query.first_attributes ?? {};
  if (candidate.target_id === 'heat_areas') {
    const type = attributeFromFieldAlias(candidate, attrs, ['typ']);
    const area = attributeFromFieldAlias(candidate, attrs, ['versorgungsgebiet']);
    const stand = attributeFromFieldAlias(candidate, attrs, ['stand']);
    const scale = attributeFromFieldAlias(candidate, attrs, ['erfassungsmaßstab', 'erfassungsmasstab']);
    const contact = attributeFromFieldAlias(candidate, attrs, ['kontakt']);
    const contactUrl = safeExternalUrl(contact?.value);
    return `<small>${escapeHtml(area ? formatEnergyRawValue(area.value, area.field) : `${query.count} Flächentreffer`)}</small>
      <small>${escapeHtml(type ? formatEnergyRawValue(type.value, type.field) : 'Wärmenetz-Gebiet')} · Stand ${escapeHtml(stand ? formatEnergyRawValue(stand.value, stand.field) : '–')} · Maßstab ${escapeHtml(scale ? formatEnergyRawValue(scale.value, scale.field) : '–')}</small>
      ${contactUrl ? `<a class="external-action-link" href="${escapeHtml(contactUrl)}" target="_blank" rel="noopener noreferrer">Kontakt öffnen ↗</a>` : ''}`;
  }

  if (candidate.target_id === 'solar_building') {
    const bins = solarBuildingBins(candidate, attrs);
    const total = bins.reduce((sum, item) => sum + item.value, 0);
    const stand = attributeFromFieldAlias(candidate, attrs, ['stand']);
    const scale = attributeFromFieldAlias(candidate, attrs, ['erfassungsmaßstab', 'erfassungsmasstab']);
    const rows = bins.length
      ? `<ul>${bins.map((item) => `<li>${escapeHtml(item.label)}: <strong>${number0.format(item.value)} m²</strong></li>`).join('')}</ul>`
      : '';
    return `<small>${number0.format(query.count)} Gebäudetreffer · klassifizierte Dachfläche ${bins.length ? `${number0.format(total)} m²` : 'siehe Attribute'}</small>
      <small>Stand ${escapeHtml(stand ? formatEnergyRawValue(stand.value, stand.field) : '–')} · Maßstab ${escapeHtml(scale ? formatEnergyRawValue(scale.value, scale.field) : '–')}</small>${rows}`;
  }

  const first = query.nearby?.[0];
  if (candidate.target_id === 'heat_plants' && first) {
    const name = attributeFromFieldAlias(candidate, first.attributes, ['name', 'anlage', 'bezeichnung']);
    const carrier = attributeFromFieldAlias(candidate, first.attributes, ['energieträger', 'energietraeger']);
    const operator = attributeFromFieldAlias(candidate, first.attributes, ['betreiber']);
    const distance = Number.isFinite(first.distance_m) ? `${number0.format(first.distance_m)} m` : 'Entfernung unbekannt';
    return `<small>${number0.format(query.count)} Treffer im 20-km-Testumkreis · nächster ca. ${escapeHtml(distance)}</small>
      <small>${escapeHtml(name ? formatEnergyRawValue(name.value, name.field) : 'Wärmeerzeugungsanlage')} ${operator ? `· ${escapeHtml(formatEnergyRawValue(operator.value, operator.field))}` : ''} ${carrier ? `· ${escapeHtml(formatEnergyRawValue(carrier.value, carrier.field))}` : ''}</small>`;
  }

  return `<small>${number0.format(query.count)} Standorttreffer · Attribute siehe Rohdaten.</small>`;
}

function renderEnergyCandidate(candidate) {
  const fields = candidate.matched_fields?.length
    ? candidate.matched_fields.map((field) => escapeHtml(field.alias)).join(' · ')
    : 'keine Fingerabdruck-Felder bestätigt';
  const serviceLink = `<a class="external-action-link" href="${escapeHtml(`${candidate.layer_url}?f=pjson`)}" target="_blank" rel="noopener noreferrer">REST-Layer öffnen ↗</a>`;
  return `<article class="discovery-card">
    <span class="mini-label">Trefferwahrscheinlichkeit ${escapeHtml(energyCandidateConfidence(candidate))}</span>
    <h3>${escapeHtml(candidate.layer_name)}</h3>
    <p><strong>${escapeHtml(candidate.service_name)}</strong> · Layer ${escapeHtml(candidate.layer_id)} · ${escapeHtml(candidate.metadata?.type ?? candidate.layer_type ?? 'Layer')}</p>
    <p class="geometry-note">${escapeHtml(candidate.layer_path)}</p>
    <small>Bestätigte Feld-Aliase: ${fields}</small>
    <div class="energy-location-detail">${energyLocationDetailsHtml(candidate)}</div>
    ${serviceLink}
  </article>`;
}


function buildWebOfficeSynserviceUrl(params = {}) {
  const url = new URL(`${TIRIS_WEBOFFICE_BASE_URL}/synservice`);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function summarizeWebOfficePayload(payload) {
  if (!payload || typeof payload !== 'object') return { kind: typeof payload, value: payload };
  return {
    keys: Object.keys(payload),
    meta: payload.METAINFO ?? null,
    project: payload.PROJECTINFO ?? null,
    return: payload.RETURN ?? payload.return ?? null,
    features: payload.FEATURES ?? null,
    error: payload.ERROR ?? payload.error ?? null,
    message: payload.message ?? payload.MESSAGE ?? null,
    response_id: payload.response_id ?? null,
  };
}

async function probeWebOfficeUrl(url) {
  const started = performance.now();
  try {
    const payload = await fetchJson(url, 15000);
    return {
      ok: true,
      duration_ms: Math.round(performance.now() - started),
      url,
      summary: summarizeWebOfficePayload(payload),
      payload,
    };
  } catch (error) {
    return {
      ok: false,
      duration_ms: Math.round(performance.now() - started),
      url,
      error: error.message,
    };
  }
}

function webOfficeProbeCard(target, attempts) {
  const success = attempts.find((attempt) => attempt.ok && (
    attempt.summary?.return ||
    (attempt.summary?.features && Object.keys(attempt.summary.features).length) ||
    (attempt.summary?.keys || []).some((key) => /result|feature|return/i.test(key))
  ));
  const reachable = attempts.some((attempt) => attempt.ok);
  const state = success ? 'öffentliche Abfrage wahrscheinlich möglich' : reachable ? 'synservice antwortet, Query-ID noch nicht bestätigt' : 'Browserabruf fehlgeschlagen / CORS oder Dienstzugriff';
  const stateClass = success ? 'environment-card--notice' : '';
  const attemptRows = attempts.map((attempt) => {
    const query = new URL(attempt.url).searchParams.get('query') || '–';
    const note = attempt.ok
      ? `Antwort: ${(attempt.summary?.keys || []).join(', ') || 'JSON'}${attempt.summary?.error ? ` · Fehlerobjekt: ${JSON.stringify(attempt.summary.error)}` : ''}`
      : `Fehler: ${attempt.error}`;
    return `<li><strong>query=${escapeHtml(query)}</strong><small>${escapeHtml(note)}</small><a class="external-action-link" href="${escapeHtml(attempt.url)}" target="_blank" rel="noopener noreferrer">direkt im Browser öffnen ↗</a></li>`;
  }).join('');
  return `
    <article class="environment-card ${stateClass}">
      <span>${escapeHtml(target.label)}</span>
      <strong>${escapeHtml(state)}</strong>
      <small>TOC ${escapeHtml(target.toc_id)} · interne Query ${escapeHtml(target.internal_query_id)} · ${escapeHtml(target.datacontainer)}</small>
      <details class="environment-source-details"><summary>Getestete Query-Kandidaten</summary><ul>${attemptRows}</ul></details>
    </article>`;
}

async function discoverEnergyLayersDeep() {
  const status = $('heatDiscoveryStatus');
  const box = $('heatDiscoveryResult');
  const raw = $('rawHeatDiscovery');
  setStatus(status, 'prüft synservice …', 'loading');
  box.hidden = true;
  box.innerHTML = '';

  const report = {
    tested_at: new Date().toISOString(),
    endpoint: `${TIRIS_WEBOFFICE_BASE_URL}/synservice`,
    project: TIRIS_WEBOFFICE_PROJECT,
    note: 'Keine Session-ID/Cookies. Interne IDs werden nur als Kandidaten für dokumentierte synservice-Abfragen geprüft.',
    base: null,
    projectinfo: null,
    targets: [],
  };

  const baseUrl = buildWebOfficeSynserviceUrl({ metainfo: 'true' });
  const projectUrl = buildWebOfficeSynserviceUrl({ project: TIRIS_WEBOFFICE_PROJECT, projectinfo: 'true', width: 320, height: 200 });
  report.base = await probeWebOfficeUrl(baseUrl);
  report.projectinfo = await probeWebOfficeUrl(projectUrl);

  for (const target of WEBOFFICE_ENERGY_TARGETS) {
    const attempts = [];
    for (const candidate of target.query_candidates) {
      const url = buildWebOfficeSynserviceUrl({
        project: TIRIS_WEBOFFICE_PROJECT,
        query: candidate,
        keyname: target.sample.keyname,
        keyvalue: target.sample.keyvalue,
        returnkey: target.returnkeys.join(';'),
        width: 320,
        height: 200,
      });
      attempts.push(await probeWebOfficeUrl(url));
    }
    report.targets.push({ target, attempts });
  }

  const baseOk = report.base.ok;
  const projectOk = report.projectinfo.ok;
  const cards = report.targets.map(({ target, attempts }) => webOfficeProbeCard(target, attempts)).join('');

  box.innerHTML = `
    <div class="environment-heading-row">
      <div>
        <h3>WebOffice Service API · sessionfreier Test</h3>
        <p>${baseOk ? 'synservice ist aus dem Browser erreichbar.' : 'Der direkte Browserabruf von synservice ist fehlgeschlagen.'} ${projectOk ? 'Das Projekt tmap_master antwortet ebenfalls.' : 'projectinfo konnte nicht bestätigt werden.'}</p>
      </div>
      <a class="external-action-link" href="${escapeHtml(projectUrl)}" target="_blank" rel="noopener noreferrer">projectinfo direkt öffnen ↗</a>
    </div>
    <div class="environment-grid">${cards}</div>
    <div class="environment-review-note">
      <strong>Auswertung:</strong>
      <span>Ein Fehler bei einem Kandidaten bedeutet nicht, dass die Daten nicht öffentlich nutzbar sind. Die dokumentierte Service API verlangt für Query-Aufrufe eine konfigurierte External Layer-ID und ein freigegebenes Suchfeld. Genau diese externe Kennung versuchen wir hier zu bestätigen.</span>
    </div>`;
  box.hidden = false;
  raw.textContent = pretty(report);

  const anyCandidateOk = report.targets.some(({ attempts }) => attempts.some((attempt) => attempt.ok));
  setStatus(status, anyCandidateOk ? 'Antworten erhalten' : baseOk ? 'API erreichbar · Query offen' : 'Browserzugriff offen', anyCandidateOk ? 'success' : 'muted');
}

async function discoverEnergyLayersDeepLegacy() {
  const status = $('heatDiscoveryStatus');
  const resultBox = $('heatDiscoveryResult');
  setStatus(status, 'Servicebaum lädt …', 'working');
  resultBox.hidden = true;
  resultBox.innerHTML = '';

  const raw = {
    tested_at: new Date().toISOString(),
    address: selectedAddress ? {
      label: selectedAddress.label,
      latitude: selectedAddress.latitude,
      longitude: selectedAddress.longitude,
    } : null,
    targets: ENERGY_LAYER_TARGETS.map((target) => ({
      id: target.id,
      label: target.label,
      known_field_aliases: target.fieldAliases,
    })),
    directory: null,
    scan: { priority_services: 0, full_scan_used: false, scanned_services: 0, service_errors: [] },
    results: {},
  };

  try {
    const directory = await collectArcgisServiceDirectory(status);
    raw.directory = {
      folders: directory.folders,
      folder_results: directory.folderResults,
      service_count: directory.services.length,
    };

    const priority = directory.services.filter(energyServiceIsPriority);
    const remaining = directory.services.filter((service) => !energyServiceIsPriority(service));
    raw.scan.priority_services = priority.length;
    const candidates = [];
    let scanned = 0;

    const scanBatch = async (services, label) => {
      const rows = await mapConcurrent(services, ENERGY_SCAN_CONCURRENCY, async (service) => {
        try {
          return await scanArcgisServiceForEnergyTargets(service);
        } catch (error) {
          raw.scan.service_errors.push({ service: service.name, type: service.type, error: error.message });
          return [];
        } finally {
          scanned += 1;
          raw.scan.scanned_services = scanned;
          setStatus(status, `${label} ${scanned}/${directory.services.length}`, 'working');
        }
      });
      rows.forEach((row) => { if (Array.isArray(row)) candidates.push(...row); });
    };

    await scanBatch(priority, 'Zielsuche');
    const foundTargetIds = new Set(candidates.filter((item) => item.name_score >= 70).map((item) => item.target_id));
    if (foundTargetIds.size < ENERGY_LAYER_TARGETS.length) {
      raw.scan.full_scan_used = true;
      await scanBatch(remaining, 'Tiefenscan');
    }

    for (const target of ENERGY_LAYER_TARGETS) {
      const targetCandidates = candidates
        .filter((candidate) => candidate.target_id === target.id)
        .sort((a, b) => b.name_score - a.name_score)
        .slice(0, 8);

      const enriched = await mapConcurrent(targetCandidates, 4, enrichEnergyCandidate);
      enriched.sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0));

      // Nur die zwei plausibelsten Kandidaten werden am Standort abgefragt.
      for (const candidate of enriched.slice(0, 2)) {
        candidate.location_query = await queryEnergyCandidateAtLocation(candidate);
      }
      raw.results[target.id] = enriched.map((candidate) => ({
        ...candidate,
        // Vollständige Layer-Metadaten sind im Rohblock nützlich, die Renderer-Struktur aber nicht.
        metadata: candidate.metadata ? {
          currentVersion: candidate.metadata.currentVersion,
          id: candidate.metadata.id,
          name: candidate.metadata.name,
          type: candidate.metadata.type,
          geometryType: candidate.metadata.geometryType,
          displayField: candidate.metadata.displayField,
          capabilities: candidate.metadata.capabilities,
          maxRecordCount: candidate.metadata.maxRecordCount,
          fields: candidate.metadata.fields,
        } : null,
      }));
    }

    $('rawHeatDiscovery').textContent = pretty(raw);

    const sections = ENERGY_LAYER_TARGETS.map((target) => {
      const items = raw.results[target.id] ?? [];
      const good = items.filter((item) => (item.total_score ?? 0) >= 65);
      const content = good.length
        ? good.slice(0, 4).map(renderEnergyCandidate).join('')
        : `<article class="discovery-card"><h3>Noch kein eindeutiger Layer</h3><p>Im öffentlich aufgelisteten ArcGIS-Servicebaum wurde für „${escapeHtml(target.label)}“ kein ausreichend passender Layer bestätigt.</p><small>Dann wäre als nächster Entwicklungsschritt die Netzwerkanalyse von tirisMaps sinnvoll, während genau dieses Thema ein-/ausgeschaltet oder abgefragt wird.</small></article>`;
      return `<div class="energy-target-result"><h3>${escapeHtml(target.label)}</h3><div class="discovery-grid">${content}</div></div>`;
    }).join('');

    resultBox.innerHTML = `
      <h3>Gezielte Suche im TIRIS-ArcGIS-Servicebaum</h3>
      <p>Geprüft wurden ${number0.format(raw.directory.service_count)} öffentlich aufgelistete Map-/FeatureServices. Exakte Themenbezeichnungen und die aus tirisMaps bekannten Feld-Aliase erhöhen die Trefferbewertung.</p>
      ${sections}
      <p class="geometry-note"><strong>Hinweis:</strong> Ein gefundener Layer ist erst dann produktionsreif, wenn Geometrie, Attribute und Standortabfrage plausibel sind. Der Test verändert keine bestehenden Standortdaten.</p>`;
    resultBox.hidden = false;

    const confirmed = ENERGY_LAYER_TARGETS.filter((target) =>
      (raw.results[target.id] ?? []).some((item) => (item.total_score ?? 0) >= 100)
    ).length;
    setStatus(status, `${confirmed}/3 stark`, confirmed ? 'success' : 'muted');
  } catch (error) {
    raw.error = error.message;
    $('rawHeatDiscovery').textContent = pretty(raw);
    resultBox.innerHTML = `<h3>Energie-Layer-Suche fehlgeschlagen</h3><p>${escapeHtml(error.message)}</p><p class="geometry-note">Falls bereits das ArcGIS-Hauptverzeichnis blockiert wird, bleiben die bekannten tirisMaps-Themen nutzbar; für die technische URL wäre dann eine einmalige Netzwerkanalyse in tirisMaps der nächste Weg.</p>`;
    resultBox.hidden = false;
    setStatus(status, 'Fehler', 'error');
  }
}

async function discoverHeatServices() {
  const status = $('heatDiscoveryStatus');
  const resultBox = $('heatDiscoveryResult');
  setStatus(status, 'sucht …', 'working');
  resultBox.hidden = true;
  resultBox.innerHTML = '';

  const raw = {
    tested_at: new Date().toISOString(),
    public_folder: null,
    known_services: [],
  };

  try {
    let folderPayload = null;
    try {
      folderPayload = await fetchJson(`${TIRIS_PUBLIC_FOLDER_URL}?f=pjson`);
      raw.public_folder = folderPayload;
    } catch (error) {
      raw.public_folder = { error: error.message };
    }

    const folderMatches = (Array.isArray(folderPayload?.services) ? folderPayload.services : [])
      .filter((service) => matchesHeatKeyword(service?.name))
      .map((service) => ({ name: service.name, type: service.type }));

    for (const service of TIRIS_HEAT_DISCOVERY_SERVICES) {
      try {
        const payload = await fetchJson(`${service.url}?f=pjson`);
        raw.known_services.push({ label: service.label, url: service.url, response: payload });
      } catch (error) {
        raw.known_services.push({ label: service.label, url: service.url, error: error.message });
      }
    }

    const serviceCards = raw.known_services.map((entry) => {
      if (entry.error) {
        return `<article class="discovery-card"><h3>${escapeHtml(entry.label)}</h3><p class="discovery-error">${escapeHtml(entry.error)}</p></article>`;
      }
      const matches = candidateLayersFromService(entry.response);
      const list = matches.length
        ? `<ul>${matches.map((layer) => `<li><strong>ID ${escapeHtml(layer.id)} · ${escapeHtml(layer.name)}</strong><small>${escapeHtml(layer.type ?? 'Layer')} ${layer.geometryType ? `· ${escapeHtml(layer.geometryType)}` : ''}</small></li>`).join('')}</ul>`
        : '<p>Kein Layername mit Wärme-/Energie-/Versorgungsbezug gefunden.</p>';
      return `<article class="discovery-card"><h3>${escapeHtml(entry.label)}</h3>${list}</article>`;
    }).join('');

    $('rawHeatDiscovery').textContent = pretty(raw);

    resultBox.innerHTML = `
      <h3>Ergebnis der Dienstsuche</h3>
      <p>Dieser Schritt entdeckt nur mögliche öffentliche Datenquellen. Ein Treffer ist noch kein fachlich bestätigter Wärmenetz-Layer.</p>
      <div class="discovery-summary">
        <div><span>Service_Public Treffer</span><strong>${number0.format(folderMatches.length)}</strong></div>
        <div><span>OGD-Dienste geprüft</span><strong>${number0.format(TIRIS_HEAT_DISCOVERY_SERVICES.length)}</strong></div>
      </div>
      ${folderMatches.length ? `
        <article class="discovery-card">
          <h3>Service_Public · passende Dienstnamen</h3>
          <ul>${folderMatches.map((service) => `<li><strong>${escapeHtml(service.name)}</strong><small>${escapeHtml(service.type ?? '')}</small></li>`).join('')}</ul>
        </article>` : `
        <article class="discovery-card">
          <h3>Service_Public</h3>
          <p>Kein Dienstname mit eindeutigem Wärme-/Energiebezug gefunden. Das schließt einen Wärmenetz-Layer innerhalb eines anders benannten Dienstes nicht aus.</p>
        </article>`}
      <div class="discovery-grid">${serviceCards}</div>
      <p class="geometry-note">Bitte bei einem Treffer die Layernamen sowie den Rohdatenblock „TIRIS Wärmenetz-Suche“ kopieren. Dann bauen wir im nächsten Schritt die echte Punkt-/Anschlussgebietsabfrage.</p>
    `;
    resultBox.hidden = false;

    const layerMatchCount = raw.known_services.reduce((sum, entry) => sum + (entry.response ? candidateLayersFromService(entry.response).length : 0), 0);
    setStatus(status, folderMatches.length || layerMatchCount ? 'Kandidaten gefunden' : 'geprüft', folderMatches.length || layerMatchCount ? 'success' : 'muted');
  } catch (error) {
    $('rawHeatDiscovery').textContent = pretty({ error: error.message, partial: raw });
    resultBox.innerHTML = `<h3>Dienstsuche fehlgeschlagen</h3><p>${escapeHtml(error.message)}</p>`;
    resultBox.hidden = false;
    setStatus(status, 'Fehler', 'error');
  }
}

/* ---------------------------------------------------------
   7. Umweltwärme – TIRIS WASSER dynamisch prüfen
--------------------------------------------------------- */

function matchesEnvironmentalHeatKeyword(value) {
  const text = normalizedDiscoveryText(value);
  return ENVIRONMENTAL_HEAT_KEYWORDS.some((keyword) =>
    text.includes(normalizedDiscoveryText(keyword))
  );
}

function environmentalHeatLayerKind(layer) {
  const name = normalizedDiscoveryText(layer?.name);

  if (name.includes('bewilligungspflicht') && (name.includes('erdwarmesonde') || name.includes('erdwaermesonde'))) {
    return 'Tiefensonden – rechtlicher Hinweis';
  }
  if (name.includes('erdwarmesonde') || name.includes('erdwaermesonde')) return 'Bestehende Erdwärmesonden';
  if (name.includes('grundwasserentnahme')) return 'Grundwasserentnahmen';
  if (name.includes('grundwasserruckgabe') || name.includes('grundwasserrueckgabe')) return 'Grundwasserrückgaben';
  if (name.includes('grundwassersonde')) return 'Grundwassersonden / Beobachtung';
  if (name.includes('schutz') || name.includes('schongebiet')) return 'Schutz-/Schongebiete';
  if (name.includes('messstelle - grundwasser') || name.includes('messort grundwasser')) return 'Grundwasser-Messstellen';
  return 'Weitere Wasserinformation';
}

function buildLayerParentPath(layers, layer) {
  const byId = new Map(layers.map((item) => [Number(item.id), item]));
  const parts = [layer.name];
  let parentId = Number(layer.parentLayerId);
  const visited = new Set();
  while (Number.isFinite(parentId) && parentId >= 0 && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    parts.unshift(parent.name);
    parentId = Number(parent.parentLayerId);
  }
  return parts.join(' › ');
}

function canonicalEnvironmentalLayerName(value) {
  return normalizedDiscoveryText(value)
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim();
}

function environmentalHeatCandidateLayers(payload) {
  const layers = Array.isArray(payload?.layers) ? payload.layers : [];
  const candidates = layers
    .filter((layer) => layer?.type === 'Feature Layer')
    .filter((layer) => matchesEnvironmentalHeatKeyword(layer?.name))
    .map((layer) => ({
      ...layer,
      path: buildLayerParentPath(layers, layer),
      kind: environmentalHeatLayerKind(layer),
    }));

  // TIRIS verwendet bei einzelnen Themen mehrere maßstabsabhängige
  // Darstellungs-Layer derselben Daten. Für unsere Analyse soll das
  // physische Objekt nur einmal gezählt werden. Bevorzugt wird der
  // Detail-Layer, der bis zum größten Bildschirmmaßstab sichtbar ist.
  const bestByKey = new Map();
  candidates.forEach((layer) => {
    const key = `${layer.kind}|${canonicalEnvironmentalLayerName(layer.name)}`;
    const existing = bestByKey.get(key);
    const layerDetailScore = Number(layer.maxScale) === 90 ? 10 : 0;
    const existingDetailScore = Number(existing?.maxScale) === 90 ? 10 : 0;
    if (!existing || layerDetailScore > existingDetailScore) bestByKey.set(key, layer);
  });

  return [...bestByKey.values()];
}

function buildPointQueryUrl(baseUrl, layer, address, distanceM) {
  const point = {
    x: address.longitude,
    y: address.latitude,
    spatialReference: { wkid: 4326 },
  };
  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    geometry: JSON.stringify(point),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    returnZ: 'false',
    returnM: 'false',
    resultRecordCount: '100',
  });
  if (distanceM > 0) {
    params.set('distance', String(distanceM));
    params.set('units', 'esriSRUnit_Meter');
  }
  return `${baseUrl}/${layer.id}/query?${params.toString()}`;
}

function pointFeatureDistanceM(address, feature) {
  const x = finiteNumber(feature?.geometry?.x);
  const y = finiteNumber(feature?.geometry?.y);
  if (x === null || y === null) return null;
  return haversineMeters(address.latitude, address.longitude, y, x);
}

function formatArcgisDate(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const date = new Date(number);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function safeExternalUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function environmentalFeatureRecord(layer, feature) {
  const attrs = feature?.attributes ?? {};
  return {
    layer_id: layer.id,
    layer_name: layer.name,
    kind: layer.kind,
    name: attrs.ANL_NAME ?? attrs.NAME ?? attrs.BEZEICHNUNG ?? attrs.OBJEKT ?? `Objekt ${attrs.OBJECTID ?? ''}`.trim(),
    type: attrs.ANL_SUBTYPE ?? attrs.ANL_TYPE ?? attrs.TYP ?? null,
    status: attrs.ANL_BEARBEITSTAT ?? attrs.STATUS ?? null,
    kataster_nr: attrs.ANL_WGEV_NR ?? null,
    postzahl: attrs.POSTZAHL ?? null,
    stand: formatArcgisDate(attrs.STAND),
    distance_m: pointFeatureDistanceM(selectedAddress, feature),
    report_wabu: safeExternalUrl(attrs.URL_WABU),
    report_wawi: safeExternalUrl(attrs.URL_WAWI),
    object_id: attrs.OBJECTID ?? null,
    raw_attributes: attrs,
  };
}

function summarizeEnvironmentalLayer(layer, response) {
  const features = Array.isArray(response?.features) ? response.features : [];
  const records = features.map((feature) => environmentalFeatureRecord(layer, feature));
  records.sort((a, b) => {
    if (Number.isFinite(a.distance_m) && Number.isFinite(b.distance_m)) return a.distance_m - b.distance_m;
    if (Number.isFinite(a.distance_m)) return -1;
    if (Number.isFinite(b.distance_m)) return 1;
    return String(a.name).localeCompare(String(b.name), 'de');
  });
  const pointDistances = records.map((record) => record.distance_m).filter((value) => Number.isFinite(value));
  const nearest = pointDistances.length ? Math.min(...pointDistances) : null;
  return {
    id: layer.id,
    name: layer.name,
    path: layer.path,
    kind: layer.kind,
    geometryType: layer.geometryType ?? null,
    count: records.length,
    nearest_m: nearest,
    records,
    first_attributes: features[0]?.attributes ?? null,
  };
}

function environmentalKindIsDirectArea(kind) {
  return kind === 'Schutz-/Schongebiete' || kind === 'Tiefensonden – rechtlicher Hinweis';
}

function environmentalKindLabel(kind) {
  const labels = {
    'Bestehende Erdwärmesonden': 'Erdsonden',
    'Tiefensonden – rechtlicher Hinweis': 'Tiefensonden · rechtlicher Hinweis',
    'Grundwasserentnahmen': 'Grundwasserentnahmen',
    'Grundwasserrückgaben': 'Grundwasserrückgaben',
    'Grundwassersonden / Beobachtung': 'Grundwasser-Sonden / Beobachtung',
    'Schutz-/Schongebiete': 'Schutz-/Schongebiet / Beschränkung',
    'Grundwasser-Messstellen': 'Messdaten',
  };
  return labels[kind] ?? kind;
}

function environmentalHeadline(kind, total) {
  if (kind === 'Tiefensonden – rechtlicher Hinweis') {
    return total > 0
      ? 'Standort liegt in einem Gebiet mit Bewilligungspflicht'
      : 'kein entsprechender Flächenhinweis am Standort';
  }
  if (kind === 'Schutz-/Schongebiete') {
    return total > 0
      ? 'Standort liegt in einer ausgewiesenen wasserrechtlichen Fläche'
      : 'kein direkter Flächentreffer am Standort';
  }
  if (kind === 'Bestehende Erdwärmesonden') {
    return total > 0
      ? `${number0.format(total)} erfasste Sonde${total === 1 ? '' : 'n'} im Umkreis`
      : `keine erfasste bestehende Sonde im ${ENVIRONMENTAL_HEAT_NEARBY_RADIUS_M}-m-Umkreis`;
  }
  return `${number0.format(total)} Treffer im ${ENVIRONMENTAL_HEAT_NEARBY_RADIUS_M}-m-Umkreis`;
}

function environmentalRecordLinks(record) {
  const links = [];
  if (record.report_wabu) links.push(`<a href="${escapeHtml(record.report_wabu)}" target="_blank" rel="noopener noreferrer">Wasserbuch-Report ↗</a>`);
  if (record.report_wawi) links.push(`<a href="${escapeHtml(record.report_wawi)}" target="_blank" rel="noopener noreferrer">Wasserinfo-Report ↗</a>`);
  return links.join('');
}

function environmentalRecordHtml(record, directArea = false) {
  const meta = [
    Number.isFinite(record.distance_m) && !directArea ? `ca. ${number0.format(record.distance_m)} m` : null,
    record.type,
    record.status,
    record.kataster_nr ? `Kataster ${record.kataster_nr}` : null,
    record.stand ? `Stand ${record.stand}` : null,
  ].filter(Boolean);
  const links = environmentalRecordLinks(record);
  return `
    <li class="environment-object">
      <strong>${escapeHtml(record.name || 'TIRIS-Objekt')}</strong>
      ${meta.length ? `<span>${meta.map(escapeHtml).join(' · ')}</span>` : ''}
      ${links ? `<div class="environment-object-links">${links}</div>` : ''}
    </li>`;
}

function environmentalCardHtml(kind, items) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const directArea = environmentalKindIsDirectArea(kind);
  const allRecords = items.flatMap((item) => item.records ?? []);
  allRecords.sort((a, b) => {
    if (Number.isFinite(a.distance_m) && Number.isFinite(b.distance_m)) return a.distance_m - b.distance_m;
    if (Number.isFinite(a.distance_m)) return -1;
    if (Number.isFinite(b.distance_m)) return 1;
    return String(a.name).localeCompare(String(b.name), 'de');
  });
  const nearest = allRecords.map((record) => record.distance_m).filter(Number.isFinite)[0] ?? null;
  const visibleRecords = directArea ? allRecords.slice(0, 3) : allRecords.slice(0, 3);
  const note = directArea
    ? 'direkter Punkt-in-Polygon-Test am Standort'
    : nearest !== null
      ? `nächster Treffer ca. ${number0.format(nearest)} m entfernt`
      : `${ENVIRONMENTAL_HEAT_NEARBY_RADIUS_M} m Umkreis`;

  return `
    <article class="environment-card ${directArea && total > 0 ? 'environment-card--notice' : ''}">
      <span>${escapeHtml(environmentalKindLabel(kind))}</span>
      <strong>${escapeHtml(environmentalHeadline(kind, total))}</strong>
      <small>${escapeHtml(note)}</small>
      ${visibleRecords.length ? `
        <ul class="environment-object-list">
          ${visibleRecords.map((record) => environmentalRecordHtml(record, directArea)).join('')}
        </ul>` : ''}
      <details>
        <summary>Datenquelle / geprüfte Layer</summary>
        <ul>${items.map((item) => `<li>ID ${escapeHtml(item.id)} · ${escapeHtml(item.path)} · ${number0.format(item.count)} Treffer</li>`).join('')}</ul>
      </details>
    </article>`;
}

function buildProjectedAddressQueryUrl(layerId, address) {
  const addressCode = address.address_code ?? address.source_id ?? null;
  if (!addressCode) return null;
  const clauses = [`ADRCD='${sqlLiteral(addressCode)}'`];
  if (address.subcode) clauses.push(`SUBCD='${sqlLiteral(address.subcode)}'`);
  const params = new URLSearchParams({
    f: 'json',
    where: clauses.join(' AND '),
    outFields: 'ADRCD,SUBCD',
    returnGeometry: 'true',
    outSR: '31254',
    returnZ: 'false',
    returnM: 'false',
    resultRecordCount: '5',
  });
  return `${TIRIS_BASIS_URL}/${layerId}/query?${params.toString()}`;
}

async function fetchProjectedTirisAddressPoint(address) {
  const preferred = Number(address.tiris_layer_id);
  const layerIds = [...new Set([preferred, 19, 22, 13].filter((value) => Number.isFinite(value) && value > 0))];
  for (const layerId of layerIds) {
    const url = buildProjectedAddressQueryUrl(layerId, address);
    if (!url) continue;
    try {
      const payload = await fetchJson(url);
      const feature = payload?.features?.[0];
      const x = finiteNumber(feature?.geometry?.x);
      const y = finiteNumber(feature?.geometry?.y);
      if (x !== null && y !== null) return { x, y, layer_id: layerId, request_url: url };
    } catch {
      // nächster Layer
    }
  }
  return null;
}

function buildTirisMapUrl(projectedPoint, scale = 2500) {
  if (!projectedPoint) return 'https://maps.tirol.gv.at/externalcall.jsp?user=guest&project=tmap_master&client=auto';
  const params = new URLSearchParams({
    project: 'tmap_master',
    x: String(projectedPoint.x),
    y: String(projectedPoint.y),
    scale: String(scale),
    rotation: '0',
    view: 'Start',
    basemapview: 'orthofoto_labeling',
    user: 'guest',
    group_id: 'TMAPS-Gast',
    client: 'core',
    language: 'de',
  });
  return `https://maps.tirol.gv.at/externalcall.jsp?${params.toString()}`;
}

async function testEnvironmentalHeat() {
  if (!selectedAddress) return;

  const status = $('environmentalHeatStatus');
  const resultBox = $('environmentalHeatResult');
  setStatus(status, 'prüft …', 'working');
  resultBox.hidden = true;
  resultBox.innerHTML = '';

  const raw = {
    tested_at: new Date().toISOString(),
    address: {
      label: selectedAddress.label,
      latitude: selectedAddress.latitude,
      longitude: selectedAddress.longitude,
      address_code: selectedAddress.address_code ?? selectedAddress.source_id ?? null,
      subcode: selectedAddress.subcode ?? null,
    },
    service_url: TIRIS_WATER_URL,
    service: null,
    tiris_map: null,
    layers: [],
  };

  try {
    const [service, projectedPoint] = await Promise.all([
      fetchJson(`${TIRIS_WATER_URL}?f=pjson`),
      fetchProjectedTirisAddressPoint(selectedAddress),
    ]);
    raw.service = service;
    raw.tiris_map = {
      projected_point: projectedPoint,
      url: buildTirisMapUrl(projectedPoint, 500),
      scale: 500,
      note: 'Position/Ausschnitt können übernommen werden; die Themenschaltung muss in tirisMaps weiterhin manuell aktiviert werden. Maßstab bewusst 1:500 für die Standortkontrolle.',
    };

    const candidates = environmentalHeatCandidateLayers(service);

    for (const layer of candidates.slice(0, 14)) {
      const directArea = environmentalKindIsDirectArea(layer.kind) && layer.geometryType === 'esriGeometryPolygon';
      const distanceM = directArea ? 0 : ENVIRONMENTAL_HEAT_NEARBY_RADIUS_M;
      const queryUrl = buildPointQueryUrl(TIRIS_WATER_URL, layer, selectedAddress, distanceM);
      try {
        const response = await fetchJson(queryUrl);
        raw.layers.push({
          layer: {
            id: layer.id,
            name: layer.name,
            path: layer.path,
            kind: layer.kind,
            geometryType: layer.geometryType ?? null,
          },
          query: directArea ? 'direkter Standorttest' : `Umkreis ${distanceM} m`,
          query_url: queryUrl,
          response,
          summary: summarizeEnvironmentalLayer(layer, response),
        });
      } catch (error) {
        raw.layers.push({
          layer: {
            id: layer.id,
            name: layer.name,
            path: layer.path,
            kind: layer.kind,
            geometryType: layer.geometryType ?? null,
          },
          query: directArea ? 'direkter Standorttest' : `Umkreis ${distanceM} m`,
          query_url: queryUrl,
          error: error.message,
        });
      }
    }

    const summaries = raw.layers.filter((entry) => entry.summary).map((entry) => entry.summary);
    const grouped = new Map();
    summaries.forEach((item) => {
      if (!grouped.has(item.kind)) grouped.set(item.kind, []);
      grouped.get(item.kind).push(item);
    });

    const preferredOrder = [
      'Bestehende Erdwärmesonden',
      'Tiefensonden – rechtlicher Hinweis',
      'Grundwasserentnahmen',
      'Grundwasserrückgaben',
      'Grundwassersonden / Beobachtung',
      'Schutz-/Schongebiete',
      'Grundwasser-Messstellen',
    ];
    const cards = preferredOrder
      .filter((kind) => grouped.has(kind))
      .map((kind) => environmentalCardHtml(kind, grouped.get(kind)))
      .join('');

    const tirisMapUrl = raw.tiris_map.url;
    const layerSourceList = summaries.map((item) =>
      `<li><strong>${escapeHtml(environmentalKindLabel(item.kind))}</strong> · TIRIS WASSER Layer ${escapeHtml(item.id)} · ${escapeHtml(item.path)}</li>`
    ).join('');

    $('rawEnvironmentalHeat').textContent = pretty(raw);
    resultBox.innerHTML = `
      <div class="environment-heading-row">
        <div>
          <h3>Umweltwärme · Standortinformationen</h3>
          <p><strong>Keine Eignungsbewertung:</strong> Die Daten zeigen bestehende/erfasste Nutzungen, Messstellen und rechtliche Standortinformationen. Sie ersetzen keine technische, hydrogeologische oder wasserrechtliche Prüfung.</p>
        </div>
        <a class="external-action-link" href="${escapeHtml(tirisMapUrl)}" target="_blank" rel="noopener noreferrer">Standort in TIRIS öffnen ↗</a>
      </div>
      <div class="environment-grid">${cards || '<p>Keine passenden Feature-Layer im WASSER-Dienst gefunden.</p>'}</div>
      <div class="environment-review-note">
        <strong>Für die visuelle Kontrolle in tirisMaps:</strong>
        <span>WASSER → Hydrogeologie → Erdwärmesonde sowie WASSER → Wasserversorgung / Grundwassernutzung. Der Positionslink öffnet den Standort; die Themen müssen in tirisMaps derzeit noch manuell aktiviert werden.</span>
      </div>
      <details class="environment-source-details">
        <summary>Datenquellen & alle ausgewerteten TIRIS-Layer</summary>
        <ul>${layerSourceList}</ul>
      </details>
      <p class="geometry-note">Anlagen, Grundwasser-Sonden und Messstellen: ${ENVIRONMENTAL_HEAT_NEARBY_RADIUS_M} m Umkreis. Bewilligungspflicht sowie Schutz-/Schongebiete: direkter Flächentest am Standort. Bei maßstabsabhängigen Doppel-Layern wird nur der Detail-Layer ausgewertet.</p>
    `;
    resultBox.hidden = false;
    setStatus(status, candidates.length ? 'geprüft' : 'keine Layer', candidates.length ? 'success' : 'muted');
  } catch (error) {
    $('rawEnvironmentalHeat').textContent = pretty({ error: error.message, partial: raw });
    resultBox.innerHTML = `<h3>Umweltwärme-Test fehlgeschlagen</h3><p>${escapeHtml(error.message)}</p>`;
    resultBox.hidden = false;
    setStatus(status, 'Fehler', 'error');
  }
}

function resetEnvironmentalHeatOutput(clearRaw = true) {
  $('environmentalHeatResult').hidden = true;
  $('environmentalHeatResult').innerHTML = '';
  if (clearRaw) $('rawEnvironmentalHeat').textContent = '–';
}


/* ---------------------------------------------------------
   5b. Solarstrahlung – robuste Zwischenlösung
   Öffentliche Rasterquelle ohne künstliche Dach-Überlagerung.
   Der echte tirisMaps-Gebäudepotenzial-Layer bleibt separat verlinkt.
--------------------------------------------------------- */

async function fetchTextUrl(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function wmsLayersFromCapabilities(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
  if (xml.querySelector('parsererror')) throw new Error('WMS-Capabilities konnten nicht gelesen werden');
  return [...xml.querySelectorAll('Layer')].map((layer) => {
    const directChild = (tag) => [...layer.children].find((child) => child.localName === tag)?.textContent?.trim() || '';
    return { name: directChild('Name'), title: directChild('Title') };
  }).filter((layer) => layer.name);
}

function solarLayerScore(layer) {
  const text = normalizedDiscoveryText(`${layer.title} ${layer.name}`);
  let score = 0;
  if (text.includes('gebaude') || text.includes('dach')) score += 10;
  if (text.includes('eignung')) score += 8;
  if (text.includes('potential') || text.includes('potenzial')) score += 7;
  if (text.includes('jahressumme')) score += 7;
  if (text.includes('jahr')) score += 4;
  if (text.includes('solar')) score += 3;
  if (text.includes('strahlung')) score += 2;
  if (text.includes('sommerhalbjahr') || text.includes('winterhalbjahr')) score -= 1;
  return score;
}

function buildSolarRasterWmsUrl(serviceUrl, layerName, bounds, transparent = true, srs = 'EPSG:31254') {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: layerName,
    STYLES: '',
    SRS: srs,
    BBOX: `${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}`,
    WIDTH: '820',
    HEIGHT: '520',
    FORMAT: 'image/png',
    TRANSPARENT: transparent ? 'TRUE' : 'FALSE',
  });
  return `${serviceUrl}?${params.toString()}`;
}

async function testSolarMap() {
  if (!selectedAddress) return;
  const status = $('solarMapStatus');
  const box = $('solarMapResult');
  setStatus(status, 'prüft …', 'working');
  box.hidden = true;

  const raw = {
    tested_at: new Date().toISOString(),
    mode: 'regional-raster-preview',
    note: 'Test 16 nutzt die robuste flächige Solarstrahlung und zoomt den Ausschnitt auf ca. 125 m; der echte Gebäudelayer wird separat gezielt gesucht.',
    tiris_building_view_url: TIRIS_SOLAR_BUILDING_VIEW_URL,
    services: [],
  };

  try {
    let best = null;
    let annual = null;

    for (const candidate of SOLAR_WMS_CANDIDATES) {
      const capUrl = `${candidate.url}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.1.1`;
      try {
        const xmlText = await fetchTextUrl(capUrl);
        const layers = wmsLayersFromCapabilities(xmlText)
          .map((layer) => ({ ...layer, score: solarLayerScore(layer) }))
          .filter((layer) => layer.score > 0)
          .sort((a, b) => b.score - a.score);

        raw.services.push({ ...candidate, capabilities_url: capUrl, matches: layers.slice(0, 25) });

        const annualHere = layers.find((layer) => {
          const text = normalizedDiscoveryText(`${layer.title} ${layer.name}`);
          return text.includes('jahressumme') && text.includes('image');
        });
        if (annualHere && !candidate.historical && !annual) {
          annual = { service: candidate, layer: annualHere };
        }
        if (layers[0] && (!best || layers[0].score > best.layer.score)) {
          best = { service: candidate, layer: layers[0] };
        }
      } catch (error) {
        raw.services.push({ ...candidate, capabilities_url: capUrl, error: error.message });
      }
    }

    const chosen = annual || best;
    const tirisLink = `<a class="external-action-link" href="${escapeHtml(TIRIS_SOLAR_BUILDING_VIEW_URL)}" target="_blank" rel="noopener noreferrer">Solarpotenziale je Gebäude in TIRIS öffnen ↗</a>`;

    if (!chosen) {
      $('rawSolarMap').textContent = pretty(raw);
      box.innerHTML = `
        <div class="solar-map-layout">
          <div class="solar-map-copy">
            <p>Kein geeigneter öffentlicher Solar-WMS-Layer konnte automatisch bestätigt werden. Die offizielle tirisMaps-Gebäudeansicht bleibt direkt verlinkt; es wird kein Layername geraten.</p>
            ${tirisLink}
          </div>
          <div class="solar-map-empty">Keine Rasterdarstellung verfügbar.</div>
        </div>`;
      box.hidden = false;
      setStatus(status, 'Layer offen', 'muted');
      return;
    }

    // Bewusst wieder eine eigenständige Rasterkarte ohne Orthofoto-Überlagerung.
    // Für das Standortumfeld verwenden wir einen ca. 125 m breiten Ausschnitt;
    // das reine Orthofoto mit Gebäudeumriss bleibt separat in der Gebäudeübersicht.
    const lon = Number(selectedAddress.longitude);
    const lat = Number(selectedAddress.latitude);
    const halfWidthM = 62.5;
    const halfHeightM = halfWidthM * (520 / 820);
    const latDelta = halfHeightM / 111320;
    const lonMetersPerDegree = 111320 * Math.cos(lat * Math.PI / 180);
    const lonDelta = halfWidthM / Math.max(1, lonMetersPerDegree);
    const bounds = {
      minX: lon - lonDelta,
      minY: lat - latDelta,
      maxX: lon + lonDelta,
      maxY: lat + latDelta,
    };
    const previewUrl = buildSolarRasterWmsUrl(chosen.service.url, chosen.layer.name, bounds, false, 'EPSG:4326');
    raw.preview = {
      srs: 'EPSG:4326',
      bbox: [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY],
      ground_width_m: 125,
      image_size_px: [820, 520],
      solar_layer: chosen.layer,
      preview_url: previewUrl,
    };
    $('rawSolarMap').textContent = pretty(raw);

    const ageNote = chosen.service.historical
      ? 'Historische Orientierung – nicht als aktuelle Rechenbasis verwenden.'
      : 'Amtliche Jahressolarstrahlung im Standortumfeld einschließlich Gelände.';

    box.innerHTML = `
      <div class="solar-map-layout">
        <div class="solar-map-copy">
          <p>${ageNote} Die spezielle TIRIS-Gebäudeansicht bleibt als ergänzende Dachauswertung verlinkt.</p>
          ${tirisLink}
          <div class="solar-map-meta">
            <span>Ausschnitt ca. 125 m</span>
            <span>${escapeHtml(chosen.layer.title || chosen.layer.name)}</span>
          </div>
          <details class="environment-source-details"><summary>Datenquelle / WMS-Details</summary><pre>${escapeHtml(pretty(raw.services))}</pre></details>
        </div>
        <img class="solar-map-preview" src="${escapeHtml(previewUrl)}" alt="Amtliche Solarstrahlung im Umfeld des Gebäudestandorts">
      </div>`;

    box.hidden = false;
    setStatus(status, 'Raster bereit', 'success');
  } catch (error) {
    $('rawSolarMap').textContent = pretty({ error: error.message, partial: raw });
    box.innerHTML = `<h3>Solarstrahlungs-Test fehlgeschlagen</h3><p>${escapeHtml(error.message)}</p>`;
    box.hidden = false;
    setStatus(status, 'Fehler', 'error');
  }
}

function resetSolarMapOutput(clearRaw = true) {
  if ($('solarMapResult')) { $('solarMapResult').hidden = true; $('solarMapResult').innerHTML = ''; }
  if (clearRaw && $('rawSolarMap')) $('rawSolarMap').textContent = '–';
}

/* ---------------------------------------------------------
   9. Kultur & Schutzstatus
--------------------------------------------------------- */

function heritageCandidateLayers(service) {
  const layers = Array.isArray(service?.layers) ? service.layers : [];
  return layers
    .filter((layer) => layer?.type === 'Feature Layer')
    .map((layer) => ({ ...layer, path: buildLayerParentPath(layers, layer) }))
    .filter((layer) => {
      const text = normalizedDiscoveryText(`${layer.name} ${layer.path}`);
      return HERITAGE_KEYWORDS.some((keyword) => text.includes(normalizedDiscoveryText(keyword)));
    });
}

function normalizeAddressComparable(value) {
  return normalizedDiscoveryText(value)
    .replace(/[",.;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSemicolonCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ';' && !quoted) {
      fields.push(field.trim());
      field = '';
      continue;
    }
    field += char;
  }
  fields.push(field.trim());
  return fields;
}

function bdaCandidateLines(csvText) {
  const expectedStreetHouse = normalizeAddressComparable(
    `${selectedAddress.street || ''} ${selectedAddress.house_number || ''}`
  );
  const expectedMunicipality = normalizeAddressComparable(selectedAddress.municipality || '');

  return csvText.split(/\r?\n/).filter((line) => {
    if (!line.trim()) return false;
    const fields = splitSemicolonCsvLine(line);
    // BDA Tirol 2026: Adresse steht in Spalte 6 (Index 5), Gemeinde in Spalte 3 (Index 2).
    const addressField = String(fields[5] || '');
    const municipalityField = normalizeAddressComparable(fields[2] || '');
    const streetHousePart = normalizeAddressComparable(addressField.split(',')[0] || '');

    return expectedStreetHouse
      && streetHousePart === expectedStreetHouse
      && (!expectedMunicipality || municipalityField === expectedMunicipality);
  }).slice(0, 10);
}

async function testHeritage() {
  if (!selectedAddress) return;
  const status = $('heritageStatus');
  const box = $('heritageResult');
  setStatus(status, 'prüft …', 'working');
  box.hidden = true;
  const raw = { tested_at: new Date().toISOString(), address: selectedAddress.label, bda: {}, tiris: [] };

  try {
    try {
      const csv = await fetchTextUrl(BDA_TYROL_CSV_2026);
      raw.bda = { source: BDA_TYROL_CSV_2026, candidates: bdaCandidateLines(csv) };
    } catch (error) {
      raw.bda = { source: BDA_TYROL_CSV_2026, error: error.message };
    }

    const service = await fetchJson(`${TIRIS_SPORT_URL}?f=pjson`);
    const candidates = heritageCandidateLayers(service);
    const reference = hazardReferenceGeometry();
    for (const layer of candidates) {
      const layerUrl = `${TIRIS_SPORT_URL}/${layer.id}`;
      const queryUrl = buildHazardSpatialQueryUrl(layerUrl, reference, { returnGeometry: false, resultRecordCount: 25 });
      try {
        const response = await fetchJson(queryUrl);
        const features = Array.isArray(response?.features) ? response.features : [];
        raw.tiris.push({ id: layer.id, name: layer.name, path: layer.path, count: features.length, first_attributes: features[0]?.attributes ?? null, query_url: queryUrl });
      } catch (error) {
        raw.tiris.push({ id: layer.id, name: layer.name, path: layer.path, count: 0, error: error.message, query_url: queryUrl });
      }
    }

    $('rawHeritage').textContent = pretty(raw);
    const bdaHit = Array.isArray(raw.bda.candidates) && raw.bda.candidates.length > 0;
    const tirisHits = raw.tiris.filter((item) => item.count > 0);
    const tirisHtml = tirisHits.length
      ? tirisHits.map((item) => `<article class="environment-card"><span>${escapeHtml(item.path)}</span><strong>${number0.format(item.count)} Treffer am ${reference.mode === 'building' ? 'Gebäude' : 'Standort'}</strong><small>${escapeHtml(hazardAttributeSummary(item.first_attributes) || 'Details siehe Rohdaten')}</small></article>`).join('')
      : '<article class="environment-card"><span>TIRIS Kultur-Kontext</span><strong>kein Treffer in den ausgewerteten Layern</strong><small>Kunstkataster/Ensemble/Archäologie – keine Aussage zur rechtlichen Schutzstellung.</small></article>';

    box.innerHTML = `
      <div class="environment-heading-row"><div><h3>Kultur & Schutzstatus</h3></div><a class="external-action-link" href="${escapeHtml(BDA_DENKMALLISTE_PAGE)}" target="_blank" rel="noopener noreferrer">BDA-Denkmalliste öffnen ↗</a></div>
      <div class="environment-grid heritage-result-grid">
        <article class="environment-card ${bdaHit ? 'hazard-card--hit' : ''}">
          <span>Bundesdenkmalamt · Denkmalliste Tirol 2026</span>
          <strong>${raw.bda.error ? 'Browserabruf nicht möglich' : (bdaHit ? 'exakter Adresstreffer – Schutzstatus prüfen' : 'kein exakter Adresstreffer gefunden')}</strong>
          <small>${raw.bda.error ? 'Für die Produktivversion wäre ein kleiner jährlich aktualisierter lokaler Datensatz die robuste Alternative.' : 'Die veröffentlichte Denkmalliste ist laut BDA selbst nicht rechtsverbindlich.'}</small>
          ${bdaHit ? `<details><summary>Trefferzeilen</summary><pre>${escapeHtml(raw.bda.candidates.join('\n'))}</pre></details>` : ''}
        </article>
        ${tirisHtml}
      </div>
      <details class="environment-source-details"><summary>Alle geprüften TIRIS-Kulturlayer</summary><ul>${raw.tiris.map((item) => `<li>Layer ${item.id} · ${escapeHtml(item.path)} · ${number0.format(item.count)} Treffer</li>`).join('') || '<li>Keine passenden Feature-Layer gefunden.</li>'}</ul></details>
      <p class="geometry-note"><strong>Wichtig:</strong> Kunstkataster oder Ensemblekartierung bedeuten nicht automatisch Denkmalschutz. Bei einem BDA-Treffer bzw. konkretem Sanierungsvorhaben ist die Schutzstellung fachlich/rechtlich zu verifizieren.</p>`;
    box.hidden = false;
    setStatus(status, 'geprüft', 'success');
  } catch (error) {
    $('rawHeritage').textContent = pretty({ error: error.message, partial: raw });
    box.innerHTML = `<h3>Kultur-/Denkmalschutz-Test fehlgeschlagen</h3><p>${escapeHtml(error.message)}</p>`;
    box.hidden = false;
    setStatus(status, 'Fehler', 'error');
  }
}

function resetHeritageOutput(clearRaw = true) {
  if ($('heritageResult')) { $('heritageResult').hidden = true; $('heritageResult').innerHTML = ''; }
  if (clearRaw && $('rawHeritage')) $('rawHeritage').textContent = '–';
}

/* ---------------------------------------------------------
   8. Hochwasser & Naturgefahren
--------------------------------------------------------- */

function hazardReferenceGeometry() {
  const building = selectedBuildingFeature();
  const rings = building?.geometry?.rings;
  if (Array.isArray(rings) && rings.length > 0) {
    return {
      mode: 'building',
      label: 'gesamtes TIRIS-Gebäudepolygon',
      geometryType: 'esriGeometryPolygon',
      geometry: { rings, spatialReference: { wkid: 4326 } },
    };
  }
  return {
    mode: 'point',
    label: 'Standortpunkt (kein bestätigtes Gebäudepolygon)',
    geometryType: 'esriGeometryPoint',
    geometry: {
      x: selectedAddress.longitude,
      y: selectedAddress.latitude,
      spatialReference: { wkid: 4326 },
    },
  };
}

function buildHazardSpatialQueryUrl(layerUrl, reference, options = {}) {
  const params = new URLSearchParams({
    f: 'json',
    where: options.where || '1=1',
    geometry: JSON.stringify(reference.geometry),
    geometryType: reference.geometryType,
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: options.outFields || '*',
    returnGeometry: options.returnGeometry ? 'true' : 'false',
    outSR: '4326',
    returnZ: 'false',
    returnM: 'false',
    resultRecordCount: String(options.resultRecordCount || 100),
  });
  return `${layerUrl}/query?${params.toString()}`;
}

function naturalHazardCandidateLayers(service) {
  const layers = Array.isArray(service?.layers) ? service.layers : [];
  return layers
    .filter((layer) => layer?.type === 'Feature Layer')
    .filter((layer) => layer.geometryType === 'esriGeometryPolygon')
    .map((layer) => ({ ...layer, path: buildLayerParentPath(layers, layer) }))
    .filter((layer) => {
      const text = normalizedDiscoveryText(`${layer.name} ${layer.path}`);
      return NATURAL_HAZARD_KEYWORDS.some((keyword) => text.includes(normalizedDiscoveryText(keyword)));
    });
}

function hazardAttributeSummary(attributes = {}) {
  const preferredKeys = [
    'ZONE', 'ZONENART', 'ZONENBEZ', 'GEFAHR', 'GEFAHRENART', 'ART', 'TYP',
    'BEZEICHNUNG', 'NAME', 'WILDBACHZONE', 'PLANSTATUS', 'GEMEINDENAME',
    'GEM_NAME', 'STAND', 'STATUS'
  ];
  const parts = [];
  for (const key of preferredKeys) {
    const value = attributes[key];
    if (value === null || value === undefined || value === '') continue;
    const formatted = /STAND|DATUM|UPDATE/i.test(key) && Number.isFinite(Number(value))
      ? formatArcgisDate(value)
      : String(value);
    if (formatted && !parts.includes(formatted)) parts.push(formatted);
    if (parts.length >= 4) break;
  }
  if (!parts.length) {
    for (const [key, value] of Object.entries(attributes)) {
      if (/OBJECTID|SHAPE/i.test(key) || value === null || value === undefined || value === '') continue;
      parts.push(`${key}: ${String(value)}`);
      if (parts.length >= 3) break;
    }
  }
  return parts.join(' · ');
}

async function queryFloodScenario(serviceDef, reference) {
  const metadataUrl = `${serviceDef.url}?f=pjson`;
  const metadata = await fetchJson(metadataUrl);
  const layers = Array.isArray(metadata?.layers) ? metadata.layers : [];
  const layer = layers.find((item) => item?.geometryType === 'esriGeometryPolygon') || layers[0];
  if (!layer) throw new Error(`${serviceDef.key}: kein Feature-Layer gefunden`);
  const layerUrl = `${serviceDef.url}/${layer.id}`;

  // Die HQ-Dienste verwenden den codierten Wert L_KATEGO für die fachliche
  // Wahrscheinlichkeit: 1 = HQ30, 2 = HQ100, 3 = HQ300.
  // Das ist robuster als nur auf den Dienstnamen oder das optionale Feld SZENARIO
  // zu vertrauen. Test 11 hat gezeigt, dass im HQ100-Dienst am Beispielstandort
  // auch ein HQ300-Datensatz geliefert werden kann, wenn ungefiltert abgefragt wird.
  let layerMetadata = null;
  let categoryFilter = '1=1';
  try {
    layerMetadata = await fetchJson(`${layerUrl}?f=pjson`);
    const hasCategory = Array.isArray(layerMetadata?.fields)
      && layerMetadata.fields.some((field) => field?.name === 'L_KATEGO');
    if (hasCategory && Number.isFinite(serviceDef.category)) {
      categoryFilter = `L_KATEGO=${serviceDef.category}`;
    }
  } catch (_) {
    // Fallback auf unfilterte Abfrage; anschließend wird zusätzlich clientseitig validiert.
  }

  const queryUrl = buildHazardSpatialQueryUrl(layerUrl, reference, {
    returnGeometry: false,
    where: categoryFilter,
  });
  const response = await fetchJson(queryUrl);
  const returnedFeatures = Array.isArray(response?.features) ? response.features : [];
  const features = Number.isFinite(serviceDef.category)
    ? returnedFeatures.filter((feature) =>
        Number(feature?.attributes?.L_KATEGO) === Number(serviceDef.category)
      )
    : returnedFeatures;

  return {
    ...serviceDef,
    layer_id: layer.id,
    layer_name: layer.name,
    metadata_url: metadataUrl,
    query_url: queryUrl,
    category_filter: categoryFilter,
    returned_count: returnedFeatures.length,
    count: features.length,
    first_attributes: features[0]?.attributes ?? null,
    layer_metadata: layerMetadata,
    response,
  };
}

function floodCardHtml(result, reference) {
  const hit = result.count > 0;
  const subject = reference.mode === 'building' ? 'Gebäude' : 'Standortpunkt';
  return `
    <article class="environment-card ${hit ? 'hazard-card--hit' : ''}">
      <span>Überflutungsfläche ${escapeHtml(result.label)}</span>
      <strong>${hit
        ? `${escapeHtml(subject)} schneidet die ausgewertete ${escapeHtml(result.label)}-Fläche`
        : `kein Treffer in der ausgewerteten ${escapeHtml(result.label)}-Fläche`}</strong>
      <small>${hit ? `${number0.format(result.count)} Flächentreffer` : 'kein Flächentreffer'} · ${escapeHtml(reference.label)}</small>
      ${hit && result.first_attributes ? `<details><summary>Erster Treffer / Attribute</summary><p>${escapeHtml(hazardAttributeSummary(result.first_attributes) || 'Attribute vorhanden – siehe Rohdaten.')}</p></details>` : ''}
    </article>`;
}

function naturalHazardHitsHtml(results, reference) {
  const hits = results.filter((item) => item.count > 0);
  if (!hits.length) {
    return `
      <article class="environment-card">
        <span>Weitere Naturgefahren</span>
        <strong>kein Treffer in den ausgewerteten TIRIS-Gefahrenflächen</strong>
        <small>${escapeHtml(reference.label)} · keine Sicherheitsbestätigung</small>
      </article>`;
  }
  return hits.map((item) => `
    <article class="environment-card hazard-card--hit">
      <span>${escapeHtml(item.path)}</span>
      <strong>${number0.format(item.count)} Flächentreffer am ${reference.mode === 'building' ? 'Gebäude' : 'Standort'}</strong>
      <small>${escapeHtml(hazardAttributeSummary(item.first_attributes) || 'Details siehe Rohdaten')}</small>
      <details><summary>Datenquelle</summary><p>TIRIS NATURGEFAHREN · Layer ${escapeHtml(item.id)} · ${escapeHtml(item.path)}</p></details>
    </article>`).join('');
}


function isFloodDuplicateHazard(item) {
  const text = normalizedDiscoveryText(`${item.name} ${item.path}`);
  return text.includes('uberflutungsflachen')
    || text.includes('zonen mit gefahrdungen niedriger wahrscheinlichkeit');
}

function isPlanningHintHazard(item) {
  const text = normalizedDiscoveryText(`${item.name} ${item.path}`);
  return text.includes('planungsbereich') || text.includes('hinweisbereich');
}

function dedupeScaleVariantLayers(items) {
  const result = [];
  for (const item of items) {
    const text = normalizedDiscoveryText(item.path).replace(/ ubersicht$/i, '');
    const isOverview = normalizedDiscoveryText(item.name).includes('ubersicht');
    const existingIndex = result.findIndex((candidate) =>
      normalizedDiscoveryText(candidate.path).replace(/ ubersicht$/i, '') === text);
    if (existingIndex < 0) {
      result.push(item);
    } else if (!isOverview && normalizedDiscoveryText(result[existingIndex].name).includes('ubersicht')) {
      result[existingIndex] = item;
    }
  }
  return result;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, items.length || 1));

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

async function naturalHazardsServiceMetadata() {
  if (!naturalHazardsServiceMetadataCache) {
    naturalHazardsServiceMetadataCache = fetchJson(`${TIRIS_NATURAL_HAZARDS_URL}?f=pjson`)
      .catch((error) => {
        naturalHazardsServiceMetadataCache = null;
        throw error;
      });
  }
  return naturalHazardsServiceMetadataCache;
}

async function testHazards() {
  if (!selectedAddress) return;
  const status = $('hazardStatus');
  const resultBox = $('hazardResult');
  setStatus(status, 'prüft …', 'working');
  resultBox.hidden = true;
  resultBox.innerHTML = '';

  const reference = hazardReferenceGeometry();
  const raw = {
    tested_at: new Date().toISOString(),
    address: { label: selectedAddress.label, latitude: selectedAddress.latitude, longitude: selectedAddress.longitude },
    reference: { mode: reference.mode, label: reference.label, geometryType: reference.geometryType },
    flood: [],
    natural_hazards_service: TIRIS_NATURAL_HAZARDS_URL,
    natural_hazard_layers: [],
  };

  try {
    const floodResults = await Promise.all(FLOOD_HQ_SERVICES.map(async (service) => {
      try {
        return await queryFloodScenario(service, reference);
      } catch (error) {
        return { ...service, error: error.message, count: 0 };
      }
    }));
    raw.flood = floodResults;

    const service = await naturalHazardsServiceMetadata();
    raw.natural_hazards_metadata = service;
    const candidates = naturalHazardCandidateLayers(service).slice(0, 24);
    let completedHazardLayers = 0;
    const hazardResults = await mapWithConcurrency(candidates, 5, async (layer) => {
      const layerUrl = `${TIRIS_NATURAL_HAZARDS_URL}/${layer.id}`;
      const queryUrl = buildHazardSpatialQueryUrl(layerUrl, reference, { returnGeometry: false });
      try {
        const response = await fetchJson(queryUrl);
        const features = Array.isArray(response?.features) ? response.features : [];
        return {
          id: layer.id,
          name: layer.name,
          path: layer.path,
          count: features.length,
          first_attributes: features[0]?.attributes ?? null,
          query_url: queryUrl,
          response,
        };
      } catch (error) {
        return { id: layer.id, name: layer.name, path: layer.path, count: 0, query_url: queryUrl, error: error.message };
      } finally {
        completedHazardLayers += 1;
        setStatus(status, `prüft ${completedHazardLayers}/${candidates.length} …`, 'working');
      }
    });
    raw.natural_hazard_layers = hazardResults;

    const projectedPoint = await fetchProjectedTirisAddressPoint(selectedAddress).catch(() => null);
    const tirisMapUrl = buildTirisMapUrl(projectedPoint, 500);
    const floodCards = floodResults.map((result) => result.error
      ? `<article class="environment-card"><span>${escapeHtml(result.label)}</span><strong>Abfrage fehlgeschlagen</strong><small>${escapeHtml(result.error)}</small></article>`
      : floodCardHtml(result, reference)).join('');
    const displayHazards = dedupeScaleVariantLayers(hazardResults.filter((item) => !isFloodDuplicateHazard(item) && !isPlanningHintHazard(item)));
    const planningHints = dedupeScaleVariantLayers(hazardResults.filter((item) => !isFloodDuplicateHazard(item) && isPlanningHintHazard(item)));
    const layerList = hazardResults.map((item) => `<li>TIRIS NATURGEFAHREN Layer ${escapeHtml(item.id)} · ${escapeHtml(item.path)} · ${number0.format(item.count)} Treffer${item.error ? ` · Fehler: ${escapeHtml(item.error)}` : ''}</li>`).join('');

    raw.display_groups = {
      additional_hazards: displayHazards.map((item) => ({ id: item.id, path: item.path, count: item.count })),
      planning_hints: planningHints.map((item) => ({ id: item.id, path: item.path, count: item.count })),
    };
    $('rawHazards').textContent = pretty(raw);
    resultBox.innerHTML = `
      <div class="environment-heading-row">
        <div>
          <h3>Hochwasser & Naturgefahren · Standortindikationen</h3>
          <p><strong>Wichtig:</strong> Die Abfrage zeigt Überschneidungen mit den ausgewerteten amtlichen Flächen. „Kein Treffer“ bedeutet nicht, dass ein Standort sicher oder vollständig gefahrenfrei ist.</p>
        </div>
        <a class="external-action-link" href="${escapeHtml(tirisMapUrl)}" target="_blank" rel="noopener noreferrer">Standort in TIRIS öffnen ↗</a>
      </div>
      <h4 class="hazard-subheading">Hochwasser · BWV-Überflutungsflächen</h4>
      <div class="environment-grid">${floodCards}</div>
      <h4 class="hazard-subheading">Weitere Gefahrenzonen · TIRIS</h4>
      <div class="environment-grid">${naturalHazardHitsHtml(displayHazards, reference)}</div>
      <h4 class="hazard-subheading">Planungs- / Hinweisbereiche</h4>
      <div class="environment-grid">${naturalHazardHitsHtml(planningHints, reference)}</div>
      <div class="environment-review-note">
        <strong>Prüfgeometrie:</strong>
        <span>${escapeHtml(reference.label)}. Mit vorhandenem Gebäude wird bewusst das gesamte Polygon geprüft, damit ein Randtreffer nicht durch einen unauffälligen Adresspunkt übersehen wird.</span>
      </div>
      <details class="environment-source-details">
        <summary>Alle geprüften Naturgefahren-Layer</summary>
        <ul>${layerList || '<li>Keine passenden polygonalen Feature-Layer gefunden.</li>'}</ul>
      </details>
      <p class="geometry-note">HQ30, HQ100 und HQ300 werden separat aus den öffentlichen BWV-Überflutungsflächen geprüft. Weitere Gefahren-/Hinweisflächen werden dynamisch aus TIRIS NATURGEFAHREN abgefragt.</p>
    `;
    resultBox.hidden = false;
    setStatus(status, 'geprüft', 'success');
  } catch (error) {
    $('rawHazards').textContent = pretty({ error: error.message, partial: raw });
    resultBox.innerHTML = `<h3>Naturgefahren-Test fehlgeschlagen</h3><p>${escapeHtml(error.message)}</p>`;
    resultBox.hidden = false;
    setStatus(status, 'Fehler', 'error');
  }
}

function resetHazardOutput(clearRaw = true) {
  $('hazardResult').hidden = true;
  $('hazardResult').innerHTML = '';
  if (clearRaw) $('rawHazards').textContent = '–';
}

/* ---------------------------------------------------------
   10. Radon · gesetzlicher Gebietsstatus
--------------------------------------------------------- */

function testRadon() {
  if (!selectedAddress) return;
  const status = $('radonStatus');
  const box = $('radonResult');
  setStatus(status, 'prüft …', 'working');

  const gkz = String(selectedAddress.municipality_code ?? '').trim();
  const isTyrol = /^70[1-9]/.test(gkz);
  const isProtection = RADON_PROTECTION_TYROL_GKZ.has(gkz);
  const isPrecaution = isTyrol;

  const raw = {
    tested_at: new Date().toISOString(),
    address: selectedAddress.label,
    municipality: selectedAddress.municipality,
    municipality_code: gkz || null,
    radonvorsorgegebiet: isPrecaution,
    radonschutzgebiet: isProtection,
    source: 'Radonschutzverordnung Anlage 1',
    source_url: RADON_RIS_URL,
    info_source: 'Energie Tirol · Infoblatt Radon in Gebäuden · November 2020',
    info_url: RADON_INFO_ENERGIE_TIROL_URL,
  };
  $('rawRadon').textContent = pretty(raw);

  if (!gkz) {
    box.innerHTML = '<h3>Radon</h3><p>Gemeindekennziffer fehlt – automatische Zuordnung derzeit nicht möglich.</p>';
    box.hidden = false;
    setStatus(status, 'GKZ fehlt', 'muted');
    return;
  }

  box.innerHTML = `
    <div class="environment-heading-row radon-heading-row">
      <div>
        <h3>Radon · Gebietsstatus</h3>
        <p>Amtliche Zuordnung über die Gemeindekennziffer. Sie sagt nichts über die tatsächliche Radonkonzentration in einem konkreten Gebäude aus.</p>
      </div>
      <div class="environment-action-links">
        <a class="external-action-link" href="${escapeHtml(RADON_RIS_URL)}" target="_blank" rel="noopener noreferrer">Radonschutzverordnung öffnen ↗</a>
        <a class="external-action-link" href="${escapeHtml(RADON_INFO_ENERGIE_TIROL_URL)}" target="_blank" rel="noopener noreferrer">Infoblatt Radon in Gebäuden ↗</a>
      </div>
    </div>
    <div class="environment-grid">
      <article class="environment-card ${isPrecaution ? 'environment-card--notice' : ''}">
        <span>Radonvorsorgegebiet</span>
        <strong>${isPrecaution ? 'ja' : 'nicht aus Tirol-Regel ableitbar'}</strong>
        <small>${isPrecaution ? 'Alle Tiroler Gemeinden sind Radonvorsorgegebiet.' : 'Für den Standort wurde keine Tiroler GKZ erkannt.'}</small>
      </article>
      <article class="environment-card ${isProtection ? 'environment-card--notice' : ''}">
        <span>Radonschutzgebiet</span>
        <strong>${isProtection ? 'ja' : 'nein'}</strong>
        <small>${escapeHtml(selectedAddress.municipality || 'Gemeinde')} · GKZ ${escapeHtml(gkz)}</small>
      </article>
    </div>
    <p class="geometry-note"><strong>Beratungshinweis:</strong> Vorsorgegebiet bedeutet insbesondere, dass bei Neubauten Radonvorsorgemaßnahmen relevant sind. Ein Gebietsstatus ersetzt keine Messung der tatsächlichen Radonkonzentration im Gebäude.</p>`;
  box.hidden = false;
  setStatus(status, 'geprüft', 'success');
}

function resetRadonOutput(clearRaw = true) {
  if ($('radonResult')) { $('radonResult').hidden = true; $('radonResult').innerHTML = ''; }
  if (clearRaw && $('rawRadon')) $('rawRadon').textContent = '–';
}

/* ---------------------------------------------------------
   11. Sommerklima & Lokalklima – TIRIS KLIMAKARTEN INNTAL
   Reiner Erkundungstest: noch keine feste Standortpass-Logik.
--------------------------------------------------------- */

const TIRIS_CLIMATE_PROJECT_URL =
  'https://www.tirol.gv.at/landesentwicklung/nachhaltigkeits-und-klimakoordination/' +
  'klimafitte-staedte-gemeinden-und-regionen-in-tirol/projekt-regionale-klimaanalyse-inntal/';

function matchesClimateKeyword(value) {
  const text = normalizedDiscoveryText(value);
  return CLIMATE_ANALYSIS_KEYWORDS.some((keyword) =>
    text.includes(normalizedDiscoveryText(keyword))
  );
}

function climateTopicLabel(layer) {
  const text = normalizedDiscoveryText(`${layer?.name || ''} ${layer?.path || ''}`);
  if (text.includes('planhinweis')) return 'Planhinweise';
  if (text.includes('kaltluft') || text.includes('leitbahn') || text.includes('einwirk') || text.includes('produktion')) {
    return 'Kaltluft / nächtliche Durchlüftung';
  }
  if (text.includes('nacht') || text.includes('04 uhr') || text.includes('04:')) {
    return 'Nächtliche Wärmebelastung';
  }
  if (text.includes('pet') || text.includes('hitze') || text.includes('warme') || text.includes('waerme') || text.includes('14 uhr') || text.includes('14:')) {
    return 'Wärmebelastung am Tag';
  }
  return 'Weitere Klimaanalyse';
}

function climateCandidateLayers(service) {
  const layers = Array.isArray(service?.layers) ? service.layers : [];
  return layers
    .filter((layer) => layer && layer.type !== 'Group Layer')
    .map((layer) => ({
      id: Number(layer.id),
      name: layer.name || `Layer ${layer.id}`,
      type: layer.type || null,
      geometryType: layer.geometryType || null,
      parentLayerId: layer.parentLayerId ?? -1,
      minScale: layer.minScale ?? null,
      maxScale: layer.maxScale ?? null,
      path: buildLayerParentPath(layers, layer),
    }))
    .filter((layer) => matchesClimateKeyword(`${layer.name} ${layer.path}`))
    .map((layer) => ({ ...layer, topic: climateTopicLabel(layer) }));
}

function buildClimateIdentifyUrl(layerIds) {
  const lat = Number(selectedAddress?.latitude);
  const lon = Number(selectedAddress?.longitude);
  const halfWidthM = 300;
  const halfHeightM = halfWidthM * (520 / 820);
  const latDelta = halfHeightM / 111320;
  const lonMetersPerDegree = 111320 * Math.cos(lat * Math.PI / 180);
  const lonDelta = halfWidthM / Math.max(1, lonMetersPerDegree);

  const params = new URLSearchParams({
    f: 'json',
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    sr: '4326',
    layers: `all:${layerIds.join(',')}`,
    tolerance: '4',
    mapExtent: `${lon-lonDelta},${lat-latDelta},${lon+lonDelta},${lat+latDelta}`,
    imageDisplay: '820,520,96',
    returnGeometry: 'false',
  });
  return `${TIRIS_CLIMATE_INNTAL_URL}/identify?${params.toString()}`;
}

function compactClimateAttributes(attributes) {
  if (!attributes || typeof attributes !== 'object') return 'keine Attribute';
  const entries = Object.entries(attributes)
    .filter(([key, value]) => {
      if (value === null || value === undefined || value === '') return false;
      return !/objectid|shape|globalid|uuid|guid/i.test(key);
    });

  const preferred = entries.filter(([key]) =>
    /name|bez|typ|klasse|kateg|bewert|hinweis|pet|temp|luft|wert|stufe|funktion|bedeut|plan/i.test(key)
  );
  const selected = (preferred.length ? preferred : entries).slice(0, 5);
  if (!selected.length) return 'Details siehe Rohdaten';

  return selected.map(([key, value]) => {
    let shown = value;
    if (typeof value === 'number' && value > 100000000000) shown = formatArcgisDate(value) || value;
    return `${key}: ${shown}`;
  }).join(' · ');
}

async function testClimateAnalysis() {
  if (!selectedAddress) return;
  const status = $('climateAnalysisStatus');
  const box = $('climateAnalysisResult');
  setStatus(status, 'prüft …', 'working');
  box.hidden = true;

  const raw = {
    tested_at: new Date().toISOString(),
    address: selectedAddress.label,
    service_url: TIRIS_CLIMATE_INNTAL_URL,
    project_url: TIRIS_CLIMATE_PROJECT_URL,
    service: null,
    candidates: [],
    identify_url: null,
    identify: null,
  };

  try {
    const service = await fetchJson(`${TIRIS_CLIMATE_INNTAL_URL}?f=pjson`);
    raw.service = service;
    const candidates = climateCandidateLayers(service);
    raw.candidates = candidates;

    let identify = { results: [] };
    if (candidates.length) {
      const ids = [...new Set(candidates.map((layer) => layer.id).filter(Number.isFinite))];
      const identifyUrl = buildClimateIdentifyUrl(ids);
      raw.identify_url = identifyUrl;
      identify = await fetchJson(identifyUrl);
      raw.identify = identify;
    }

    $('rawClimateAnalysis').textContent = pretty(raw);

    const results = Array.isArray(identify?.results) ? identify.results : [];
    const candidateById = new Map(candidates.map((layer) => [Number(layer.id), layer]));
    const grouped = new Map();

    for (const layer of candidates) {
      if (!grouped.has(layer.topic)) grouped.set(layer.topic, { layers: [], hits: [] });
      grouped.get(layer.topic).layers.push(layer);
    }
    for (const result of results) {
      const layer = candidateById.get(Number(result.layerId));
      if (!layer) continue;
      if (!grouped.has(layer.topic)) grouped.set(layer.topic, { layers: [layer], hits: [] });
      grouped.get(layer.topic).hits.push(result);
    }

    const preferredOrder = [
      'Wärmebelastung am Tag',
      'Nächtliche Wärmebelastung',
      'Kaltluft / nächtliche Durchlüftung',
      'Planhinweise',
      'Weitere Klimaanalyse',
    ];

    const cards = preferredOrder
      .filter((topic) => grouped.has(topic))
      .map((topic) => {
        const group = grouped.get(topic);
        const hit = group.hits[0];
        const layerNames = group.layers.slice(0, 4).map((layer) => layer.name).join(' · ');
        return `
          <article class="environment-card ${group.hits.length ? 'environment-card--notice' : ''}">
            <span>${escapeHtml(topic)}</span>
            <strong>${group.hits.length ? `${number0.format(group.hits.length)} Information(en) am Standort` : 'Thema im Dienst vorhanden'}</strong>
            <small>${hit ? escapeHtml(compactClimateAttributes(hit.attributes)) : escapeHtml(layerNames || 'Keine direkte Punktinformation zurückgegeben.')}</small>
          </article>`;
      }).join('');

    const layerList = candidates.length
      ? `<ul>${candidates.map((layer) => `<li><strong>Layer ${layer.id} · ${escapeHtml(layer.path)}</strong><small>${escapeHtml(layer.type || 'Layer')} · ${escapeHtml(layer.topic)}</small></li>`).join('')}</ul>`
      : '<p>Im aktuellen Dienst wurden über die Suchbegriffe keine passenden Einzel-Layer gefunden.</p>';

    const coverageText = results.length
      ? 'Der Standort liefert direkte Informationen aus der regionalen Klimaanalyse.'
      : 'Der Dienst wurde erreicht, am exakten Standort kam über die gefundenen Layer jedoch keine direkte Identify-Information zurück. Das kann außerhalb der Abdeckung liegen oder an der Darstellungsart einzelner Layer liegen.';

    box.innerHTML = `
      <div class="environment-heading-row">
        <div>
          <h3>Regionale Klimaanalyse · Erkundung</h3>
          <p>${escapeHtml(coverageText)}</p>
        </div>
        <a class="external-action-link" href="${escapeHtml(TIRIS_CLIMATE_PROJECT_URL)}" target="_blank" rel="noopener noreferrer">Projekt Klimaanalyse Inntal öffnen ↗</a>
      </div>
      <div class="discovery-summary">
        <div><span>relevante Layer gefunden</span><strong>${number0.format(candidates.length)}</strong></div>
        <div><span>Identify-Treffer am Standort</span><strong>${number0.format(results.length)}</strong></div>
      </div>
      <div class="environment-grid">${cards || '<p>Noch keine passenden Klimathemen gefunden.</p>'}</div>
      <div class="environment-review-note">
        <strong>Noch keine Standortpass-Entscheidung:</strong>
        <span>Wir prüfen hier nur, ob Wärmebelastung, Nachtklima, Kaltluft und Planhinweise eine sinnvolle schnelle Vorinformation liefern. Heiße Tage, Tropennächte und detaillierte Klimadiagramme bleiben vorerst dem Klimablatt vorbehalten.</span>
      </div>
      <details class="environment-source-details"><summary>Gefundene TIRIS-Klimakarten-Layer</summary>${layerList}</details>`;

    box.hidden = false;
    setStatus(status, candidates.length ? 'erkundet' : 'keine Layer', candidates.length ? 'success' : 'muted');
  } catch (error) {
    $('rawClimateAnalysis').textContent = pretty({ error: error.message, partial: raw });
    box.innerHTML = `<h3>Klimakarten-Test fehlgeschlagen</h3><p>${escapeHtml(error.message)}</p>`;
    box.hidden = false;
    setStatus(status, 'Fehler', 'error');
  }
}

function resetClimateAnalysisOutput(clearRaw = true) {
  if ($('climateAnalysisResult')) {
    $('climateAnalysisResult').hidden = true;
    $('climateAnalysisResult').innerHTML = '';
  }
  if (clearRaw && $('rawClimateAnalysis')) $('rawClimateAnalysis').textContent = '–';
}

/* ---------------------------------------------------------
   Hilfsfunktionen / Events
--------------------------------------------------------- */

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

$('tirisLiveAddressInput').addEventListener('input', () => {
  window.clearTimeout(addressSearchTimer);
  addressSearchTimer = window.setTimeout(() => searchSharedAddress(), 250);
});
$('tirisLiveAddressInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    searchSharedAddress();
  }
});
$('searchTirisLiveAddressButton').addEventListener('click', () => searchSharedAddress());

$('clearAddressButton').addEventListener('click', clearAddress);
$('testBasisButton').addEventListener('click', testBasisService);
$('testTirisAddressLayersButton').addEventListener('click', testTirisAddressLayers);
$('loadBuildingButton').addEventListener('click', loadBuildings);
$('loadBuildingAreaButton').addEventListener('click', loadBuildingArea);
$('changeBuildingButton').addEventListener('click', editSelectedBuilding);
$('noSuitableBuildingButton').addEventListener('click', continueWithoutBuildingGeometry);
$('compareBuildingButton').addEventListener('click', compareBuildingGeometry);
$('clearValidationButton').addEventListener('click', clearValidation);
$('loadTerrainButton').addEventListener('click', loadTerrain);
$('loadSolarButton').addEventListener('click', loadSolar);
$('discoverHeatButton').addEventListener('click', discoverEnergyLayersDeep);
$('testEnvironmentalHeatButton').addEventListener('click', testEnvironmentalHeat);
$('testHazardButton').addEventListener('click', testHazards);
$('testSolarMapButton').addEventListener('click', testSolarMap);
$('testHeritageButton').addEventListener('click', testHeritage);
$('testRadonButton').addEventListener('click', testRadon);
$('testClimateAnalysisButton').addEventListener('click', testClimateAnalysis);
$('solarObserverMode').addEventListener('change', () => {
  if (!$('solarChartCard').hidden || !$('solarResult').hidden) loadSolar();
});
$('orthophotoScale').addEventListener('change', () => {
  if (buildingFeatures.length > 0) drawBuildingGeometry(buildingFeatures);
});

$('year').textContent = String(new Date().getFullYear());

/* ---------------------------------------------------------
   Öffentliche Tool-internen Funktionen für die V1-Oberfläche.
   Keine externen TIRIS-Sessions; nur bereits bestätigte Browserabfragen.
--------------------------------------------------------- */
window.StandortpassCore = Object.freeze({
  getSelectedAddress() {
    return selectedAddress ? JSON.parse(JSON.stringify(selectedAddress)) : null;
  },
  getSelectedBuilding() {
    const feature = selectedBuildingFeature();
    return feature ? JSON.parse(JSON.stringify(feature)) : null;
  },
  getSelectedBuildingSelectionMode() {
    return selectedBuildingSelectionMode;
  },
  restoreBuildingSnapshot(snapshot) {
    return restoreBuildingSnapshot(JSON.parse(JSON.stringify(snapshot)));
  },
  selectAddressRecord(record, provider = 'tiris-project-import') {
    if (!record) return false;
    selectAddress(JSON.parse(JSON.stringify(record)), provider);
    return true;
  },
  async searchAndSelectAddress(label) {
    if (!label) return false;
    const result = await searchSharedAddress({
      query: label,
      autoSelectBest: true,
      expectedLabel: label,
      provider: 'hybrid-project-import',
    });
    return Boolean(selectedAddress && result);
  },
  clearAddress,
  loadBuildings,
  loadTerrain,
  loadSolar,
  testSolarMap,
  testEnvironmentalHeat,
  testHazards,
  testHeritage,
  testRadon,
  async getTirisMapUrl(scale = 2500) {
    if (!selectedAddress) return 'https://maps.tirol.gv.at/';
    const point = await fetchProjectedTirisAddressPoint(selectedAddress).catch(() => null);
    return buildTirisMapUrl(point, scale);
  },
});

initAddressModule().catch(() => {});
