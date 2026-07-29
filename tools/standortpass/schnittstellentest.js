'use strict';

/* =========================================================
   STANDORTPASS – SCHNITTSTELLENTEST 01

   Testet bewusst nur:
   1) bestehendes BEV-Adressmodul
   2) TIRIS BASIS Service-Metadaten
   3) TIRIS Gebäude FeatureServer
   4) bestehende TIRIS-DGM-Höhenfunktion

   Noch KEINE freigegebene Standortpass-Berechnungslogik.
========================================================= */

const $ = (id) => document.getElementById(id);

const TIRIS_BASIS_URL =
  'https://gis.tirol.gv.at/arcgis/rest/services/' +
  'Service_Public/ogd_basis/MapServer';

const TIRIS_BUILDING_QUERY_URL =
  'https://services3.arcgis.com/hG7UfxX49PQ8XkXh/' +
  'arcgis/rest/services/Gebaeude/FeatureServer/0/query';

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
   1. Bestehendes BEV-Adressmodul
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

    setStatus(status, 'BEV bereit', 'success');
    $('addressSearchStatus').textContent =
      `${number0.format(info.address_count)} Adressen · Stand ${info.dataset_date ?? '–'}`;
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

      button.addEventListener('click', () => selectAddress(record));
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

function selectAddress(record) {
  selectedAddress = record;
  buildingFeatures = [];
  selectedBuildingId = null;

  $('addressSearchInput').value = record.label;
  $('addressSuggestions').hidden = true;
  $('addressSearchInput').setAttribute('aria-expanded', 'false');

  $('selectedAddressLabel').textContent = record.label;
  $('selectedAddressMeta').textContent =
    `${record.latitude.toFixed(6)}, ${record.longitude.toFixed(6)} · ` +
    `${record.coordinate_kind === 'building' ? 'Gebäudekoordinate' : 'Zugangskoordinate'} · ` +
    `BEV ${record.dataset_date ?? '–'}`;
  $('selectedAddressCard').hidden = false;

  $('rawAddress').textContent = pretty(record);

  $('loadBuildingButton').disabled = false;
  $('loadTerrainButton').disabled = false;
  setStatus($('buildingStatus'), 'bereit');
  setStatus($('terrainStatus'), 'bereit');

  resetBuildingOutput();
  resetTerrainOutput();
}

function clearAddress() {
  selectedAddress = null;
  $('addressSearchInput').value = '';
  $('selectedAddressCard').hidden = true;
  $('rawAddress').textContent = '–';
  $('loadBuildingButton').disabled = true;
  $('loadTerrainButton').disabled = true;
  setStatus($('buildingStatus'), 'Adresse fehlt');
  setStatus($('terrainStatus'), 'Adresse fehlt');
  resetBuildingOutput();
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
   3. TIRIS Gebäude FeatureServer
--------------------------------------------------------- */

function buildBuildingQueryUrl(address, radiusM) {
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
    outFields: BUILDING_FIELDS,
    returnGeometry: 'true',
    outSR: '4326',
    returnZ: 'false',
    returnM: 'false',
  });

  return `${TIRIS_BUILDING_QUERY_URL}?${params.toString()}`;
}

async function loadBuildings() {
  if (!selectedAddress) return;

  const status = $('buildingStatus');
  const radius = Number($('buildingRadius').value) || 30;

  setStatus(status, 'lädt …', 'working');
  resetBuildingOutput(false);

  try {
    const url = buildBuildingQueryUrl(selectedAddress, radius);
    const payload = await fetchJson(url);
    $('rawBuildings').textContent = pretty({ request_url: url, response: payload });

    buildingFeatures = Array.isArray(payload.features) ? payload.features : [];

    if (buildingFeatures.length === 0) {
      setStatus(status, 'kein Treffer', 'error');
      $('buildingResults').hidden = false;
      $('buildingCandidateList').innerHTML =
        '<p class="field-status">Im gewählten Radius wurde kein Gebäude geliefert. Radius erhöhen oder Koordinate prüfen.</p>';
      drawBuildingGeometry([]);
      return;
    }

    buildingFeatures = buildingFeatures
      .map((feature) => ({
        ...feature,
        _distance: approximateFeatureDistance(feature, selectedAddress),
      }))
      .sort((a, b) => a._distance - b._distance);

    renderBuildingCandidates();
    drawBuildingGeometry(buildingFeatures);
    $('buildingResults').hidden = false;

    setStatus(
      status,
      buildingFeatures.length === 1 ? '1 Gebäude' : `${buildingFeatures.length} Gebäude`,
      'success'
    );

    if (buildingFeatures.length === 1) {
      selectBuilding(buildingFeatures[0].attributes?.OBJECTID);
    }
  } catch (error) {
    $('rawBuildings').textContent = pretty({ error: error.message });
    setStatus(status, 'Fehler', 'error');
    $('buildingResults').hidden = false;
    $('buildingCandidateList').innerHTML =
      `<p class="field-status">Gebäudeabruf fehlgeschlagen: ${escapeHtml(error.message)}</p>`;
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

  const plausibleMedian =
    medianHeight !== null && medianHeight >= 2.5 && medianHeight <= 60;

  if (length !== null && plausibleMedian) {
    const wallRaw = length * medianHeight;
    $('wallPreview').textContent =
      `Brutto-Außenwand testweise ca. ${number0.format(roundTo(wallRaw, 10))} m²`;
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
  $('buildingSvg').innerHTML = '';
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

$('addressSearchInput').addEventListener('input', () => {
  window.clearTimeout(addressSearchTimer);
  addressSearchTimer = window.setTimeout(runAddressSearch, 180);
});

$('clearAddressButton').addEventListener('click', clearAddress);
$('testBasisButton').addEventListener('click', testBasisService);
$('loadBuildingButton').addEventListener('click', loadBuildings);
$('loadTerrainButton').addEventListener('click', loadTerrain);

$('year').textContent = String(new Date().getFullYear());

initAddressModule();
