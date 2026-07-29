'use strict';

/* =========================================================
   STANDORTPASS – SCHNITTSTELLENTEST 03

   Testet bewusst:
   1) TIRIS Live-Adresssuche als mögliche gemeinsame Primärquelle
   2) TIRIS Katastralgemeinde aus der Standortkoordinate
   3) bestehenden BEV-Bestand nur als Vergleich/Fallback
   4) TIRIS Gebäude FeatureServer mit Punkt-in-Polygon-Zuordnung
   5) TIRIS Orthofoto als visuelle Kontrolle
   6) bestehende TIRIS-DGM-Höhenfunktion

   Noch KEINE freigegebene Standortpass-Berechnungslogik.
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

const TIRIS_LIVE_ADDRESS_LAYERS = [
  { id: 19, kind: 'building', label: 'AGWR Gebäudeadresse' },
  { id: 22, kind: 'address', label: 'AGWR Grundstücksadresse' },
  { id: 13, kind: 'address', label: 'TIRIS Adresse' },
];

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
let selectedAddress = null;
let buildingFeatures = [];
let selectedBuildingId = null;
let addressSearchTimer = null;
let selectedKgResult = null;
let selectedAddressProvider = null;

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
   1. TIRIS Live-Adresse + gemeinsames Standortformat
--------------------------------------------------------- */

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('de-AT')
    .replace(/\s+/g, ' ');
}

function sqlLiteral(value) {
  return String(value ?? '').replaceAll("'", "''");
}

function dateToIso(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseSimpleAustrianAddress(input) {
  const text = String(input ?? '')
    .trim()
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ');

  const postalMatch = text.match(/\b(\d{4})\b/);
  if (!postalMatch) {
    return { ok: false, message: 'Keine vierstellige PLZ erkannt.' };
  }

  const postalCode = postalMatch[1];
  const postalIndex = postalMatch.index ?? 0;
  const beforePostal = text
    .slice(0, postalIndex)
    .replace(/[;,\s]+$/, '')
    .trim();
  const afterPostal = text
    .slice(postalIndex + postalCode.length)
    .replace(/^[;,\s]+/, '')
    .trim();

  const houseMatch = beforePostal.match(/(?:^|\s)(\d+[A-Za-z]?(?:[\/-][A-Za-z0-9]+)?)$/);
  if (!houseMatch) {
    return {
      ok: false,
      message: 'Hausnummer nicht erkannt. Testformat: Straße Hausnummer, PLZ Gemeinde.',
    };
  }

  const houseNumber = houseMatch[1];
  const street = beforePostal.slice(0, beforePostal.length - houseMatch[0].length).trim();

  if (!street) {
    return { ok: false, message: 'Straßenname fehlt.' };
  }

  return {
    ok: true,
    street,
    house_number: houseNumber,
    postal_code: postalCode,
    municipality: afterPostal || null,
  };
}

function liveLayerFields(layerId) {
  if (layerId === 13) {
    return {
      street: 'SNAME',
      house: 'HNR',
      postal: 'PLZ',
      municipality: 'GEMNAME',
    };
  }
  return {
    street: 'STRASSENNAME',
    house: 'HNR_ADR_ZUSAMMEN',
    postal: 'PLZ',
    municipality: 'GEMEINDENAME',
  };
}

function buildTirisLiveAddressQueryUrl(layerId, parsed, strictMunicipality = true) {
  const fields = liveLayerFields(layerId);
  const clauses = [
    `${fields.postal}='${sqlLiteral(parsed.postal_code)}'`,
    `${fields.street}='${sqlLiteral(parsed.street)}'`,
    `${fields.house}='${sqlLiteral(parsed.house_number)}'`,
  ];

  if (strictMunicipality && parsed.municipality) {
    clauses.push(`${fields.municipality}='${sqlLiteral(parsed.municipality)}'`);
  }

  const params = new URLSearchParams({
    f: 'json',
    where: clauses.join(' AND '),
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    returnZ: 'false',
    returnM: 'false',
    resultRecordCount: '20',
  });

  return `${TIRIS_BASIS_URL}/${layerId}/query?${params.toString()}`;
}

function normalizeTirisAddressFeature(feature, layer) {
  const attrs = feature?.attributes ?? {};
  const geometry = feature?.geometry ?? {};
  const isLayer13 = layer.id === 13;

  const street = isLayer13 ? attrs.SNAME : attrs.STRASSENNAME;
  const house = isLayer13 ? attrs.HNR : attrs.HNR_ADR_ZUSAMMEN;
  const municipality = isLayer13 ? attrs.GEMNAME : attrs.GEMEINDENAME;
  const municipalityCode = isLayer13 ? attrs.GEMOESTAT : attrs.GEMOESTAT;
  const subcode = attrs.SUBCD ?? null;
  const addressCode = attrs.ADRCD ?? null;
  const latitude = finiteNumber(geometry.y);
  const longitude = finiteNumber(geometry.x);

  if (latitude === null || longitude === null) return null;

  return {
    id: `tiris-${addressCode ?? attrs.OBJECTID ?? 'address'}-${subcode ?? '0'}`,
    label: `${street ?? '–'} ${house ?? ''}, ${attrs.PLZ ?? ''} ${municipality ?? ''}`.replace(/\s+/g, ' ').trim(),
    street: street ?? '',
    house_number: String(house ?? ''),
    postal_code: String(attrs.PLZ ?? ''),
    municipality: municipality ?? '',
    delivery_locality: municipality ?? '',
    municipality_code: municipalityCode ? String(municipalityCode) : null,
    locality: isLayer13 ? (attrs.ORTSTEIL ?? null) : (attrs.BEZ_ORTSTEIL ?? null),
    latitude,
    longitude,
    address_latitude: latitude,
    address_longitude: longitude,
    building: layer.kind === 'building'
      ? { latitude, longitude, subcode, object_number: null, property: null }
      : null,
    cadastral_municipality_number: null,
    cadastral_municipality_numbers: [],
    source: 'Land Tirol / TIRIS',
    source_id: addressCode ? String(addressCode) : String(attrs.OBJECTID ?? ''),
    address_code: addressCode ? String(addressCode) : null,
    subcode: subcode ? String(subcode) : null,
    coordinate_kind: layer.kind,
    dataset_date: dateToIso(attrs.STAND),
    updated_at: dateToIso(attrs.UPDATETIMESTAMP),
    license: 'OGD Land Tirol',
    is_demo: false,
    tiris_layer_id: layer.id,
    tiris_layer_label: layer.label,
    raw_attributes: attrs,
  };
}

async function searchTirisLiveAddress() {
  const input = $('tirisLiveAddressInput');
  const resultBox = $('tirisLiveAddressResults');
  const status = $('tirisLiveAddressStatus');
  const parsed = parseSimpleAustrianAddress(input.value);

  if (!parsed.ok) {
    $('tirisParsedAddress').textContent = parsed.message;
    resultBox.hidden = true;
    setStatus(status, 'Eingabe prüfen', 'error');
    return;
  }

  $('tirisParsedAddress').textContent =
    `${parsed.street} · HNr. ${parsed.house_number} · ${parsed.postal_code}` +
    `${parsed.municipality ? ` · ${parsed.municipality}` : ''}`;
  setStatus(status, 'sucht …', 'working');
  resultBox.hidden = true;
  resultBox.innerHTML = '';

  const attempts = [];
  const normalized = [];

  try {
    for (const layer of TIRIS_LIVE_ADDRESS_LAYERS) {
      let url = buildTirisLiveAddressQueryUrl(layer.id, parsed, true);
      let payload = await fetchJson(url);
      attempts.push({ layer, strict_municipality: true, request_url: url, response: payload });

      let features = Array.isArray(payload.features) ? payload.features : [];

      // Gemeindenamen können Schreibvarianten enthalten. Bei null Treffern
      // wird einmal ohne Gemeindeklausel gesucht; PLZ+Straße+Hausnummer bleiben exakt.
      if (features.length === 0 && parsed.municipality) {
        url = buildTirisLiveAddressQueryUrl(layer.id, parsed, false);
        payload = await fetchJson(url);
        attempts.push({ layer, strict_municipality: false, request_url: url, response: payload });
        features = Array.isArray(payload.features) ? payload.features : [];
      }

      features.forEach((feature) => {
        const item = normalizeTirisAddressFeature(feature, layer);
        if (item) normalized.push({ item, feature, layer });
      });

      // Gebäudeadressen sind für unsere Zwecke der bevorzugte Treffer.
      if (normalized.length > 0 && layer.id === 19) break;
    }

    $('rawTirisLiveAddress').textContent = pretty({ parsed, attempts, normalized });

    const deduped = [];
    const keys = new Set();
    normalized.forEach((entry) => {
      const key = `${entry.item.address_code ?? ''}|${entry.item.subcode ?? ''}|${entry.item.latitude.toFixed(7)}|${entry.item.longitude.toFixed(7)}`;
      if (!keys.has(key)) {
        keys.add(key);
        deduped.push(entry);
      }
    });

    if (deduped.length === 0) {
      setStatus(status, 'kein Treffer', 'error');
      resultBox.innerHTML = `
        <div class="no-live-result">
          <strong>Keine passende TIRIS-Adresse gefunden.</strong>
          <small>Der BEV-Fallback darunter bleibt verfügbar. Bitte Rohantwort kontrollieren.</small>
        </div>
      `;
      resultBox.hidden = false;
      return;
    }

    resultBox.innerHTML = '';
    deduped.forEach(({ item, layer }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'suggestion-button';
      button.innerHTML = `
        <strong>${escapeHtml(item.label)}</strong>
        <small>${escapeHtml(layer.label)} · ADRCD ${escapeHtml(item.address_code ?? '–')} · ${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}</small>
      `;
      button.addEventListener('click', () => selectAddress(item, 'tiris'));
      resultBox.appendChild(button);
    });

    resultBox.hidden = false;
    setStatus(status, deduped.length === 1 ? '1 Treffer' : `${deduped.length} Treffer`, 'success');

    if (deduped.length === 1) {
      selectAddress(deduped[0].item, 'tiris');
    }
  } catch (error) {
    $('rawTirisLiveAddress').textContent = pretty({ parsed, attempts, error: error.message });
    resultBox.innerHTML = `<p class="field-status">Live-Suche fehlgeschlagen: ${escapeHtml(error.message)}</p>`;
    resultBox.hidden = false;
    setStatus(status, 'Fehler', 'error');
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
  } catch (error) {
    $('rawKg').textContent = pretty({ error: error.message });
    $('kgResult').innerHTML = `<strong>KG-Abfrage fehlgeschlagen</strong><small>${escapeHtml(error.message)}</small>`;
  }
}

async function compareSelectedAddressWithBev(address) {
  $('liveAddressChecks').hidden = false;

  if (!addressRegistry) {
    $('bevComparisonResult').innerHTML = '<strong>BEV noch nicht bereit</strong><small>Vergleich wird nach Initialisierung möglich.</small>';
    return;
  }

  try {
    const result = await addressRegistry.search(address.label, { limit: 12 });
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
   1d. Bestehendes BEV-Adressmodul – nur Fallback/Vergleich
--------------------------------------------------------- */

async function initAddressModule() {
  const status = $('addressModuleStatus');

  try {
    if (!window.AddressProviderCore || !window.BevLocalAddressProvider) {
      throw new Error(
        'Die bestehenden Adressmodule wurden nicht geladen. ' +
        'Liegt dieser Testordner neben tools/klima-heizlast/?'
      );
    }

    addressRegistry = new window.AddressProviderCore.AddressProviderRegistry();
    addressRegistry.register(
      new window.BevLocalAddressProvider({
        baseUrl: '../klima-heizlast/data/addresses',
      })
    );

    await addressRegistry.init();
    const info = addressRegistry.info();

    setStatus(status, 'BEV Fallback bereit', 'success');
    $('addressSearchStatus').textContent =
      `${number0.format(info.address_count)} Adressen · Stand ${info.dataset_date ?? '–'} · nur Fallback/Vergleich`;

    if (selectedAddress && selectedAddressProvider === 'tiris') {
      compareSelectedAddressWithBev(selectedAddress);
    }
  } catch (error) {
    setStatus(status, 'Adressmodul Fehler', 'error');
    $('addressSearchStatus').textContent = error.message;
    console.error(error);
  }
}

async function runAddressSearch() {
  if (!addressRegistry) return;

  const input = $('addressSearchInput');
  const query = input.value.trim();
  const suggestions = $('addressSuggestions');

  if (query.length < 3) {
    suggestions.hidden = true;
    suggestions.innerHTML = '';
    return;
  }

  try {
    const result = await addressRegistry.search(query, { limit: 8 });
    const records = result.results ?? [];

    suggestions.innerHTML = '';

    if (records.length === 0) {
      suggestions.hidden = true;
      $('addressSearchStatus').textContent = result.guidance || 'Keine Adresse gefunden.';
      return;
    }

    records.forEach((record) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'suggestion-button';
      button.setAttribute('role', 'option');

      const coordinateInfo = record.coordinate_kind === 'building'
        ? 'Gebäudekoordinate'
        : 'Zugangskoordinate';

      button.innerHTML = `
        <strong>${escapeHtml(record.label)}</strong>
        <small>${escapeHtml(coordinateInfo)} · ${record.latitude.toFixed(6)}, ${record.longitude.toFixed(6)}</small>
      `;

      button.addEventListener('click', () => selectAddress(record, 'bev'));
      suggestions.appendChild(button);
    });

    suggestions.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    $('addressSearchStatus').textContent = `${records.length} Vorschläge gefunden.`;
  } catch (error) {
    suggestions.hidden = true;
    $('addressSearchStatus').textContent = `Adresssuche fehlgeschlagen: ${error.message}`;
  }
}

function selectAddress(record, provider = 'bev') {
  selectedAddress = record;
  selectedAddressProvider = provider;
  buildingFeatures = [];
  selectedBuildingId = null;

  if (provider === 'bev') {
    $('addressSearchInput').value = record.label;
    $('addressSuggestions').hidden = true;
    $('addressSearchInput').setAttribute('aria-expanded', 'false');
  } else {
    $('tirisLiveAddressInput').value = record.label;
    $('tirisLiveAddressResults').hidden = true;
  }

  const sourceLabel = provider === 'tiris' ? 'TIRIS live' : 'BEV Fallback';
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
  setStatus($('buildingStatus'), 'bereit');
  setStatus($('terrainStatus'), 'bereit');

  resetBuildingOutput();
  resetTirisAddressLayerOutput();
  resetTerrainOutput();

  loadKatastralgemeinde(record);
  compareSelectedAddressWithBev(record);
}

function clearAddress() {
  selectedAddress = null;
  selectedAddressProvider = null;
  selectedKgResult = null;
  $('addressSearchInput').value = '';
  $('tirisLiveAddressInput').value = '';
  $('selectedAddressCard').hidden = true;
  $('liveAddressChecks').hidden = true;
  $('tirisLiveAddressResults').hidden = true;
  $('rawAddress').textContent = '–';
  $('rawTirisLiveAddress').textContent = '–';
  $('rawKg').textContent = '–';
  $('rawBevComparison').textContent = '–';
  $('loadBuildingButton').disabled = true;
  $('loadBuildingAreaButton').disabled = true;
  $('testTirisAddressLayersButton').disabled = true;
  $('loadTerrainButton').disabled = true;
  setStatus($('buildingStatus'), 'Adresse fehlt');
  setStatus($('terrainStatus'), 'Adresse fehlt');
  setStatus($('tirisLiveAddressStatus'), 'nicht geprüft');
  $('tirisParsedAddress').textContent = 'Noch keine Adresse zerlegt.';
  resetBuildingOutput();
  resetTirisAddressLayerOutput();
  resetTerrainOutput();
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
    selectBuilding(buildingFeatures[0].attributes?.OBJECTID);
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
    button.addEventListener('click', () => selectBuilding(attrs.OBJECTID));
    list.appendChild(button);
  });
}

function selectBuilding(objectId) {
  const feature = buildingFeatures.find(
    (item) => String(item.attributes?.OBJECTID) === String(objectId)
  );

  if (!feature) return;

  selectedBuildingId = feature.attributes?.OBJECTID;

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
  $('buildingResults').hidden = true;
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

function buildOrthophotoWmsUrl(minX, minY, maxX, maxY) {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: 'Image_Aktuell_RGB',
    STYLES: '',
    SRS: 'EPSG:4326',
    BBOX: `${minX},${minY},${maxX},${maxY}`,
    WIDTH: '1040',
    HEIGHT: '720',
    FORMAT: 'image/jpeg',
    TRANSPARENT: 'false',
  });
  return `${TIRIS_ORTHOPHOTO_WMS_URL}?${params.toString()}`;
}

function loadOrthophotoForBounds(minX, minY, maxX, maxY) {
  const image = $('orthophotoImage');
  const status = $('orthophotoStatus');
  const url = buildOrthophotoWmsUrl(minX, minY, maxX, maxY);

  $('rawOrthophoto').textContent = pretty({
    service: 'TIRIS Orthofoto WMS',
    layer: 'Image_Aktuell_RGB',
    bbox_wgs84: [minX, minY, maxX, maxY],
    request_url: url,
  });

  image.hidden = true;
  status.textContent = 'Orthofoto wird geladen …';
  image.onload = () => {
    image.hidden = false;
    status.textContent = 'TIRIS Orthofoto geladen · Polygon und Adresspunkt liegen darüber.';
  };
  image.onerror = () => {
    image.hidden = true;
    status.textContent = 'Orthofoto konnte nicht geladen werden – bitte Roh-URL / WMS prüfen.';
  };
  image.src = url;
}

function drawBuildingGeometry(features) {
  const svg = $('buildingSvg');
  svg.innerHTML = '';

  const allPoints = features.flatMap((feature) => geometryPoints(feature.geometry));

  if (selectedAddress) {
    allPoints.push([selectedAddress.longitude, selectedAddress.latitude]);
  }

  if (allPoints.length === 0) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '260');
    text.setAttribute('y', '180');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', '#526562');
    text.textContent = 'Keine Geometrie verfügbar';
    svg.appendChild(text);
    return;
  }

  const xs = allPoints.map((point) => Number(point[0]));
  const ys = allPoints.map((point) => Number(point[1]));
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  const xPad = Math.max((maxX - minX) * 0.18, 0.00008);
  const yPad = Math.max((maxY - minY) * 0.18, 0.00006);
  minX -= xPad;
  maxX += xPad;
  minY -= yPad;
  maxY += yPad;

  loadOrthophotoForBounds(minX, minY, maxX, maxY);

  const width = 520;
  const height = 360;

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
      const d = ring
        .map((point, index) => {
          const [x, y] = project(point);
          return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(' ') + ' Z';

      path.setAttribute('d', d);
      path.setAttribute('class', 'building-shape');
      path.dataset.objectId = objectId;
      path.addEventListener('click', () => selectBuilding(objectId));
      svg.appendChild(path);
    });
  });

  if (selectedAddress) {
    const [cx, cy] = project([selectedAddress.longitude, selectedAddress.latitude]);
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx.toFixed(2));
    circle.setAttribute('cy', cy.toFixed(2));
    circle.setAttribute('r', '6');
    circle.setAttribute('class', 'address-point');
    svg.appendChild(circle);
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
}

function editSelectedBuilding() {
  if (!selectedAddress) return;
  const radiusSelect = $('buildingRadius');
  if (Number(radiusSelect.value) < 30) radiusSelect.value = '30';
  loadBuildingArea().then(() => {
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
      throw new Error('Bestehendes location-core.js wurde nicht geladen.');
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

$('tirisLiveAddressInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    searchTirisLiveAddress();
  }
});
$('searchTirisLiveAddressButton').addEventListener('click', searchTirisLiveAddress);

$('addressSearchInput').addEventListener('input', () => {
  window.clearTimeout(addressSearchTimer);
  addressSearchTimer = window.setTimeout(runAddressSearch, 180);
});

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

$('year').textContent = String(new Date().getFullYear());

initAddressModule();
