'use strict';
/* Temporäre Kompatibilitätsbrücke für Standortpass V1.5. */
(function loadSharedLocationCore() {
  if (window.LocationCore) return;
  const source = document.currentScript?.src || window.location.href;
  const url = new URL('../../shared/js/services/location-core.js?v=1', source).href;
  document.write(`<script src="${url}"><\/script>`);
})();
