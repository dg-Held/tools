'use strict';
/*
  TEMPORÄRE KOMPATIBILITÄTSBRÜCKE
  Die gemeinsame Implementierung liegt unter shared/js/services/.
  Diese Datei bleibt nur bis zur anschließenden Standortpass-Umstellung,
  weil Standortpass V1.5 noch den alten Pfad lädt.
*/
(function loadSharedAddressProviderCore() {
  if (window.AddressProviderCore) return;
  const source = document.currentScript?.src || window.location.href;
  const url = new URL('../../shared/js/services/address-provider-core.js?v=1', source).href;
  document.write(`<script src="${url}"><\/script>`);
})();
