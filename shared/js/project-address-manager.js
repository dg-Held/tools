'use strict';

(function initProjectAddressManager(global) {
  const store = global.EnergyToolsProjectStore;
  if (!store) return;

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function currentAddress() {
    const project = store.get();
    const record = project?.location?.addressRecord;
    if (record) return record;

    const latitude = finiteNumber(project?.location?.latitude?.value);
    const longitude = finiteNumber(project?.location?.longitude?.value);
    const label = project?.project?.addressLabel || project?.location?.address?.value || '';
    if (!label && latitude === null && longitude === null) return null;
    return { label, latitude, longitude };
  }

  function normalized(value) {
    return String(value ?? '').trim().toLocaleLowerCase('de-AT');
  }

  function isSameAddress(current, next) {
    if (!current || !next) return false;
    const currentId = current.id ?? current.address_code ?? current.source_id;
    const nextId = next.id ?? next.address_code ?? next.source_id;
    if (currentId && nextId && String(currentId) === String(nextId)) return true;

    const currentLat = finiteNumber(current.latitude);
    const currentLon = finiteNumber(current.longitude);
    const nextLat = finiteNumber(next.latitude);
    const nextLon = finiteNumber(next.longitude);
    if ([currentLat, currentLon, nextLat, nextLon].every((value) => value !== null)) {
      if (Math.abs(currentLat - nextLat) < 0.00001 && Math.abs(currentLon - nextLon) < 0.00001) return true;
    }
    return normalized(current.label) !== '' && normalized(current.label) === normalized(next.label);
  }

  async function requestSelection(nextAddress) {
    if (!nextAddress) return { allowed: false, action: 'invalid' };
    const current = currentAddress();
    if (!current) return { allowed: true, action: 'initial' };
    if (isSameAddress(current, nextAddress)) return { allowed: true, action: 'same' };

    const currentLabel = current.label || 'bisheriger Standort';
    const nextLabel = nextAddress.label || 'neuer Standort';
    const replace = global.confirm(
      `Projektadresse ändern?\n\nBisher: ${currentLabel}\nNeu: ${nextLabel}\n\nAbbrechen lässt das Projekt unverändert.`
    );
    if (!replace) return { allowed: false, action: 'cancel' };

    const correction = global.confirm(
      'Ist dies nur eine Korrektur derselben Liegenschaft?\n\nOK: manuelle Gebäudewerte behalten.\nAbbrechen: als neues Gebäude behandeln und standortabhängige Gebäudedaten neu aufbauen.'
    );
    return { allowed: true, action: correction ? 'correct' : 'replace' };
  }

  global.EnergyToolsAddressManager = Object.freeze({
    currentAddress,
    isSameAddress,
    requestSelection,
  });
})(window);
