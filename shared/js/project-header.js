'use strict';

(function initProjectHeader() {
  const store = window.EnergyToolsProjectStore;
  if (!store) return;

  const $ = (id) => document.getElementById(id);
  const title = $('projectTitle');
  const projectId = $('projectId');
  const address = $('projectAddress');
  const printDate = $('projectPrintDate');
  const exportButton = $('exportProjectButton');
  const importButton = $('importProjectButton');
  const importInput = $('importProjectInput');
  const resetButton = $('resetProjectButton');
  const printButton = $('printReportButton');

  function render(projectState) {
    const nextTitle = projectState.project.title || '';
    const nextId = projectState.project.id || '';
    const nextAddress = projectState.project.addressLabel || 'Noch kein Standort gewählt';
    const nextDate = new Intl.DateTimeFormat('de-AT').format(new Date());
    if (title.value !== nextTitle) title.value = nextTitle;
    if (projectId.value !== nextId) projectId.value = nextId;
    if (address.textContent !== nextAddress) address.textContent = nextAddress;
    if (printDate.textContent !== nextDate) printDate.textContent = nextDate;
  }

  title.addEventListener('input', () => store.setPath('project.title', title.value));
  projectId.addEventListener('input', () => store.setPath('project.id', projectId.value));
  printButton.addEventListener('click', () => window.print());

  exportButton.addEventListener('click', () => {
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const project = store.get();
    const safeId = (project.project.id || 'projekt').replace(/[^a-z0-9_-]+/gi, '-');
    link.href = url;
    link.download = `${safeId}-energie-tools.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  importButton.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      store.importJson(await file.text());
    } catch (error) {
      window.alert(error.message);
    } finally {
      importInput.value = '';
    }
  });

  resetButton.addEventListener('click', () => {
    if (window.confirm('Gemeinsame Projektdaten wirklich zurücksetzen?')) store.reset();
  });

  store.subscribe(render);
  render(store.get());
})();
