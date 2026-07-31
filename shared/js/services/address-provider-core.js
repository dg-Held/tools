'use strict';

(function initAddressProviderCore(global) {
  function normalizeText(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function standardizeAddress(record, providerName) {
    const latitude = Number(record.latitude);
    const longitude = Number(record.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('Das Adressergebnis enthält keine gültigen Koordinaten.');
    }

    return {
      id: String(record.id ?? record.source_id ?? record.label),
      label: String(record.label ?? '').trim(),
      street: String(record.street ?? '').trim(),
      house_number: String(record.house_number ?? '').trim(),
      postal_code: String(record.postal_code ?? '').trim(),
      municipality: String(record.municipality ?? '').trim(),
      delivery_locality: String(
        record.delivery_locality ??
        record.municipality ??
        ''
      ).trim(),
      municipality_code: String(
        record.municipality_code ?? ''
      ).trim(),
      locality: String(record.locality ?? '').trim(),
      latitude,
      longitude,
      address_latitude: Number.isFinite(Number(record.address_latitude))
        ? Number(record.address_latitude)
        : latitude,
      address_longitude: Number.isFinite(Number(record.address_longitude))
        ? Number(record.address_longitude)
        : longitude,
      building: record.building ?? null,
      cadastral_municipality_number:
        record.cadastral_municipality_number ?? null,
      cadastral_municipality_numbers:
        Array.isArray(record.cadastral_municipality_numbers)
          ? record.cadastral_municipality_numbers
          : [],
      source: String(record.source ?? providerName ?? 'Adresse'),
      source_id: String(record.source_id ?? record.id ?? '').trim(),
      coordinate_kind: String(
        record.coordinate_kind ?? 'address_access'
      ),
      dataset_date: record.dataset_date ?? null,
      license: record.license ?? null,
      is_demo: Boolean(record.is_demo),
      search_text: normalizeText(
        record.search_text ??
        [
          record.label,
          record.street,
          record.house_number,
          record.postal_code,
          record.municipality,
          record.delivery_locality,
          record.locality,
        ].filter(Boolean).join(' ')
      ),
    };
  }

  class AddressProviderRegistry {
    constructor() {
      this.providers = new Map();
      this.activeProviderId = null;
    }

    register(provider) {
      if (!provider?.id || typeof provider.search !== 'function') {
        throw new Error('Ungültiger Adressanbieter.');
      }

      this.providers.set(provider.id, provider);

      if (!this.activeProviderId) {
        this.activeProviderId = provider.id;
      }

      return provider;
    }

    use(providerId) {
      if (!this.providers.has(providerId)) {
        throw new Error(`Adressanbieter ${providerId} ist nicht registriert.`);
      }

      this.activeProviderId = providerId;
    }

    active() {
      const provider = this.providers.get(this.activeProviderId);

      if (!provider) {
        throw new Error('Kein Adressanbieter aktiv.');
      }

      return provider;
    }

    async init() {
      const provider = this.active();

      if (typeof provider.init === 'function') {
        await provider.init();
      }

      return provider;
    }

    async search(query, options = {}) {
      return this.active().search(query, options);
    }

    info() {
      return this.active().info();
    }
  }

  global.AddressProviderCore = {
    normalizeText,
    standardizeAddress,
    AddressProviderRegistry,
  };
})(window);
