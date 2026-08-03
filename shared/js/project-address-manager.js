'use strict';

(function initEnergyToolsAddressManager(global) {
  const store = global.EnergyToolsProjectStore;
  const model = global.EnergyToolsDataModel;
  const resolver = global.EnergyToolsValueResolver;
  if (!store || !model || !resolver) return;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function normalized(value) {
    return String(value ?? '')
      .trim()
      .toLocaleLowerCase('de-AT')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function currentAddress(project = store.get()) {
    const record = project?.location?.addressRecord;
    if (record) return record;
    const label = project?.project?.addressLabel || resolver.value(project?.location?.address, '');
    const latitude = resolver.value(project?.location?.latitude, null);
    const longitude = resolver.value(project?.location?.longitude, null);
    return label ? { label, latitude, longitude } : null;
  }

  function addressCode(address) {
    return String(address?.address_code ?? address?.source_id ?? address?.id ?? '').trim();
  }

  function addressesEquivalent(a, b) {
    if (!a || !b) return false;
    const codeA = addressCode(a);
    const codeB = addressCode(b);
    if (codeA && codeB && codeA === codeB) return true;

    const labelA = normalized(a.label);
    const labelB = normalized(b.label);
    if (labelA && labelB && labelA === labelB) return true;

    const latA = finite(a.latitude);
    const lonA = finite(a.longitude);
    const latB = finite(b.latitude);
    const lonB = finite(b.longitude);
    return latA !== null && lonA !== null && latB !== null && lonB !== null
      && Math.abs(latA - latB) < 0.00001
      && Math.abs(lonA - lonB) < 0.00001;
  }

  function keepManualDeep(value) {
    if (Array.isArray(value)) {
      const items = value.map(keepManualDeep).filter((item) => item !== undefined);
      return items.length ? items : undefined;
    }
    if (!value || typeof value !== 'object') return undefined;

    if (resolver.isField(value)) {
      const manual = value.candidates?.[model.ORIGIN.MANUAL];
      if (!manual || manual.value === null || manual.value === undefined || manual.value === '') return undefined;
      return model.field(null, {
        unit: value.unit ?? null,
        candidates: { [model.ORIGIN.MANUAL]: clone(manual) },
      });
    }

    const result = {};
    Object.entries(value).forEach(([key, item]) => {
      const kept = keepManualDeep(item);
      if (kept !== undefined) result[key] = kept;
    });
    return Object.keys(result).length ? result : undefined;
  }

  function prepareAddressCorrection() {
    const previous = store.get();
    const preserved = {
      project: {
        title: previous.project?.title || '',
        id: previous.project?.id || '',
        addressLabel: '',
        createdAt: previous.project?.createdAt,
      },
      building: {
        identity: {},
        geometry: keepManualDeep(previous.building?.geometry) || {},
        thermal: keepManualDeep(previous.building?.thermal) || { envelope: {} },
      },
      usage: keepManualDeep(previous.usage) || { household: {} },
      consumption: keepManualDeep(previous.consumption) || { heating: {} },
      systems: keepManualDeep(previous.systems) || { heating: {} },
      measures: clone(previous.measures || {}),
      scenarios: clone(previous.scenarios || {
        activeId: 'existing',
        items: { existing: { id: 'existing', title: 'Bestand', measureIds: [] } },
      }),
      location: { addressRecord: null },
      modules: {
        standortpass: {}, klima: {}, heizlast: {}, energiefluss: {}, wirtschaftlichkeit: {},
      },
      cache: {},
    };

    store.batch(() => {
      store.reset();
      store.patch(preserved);
    });

    const project = store.get();
    global.dispatchEvent(new CustomEvent('energy-tools:address-context-cleared', {
      detail: { project, reason: 'address-correction' },
    }));
    return project;
  }

  function startNewProject() {
    const project = store.newProject();
    global.dispatchEvent(new CustomEvent('energy-tools:project-reset', {
      detail: { project, reason: 'new-address-project' },
    }));
    return project;
  }

  function ensureDialog() {
    let dialog = document.getElementById('energyToolsAddressChangeDialog');
    if (dialog) return dialog;

    dialog = document.createElement('dialog');
    dialog.id = 'energyToolsAddressChangeDialog';
    dialog.className = 'shared-choice-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="shared-choice-dialog__panel">
        <div class="shared-choice-dialog__head">
          <span class="shared-choice-dialog__eyebrow">Laufendes Projekt</span>
          <h2>Andere Adresse verwenden?</h2>
        </div>
        <p class="shared-choice-dialog__text">
          Die ausgewählte Adresse unterscheidet sich vom aktuellen Projekt.
          Entscheide, ob nur der Standort korrigiert oder ein neues Gebäude begonnen wird.
        </p>
        <div class="shared-choice-dialog__addresses">
          <span>Aktuell</span><strong data-current-address>–</strong>
          <span>Neu</span><strong data-next-address>–</strong>
        </div>
        <div class="shared-choice-dialog__options">
          <button value="correct" class="secondary-button" type="submit">
            <strong>Adresse korrigieren</strong>
            <small>Projekt, manuelle Gebäudeangaben, Nutzung und Verbrauch bleiben erhalten. Standortabhängige Automatiken werden neu ermittelt.</small>
          </button>
          <button value="new" class="shared-choice-dialog__danger" type="submit">
            <strong>Neues Projekt starten</strong>
            <small>Das laufende Projekt wird geleert. Bei Bedarf vorher als JSON exportieren.</small>
          </button>
        </div>
        <button value="cancel" class="quiet-button shared-choice-dialog__cancel" type="submit">Abbrechen</button>
      </form>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  function askUser(current, next) {
    const dialog = ensureDialog();
    dialog.querySelector('[data-current-address]').textContent = current?.label || 'Aktuelles Projekt';
    dialog.querySelector('[data-next-address]').textContent = next?.label || 'Neue Adresse';

    return new Promise((resolve) => {
      let settled = false;
      const finish = (choice) => {
        if (settled) return;
        settled = true;
        dialog.removeEventListener('close', onClose);
        dialog.removeEventListener('cancel', onCancel);
        resolve(choice);
      };
      const onClose = () => finish(dialog.returnValue || 'cancel');
      const onCancel = (event) => {
        event.preventDefault();
        dialog.close('cancel');
      };
      dialog.addEventListener('close', onClose, { once: true });
      dialog.addEventListener('cancel', onCancel, { once: true });
      dialog.showModal();
    });
  }

  async function requestSelection(nextAddress) {
    const current = currentAddress();
    if (!current || addressesEquivalent(current, nextAddress)) {
      return { allowed: true, action: current ? 'same' : 'initial', current };
    }

    const action = await askUser(current, nextAddress);
    if (action === 'cancel') return { allowed: false, action, current };
    if (action === 'new') startNewProject();
    else prepareAddressCorrection();
    return { allowed: true, action, current };
  }

  global.EnergyToolsAddressManager = Object.freeze({
    currentAddress,
    addressesEquivalent,
    requestSelection,
    prepareAddressCorrection,
    startNewProject,
  });
})(window);
