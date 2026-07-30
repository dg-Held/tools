'use strict';

(function initStandortpassV1() {
  const store = window.EnergyToolsProjectStore;
  const model = window.EnergyToolsDataModel;
  const core = window.StandortpassCore;
  if (!store || !model || !core) return;

  const $ = (id) => document.getElementById(id);
  const clone = (value) => JSON.parse(JSON.stringify(value));

  let lastUiSignature = '';
  let reportRunning = false;
  let reportHasRun = false;
  let hydrationRunning = false;

  const reportSteps = [
    { key: 'building', label: 'Gebäude zuordnen', run: () => core.loadBuildings(), statusId: 'buildingStatus', retryId: 'buildingManualAction' },
    { key: 'terrain', label: 'Höhenlage prüfen', run: () => core.loadTerrain(), statusId: 'terrainStatus', retryId: 'terrainManualAction' },
    { key: 'solar', label: 'Sonnenbahn & Verschattung laden', run: () => core.loadSolar(), statusId: 'solarStatus', retryId: 'loadSolarButton', retryButton: true },
    { key: 'solarMap', label: 'Solarstrahlung im Umfeld laden', run: () => core.testSolarMap(), statusId: 'solarMapStatus', retryId: 'solarMapManualAction' },
    { key: 'environmentalHeat', label: 'Umweltwärme prüfen', run: () => core.testEnvironmentalHeat(), statusId: 'environmentalHeatStatus', retryId: 'environmentalHeatManualAction' },
    { key: 'hazards', label: 'Hochwasser & Naturgefahren prüfen', run: () => core.testHazards(), statusId: 'hazardStatus', retryId: 'hazardManualAction' },
    { key: 'heritage', label: 'Kultur & Schutzstatus prüfen', run: () => core.testHeritage(), statusId: 'heritageStatus', retryId: 'heritageManualAction' },
    { key: 'radon', label: 'Radonstatus prüfen', run: () => Promise.resolve(core.testRadon()), statusId: 'radonStatus', retryId: 'radonManualAction' },
  ];

  function text(id) {
    return $(id)?.textContent?.trim() || '';
  }

  function statusText(id) {
    return text(id).toLowerCase();
  }

  function field(value, options = {}) {
    return model.field(value ?? null, options);
  }

  function safeJson(id) {
    const raw = $(id)?.textContent?.trim();
    if (!raw || raw === '–') return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function compactAddressRecord(record) {
    if (!record) return null;
    const keys = [
      'label', 'postal_code', 'municipality', 'municipality_code', 'locality', 'street', 'house_number',
      'latitude', 'longitude', 'coordinate_kind', 'dataset_date', 'updated_at', 'address_code', 'subcode',
      'object_number', 'property', 'cadastral_municipality_number', 'cadastral_municipality_numbers',
      'source_id', 'tiris_layer_id', 'tiris_layer_label', 'license',
    ];
    const out = {};
    keys.forEach((key) => {
      if (record[key] !== undefined && record[key] !== null) out[key] = clone(record[key]);
    });
    return out;
  }

  function selectedBuildingShared(feature) {
    if (!feature) return null;
    const attrs = feature.attributes || {};
    const perimeter = Number(attrs.Shape__Length);
    const medianHeight = Number(attrs.GEB_HOEHE_MEDIAN);
    const wallRaw = Number.isFinite(perimeter) && Number.isFinite(medianHeight)
      ? perimeter * medianHeight
      : null;

    return {
      objectId: attrs.OBJECTID ?? null,
      municipalityCode: attrs.GEMNR ?? null,
      geometryWgs84: feature.geometry ? clone(feature.geometry) : null,
      roofProjection: field(Number.isFinite(Number(attrs.Shape__Area)) ? Number(attrs.Shape__Area) : null, {
        unit: 'm²', origin: model.ORIGIN.OFFICIAL, source: 'TIRIS Gebäude', method: 'Shape__Area',
      }),
      roofPerimeter: field(Number.isFinite(perimeter) ? perimeter : null, {
        unit: 'm', origin: model.ORIGIN.OFFICIAL, source: 'TIRIS Gebäude', method: 'Shape__Length',
      }),
      heightMedian: field(Number.isFinite(medianHeight) ? medianHeight : null, {
        unit: 'm', origin: model.ORIGIN.OFFICIAL, source: 'TIRIS Gebäude', method: 'GEB_HOEHE_MEDIAN',
      }),
      heightMax: field(Number.isFinite(Number(attrs.GEB_HOEHE_MAX)) ? Number(attrs.GEB_HOEHE_MAX) : null, {
        unit: 'm', origin: model.ORIGIN.OFFICIAL, source: 'TIRIS Gebäude', method: 'GEB_HOEHE_MAX',
      }),
      exteriorWallGrossOrienting: field(wallRaw, {
        unit: 'm²', origin: model.ORIGIN.DERIVED, source: 'Standortpass',
        method: 'Shape__Length × GEB_HOEHE_MEDIAN', quality: 'Orientierungswert',
        automaticValue: wallRaw,
      }),
      dataDate: attrs.STAND ?? null,
      updatedAtSource: attrs.UPDATETIMESTAMP ?? null,
    };
  }

  function compactSolarShared() {
    const raw = safeJson('rawSolar');
    const response = raw?.response;
    if (!response) return null;
    const monthly = response['sonnenstunden pro tag im monatsmittel'] || {};
    return {
      observerHeightM: Number(raw?.observer?.height) || null,
      observerMode: raw?.observer?.mode || raw?.observer?.source || null,
      dataBasis: response.datengrundlage ?? null,
      flightYear: response.flugjahr ?? null,
      serviceVersion: response.voibos ?? null,
      horizonCount: Array.isArray(response.horizont) ? response.horizont.length : null,
      monthlySunHours: {
        january: monthly.januar ?? null,
        march: monthly.maerz ?? null,
        june: monthly.juni ?? null,
        september: monthly.september ?? null,
        december: monthly.dezember ?? null,
      },
    };
  }


  const number0 = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 0 });

  function finiteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function roundToStep(value, step) {
    return Math.round(value / step) * step;
  }

  function parseInputValue(id) {
    const el = $(id);
    if (!el) return null;
    const raw = String(el.value ?? '').replace(',', '.').trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function setInputValue(id, value) {
    const el = $(id);
    if (!el) return;
    el.value = value === null || value === undefined || value === '' ? '' : String(value);
  }

  function formatArea(value) {
    return value === null ? '–' : `${number0.format(value)} m²`;
  }

  function formatVolume(value) {
    return value === null ? '–' : `${number0.format(value)} m³`;
  }

  function formatPitch(value) {
    return value === null ? '–' : `${number0.format(value)}°`;
  }

  function estimateFieldConfig() {
    return [
      { key: 'exteriorWall', autoId: 'autoExteriorWallValue', manualId: 'manualExteriorWallValue', effectiveId: 'effectiveExteriorWallValue', unit: 'm²', format: formatArea },
      { key: 'windowArea', autoId: 'autoWindowAreaValue', manualId: 'manualWindowAreaValue', effectiveId: 'effectiveWindowAreaValue', unit: 'm²', format: formatArea },
      { key: 'topFloorArea', autoId: 'autoTopFloorAreaValue', manualId: 'manualTopFloorAreaValue', effectiveId: 'effectiveTopFloorAreaValue', unit: 'm²', format: formatArea },
      { key: 'basementArea', autoId: 'autoBasementAreaValue', manualId: 'manualBasementAreaValue', effectiveId: 'effectiveBasementAreaValue', unit: 'm²', format: formatArea },
      { key: 'roofPitch', autoId: 'autoRoofPitchValue', manualId: 'manualRoofPitchValue', effectiveId: 'effectiveRoofPitchValue', unit: '°', format: formatPitch },
      { key: 'roofSlopeArea', autoId: 'autoRoofSlopeAreaValue', manualId: 'manualRoofSlopeAreaValue', effectiveId: 'effectiveRoofSlopeAreaValue', unit: 'm²', format: formatArea },
      { key: 'volume', autoId: 'autoVolumeValue', manualId: 'manualVolumeValue', effectiveId: 'effectiveVolumeValue', unit: 'm³', format: formatVolume },
    ];
  }

  function currentGeometryEstimates() {
    const feature = core.getSelectedBuilding();
    const attrs = feature?.attributes || {};
    const roofArea = finiteNumber(attrs.Shape__Area);
    const perimeter = finiteNumber(attrs.Shape__Length);
    const medianHeight = finiteNumber(attrs.GEB_HOEHE_MEDIAN);
    const windowShare = Math.max(0, Math.min(100, parseInputValue('windowSharePercent') ?? 20));

    const autoExteriorWall = perimeter !== null && medianHeight !== null ? roundToStep(perimeter * medianHeight, 10) : null;
    const autoTopFloor = roofArea !== null ? roundToStep(roofArea, 10) : null;
    const autoBasement = roofArea !== null ? roundToStep(roofArea, 10) : null;
    const autoWindowArea = autoExteriorWall !== null ? roundToStep((autoExteriorWall * windowShare) / 100, 5) : null;
    const effectiveRoofPitch = parseInputValue('manualRoofPitchValue');
    const autoRoofSlopeArea = roofArea !== null && effectiveRoofPitch !== null && effectiveRoofPitch >= 0 && effectiveRoofPitch < 89
      ? roundToStep(roofArea / Math.cos((effectiveRoofPitch * Math.PI) / 180), 10)
      : null;
    const autoVolume = roofArea !== null && medianHeight !== null ? roundToStep(roofArea * medianHeight, 10) : null;

    const auto = {
      exteriorWall: autoExteriorWall,
      windowArea: autoWindowArea,
      topFloorArea: autoTopFloor,
      basementArea: autoBasement,
      roofPitch: null,
      roofSlopeArea: autoRoofSlopeArea,
      volume: autoVolume,
    };

    const result = { windowSharePercent: windowShare, fields: {} };
    estimateFieldConfig().forEach((config) => {
      const manual = parseInputValue(config.manualId);
      const automatic = auto[config.key] ?? null;
      result.fields[config.key] = {
        automatic,
        manual,
        effective: manual ?? automatic,
        unit: config.unit,
        source: manual !== null ? 'manual' : 'automatic',
      };
    });
    return result;
  }

  function renderGeometryEstimates() {
    const data = currentGeometryEstimates();
    estimateFieldConfig().forEach((config) => {
      const item = data.fields[config.key];
      if ($(config.autoId)) $(config.autoId).textContent = config.key === 'roofPitch' ? '–' : config.format(item.automatic);
      const effective = $(config.effectiveId);
      if (effective) {
        effective.textContent = config.format(item.effective);
        effective.classList.remove('estimate-used', 'is-manual', 'is-auto');
        if (item.effective !== null) effective.classList.add('estimate-used', item.source === 'manual' ? 'is-manual' : 'is-auto');
      }
    });
  }

  function geometryEstimatesShared() {
    const data = currentGeometryEstimates();
    const out = { windowSharePercent: data.windowSharePercent, updatedAt: new Date().toISOString() };
    Object.entries(data.fields).forEach(([key, item]) => {
      out[key] = clone(item);
    });
    return out;
  }

  function restoreGeometryEstimates(saved) {
    if (!saved) return;
    setInputValue('windowSharePercent', saved.windowSharePercent ?? 20);
    const mapping = {
      exteriorWall: 'manualExteriorWallValue',
      windowArea: 'manualWindowAreaValue',
      topFloorArea: 'manualTopFloorAreaValue',
      basementArea: 'manualBasementAreaValue',
      roofPitch: 'manualRoofPitchValue',
      roofSlopeArea: 'manualRoofSlopeAreaValue',
      volume: 'manualVolumeValue',
    };
    Object.entries(mapping).forEach(([key, id]) => setInputValue(id, saved[key]?.manual ?? null));
    renderGeometryEstimates();
  }

  function resetGeometryEstimatesInputs() {
    setInputValue('windowSharePercent', 20);
    ['manualExteriorWallValue', 'manualWindowAreaValue', 'manualTopFloorAreaValue', 'manualBasementAreaValue', 'manualRoofPitchValue', 'manualRoofSlopeAreaValue', 'manualVolumeValue']
      .forEach((id) => setInputValue(id, null));
    renderGeometryEstimates();
  }

  function effectiveEstimateText(key, fallback = '–') {
    const ids = {
      exteriorWall: 'effectiveExteriorWallValue',
      windowArea: 'effectiveWindowAreaValue',
      topFloorArea: 'effectiveTopFloorAreaValue',
      basementArea: 'effectiveBasementAreaValue',
      roofPitch: 'effectiveRoofPitchValue',
      roofSlopeArea: 'effectiveRoofSlopeAreaValue',
      volume: 'effectiveVolumeValue',
    };
    const value = text(ids[key]);
    return value && value !== '–' ? value : fallback;
  }

  function syncProjectFromUi() {
    const addressRecord = core.getSelectedAddress();
    const buildingFeature = core.getSelectedBuilding();
    const terrainRaw = safeJson('rawTerrain');
    const addressLabel = addressRecord?.label || '';

    const uiSignature = JSON.stringify({
      addressLabel,
      buildingId: buildingFeature?.attributes?.OBJECTID ?? null,
      addressStatus: statusText('tirisLiveAddressStatus'),
      buildingStatus: statusText('buildingStatus'),
      terrainStatus: statusText('terrainStatus'),
      solarStatus: statusText('solarStatus'),
      solarMapStatus: statusText('solarMapStatus'),
      environmentalHeatStatus: statusText('environmentalHeatStatus'),
      hazardsStatus: statusText('hazardStatus'),
      heritageStatus: statusText('heritageStatus'),
      radonStatus: statusText('radonStatus'),
      terrainHeight: terrainRaw?.elevation_m ?? null,
      reportStatus: statusText('reportRunStatus'),
      windowSharePercent: parseInputValue('windowSharePercent') ?? 20,
      geometryEstimateManuals: estimateFieldConfig().map((config) => parseInputValue(config.manualId)),
    });
    if (uiSignature === lastUiSignature) return;
    lastUiSignature = uiSignature;

    const locationPatch = addressRecord ? {
      address: field(addressLabel, {
        origin: model.ORIGIN.OFFICIAL,
        source: String(addressRecord.tiris_layer_label || '').includes('TIRIS') || addressRecord.tiris_layer_id ? 'TIRIS ogd_basis' : 'Adressquelle',
        dataDate: addressRecord.dataset_date ?? null,
      }),
      latitude: field(Number(addressRecord.latitude), { unit: '°', origin: model.ORIGIN.OFFICIAL, source: 'TIRIS/BEV Adresse' }),
      longitude: field(Number(addressRecord.longitude), { unit: '°', origin: model.ORIGIN.OFFICIAL, source: 'TIRIS/BEV Adresse' }),
      municipality: field(addressRecord.municipality ?? null, { origin: model.ORIGIN.OFFICIAL, source: 'TIRIS/BEV Adresse' }),
      municipalityCode: field(addressRecord.municipality_code ?? null, { origin: model.ORIGIN.OFFICIAL, source: 'TIRIS/BEV Adresse' }),
      cadastralMunicipalityNumber: field(addressRecord.cadastral_municipality_number ?? null, { origin: model.ORIGIN.OFFICIAL, source: 'TIRIS ogd_basis' }),
      addressRecord: compactAddressRecord(addressRecord),
      metadataText: text('selectedAddressMeta'),
    } : {};

    if (terrainRaw && Number.isFinite(Number(terrainRaw.elevation_m))) {
      locationPatch.elevation = field(Number(terrainRaw.elevation_m), {
        unit: 'm ü. A.', origin: model.ORIGIN.OFFICIAL,
        source: terrainRaw.source || 'TIRIS DGM', method: terrainRaw.layer_name || terrainRaw.layer_id || null,
      });
    }

    const modulePatch = {
      addressStatus: statusText('tirisLiveAddressStatus'),
      buildingStatus: statusText('buildingStatus'),
      terrainStatus: statusText('terrainStatus'),
      solarStatus: statusText('solarStatus'),
      solarMapStatus: statusText('solarMapStatus'),
      environmentalHeatStatus: statusText('environmentalHeatStatus'),
      hazardsStatus: statusText('hazardStatus'),
      heritageStatus: statusText('heritageStatus'),
      radonStatus: statusText('radonStatus'),
      reportStatus: statusText('reportRunStatus'),
      solar: compactSolarShared(),
      geometryEstimates: geometryEstimatesShared(),
      updatedAt: new Date().toISOString(),
    };

    store.patch({
      project: addressRecord ? { addressLabel } : {},
      location: locationPatch,
      building: buildingFeature ? selectedBuildingShared(buildingFeature) : {},
      modules: { standortpass: modulePatch },
    });

    renderOverview();
  }

  function resultCard(label, status, detail, tone = 'neutral') {
    return `<article class="overview-result overview-result--${tone}">
      <span>${label}</span><strong>${status}</strong><small>${detail}</small>
    </article>`;
  }

  function toneFromStatus(status) {
    if (/fehler|fehlgeschlagen|nicht verfügbar|offen/.test(status)) return 'warning';
    if (/erfolgreich|fertig|gefunden|geprüft|bereit|ja|raster/.test(status)) return 'success';
    return 'neutral';
  }

  function solarOverviewStatus() {
    const profile = text('solarStatus') || 'offen';
    const map = text('solarMapStatus') || 'offen';
    if (/fehler/i.test(profile) || /fehler/i.test(map)) return 'teilweise';
    if (/erfolgreich/i.test(profile) && /raster bereit|erfolgreich/i.test(map)) return 'erfolgreich';
    return profile;
  }

  function renderOverview() {
    const overview = $('projectOverviewGrid');
    if (!overview) return;
    const items = [
      ['Bericht', text('reportRunStatus') || 'offen', reportHasRun ? 'Automatischer Prüflauf wurde ausgeführt.' : 'Nach Adressauswahl mit einem Klick erstellen.'],
      ['Standort', text('tirisLiveAddressStatus') || 'offen', text('selectedAddressLabel') || 'Adresse noch nicht gewählt'],
      ['Gebäude', text('buildingStatus') || 'offen', text('buildingMatchInfo') || 'Gebäude noch nicht geprüft'],
      ['Solar', solarOverviewStatus(), 'Sonnenbahn, Verschattung und Jahressolarstrahlung'],
      ['Umweltwärme', text('environmentalHeatStatus') || 'offen', 'Erdsonden, Grundwasser und wasserrechtliche Hinweise'],
      ['Naturgefahren', text('hazardStatus') || 'offen', 'HQ30/HQ100/HQ300 und TIRIS-Gefahrenhinweise'],
      ['Schutz & Radon', `${text('heritageStatus') || 'offen'} · ${text('radonStatus') || 'offen'}`, 'Denkmalschutz, Kulturkontext und Radonstatus'],
      ['Wärmenetz', 'TIRIS-Check', 'Automatische Schnittstelle noch in Klärung; Link folgt der Projektadresse.'],
    ];
    overview.innerHTML = items.map(([label, status, detail]) => resultCard(label, status, detail, toneFromStatus(status.toLowerCase()))).join('');
  }

  function setReportStatus(label, state = 'muted') {
    const chip = $('reportRunStatus');
    if (!chip) return;
    chip.textContent = label;
    chip.classList.remove('is-working', 'is-error', 'is-success', 'status-chip--muted');
    if (state === 'working') chip.classList.add('is-working');
    else if (state === 'error') chip.classList.add('is-error');
    else if (state === 'success') chip.classList.add('is-success');
    else chip.classList.add('status-chip--muted');
  }

  function setProgress(index, total, label) {
    const box = $('reportProgress');
    if (!box) return;
    box.hidden = false;
    const pct = total ? Math.max(0, Math.min(100, (index / total) * 100)) : 0;
    $('reportProgressBar').style.width = `${pct}%`;
    $('reportProgressText').textContent = label;
  }

  function setRetry(step, show) {
    const element = $(step.retryId);
    if (!element) return;
    element.classList.toggle('is-retry', Boolean(show));
  }

  function stepFailed(step) {
    const status = statusText(step.statusId);
    return /fehler|fehlgeschlagen|gkz fehlt/.test(status);
  }

  function buildingNeedsManualChoice() {
    return !core.getSelectedBuilding() && document.querySelectorAll('#buildingCandidateList .candidate-button').length > 0;
  }

  async function updateLocationLinks() {
    const heatLink = $('heatTirisLink');
    if (!heatLink || !core.getSelectedAddress()) return;
    heatLink.href = await core.getTirisMapUrl(500);
  }

  async function runFullReport(options = {}) {
    if (reportRunning || !core.getSelectedAddress()) return;
    reportRunning = true;
    const button = $('runReportButton');
    button.disabled = true;
    button.textContent = 'Bericht wird erstellt …';
    setReportStatus('läuft …', 'working');
    $('reportRunMessage').textContent = 'Die Standortprüfungen werden nacheinander ausgeführt. Fehlgeschlagene Einzelprüfungen können anschließend direkt im jeweiligen Block wiederholt werden.';
    reportSteps.forEach((step) => setRetry(step, false));

    let errors = 0;
    for (let index = 0; index < reportSteps.length; index += 1) {
      const step = reportSteps[index];
      setProgress(index, reportSteps.length, `${index + 1}/${reportSteps.length} · ${step.label} …`);
      try {
        await step.run();
      } catch (error) {
        console.warn(`Standortpass-Schritt ${step.key} fehlgeschlagen.`, error);
        errors += 1;
      }
      if (stepFailed(step)) {
        errors += 1;
        setRetry(step, true);
      }
      if (step.key === 'building' && buildingNeedsManualChoice()) {
        setRetry(step, true);
      }
      syncProjectFromUi();
    }

    await updateLocationLinks();
    setProgress(reportSteps.length, reportSteps.length, 'Prüflauf abgeschlossen.');

    const manualBuilding = buildingNeedsManualChoice();
    reportHasRun = true;
    if (errors || manualBuilding) {
      setReportStatus('teilweise fertig', 'muted');
      $('reportRunMessage').textContent = manualBuilding
        ? 'Bericht erstellt. Die Gebäudeauswahl ist noch offen; nach der Auswahl bitte „Bericht aktualisieren“ verwenden.'
        : 'Bericht erstellt. Mindestens eine Einzelprüfung konnte nicht abgeschlossen werden; dort ist „erneut prüfen“ eingeblendet.';
    } else {
      setReportStatus('fertig', 'success');
      $('reportRunMessage').textContent = 'Alle automatisch verfügbaren Standortprüfungen wurden abgeschlossen.';
    }

    button.disabled = false;
    button.textContent = 'Bericht aktualisieren';
    reportRunning = false;

    store.patch({ modules: { standortpass: {
      reportGeneratedAt: new Date().toISOString(),
      reportStatus: text('reportRunStatus'),
      reportNeedsBuildingChoice: manualBuilding,
    } } });
    buildPrintSummary();
    renderOverview();
  }

  function compactCards(containerId, maxItems = 4) {
    const root = $(containerId);
    if (!root || root.hidden) return [];
    return [...root.querySelectorAll('.environment-card')]
      .slice(0, maxItems)
      .map((card) => {
        const label = card.querySelector('span')?.textContent?.trim() || '';
        const value = card.querySelector('strong')?.textContent?.trim() || '';
        return label && value ? `${label}: ${value}` : value || label;
      })
      .filter(Boolean);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('\"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function listHtml(items, fallback = 'Noch nicht geprüft.') {
    if (!items.length) return `<p>${escapeHtml(fallback)}</p>`;
    return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  function compactCardsDetailed(containerId, maxItems = 4) {
    const root = $(containerId);
    if (!root || root.hidden) return [];
    return [...root.querySelectorAll('.environment-card')]
      .slice(0, maxItems)
      .map((card) => ({
        label: card.querySelector('span')?.textContent?.trim() || '',
        value: card.querySelector('strong')?.textContent?.trim() || '',
        note: card.querySelector('small')?.textContent?.trim() || '',
      }))
      .filter((item) => item.label || item.value || item.note);
  }

  function detailedListHtml(items, fallback = 'Noch nicht geprüft.') {
    if (!items.length) return `<p>${escapeHtml(fallback)}</p>`;
    return `<ul>${items.map((item) => `<li><strong>${escapeHtml(item.label)}</strong>: ${escapeHtml(item.value)}${item.note ? ` <small>(${escapeHtml(item.note)})</small>` : ''}</li>`).join('')}</ul>`;
  }

  function printMiniGridHtml(items) {
    return `<div class="print-mini-grid">${items.filter((item) => item && item.value && item.value !== '–').map((item) => `<div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join('')}</div>`;
  }

  function buildPrintSummary() {
    renderGeometryEstimates();
    const grid = $('printReportGrid');
    if (!grid) return;

    const buildingMetrics = [
      { label: 'Höhenlage', value: text('terrainHeight') },
      { label: 'Dachprojektion', value: text('metricAreaRounded') },
      { label: 'Gebäudehöhe Median', value: text('metricHeightMedian') },
      { label: 'Außenwandfläche', value: effectiveEstimateText('exteriorWall') },
      { label: 'Fensterfläche', value: effectiveEstimateText('windowArea') },
      { label: 'Oberste Geschoßfläche', value: effectiveEstimateText('topFloorArea') },
      { label: 'Kellerdecke / UG-Fläche', value: effectiveEstimateText('basementArea') },
      { label: 'Dachneigung', value: effectiveEstimateText('roofPitch', '') },
      { label: 'Dachschrägefläche', value: effectiveEstimateText('roofSlopeArea', '') },
      { label: 'Gebäudevolumen', value: effectiveEstimateText('volume', '') },
    ];

    const heat = compactCardsDetailed('environmentalHeatResult', 6);
    heat.unshift({ label: 'Wärmenetz', value: 'direkter TIRIS-Check am Projektstandort', note: 'Link folgt der ausgewählten Adresse' });

    const solarMeta = [
      { label: 'Bezugshöhe', value: text('solarChartHeight') },
      ...[...document.querySelectorAll('#solarResult .solar-month-grid > div')].map((item) => ({
        label: item.querySelector('span')?.textContent?.trim() || '',
        value: item.querySelector('strong')?.textContent?.trim() || '',
      })),
    ];

    const chart = !$('solarChartCard')?.hidden && $('solarChart')?.childElementCount
      ? `<div class="print-solar-chart">${$('solarChart').outerHTML.replace('id="solarChart"', '')}</div>${$('solarChartCard')?.querySelector('.solar-legend')?.outerHTML || ''}`
      : '';

    const orthoSrc = $('orthophotoImage')?.getAttribute('src') || '';
    const solarSrc = document.querySelector('#solarMapResult .solar-map-preview')?.getAttribute('src') || '';
    const mediaItems = [];
    if (orthoSrc) mediaItems.push(`<div class="print-media-item"><img src="${escapeHtml(orthoSrc)}" alt="Orthofoto des Projektstandorts"><small>Orthofoto + TIRIS-Gebäudepolygon</small></div>`);
    if (solarSrc) mediaItems.push(`<div class="print-media-item"><img src="${escapeHtml(solarSrc)}" alt="Solarstrahlung im Standortumfeld"><small>Solarstrahlung im Standortumfeld · Image Jahressumme</small></div>`);
    const mediaHtml = mediaItems.length ? `<article class="print-summary-card print-summary-card--wide"><h2>Karten</h2><div class="print-media-grid">${mediaItems.join('')}</div></article>` : '';

    const riskItems = [
      ...[...document.querySelectorAll('#hazardResult .environment-card')].map((card) => ({
        label: card.querySelector('span')?.textContent?.trim() || '',
        value: card.querySelector('strong')?.textContent?.trim() || '',
        note: card.querySelector('small')?.textContent?.trim() || '',
        hit: card.classList.contains('hazard-card--hit'),
      })),
      ...[...document.querySelectorAll('#heritageResult .environment-card')].slice(0, 2).map((card) => ({
        label: card.querySelector('span')?.textContent?.trim() || '',
        value: card.querySelector('strong')?.textContent?.trim() || '',
        note: card.querySelector('small')?.textContent?.trim() || '',
        hit: card.classList.contains('hazard-card--hit'),
      })),
      ...[...document.querySelectorAll('#radonResult .environment-card')].map((card) => ({
        label: card.querySelector('span')?.textContent?.trim() || '',
        value: card.querySelector('strong')?.textContent?.trim() || '',
        note: card.querySelector('small')?.textContent?.trim() || '',
        hit: card.classList.contains('environment-card--notice'),
      })),
    ].filter((item) => item.label || item.value);

    const riskHtml = riskItems.length
      ? `<div class="print-risk-list">${riskItems.map((item) => `<div class="print-risk-item ${item.hit ? 'print-risk-item--hit' : ''}"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.value)}</span>${item.note ? `<small>${escapeHtml(item.note)}</small>` : ''}</div>`).join('')}</div>`
      : '<p>Noch nicht geprüft.</p>';

    grid.innerHTML = `
      <article class="print-summary-card">
        <h2>Gebäude & Standort</h2>
        ${printMiniGridHtml(buildingMetrics)}
      </article>
      <article class="print-summary-card">
        <h2>Wärmeversorgung</h2>
        ${detailedListHtml(heat)}
      </article>
      ${mediaHtml}
      <article class="print-summary-card print-summary-card--wide">
        <h2>Solar</h2>
        ${printMiniGridHtml(solarMeta)}
        ${chart}
      </article>
      <article class="print-summary-card print-summary-card--wide">
        <h2>Standort & Risiken</h2>
        ${riskHtml}
      </article>`;
  }

  function resetReportUi() {
    reportHasRun = false;
    reportRunning = false;
    setReportStatus('Adresse fehlt');
    const button = $('runReportButton');
    button.disabled = true;
    button.textContent = 'Bericht erstellen';
    $('reportRunMessage').textContent = 'Nach der Adressauswahl werden Gebäude, Höhenlage, Solar, Umweltwärme, Naturgefahren, Schutzstatus und Radon nacheinander geprüft.';
    $('reportProgress').hidden = true;
    $('reportProgressBar').style.width = '0%';
    reportSteps.forEach((step) => setRetry(step, false));
    $('printReportGrid').innerHTML = '';
    resetGeometryEstimatesInputs();
    renderOverview();
  }

  async function hydrateProject(projectState, options = {}) {
    if (hydrationRunning || !projectState) return;
    hydrationRunning = true;
    try {
      core.clearAddress();
      const record = projectState.location?.addressRecord;
      const label = projectState.project?.addressLabel || projectState.location?.address?.value || '';
      let restored = false;
      if (record?.latitude !== undefined && record?.longitude !== undefined) {
        restored = core.selectAddressRecord(record, 'tiris-project-import');
      } else if (label) {
        restored = await core.searchAndSelectAddress(label);
      }
      if (!restored && label) {
        $('tirisLiveAddressInput').value = label;
        $('reportRunMessage').textContent = 'Projektadresse übernommen. Bitte die Adresse einmal suchen und bestätigen, da im älteren Projekt keine Koordinate gespeichert war.';
      }
      restoreGeometryEstimates(projectState.modules?.standortpass?.geometryEstimates);
      if (restored && options.autoRun) await runFullReport({ source: 'import' });
    } finally {
      hydrationRunning = false;
    }
  }

  window.addEventListener('standortpass:address-selected', async (event) => {
    const record = event.detail?.record;
    if (record) {
      // Neuer Standort = keine alten standortabhängigen Ergebnisse weiterverwenden.
      store.setPath('location', { addressRecord: compactAddressRecord(record) });
      store.setPath('building', {});
      store.setPath('modules.standortpass', {});
      store.setPath('project.addressLabel', record.label || '');
    }
    reportHasRun = false;
    $('reportProgress').hidden = true;
    $('reportProgressBar').style.width = '0%';
    const button = $('runReportButton');
    button.disabled = false;
    button.textContent = 'Bericht erstellen';
    setReportStatus('bereit', 'success');
    $('reportRunMessage').textContent = 'Standort ist gewählt. Mit „Bericht erstellen“ werden alle verfügbaren Prüfungen automatisch nacheinander ausgeführt.';
    resetGeometryEstimatesInputs();
    await updateLocationLinks();
    syncProjectFromUi();
  });

  window.addEventListener('standortpass:address-cleared', () => {
    if (!hydrationRunning) {
      store.setPath('project.addressLabel', '');
      store.setPath('location', {});
      store.setPath('building', {});
      store.setPath('modules.standortpass', {});
    }
    resetReportUi();
  });

  window.addEventListener('standortpass:kg-loaded', (event) => {
    const number = event.detail?.number;
    const name = event.detail?.name;
    if (number !== undefined && number !== null) {
      store.setPath('location.cadastralMunicipalityNumber', field(String(number), { origin: model.ORIGIN.OFFICIAL, source: 'TIRIS ogd_basis' }));
    }
    if (name) store.setPath('location.cadastralMunicipalityName', field(name, { origin: model.ORIGIN.OFFICIAL, source: 'TIRIS ogd_basis' }));
    syncProjectFromUi();
  });

  window.addEventListener('standortpass:building-selected', (event) => {
    const feature = event.detail?.feature;
    if (feature) store.setPath('building', selectedBuildingShared(feature));
    renderGeometryEstimates();
    if (reportHasRun && !reportRunning) {
      setReportStatus('aktualisieren');
      $('runReportButton').textContent = 'Bericht aktualisieren';
      $('reportRunMessage').textContent = 'Gebäudeauswahl geändert. Solar- und Risikoprüfung sollten mit „Bericht aktualisieren“ neu berechnet werden.';
    }
    syncProjectFromUi();
  });

  window.addEventListener('standortpass:building-cleared', () => {
    store.setPath('building', {});
    renderGeometryEstimates();
    syncProjectFromUi();
  });

  window.addEventListener('energy-tools:project-reset', () => {
    hydrationRunning = true;
    try { core.clearAddress(); } finally { hydrationRunning = false; }
    resetReportUi();
  });

  window.addEventListener('energy-tools:project-imported', (event) => {
    hydrateProject(event.detail?.project, { autoRun: true });
  });

  window.addEventListener('energy-tools:prepare-print', buildPrintSummary);

  $('runReportButton')?.addEventListener('click', () => runFullReport());
  $('printReportButtonBottom')?.addEventListener('click', () => {
    buildPrintSummary();
    window.requestAnimationFrame(() => window.print());
  });

  ['windowSharePercent', 'manualExteriorWallValue', 'manualWindowAreaValue', 'manualTopFloorAreaValue', 'manualBasementAreaValue', 'manualRoofPitchValue', 'manualRoofSlopeAreaValue', 'manualVolumeValue'].forEach((id) => {
    $(id)?.addEventListener('input', () => {
      renderGeometryEstimates();
      buildPrintSummary();
      syncProjectFromUi();
    });
  });

  const observer = new MutationObserver(() => {
    window.clearTimeout(observer.timer);
    observer.timer = window.setTimeout(syncProjectFromUi, 140);
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'hidden'],
  });

  renderGeometryEstimates();
  renderOverview();
  syncProjectFromUi();

  // Persistierte Projekte stellen zunächst den Standort wieder her. Automatische
  // Fremdabfragen starten erst bei Import oder auf expliziten Klick „Bericht erstellen“.
  const initial = store.get();
  if (initial.project?.addressLabel || initial.location?.addressRecord) {
    hydrateProject(initial, { autoRun: false });
  } else {
    resetReportUi();
  }
})();
