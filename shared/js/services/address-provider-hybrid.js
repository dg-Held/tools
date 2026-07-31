'use strict';

(function initHybridAddressProvider(global) {
  class HybridAddressProvider {
    constructor({
      id = 'bev-tiris-hybrid',
      suggestionProvider,
      liveProvider,
    } = {}) {
      if (!suggestionProvider || !liveProvider) {
        throw new Error('HybridAddressProvider benötigt Vorschlags- und Live-Provider.');
      }

      this.id = id;
      this.name = 'BEV-Vorschläge + TIRIS Live-Check';
      this.suggestionProvider = suggestionProvider;
      this.liveProvider = liveProvider;
      this.initialized = false;
    }

    async init() {
      if (typeof this.suggestionProvider.init === 'function') {
        await this.suggestionProvider.init();
      }
      this.initialized = true;
      return this;
    }

    info() {
      const suggestion = this.suggestionProvider.info?.() ?? {};
      const live = this.liveProvider.info?.() ?? {};
      return {
        id: this.id,
        name: this.name,
        initialized: this.initialized,
        dataset_mode: suggestion.dataset_mode ?? 'unknown',
        dataset_date: suggestion.dataset_date ?? null,
        address_count: suggestion.address_count ?? 0,
        attribution: suggestion.attribution ?? '',
        license: suggestion.license ?? '',
        warning: suggestion.warning ?? null,
        suggestion_source: suggestion.name ?? 'BEV lokal',
        live_source: live.name ?? 'TIRIS live',
      };
    }

    async search(query, options = {}) {
      const local = await this.suggestionProvider.search(query, options);
      if (local.results?.length) {
        return {
          ...local,
          provider: this.info(),
          result_mode: 'local-suggestions',
        };
      }

      try {
        const live = await this.liveProvider.search(query, options);
        if (live.results?.length) {
          return {
            ...live,
            provider: this.info(),
            result_mode: 'tiris-live-fallback',
          };
        }
      } catch (error) {
        return {
          ...local,
          provider: this.info(),
          guidance: local.guidance || `TIRIS-Live-Fallback nicht verfügbar: ${error.message}`,
          result_mode: 'local-only',
        };
      }

      return {
        ...local,
        provider: this.info(),
        result_mode: 'no-match',
      };
    }

    async resolve(address) {
      try {
        const live = await this.liveProvider.resolve(address);
        if (live) {
          return {
            address: live,
            mode: 'tiris-live',
            usedFallback: false,
          };
        }
      } catch (error) {
        return {
          address,
          mode: 'bev-fallback',
          usedFallback: true,
          warning: `TIRIS-Live-Abgleich nicht verfügbar: ${error.message}`,
        };
      }

      return {
        address,
        mode: 'bev-fallback',
        usedFallback: true,
        warning: 'Kein eindeutiger TIRIS-Live-Treffer. BEV-Stichtagsadresse wird verwendet.',
      };
    }
  }

  global.HybridAddressProvider = HybridAddressProvider;
})(window);
