'use strict';

(function initStandortpassV1() {
  const store = window.EnergyToolsProjectStore;
  const model = window.EnergyToolsDataModel;
  if (!store || !model) return;
  const $ = (id) => document.getElementById(id);

  function text(id) {
    return $(id)?.textContent?.trim() || '';
  }

  function statusText(id) {
    return text(id).toLowerCase();
  }

  function field(value, options = {}) {
    return model.field(value || null, options);
  }

  let lastUiSignature = '';

  function syncProjectFromUi() {
    const addressLabel = text('selectedAddressLabel');
    const addressMeta = text('selectedAddressMeta');
    const hasAddress = addressLabel && addressLabel !== '–';

    const locationPatch = hasAddress ? {
      address: field(addressLabel, {
        origin: model.ORIGIN.OFFICIAL,
        source: addressMeta.includes('TIRIS') ? 'TIRIS ogd_basis' : 'BEV Fallback',
      }),
      metadataText: addressMeta,
      cadastralMunicipalityText: text('kgResult'),
    } : {};

    const selectedBuilding = document.querySelector('.selected-building-card, .building-selected-card, .selected-card--building');
    const buildingResult = $('selectedBuildingResult') || $('selectedBuildingInfo');
    const buildingText = buildingResult?.textContent?.trim() || selectedBuilding?.textContent?.trim() || '';

    const uiSignature = JSON.stringify({ addressLabel, addressMeta, buildingText,
      addressStatus: statusText('tirisLiveAddressStatus'), buildingStatus: statusText('buildingStatus'),
      terrainStatus: statusText('terrainStatus'), solarStatus: statusText('solarStatus'),
      environmentalHeatStatus: statusText('environmentalHeatStatus'), hazardsStatus: statusText('hazardStatus'),
      heritageStatus: statusText('heritageStatus'), radonStatus: statusText('radonStatus') });
    if (uiSignature === lastUiSignature) return;
    lastUiSignature = uiSignature;

    const modulePatch = {
      addressStatus: statusText('tirisLiveAddressStatus'),
      buildingStatus: statusText('buildingStatus'),
      terrainStatus: statusText('terrainStatus'),
      solarStatus: statusText('solarStatus'),
      environmentalHeatStatus: statusText('environmentalHeatStatus'),
      hazardsStatus: statusText('hazardStatus'),
      heritageStatus: statusText('heritageStatus'),
      radonStatus: statusText('radonStatus'),
      updatedAt: new Date().toISOString(),
    };

    store.patch({
      project: hasAddress ? { addressLabel } : {},
      location: locationPatch,
      building: buildingText ? {
        summaryText: buildingText,
        origin: model.ORIGIN.OFFICIAL,
        source: 'TIRIS Gebäude',
      } : {},
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
    if (/fehler|nicht verfügbar/.test(status)) return 'warning';
    if (/erfolgreich|fertig|gefunden|ja|erkundet/.test(status)) return 'success';
    return 'neutral';
  }

  function renderOverview() {
    const overview = $('projectOverviewGrid');
    if (!overview) return;
    const items = [
      ['Standort', text('tirisLiveAddressStatus') || 'offen', text('selectedAddressLabel') || 'Adresse noch nicht gewählt'],
      ['Gebäude', text('buildingStatus') || 'offen', text('buildingMatchInfo') || 'Gebäude noch nicht geprüft'],
      ['Solar', text('solarStatus') || 'offen', 'Sonnenbahn, Gelände- und Objektverschattung'],
      ['Umweltwärme', text('environmentalHeatStatus') || 'offen', 'Erdsonden, Grundwasser und wasserrechtliche Hinweise'],
      ['Naturgefahren', text('hazardStatus') || 'offen', 'HQ30/HQ100/HQ300 und TIRIS-Gefahrenhinweise'],
      ['Schutzstatus', text('heritageStatus') || 'offen', 'BDA-Liste, Kunstkataster und Archäologie'],
      ['Radon', text('radonStatus') || 'offen', 'Vorsorge- und Schutzgebietsstatus'],
      ['Wärmenetz', 'manueller TIRIS-Check', 'Öffentliche Programmierschnittstelle angefragt'],
    ];
    overview.innerHTML = items.map(([label, status, detail]) => resultCard(label, status, detail, toneFromStatus(status.toLowerCase()))).join('');
  }

  const observer = new MutationObserver(() => {
    window.clearTimeout(observer.timer);
    observer.timer = window.setTimeout(syncProjectFromUi, 120);
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden'] });

  $('selectedAddressCard')?.addEventListener('transitionend', syncProjectFromUi);
  renderOverview();
  syncProjectFromUi();
})();
