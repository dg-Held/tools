'use strict';

(function initProjectValueField(global) {
  const store = global.EnergyToolsProjectStore;
  const resolver = global.EnergyToolsValueResolver;
  const model = global.EnergyToolsDataModel;
  if (!store || !resolver || !model) return;

  const ORIGIN_LABELS = Object.freeze({
    [model.ORIGIN.MANUAL]: 'manuell bestätigt',
    [model.ORIGIN.OFFICIAL]: 'amtlich automatisch',
    [model.ORIGIN.DERIVED]: 'abgeleitet',
    [model.ORIGIN.FALLBACK]: 'Annahme / Fallback',
  });

  function formatNumber(value, digits = 1) {
    if (value === null || value === undefined || value === '') return '–';
    if (typeof value !== 'number') return String(value);
    return new Intl.NumberFormat('de-AT', { maximumFractionDigits: digits }).format(value);
  }

  function mount(host) {
    const path = host.dataset.projectValuePath;
    if (!path) return;
    const label = host.dataset.projectValueLabel || path;
    const unit = host.dataset.projectValueUnit || '';
    const digits = Number(host.dataset.projectValueDigits ?? 1);
    const inputType = host.dataset.projectValueType || 'number';

    host.classList.add('project-value-field');
    host.innerHTML = `
      <div class="project-value-field__heading">
        <span>${label}</span>
        <span class="project-value-origin" data-value-origin>–</span>
      </div>
      <div class="project-value-field__main">
        <input data-value-input type="${inputType}" ${inputType === 'number' ? 'step="any"' : ''}>
        ${unit ? `<span class="project-value-field__unit">${unit}</span>` : ''}
        <button class="quiet-button project-value-reset" type="button" data-value-reset>Zurücksetzen</button>
      </div>
      <small data-value-detail></small>`;

    const input = host.querySelector('[data-value-input]');
    const reset = host.querySelector('[data-value-reset]');
    const origin = host.querySelector('[data-value-origin]');
    const detail = host.querySelector('[data-value-detail]');
    let rendering = false;

    function render(project) {
      rendering = true;
      const field = path.split('.').reduce((value, key) => value?.[key], project);
      const info = resolver.describe(field);
      if (inputType === 'number') {
        input.value = info.value === null || info.value === undefined ? '' : String(info.value);
      } else {
        input.value = info.value ?? '';
      }
      origin.textContent = ORIGIN_LABELS[info.origin] ?? 'noch nicht festgelegt';
      origin.dataset.origin = info.origin ?? 'empty';
      reset.hidden = !info.isManual;

      const automatic = info.automaticValue;
      const source = info.source ? `Quelle: ${info.source}` : '';
      const automaticText = info.isManual && automatic !== null
        ? `Automatischer Wert: ${formatNumber(automatic, digits)}${unit ? ` ${unit}` : ''}`
        : '';
      detail.textContent = [automaticText, source].filter(Boolean).join(' · ');
      rendering = false;
    }

    function commit() {
      if (rendering) return;
      const raw = input.value.trim();
      const value = inputType === 'number'
        ? (raw === '' ? null : Number(raw))
        : raw;
      if (inputType === 'number' && value !== null && !Number.isFinite(value)) return;
      store.setFieldCandidate(path, model.ORIGIN.MANUAL, value, {
        unit: unit || null,
        source: 'Nutzereingabe',
      });
    }

    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
    reset.addEventListener('click', () => store.clearFieldCandidate(path, model.ORIGIN.MANUAL));
    store.subscribe(render);
    render(store.get());
  }

  document.querySelectorAll('[data-project-value-path]').forEach(mount);
  global.EnergyToolsProjectValueField = Object.freeze({ mount, ORIGIN_LABELS });
})(window);
