'use strict';

(function initProjectHeader(global) {
  const store = global.EnergyToolsProjectStore;
  if (!store) return;

  const dateFormatter = new Intl.DateTimeFormat('de-AT');

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function headerMarkup() {
    return `
      <section class="container project-header-card" aria-label="Gemeinsame Projektkopfzeile">
        <div class="project-header-row project-header-row--top">
          <label class="project-title-field">
            <span>Projekttitel</span>
            <input data-project-title type="text" placeholder="z. B. Energieberatung Musterhaus">
          </label>
          <label class="project-id-field">
            <span>Projekt-ID</span>
            <input data-project-id type="text" placeholder="optional">
          </label>
        </div>

        <div class="project-header-row project-header-row--meta">
          <div class="project-address-field">
            <span>Adresse</span>
            <strong data-project-address>Noch kein Standort gewählt</strong>
          </div>
          <div class="project-date-field">
            <span>Datum / Ausdruck</span>
            <strong data-project-date>–</strong>
          </div>
        </div>

        <div class="project-actions no-print">
          <button class="secondary-button" type="button" data-project-print>Drucken / PDF</button>
          <button class="quiet-button" type="button" data-project-change-address>Standort ändern</button>

          <details class="project-menu">
            <summary class="quiet-button">Projekt</summary>
            <div class="project-menu-panel">
              <button type="button" data-project-export>Projekt exportieren</button>
              <button type="button" data-project-import>Projekt importieren</button>
              <button type="button" data-project-new>Neues Projekt</button>
              <button class="project-menu-danger" type="button" data-project-reset>Projekt zurücksetzen</button>
            </div>
          </details>

          <input data-project-import-input type="file" accept="application/json,.json" hidden>
        </div>
      </section>`;
  }

  function reportActionsMarkup(label = 'Drucken / PDF') {
    return `
      <div class="container shared-report-actions no-print">
        <button class="secondary-button" type="button" data-project-print>${escapeHtml(label)}</button>
      </div>`;
  }

  function prepareAndPrint() {
    global.dispatchEvent(new CustomEvent('energy-tools:prepare-print'));
    global.requestAnimationFrame(() => global.print());
  }

  function closeMenus() {
    document.querySelectorAll('.project-menu[open]').forEach((menu) => {
      menu.open = false;
    });
  }

  function mountHeader(host) {
    host.innerHTML = headerMarkup();
    const title = host.querySelector('[data-project-title]');
    const projectId = host.querySelector('[data-project-id]');
    const importInput = host.querySelector('[data-project-import-input]');

    title?.addEventListener('input', () => store.setPath('project.title', title.value));
    projectId?.addEventListener('input', () => store.setPath('project.id', projectId.value));

    host.querySelectorAll('[data-project-print]').forEach((button) => {
      button.addEventListener('click', prepareAndPrint);
    });

    host.querySelector('[data-project-change-address]')?.addEventListener('click', () => {
      const target = document.querySelector('[data-address-section]')
        ?? document.getElementById('addressSearchInput')
        ?? document.getElementById('tirisLiveAddressInput');
      target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      global.setTimeout(() => {
        const input = target?.matches?.('input')
          ? target
          : target?.querySelector?.('input');
        input?.focus?.();
      }, 350);
    });

    host.querySelector('[data-project-export]')?.addEventListener('click', () => {
      const blob = new Blob([store.exportJson()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const project = store.get();
      const safeId = (project.project.id || project.project.title || 'projekt')
        .replace(/[^a-z0-9_-]+/gi, '-')
        .replace(/^-+|-+$/g, '') || 'projekt';
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeId}-energie-tools.json`;
      link.click();
      URL.revokeObjectURL(url);
      closeMenus();
    });

    host.querySelector('[data-project-import]')?.addEventListener('click', () => importInput?.click());
    importInput?.addEventListener('change', async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      try {
        const imported = store.importJson(await file.text());
        global.dispatchEvent(new CustomEvent('energy-tools:project-imported', {
          detail: { project: imported },
        }));
      } catch (error) {
        global.alert(error.message);
      } finally {
        importInput.value = '';
        closeMenus();
      }
    });

    host.querySelector('[data-project-new]')?.addEventListener('click', () => {
      if (!global.confirm('Ein neues Projekt beginnen? Das aktuelle Projekt vorher bei Bedarf exportieren.')) return;
      const next = store.newProject();
      global.dispatchEvent(new CustomEvent('energy-tools:project-reset', {
        detail: { project: next, reason: 'new-project' },
      }));
      closeMenus();
    });

    host.querySelector('[data-project-reset]')?.addEventListener('click', () => {
      if (!global.confirm('Gemeinsame Projektdaten wirklich vollständig zurücksetzen?')) return;
      const resetState = store.reset();
      global.dispatchEvent(new CustomEvent('energy-tools:project-reset', {
        detail: { project: resetState, reason: 'reset' },
      }));
      closeMenus();
    });

    function render(projectState) {
      const nextTitle = projectState?.project?.title || '';
      const nextId = projectState?.project?.id || '';
      const nextAddress = projectState?.project?.addressLabel || 'Noch kein Standort gewählt';
      const nextDate = dateFormatter.format(new Date());
      const addressNode = host.querySelector('[data-project-address]');
      const dateNode = host.querySelector('[data-project-date]');

      if (title && title.value !== nextTitle) title.value = nextTitle;
      if (projectId && projectId.value !== nextId) projectId.value = nextId;
      if (addressNode && addressNode.textContent !== nextAddress) addressNode.textContent = nextAddress;
      if (dateNode && dateNode.textContent !== nextDate) dateNode.textContent = nextDate;
    }

    store.subscribe(render);
    render(store.get());
  }

  document.querySelectorAll('[data-project-header]').forEach(mountHeader);
  document.querySelectorAll('[data-report-actions]').forEach((host) => {
    host.innerHTML = reportActionsMarkup(host.dataset.reportActionsLabel || 'Drucken / PDF');
    host.querySelector('[data-project-print]')?.addEventListener('click', prepareAndPrint);
  });
})(window);
