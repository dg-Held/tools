'use strict';

(function initTirisLiveAddressProvider(global) {
  const core = global.AddressProviderCore;
  if (!core) return;

  const BASE_URL =
    'https://gis.tirol.gv.at/arcgis/rest/services/' +
    'Service_Public/ogd_basis/MapServer';

  const LAYERS = [
    { id: 19, kind: 'building', label: 'AGWR Gebäudeadresse' },
    { id: 22, kind: 'address', label: 'AGWR Grundstücksadresse' },
    { id: 13, kind: 'address', label: 'TIRIS Adresse' },
  ];

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function sqlLiteral(value) {
    return String(value ?? '').replaceAll("'", "''");
  }

  function isoDate(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  function compactText(value) {
    return core.normalizeText(value)
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokens(value) {
    return compactText(value).split(' ').filter(Boolean);
  }

  function houseCandidates(value) {
    const text = String(value ?? '').trim();
    if (!text) return [];
    return [...new Set([text, text.toLowerCase(), text.toUpperCase()])];
  }

  function extractFullSearch(query) {
    const text = String(query ?? '').trim();
    const postal = text.match(/\b(\d{4})\b/)?.[1] ?? null;
    const rawTokens = text.replace(/[;,]+/g, ' ').split(/\s+/).filter(Boolean);
    const housePattern = /^\d+[A-Za-z]?(?:[\/-][A-Za-z0-9]+)?$/;
    const houses = [...new Set(
      rawTokens
        .filter((token) => token !== postal && housePattern.test(token))
        .flatMap(houseCandidates)
    )];

    if (!postal || houses.length === 0) return null;

    return {
      original: text,
      postal_code: postal,
      house_candidates: houses,
      normalized: compactText(text),
      tokens: tokens(text),
    };
  }

  function layerFields(layerId) {
    if (layerId === 13) {
      return {
        street: 'SNAME',
        house: 'HNR',
        postal: 'PLZ',
        municipality: 'GEMNAME',
      };
    }
    return {
      street: 'STRASSENNAME',
      house: 'HNR_ADR_ZUSAMMEN',
      postal: 'PLZ',
      municipality: 'GEMEINDENAME',
    };
  }

  function normalizeFeature(feature, layer, fallback = null) {
    const attrs = feature?.attributes ?? {};
    const geometry = feature?.geometry ?? {};
    const isLayer13 = layer.id === 13;

    const street = isLayer13 ? attrs.SNAME : attrs.STRASSENNAME;
    const house = isLayer13 ? attrs.HNR : attrs.HNR_ADR_ZUSAMMEN;
    const municipality = isLayer13 ? attrs.GEMNAME : attrs.GEMEINDENAME;
    const latitude = finiteNumber(geometry.y);
    const longitude = finiteNumber(geometry.x);

    if (latitude === null || longitude === null) return null;

    const adrCd = attrs.ADRCD ?? fallback?.source_id ?? null;
    const subCd = attrs.SUBCD ?? fallback?.subcode ?? null;
    const label = `${street ?? fallback?.street ?? ''} ${house ?? fallback?.house_number ?? ''}, ${attrs.PLZ ?? fallback?.postal_code ?? ''} ${municipality ?? fallback?.municipality ?? ''}`
      .replace(/\s+/g, ' ')
      .replace(' ,', ',')
      .trim();

    const standardized = core.standardizeAddress({
      id: `tiris-${adrCd ?? attrs.OBJECTID ?? 'address'}-${subCd ?? '0'}`,
      label,
      street: street ?? fallback?.street ?? '',
      house_number: String(house ?? fallback?.house_number ?? ''),
      postal_code: String(attrs.PLZ ?? fallback?.postal_code ?? ''),
      municipality: municipality ?? fallback?.municipality ?? '',
      delivery_locality: municipality ?? fallback?.delivery_locality ?? fallback?.municipality ?? '',
      municipality_code: attrs.GEMOESTAT ?? fallback?.municipality_code ?? '',
      locality: isLayer13
        ? (attrs.ORTSTEIL ?? fallback?.locality ?? '')
        : (attrs.BEZ_ORTSTEIL ?? fallback?.locality ?? ''),
      latitude,
      longitude,
      address_latitude: latitude,
      address_longitude: longitude,
      building: layer.kind === 'building'
        ? { latitude, longitude }
        : (fallback?.building ?? null),
      cadastral_municipality_number: fallback?.cadastral_municipality_number ?? null,
      cadastral_municipality_numbers: fallback?.cadastral_municipality_numbers ?? [],
      source: 'Land Tirol / TIRIS live',
      source_id: String(adrCd ?? attrs.OBJECTID ?? ''),
      coordinate_kind: layer.kind,
      dataset_date: isoDate(attrs.STAND) ?? fallback?.dataset_date ?? null,
      license: 'OGD Land Tirol',
      is_demo: false,
    }, 'Land Tirol / TIRIS live');

    return {
      ...standardized,
      address_code: adrCd ? String(adrCd) : null,
      subcode: subCd ? String(subCd) : null,
      updated_at: isoDate(attrs.UPDATETIMESTAMP),
      tiris_layer_id: layer.id,
      tiris_layer_label: layer.label,
      raw_attributes: attrs,
      fallback_source: fallback?.source ?? null,
    };
  }

  function scoreCandidate(candidate, expected) {
    const candidateText = compactText([
      candidate.street,
      candidate.house_number,
      candidate.postal_code,
      candidate.municipality,
      candidate.locality,
    ].filter(Boolean).join(' '));

    const expectedText = compactText([
      expected?.street,
      expected?.house_number,
      expected?.postal_code,
      expected?.municipality,
      expected?.locality,
      expected?.label,
    ].filter(Boolean).join(' '));

    const expectedTokens = tokens(expectedText);
    const candidateTokens = new Set(tokens(candidateText));
    const matched = expectedTokens.filter((token) => candidateTokens.has(token)).length;
    let score = expectedTokens.length ? (matched / expectedTokens.length) * 10 : 0;

    if (candidate.source_id && expected?.source_id && String(candidate.source_id) === String(expected.source_id)) score += 20;
    if (candidate.postal_code && expected?.postal_code && candidate.postal_code === expected.postal_code) score += 4;
    if (candidate.house_number && expected?.house_number && compactText(candidate.house_number) === compactText(expected.house_number)) score += 4;
    if (candidate.street && expected?.street && compactText(candidate.street) === compactText(expected.street)) score += 4;

    return score;
  }

  class TirisLiveAddressProvider {
    constructor({
      id = 'tiris-live',
      fetchImpl = global.fetch?.bind(global),
      timeoutMs = 9000,
    } = {}) {
      this.id = id;
      this.name = 'TIRIS live';
      this.fetchImpl = fetchImpl;
      this.timeoutMs = timeoutMs;
    }

    info() {
      return {
        id: this.id,
        name: this.name,
        mode: 'live',
        source: 'Land Tirol / TIRIS ogd_basis',
        rest_service_url: BASE_URL,
      };
    }

    async fetchJson(url) {
      if (!this.fetchImpl) throw new Error('Fetch ist in diesem Browser nicht verfügbar.');

      const controller = new AbortController();
      const timer = global.setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`TIRIS HTTP ${response.status}`);
        const payload = await response.json();
        if (payload?.error) throw new Error(payload.error.message || 'TIRIS meldet einen Fehler.');
        return payload;
      } finally {
        global.clearTimeout(timer);
      }
    }

    queryUrl(layerId, where) {
      const params = new URLSearchParams({
        f: 'json',
        where,
        outFields: '*',
        returnGeometry: 'true',
        outSR: '4326',
        returnZ: 'false',
        returnM: 'false',
        resultRecordCount: '2000',
      });
      return `${BASE_URL}/${layerId}/query?${params.toString()}`;
    }

    async queryLayer(layer, where, fallback = null) {
      const payload = await this.fetchJson(this.queryUrl(layer.id, where));
      return (payload.features ?? [])
        .map((feature) => normalizeFeature(feature, layer, fallback))
        .filter(Boolean);
    }

    async resolve(address) {
      const expected = address ?? {};
      const collected = [];
      const adrCd = String(expected.source_id ?? expected.address_code ?? '').trim();

      if (adrCd) {
        for (const layer of LAYERS) {
          const exact = await this.queryLayer(layer, `ADRCD='${sqlLiteral(adrCd)}'`, expected);
          exact.forEach((candidate) => collected.push(candidate));
          if (layer.kind === 'building' && exact.length === 1) break;
        }
      }

      if (collected.length === 0 && expected.postal_code && expected.house_number) {
        const houses = houseCandidates(expected.house_number);
        for (const layer of LAYERS) {
          const fields = layerFields(layer.id);
          const where = [
            `${fields.postal}='${sqlLiteral(expected.postal_code)}'`,
            `(${houses.map((house) => `${fields.house}='${sqlLiteral(house)}'`).join(' OR ')})`,
          ].join(' AND ');
          const found = await this.queryLayer(layer, where, expected);
          found.forEach((candidate) => collected.push(candidate));
          if (layer.kind === 'building' && found.length === 1) break;
        }
      }

      if (collected.length === 0) return null;

      const deduped = new Map();
      collected.forEach((candidate) => {
        const key = `${candidate.source_id}|${candidate.subcode ?? ''}|${candidate.latitude.toFixed(7)}|${candidate.longitude.toFixed(7)}`;
        const score = scoreCandidate(candidate, expected);
        const previous = deduped.get(key);
        if (!previous || score > previous.score) deduped.set(key, { candidate, score });
      });

      const ranked = [...deduped.values()].sort((a, b) => b.score - a.score);
      return ranked[0]?.candidate ?? null;
    }

    async search(query, { limit = 8 } = {}) {
      const parsed = extractFullSearch(query);
      if (!parsed) {
        return {
          results: [],
          guidance: 'Für die reine TIRIS-Livesuche bitte PLZ und Hausnummer angeben.',
          provider: this.info(),
        };
      }

      const collected = [];
      for (const layer of LAYERS) {
        const fields = layerFields(layer.id);
        const where = [
          `${fields.postal}='${sqlLiteral(parsed.postal_code)}'`,
          `(${parsed.house_candidates.map((house) => `${fields.house}='${sqlLiteral(house)}'`).join(' OR ')})`,
        ].join(' AND ');
        const found = await this.queryLayer(layer, where, null);
        found.forEach((candidate) => {
          const fakeExpected = { label: parsed.original, postal_code: parsed.postal_code };
          collected.push({ candidate, score: scoreCandidate(candidate, fakeExpected) });
        });
      }

      const deduped = new Map();
      collected.forEach(({ candidate, score }) => {
        const key = `${candidate.source_id}|${candidate.subcode ?? ''}|${candidate.latitude.toFixed(7)}|${candidate.longitude.toFixed(7)}`;
        const previous = deduped.get(key);
        if (!previous || score > previous.score) deduped.set(key, { candidate, score });
      });

      const results = [...deduped.values()]
        .sort((a, b) => b.score - a.score || a.candidate.label.localeCompare(b.candidate.label, 'de'))
        .slice(0, limit)
        .map((item) => item.candidate);

      return {
        results,
        guidance: results.length ? '' : 'Keine passende TIRIS-Adresse gefunden.',
        provider: this.info(),
      };
    }
  }

  global.TirisLiveAddressProvider = TirisLiveAddressProvider;
})(window);
