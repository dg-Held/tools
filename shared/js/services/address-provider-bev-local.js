'use strict';

(function initBevLocalAddressProvider(global) {
  const {
    normalizeText,
    standardizeAddress,
  } = global.AddressProviderCore;

  function joinUrl(base, path) {
    const cleanBase = String(base).replace(/\/+$/, '');
    const cleanPath = String(path).replace(/^\/+/, '');
    return `${cleanBase}/${cleanPath}`;
  }

  function extractPostalCode(query) {
    const match = String(query).match(/(?:^|\D)(\d{4})(?:\D|$)/);
    return match ? match[1] : null;
  }

  function unique(values) {
    return [...new Set(values)];
  }

  function scoreAddress(address, normalizedQuery, tokens) {
    let score = 0;
    const label = normalizeText(address.label);
    const street = normalizeText(address.street);
    const municipality = normalizeText(address.municipality);
    const postalCode = normalizeText(address.postal_code);
    const houseNumber = normalizeText(address.house_number);

    if (label === normalizedQuery) score += 1000;
    if (label.startsWith(normalizedQuery)) score += 350;
    if (street && normalizedQuery.startsWith(street)) score += 180;
    if (postalCode && normalizedQuery.includes(postalCode)) score += 100;
    if (municipality && normalizedQuery.includes(municipality)) score += 90;
    if (houseNumber && normalizedQuery.includes(houseNumber)) score += 40;

    tokens.forEach((token) => {
      if (label.includes(token)) score += 20;
      if (street.startsWith(token)) score += 12;
      if (municipality.startsWith(token)) score += 10;
    });

    return score;
  }

  class BevLocalAddressProvider {
    constructor({
      id = 'bev-local',
      baseUrl = global.EnergyToolsPaths?.addresses ?? 'data/addresses',
      fetchImpl = global.fetch?.bind(global),
      embeddedData = global.BEV_DEMO_ADDRESS_DATA ?? null,
    } = {}) {
      this.id = id;
      this.name = 'BEV – lokaler Adressindex';
      this.baseUrl = baseUrl;
      this.fetchImpl = fetchImpl;
      this.embeddedData = embeddedData;
      this.manifest = null;
      this.chunkCache = new Map();
      this.initialized = false;
      this.initializationWarning = null;
    }

    async fetchJson(path) {
      if (!this.fetchImpl) {
        throw new Error('Fetch ist in diesem Browser nicht verfügbar.');
      }

      const response = await this.fetchImpl(joinUrl(this.baseUrl, path), {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Adressindex HTTP ${response.status}`);
      }

      return response.json();
    }

    async init() {
      if (this.initialized) return this;

      try {
        this.manifest = await this.fetchJson('manifest.json');
      } catch (error) {
        if (!this.embeddedData?.manifest) {
          throw error;
        }

        this.manifest = this.embeddedData.manifest;
        this.initializationWarning =
          'Der eingebettete Demonstrationsindex wird verwendet. ' +
          'Für den vollständigen BEV-Index muss die Seite über einen Webserver laufen.';
      }

      this.initialized = true;
      return this;
    }

    info() {
      return {
        id: this.id,
        name: this.name,
        initialized: this.initialized,
        dataset_mode: this.manifest?.dataset_mode ?? 'unknown',
        dataset_date: this.manifest?.dataset_date ?? null,
        address_count: this.manifest?.address_count ?? 0,
        attribution: this.manifest?.attribution ?? '',
        license: this.manifest?.license ?? '',
        warning: this.initializationWarning,
      };
    }

    municipalityCandidates(normalizedQuery) {
      const municipalities = this.manifest?.municipalities ?? [];
      const queryTokens = normalizedQuery
        .split(' ')
        .filter((token) => token.length >= 3);

      return municipalities.filter((item) => {
        const normalizedName = normalizeText(item.name);
        return (
          normalizedQuery.includes(normalizedName) ||
          queryTokens.some((token) => normalizedName.includes(token))
        );
      });
    }

    candidatePostalCodes(query) {
      const directPostalCode = extractPostalCode(query);

      if (directPostalCode) {
        return [directPostalCode];
      }

      const normalizedQuery = normalizeText(query);
      const municipalityMatches =
        this.municipalityCandidates(normalizedQuery);

      const postalCodes = municipalityMatches.flatMap(
        (item) => item.postal_codes ?? []
      );

      if (postalCodes.length > 0) {
        return unique(postalCodes).slice(0, 12);
      }

      if (this.manifest?.dataset_mode === 'demo') {
        return Object.keys(this.manifest.chunks ?? {});
      }

      return [];
    }

    async loadChunk(postalCode) {
      const path = this.manifest?.chunks?.[postalCode];

      if (!path) return [];

      /*
        Mehrere PLZ können seit Stufe 12 auf dieselbe Präfix-Datei zeigen.
        Deshalb wird nach Dateipfad gecacht, nicht mehr nach PLZ.
      */
      if (this.chunkCache.has(path)) {
        return this.chunkCache.get(path);
      }

      let records;

      try {
        records = await this.fetchJson(path);
      } catch (error) {
        /*
          Der eingebettete Demoindex ist weiterhin PLZ-basiert.
        */
        records = this.embeddedData?.chunks?.[postalCode];

        if (!records) throw error;
      }

      const standardized = records.map((record) =>
        standardizeAddress(record, this.name)
      );

      this.chunkCache.set(path, standardized);
      return standardized;
    }

    guidance(query) {
      const postalCodes = this.candidatePostalCodes(query);

      if (
        this.manifest?.dataset_mode !== 'demo' &&
        postalCodes.length === 0
      ) {
        return (
          'Bitte PLZ oder Gemeinde ergänzen, damit nur der passende ' +
          'lokale Adressabschnitt geladen wird.'
        );
      }

      return '';
    }

    async search(query, { limit = 8 } = {}) {
      await this.init();

      const normalizedQuery = normalizeText(query);

      if (normalizedQuery.length < 3) {
        return {
          results: [],
          guidance: 'Mindestens drei Zeichen eingeben.',
          provider: this.info(),
        };
      }

      const postalCodes = this.candidatePostalCodes(query);

      if (postalCodes.length === 0) {
        return {
          results: [],
          guidance: this.guidance(query),
          provider: this.info(),
        };
      }

      /*
        Bei Gemeinde-Suchen können mehrere PLZ auf dieselbe Präfix-Datei
        zeigen. Einmal laden reicht.
      */
      const uniquePostalCodes = unique(postalCodes);

      const chunks = await Promise.all(
        uniquePostalCodes.map(
          (postalCode) => this.loadChunk(postalCode)
        )
      );

      const tokens = normalizedQuery
        .split(' ')
        .filter((token) => token.length >= 1);

      const allowedPostalCodes = new Set(uniquePostalCodes);

      const matches = chunks
        .flat()
        .filter(
          (address, index, all) =>
            allowedPostalCodes.has(address.postal_code) &&
            all.findIndex(
              (candidate) => candidate.id === address.id
            ) === index
        )
        .filter((address) =>
          tokens.every((token) => address.search_text.includes(token))
        )
        .map((address) => ({
          address,
          score: scoreAddress(address, normalizedQuery, tokens),
        }))
        .sort((a, b) =>
          b.score - a.score ||
          a.address.label.localeCompare(
            b.address.label,
            'de'
          )
        )
        .slice(0, limit)
        .map((item) => item.address);

      return {
        results: matches,
        guidance:
          matches.length === 0
            ? 'Keine passende Adresse gefunden. Schreibweise, PLZ oder Gemeinde prüfen.'
            : '',
        provider: this.info(),
      };
    }
  }

  global.BevLocalAddressProvider = BevLocalAddressProvider;
})(window);
