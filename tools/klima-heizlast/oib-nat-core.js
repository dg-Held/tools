'use strict';

(function initOibNatCore(global) {
  function records() {
    return global.OIB_NAT_TIROL?.records ?? {};
  }

  function lookup(kgNumber) {
    if (!kgNumber) return null;
    return records()[String(kgNumber)] ?? null;
  }

  function lookupAddress(address) {
    const kgNumbers = Array.isArray(
      address?.cadastral_municipality_numbers
    )
      ? [...new Set(
          address.cadastral_municipality_numbers
            .map(String)
            .filter(Boolean)
        )]
      : address?.cadastral_municipality_number
        ? [String(address.cadastral_municipality_number)]
        : [];

    if (kgNumbers.length === 0) {
      return {
        status: 'missing',
        references: [],
        message:
          'Für diese Adresse ist keine Katastralgemeinde hinterlegt.',
      };
    }

    const references = kgNumbers
      .map((kgNumber) => lookup(kgNumber))
      .filter(Boolean);

    if (kgNumbers.length > 1) {
      return {
        status: 'ambiguous',
        references,
        kg_numbers: kgNumbers,
        message:
          'Die Adresse ist mehreren Katastralgemeinden zugeordnet. ' +
          'Die NAT wird deshalb nicht automatisch festgelegt.',
      };
    }

    if (references.length !== 1) {
      return {
        status: 'missing',
        references,
        kg_numbers: kgNumbers,
        message:
          `Für KG ${kgNumbers[0]} wurde keine OIB-NAT-Referenz gefunden.`,
      };
    }

    return {
      status: 'exact',
      reference: references[0],
      references,
      kg_numbers: kgNumbers,
      message:
        'OIB-NAT über die BEV-Katastralgemeinde automatisch zugeordnet.',
    };
  }

  global.OibNatCore = {
    lookup,
    lookupAddress,
  };
})(window);
