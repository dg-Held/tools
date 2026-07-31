'use strict';
/* Temporäre Kompatibilitätsbrücke für Standortpass V1.5. */
(function loadSharedBevAddressProvider() {
  if (window.BevLocalAddressProvider) return;
  const source = document.currentScript?.src || window.location.href;
  const url = new URL('../../shared/js/services/address-provider-bev-local.js?v=1', source).href;
  document.write(`<script src="${url}"><\/script>`);
})();
