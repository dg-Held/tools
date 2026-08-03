'use strict';

(function initEnergyToolsPaths(global) {
  const scriptUrl = document.currentScript?.src
    ? new URL(document.currentScript.src)
    : new URL('shared/js/paths.js', global.location.href);

  const sharedJsUrl = new URL('./', scriptUrl);
  const sharedUrl = new URL('../', sharedJsUrl);
  const rootUrl = new URL('../', sharedUrl);
  const sharedDataUrl = new URL('data/', sharedUrl);

  function href(relativePath, base = rootUrl) {
    return new URL(relativePath, base).href;
  }

  global.EnergyToolsPaths = Object.freeze({
    root: rootUrl.href,
    shared: sharedUrl.href,
    sharedData: sharedDataUrl.href,
    addresses: href('addresses/', sharedDataUrl),
    climateInca: href('climate/inca/', sharedDataUrl),
    climateDataStatus: href('climate/datenstand.json', sharedDataUrl),
    oibStandards: href('standards/oib/', sharedDataUrl),
    tool(name, file = 'index.html') {
      return href(`tools/${name}/${file}`);
    },
    page(file) {
      return href(`pages/${file}`);
    },
    asset(file) {
      return href(`assets/${file}`);
    },
    href,
  });
})(window);
