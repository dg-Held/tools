#!/usr/bin/env python3
"""Exportiert freigegebene Fachdaten aus BAUTEIL_DATEN_MASTER.xlsx in Website-JSON.

Keine externen Python-Pakete erforderlich. Die Exceldatei wird als XLSX-ZIP gelesen.
Die Quelle bleibt außerhalb des veröffentlichten Website-Ordners; nur die JSON-Ausgabe
wird nach shared/data geschrieben.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import os
import re
import shutil
import sys
import tempfile
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable
from xml.etree import ElementTree as ET

NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_REL_DOC = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_REL_PKG = "http://schemas.openxmlformats.org/package/2006/relationships"

REQUIRED_SHEETS = {
    "Ziel_U_Werte",
    "Bestand_Baujahr",
    "Lambda_Werte",
}

COMPONENT_TO_TOOL = {
    "wall_external": ["exteriorWall"],
    "window_external": ["windows"],
    "door_external": ["exteriorDoor"],
    "roof_top_ceiling": ["topFloorCeiling", "roof"],
    "ceiling_unheated": ["basementCeiling"],
    "floor_ground": ["groundFloor"],
    "wall_ground": ["groundWall"],
}

PERIOD_ID_MAP = {
    "pre1900": "before_1900",
    "before1900": "before_1900",
    "before_1900": "before_1900",
}

DEFAULT_FINANCE = {
    "period_years": 30,
    "interest_rate_percent": 2.0,
    "energy_price_escalation_percent": 2.0,
    "investment_price_escalation_percent": 2.0,
    "disposal_price_escalation_percent": 2.0,
    "include_vat": True,
}

DEFAULT_ROUNDING = {
    "thickness_cm": 2,
    "uvalue_decimals": 2,
    "cost_per_m2_eur": 10,
    "total_eur": 500,
    "annual_eur": 50,
    "co2_kg": 100,
}

DATASET_PATHS = {
    "targets": "shared/data/measures/envelope-targets.json",
    "existing_u_values": "shared/data/building/existing-u-values.json",
    "lambda_values": "shared/data/measures/lambda-values.json",
    "costs": "shared/data/costs/renovation-costs.json",
    "energy_prices": "shared/data/economics/energy-prices.json",
    "emissions": "shared/data/emissions/emission-factors.json",
    "finance": "shared/data/economics/financial-defaults.json",
    "measure_effects": "shared/data/measures/measure-effects.json",
}


class ExportError(RuntimeError):
    pass


def norm_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def norm_key(value: Any) -> str:
    text = norm_text(value).lower()
    text = text.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    return re.sub(r"[^a-z0-9]+", "_", text).strip("_")


def as_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    text = norm_text(value).lower()
    if text in {"ja", "yes", "true", "1", "aktiv", "active", "freigegeben"}:
        return True
    if text in {"nein", "no", "false", "0", "inaktiv", "inactive"}:
        return False
    return default


def as_number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(float(value)) else None
    text = norm_text(value).replace(" ", "")
    if not text:
        return None
    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    else:
        text = text.replace(",", ".")
    text = re.sub(r"[^0-9eE+\-.]", "", text)
    try:
        number = float(text)
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def smart_number(value: Any) -> int | float | None:
    number = as_number(value)
    if number is None:
        return None
    return int(number) if number.is_integer() else number


def excel_date(value: Any) -> str | None:
    if isinstance(value, (int, float)) and 20000 < float(value) < 100000:
        date = dt.datetime(1899, 12, 30) + dt.timedelta(days=float(value))
        return date.date().isoformat()
    text = norm_text(value)
    return text or None


def round_step(value: float | None, step: float | None) -> float | None:
    if value is None:
        return None
    if not step or step <= 0:
        return value
    rounded = round(value / step) * step
    return int(rounded) if float(rounded).is_integer() else rounded


def col_index(cell_reference: str) -> int:
    letters = re.match(r"[A-Z]+", cell_reference.upper())
    if not letters:
        return 0
    value = 0
    for char in letters.group(0):
        value = value * 26 + ord(char) - 64
    return value - 1


class XlsxReader:
    def __init__(self, path: Path):
        self.path = path
        self.zip = zipfile.ZipFile(path)
        self.shared_strings = self._load_shared_strings()
        self.sheet_paths = self._load_sheet_paths()

    def close(self) -> None:
        self.zip.close()

    def _load_shared_strings(self) -> list[str]:
        try:
            root = ET.fromstring(self.zip.read("xl/sharedStrings.xml"))
        except KeyError:
            return []
        values: list[str] = []
        for si in root.findall(f"{{{NS_MAIN}}}si"):
            values.append("".join(node.text or "" for node in si.iter(f"{{{NS_MAIN}}}t")))
        return values

    def _load_sheet_paths(self) -> dict[str, str]:
        workbook = ET.fromstring(self.zip.read("xl/workbook.xml"))
        rels = ET.fromstring(self.zip.read("xl/_rels/workbook.xml.rels"))
        relation_targets = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in rels.findall(f"{{{NS_REL_PKG}}}Relationship")
        }
        result: dict[str, str] = {}
        for sheet in workbook.findall(f".//{{{NS_MAIN}}}sheet"):
            name = sheet.attrib.get("name", "")
            rel_id = sheet.attrib.get(f"{{{NS_REL_DOC}}}id")
            target = relation_targets.get(rel_id or "", "")
            if target.startswith("/"):
                path = target.lstrip("/")
            elif target.startswith("xl/"):
                path = target
            else:
                path = f"xl/{target}"
            result[name] = str(Path(path).as_posix())
        return result

    def sheet_names(self) -> set[str]:
        return set(self.sheet_paths)

    def read_sheet(self, name: str) -> list[list[Any]]:
        path = self.sheet_paths.get(name)
        if not path:
            return []
        root = ET.fromstring(self.zip.read(path))
        rows: list[list[Any]] = []
        for row_node in root.findall(f".//{{{NS_MAIN}}}row"):
            row: list[Any] = []
            for cell in row_node.findall(f"{{{NS_MAIN}}}c"):
                index = col_index(cell.attrib.get("r", "A1"))
                while len(row) <= index:
                    row.append(None)
                cell_type = cell.attrib.get("t")
                value_node = cell.find(f"{{{NS_MAIN}}}v")
                value_text = value_node.text if value_node is not None else None
                if cell_type == "inlineStr":
                    value = "".join(node.text or "" for node in cell.iter(f"{{{NS_MAIN}}}t"))
                elif cell_type == "s" and value_text is not None:
                    shared_index = int(value_text)
                    value = self.shared_strings[shared_index] if shared_index < len(self.shared_strings) else ""
                elif cell_type == "b":
                    value = value_text == "1"
                elif cell_type in {"str", "e"}:
                    value = value_text
                elif value_text is None:
                    value = None
                else:
                    try:
                        numeric = float(value_text)
                        value = int(numeric) if numeric.is_integer() else numeric
                    except ValueError:
                        value = value_text
                row[index] = value
            rows.append(row)
        return rows


def sheet_records(rows: list[list[Any]], expected_headers: Iterable[str]) -> list[dict[str, Any]]:
    expected = {norm_key(item) for item in expected_headers}
    header_index = None
    for index, row in enumerate(rows):
        normalized = {norm_key(cell) for cell in row if norm_text(cell)}
        if len(normalized & expected) >= min(3, len(expected)):
            header_index = index
            break
    if header_index is None:
        return []
    headers = [norm_text(value) for value in rows[header_index]]
    records: list[dict[str, Any]] = []
    for row in rows[header_index + 1 :]:
        if not any(norm_text(value) for value in row):
            continue
        record: dict[str, Any] = {}
        for index, header in enumerate(headers):
            if not header:
                continue
            record[header] = row[index] if index < len(row) else None
        records.append(record)
    return records


def value_by(record: dict[str, Any], *names: str) -> Any:
    normalized = {norm_key(key): value for key, value in record.items()}
    for name in names:
        key = norm_key(name)
        if key in normalized:
            return normalized[key]
    return None


def source_version(reader: XlsxReader) -> str:
    rows = reader.read_sheet("Version")
    for row in rows:
        if row and norm_key(row[0] if row else None) == "datenmodell_version":
            return norm_text(row[1] if len(row) > 1 else None) or "unversioned"
    return "unversioned"


def source_status(reader: XlsxReader) -> str | None:
    rows = reader.read_sheet("Version")
    for row in rows:
        if row and norm_key(row[0] if row else None) == "status":
            return norm_text(row[1] if len(row) > 1 else None) or None
    return None


def export_targets(reader: XlsxReader, version: str) -> tuple[dict[str, Any], list[str]]:
    records = sheet_records(reader.read_sheet("Ziel_U_Werte"), ["Bauteil_ID", "Empfehlung", "Ambitioniert", "Aktiv"])
    components: dict[str, Any] = {}
    warnings: list[str] = []
    for row in records:
        if not as_bool(value_by(row, "Aktiv")):
            continue
        component_id = norm_text(value_by(row, "Bauteil_ID"))
        recommended = as_number(value_by(row, "Empfehlung"))
        ambitious = as_number(value_by(row, "Ambitioniert"))
        if not component_id or recommended is None or ambitious is None:
            warnings.append(f"Ziel_U_Werte: unvollständige aktive Zeile für {component_id or 'unbekannt'} übersprungen.")
            continue
        item: dict[str, Any] = {
            "label": norm_text(value_by(row, "Bauteil")) or component_id,
            "recommended": recommended,
            "ambitious": ambitious,
            "source_id": norm_text(value_by(row, "Quelle_ID")) or None,
        }
        funding = as_number(value_by(row, "WBF_2026", "Foerderreferenz", "Förderreferenz"))
        if funding is not None:
            item["funding_reference"] = funding
        if component_id in {"window_external", "door_external"}:
            item["measure_type"] = "exchange"
        if component_id in {"floor_ground", "wall_ground"}:
            item["analytic_optimum_allowed"] = False
        components[component_id] = item
    return {
        "schema": "energy-tools-envelope-targets",
        "version": version,
        "status": "advisory-targets",
        "notice": "Empfohlener Mindeststandard und ambitionierter Standard. Rechtliche OIB-Prüfdaten werden getrennt versioniert.",
        "components": components,
    }, warnings


def normalize_period_id(value: Any) -> str:
    raw = norm_key(value)
    return PERIOD_ID_MAP.get(raw, raw)


def export_existing_u(reader: XlsxReader, version: str) -> tuple[dict[str, Any], list[str]]:
    records = sheet_records(reader.read_sheet("Bestand_Baujahr"), ["Bauteil_ID", "Periode_ID", "U_Wert", "Aktiv"])
    period_meta: dict[str, dict[str, Any]] = {}
    component_values: dict[str, dict[str, float]] = defaultdict(dict)
    component_labels: dict[str, str] = {}
    warnings: list[str] = []
    latest_data_date: str | None = None
    for row in records:
        if not as_bool(value_by(row, "Aktiv")):
            continue
        source_component = norm_text(value_by(row, "Bauteil_ID"))
        period_id = normalize_period_id(value_by(row, "Periode_ID"))
        u_value = as_number(value_by(row, "U_Wert", "U-Wert"))
        if not source_component or not period_id or u_value is None:
            warnings.append("Bestand_Baujahr: unvollständige aktive Zeile übersprungen.")
            continue
        year_min = smart_number(value_by(row, "Von_Jahr"))
        year_max = smart_number(value_by(row, "Bis_Jahr"))
        label = "vor 1900" if period_id == "before_1900" else period_id.replace("_", "–")
        period = {"id": period_id, "label": label}
        if year_min is not None:
            period["year_min"] = year_min
        if year_max is not None:
            period["year_max"] = year_max
        period_meta[period_id] = period
        data_date = excel_date(value_by(row, "Datenstand"))
        if data_date:
            latest_data_date = data_date
        for tool_component in COMPONENT_TO_TOOL.get(source_component, [source_component]):
            component_values[tool_component][period_id] = u_value
            component_labels[tool_component] = norm_text(value_by(row, "Bauteil")) or source_component
    periods = sorted(period_meta.values(), key=lambda item: (item.get("year_min", -10**9), item.get("year_max", 10**9)))
    components = {
        component_id: {"label": component_labels.get(component_id, component_id), "values": values}
        for component_id, values in component_values.items()
    }
    return {
        "schema_version": 1,
        "version": version,
        "data_date": latest_data_date,
        "title": "Bestands-U-Wert-Vorschläge nach Bauperiode",
        "purpose": "Sichtbare Beratungsfallbacks, wenn kein konkreter U-Wert bekannt oder bestätigt ist.",
        "priority": "manuell bestätigt → übernommen/amtlich → Bauperiodenvorschlag → grober Zustandsfallback",
        "periods": periods,
        "components": components,
    }, warnings


def export_lambda(reader: XlsxReader, version: str) -> tuple[dict[str, Any], list[str]]:
    records = sheet_records(reader.read_sheet("Lambda_Werte"), ["Lambda_ID", "Lambda_W_mK", "Anzeige", "Aktiv"])
    values: list[dict[str, Any]] = []
    warnings: list[str] = []
    for row in records:
        if not as_bool(value_by(row, "Aktiv")):
            continue
        item_id = norm_text(value_by(row, "Lambda_ID"))
        number = as_number(value_by(row, "Lambda_W_mK"))
        if not item_id:
            continue
        if number is None:
            if "custom" not in item_id.lower():
                warnings.append(f"Lambda_Werte: {item_id} ohne Zahlenwert übersprungen.")
            continue
        item = {
            "id": item_id,
            "value": number,
            "label": norm_text(value_by(row, "Anzeige")) or f"{number:.3f} W/mK".replace(".", ","),
            "active": True,
        }
        if abs(number - 0.035) < 1e-9:
            item["recommended_input"] = True
        values.append(item)
    values.sort(key=lambda item: item["value"])
    return {
        "schema": "energy-tools-lambda-values",
        "version": version,
        "values": values,
        "notice": "Materialneutrale thermische Eingabe. Materialökologie wird getrennt bewertet.",
    }, warnings


def active_or_filled_rows(records: list[dict[str, Any]], numeric_names: list[str]) -> tuple[list[dict[str, Any]], int]:
    active: list[dict[str, Any]] = []
    filled_inactive = 0
    for row in records:
        is_active = as_bool(value_by(row, "Aktiv"))
        filled = any(as_number(value_by(row, name)) is not None for name in numeric_names)
        if is_active:
            active.append(row)
        elif filled:
            filled_inactive += 1
    return active, filled_inactive


def export_costs(reader: XlsxReader, version: str, rounding: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    records = sheet_records(reader.read_sheet("Kostenmodelle"), ["Kostenmodell_ID", "Bauteil_ID", "Vollkosten_Sockel_Quellwert", "Aktiv"])
    active, filled_inactive = active_or_filled_rows(records, ["Vollkosten_Sockel_Quellwert", "Vollkosten_Sockel_gerundet", "Kostenband_mitte"])
    warnings: list[str] = []
    if filled_inactive:
        warnings.append(f"Kostenmodelle: {filled_inactive} befüllte Zeile(n) sind nicht aktiv und wurden nicht exportiert.")
    models: list[dict[str, Any]] = []
    step = as_number(rounding.get("cost_per_m2_eur")) or 10
    for row in active:
        model_id = norm_text(value_by(row, "Kostenmodell_ID"))
        component_id = norm_text(value_by(row, "Bauteil_ID"))
        if not model_id or not component_id:
            warnings.append("Kostenmodelle: aktive Zeile ohne ID übersprungen.")
            continue
        base_source = as_number(value_by(row, "Vollkosten_Sockel_Quellwert"))
        base = base_source if base_source is not None else as_number(value_by(row, "Vollkosten_Sockel_gerundet"))
        variable_source = as_number(value_by(row, "Variable_Kosten_Quellwert"))
        variable = variable_source if variable_source is not None else as_number(value_by(row, "Variable_Kosten_gerundet"))
        sunk_source = as_number(value_by(row, "Sowiesokosten_Quellwert"))
        sunk = sunk_source if sunk_source is not None else as_number(value_by(row, "Sowiesokosten_gerundet"))
        low = as_number(value_by(row, "Kostenband_unten"))
        middle = as_number(value_by(row, "Kostenband_mitte"))
        high = as_number(value_by(row, "Kostenband_oben"))
        if base is None and middle is None:
            warnings.append(f"Kostenmodelle: {model_id} ohne Kostenwert übersprungen.")
            continue
        base = base if base is not None else middle
        item: dict[str, Any] = {
            "id": model_id,
            "component_id": component_id,
            "label": norm_text(value_by(row, "Massnahme_System", "Maßnahme_System")) or model_id,
            "base_cost_eur_m2": round_step(base, step),
            "variable_cost_eur_m2_cm": variable or 0,
            "sunk_cost_eur_m2": round_step(sunk or 0, step),
            "range_eur_m2": {
                "low": round_step(low if low is not None else base, step),
                "middle": round_step(middle if middle is not None else base, step),
                "high": round_step(high if high is not None else base, step),
            },
            "status": norm_text(value_by(row, "Status")) or "freigegeben",
            "active": True,
            "source_id": norm_text(value_by(row, "Quelle_ID")) or None,
            "data_date": excel_date(value_by(row, "Kostenstand")),
            "region": norm_text(value_by(row, "Region")) or None,
            "vat": norm_text(value_by(row, "MwSt")) or None,
            "included": norm_text(value_by(row, "Enthalten")) or None,
            "excluded": norm_text(value_by(row, "Nicht_enthalten")) or None,
            "note": norm_text(value_by(row, "Hinweise")) or None,
        }
        unit = norm_text(value_by(row, "Einheit"))
        if unit:
            item["unit"] = unit
        item["source_values"] = {
            "base_cost": base_source,
            "variable_cost": variable_source,
            "sunk_cost": sunk_source,
        }
        models.append(item)
    return {
        "schema": "energy-tools-renovation-costs",
        "version": version,
        "status": "excel-export",
        "notice": "Nur aktive Kostenmodelle. Quellenwerte bleiben dokumentiert; bereitgestellte Beratungswerte werden auf den festgelegten €/m²-Schritt gerundet.",
        "models": models,
    }, warnings


def export_energy_prices(reader: XlsxReader, version: str) -> tuple[dict[str, Any], list[str]]:
    records = sheet_records(reader.read_sheet("Energiepreise"), ["Energietraeger_ID", "Preis_Quellwert", "Aktiv"])
    active, filled_inactive = active_or_filled_rows(records, ["Preis_Quellwert"])
    warnings: list[str] = []
    if filled_inactive:
        warnings.append(f"Energiepreise: {filled_inactive} befüllte Zeile(n) sind nicht aktiv.")
    items: list[dict[str, Any]] = []
    for row in active:
        item_id = norm_text(value_by(row, "Energietraeger_ID"))
        price = as_number(value_by(row, "Preis_Quellwert"))
        if not item_id or price is None:
            warnings.append(f"Energiepreise: unvollständiger aktiver Datensatz {item_id or 'unbekannt'} übersprungen.")
            continue
        items.append({
            "id": item_id,
            "label": norm_text(value_by(row, "Energietraeger")) or item_id,
            "price": price,
            "unit": norm_text(value_by(row, "Einheit")) or "€/kWh Endenergie",
            "active": True,
            "price_date": excel_date(value_by(row, "Preisstand")),
            "region": norm_text(value_by(row, "Region")) or None,
            "source_id": norm_text(value_by(row, "Quelle_ID")) or None,
            "status": norm_text(value_by(row, "Status")) or None,
            "note": norm_text(value_by(row, "Hinweise")) or None,
        })
    return {"schema": "energy-tools-energy-prices", "version": version, "status": "excel-export", "items": items}, warnings


def export_emissions(reader: XlsxReader, version: str) -> tuple[dict[str, Any], list[str]]:
    records = sheet_records(reader.read_sheet("Emissionsfaktoren"), ["Energietraeger_ID", "Faktor_kgCO2e_kWh", "Aktiv"])
    active, filled_inactive = active_or_filled_rows(records, ["Faktor_kgCO2e_kWh"])
    warnings: list[str] = []
    if filled_inactive:
        warnings.append(f"Emissionsfaktoren: {filled_inactive} befüllte Zeile(n) sind nicht aktiv.")
    items: list[dict[str, Any]] = []
    for row in active:
        item_id = norm_text(value_by(row, "Energietraeger_ID"))
        factor = as_number(value_by(row, "Faktor_kgCO2e_kWh"))
        if not item_id or factor is None:
            warnings.append(f"Emissionsfaktoren: unvollständiger aktiver Datensatz {item_id or 'unbekannt'} übersprungen.")
            continue
        items.append({
            "id": item_id,
            "label": norm_text(value_by(row, "Energietraeger")) or item_id,
            "factor_kg_co2e_kwh": factor,
            "basis": norm_text(value_by(row, "Bezugsbasis")) or "Endenergie",
            "active": True,
            "data_date": excel_date(value_by(row, "Datenstand")),
            "region": norm_text(value_by(row, "Region")) or None,
            "source_id": norm_text(value_by(row, "Quelle_ID")) or None,
            "status": norm_text(value_by(row, "Status")) or None,
            "note": norm_text(value_by(row, "Hinweise")) or None,
        })
    return {"schema": "energy-tools-emission-factors", "version": version, "status": "excel-export", "items": items}, warnings


def export_finance(reader: XlsxReader, version: str) -> tuple[dict[str, Any], list[str]]:
    records = sheet_records(reader.read_sheet("Finanzannahmen"), ["Schluessel", "Beschreibung", "Wert"])
    values = {norm_text(value_by(row, "Schluessel")): value_by(row, "Wert") for row in records if norm_text(value_by(row, "Schluessel"))}
    defaults = {
        "period_years": smart_number(values.get("calculation_period_years")),
        "interest_rate_percent": as_number(values.get("interest_rate_pct")),
        "energy_price_escalation_percent": as_number(values.get("energy_price_escalation_pct")),
        "investment_price_escalation_percent": as_number(values.get("investment_price_escalation_pct")),
        "disposal_price_escalation_percent": as_number(values.get("disposal_price_escalation_pct")),
        "include_vat": as_bool(values.get("include_vat"), True),
    }
    rounding = {
        "thickness_cm": smart_number(values.get("thickness_rounding_cm")),
        "uvalue_decimals": smart_number(values.get("uvalue_decimals")),
        "cost_per_m2_eur": smart_number(values.get("cost_m2_rounding_eur")),
        "total_eur": smart_number(values.get("total_rounding_eur")),
        "annual_eur": smart_number(values.get("annual_rounding_eur")),
        "co2_kg": smart_number(values.get("co2_rounding_kg")),
    }
    warnings: list[str] = []
    missing = [key for key, value in defaults.items() if value is None]
    if missing:
        warnings.append("Finanzannahmen: fehlende Standardwerte: " + ", ".join(missing) + ". Bestehende Website-Datei wird im sicheren Modus beibehalten.")
    return {
        "schema": "energy-tools-financial-defaults",
        "version": version,
        "status": "excel-export",
        "defaults": {key: value if value is not None else DEFAULT_FINANCE[key] for key, value in defaults.items()},
        "rounding": {key: value if value is not None else DEFAULT_ROUNDING[key] for key, value in rounding.items()},
        "notice": "Finanzwerte sind sichtbare, überschreibbare Projektannahmen. Intern wird ohne Ergebnisrundung gerechnet.",
        "_missing_defaults": missing,
    }, warnings


def export_component_effects(reader: XlsxReader, version: str) -> tuple[dict[str, Any], list[str]]:
    records = sheet_records(reader.read_sheet("Komfort_Oekologie"), ["Wirkungs_ID", "Bauteil_ID", "Massnahme"])
    components: dict[str, Any] = {}
    for row in records:
        component_id = norm_text(value_by(row, "Bauteil_ID"))
        if not component_id:
            continue
        components[component_id] = {
            "measure": norm_text(value_by(row, "Massnahme", "Maßnahme")) or None,
            "winter_comfort": norm_text(value_by(row, "Winterkomfort")) or None,
            "summer_comfort": norm_text(value_by(row, "Sommerkomfort")) or None,
            "surface_temperature": norm_text(value_by(row, "Oberflaechentemperatur", "Oberflächentemperatur")) or None,
            "moisture": norm_text(value_by(row, "Feuchte_Risiko")) or None,
            "sound": norm_text(value_by(row, "Schallschutz")) or None,
            "daylight": norm_text(value_by(row, "Tageslicht")) or None,
            "material_ecology": norm_text(value_by(row, "Materialoekologie", "Materialökologie")) or None,
            "source_id": norm_text(value_by(row, "Quelle_ID")) or None,
            "note": norm_text(value_by(row, "Hinweise")) or None,
        }
    return {"components": components}, []


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def backup_existing(paths: list[Path], source_dir: Path, site_root: Path) -> Path | None:
    existing = [path for path in paths if path.exists()]
    if not existing:
        return None
    stamp = dt.datetime.now().strftime("%Y-%m-%d_%H%M%S")
    backup_dir = source_dir / "BAUTEIL_DATEN_BACKUPS" / stamp
    for path in existing:
        try:
            relative = path.relative_to(site_root)
        except ValueError:
            relative = Path(path.name)
        destination = backup_dir / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, destination)
    return backup_dir


def atomic_json_write(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False, suffix=".tmp") as handle:
        handle.write(payload)
        temporary = Path(handle.name)
    os.replace(temporary, path)


def main() -> int:
    parser = argparse.ArgumentParser(description="BAUTEIL_DATEN_MASTER.xlsx prüfen und in Website-JSON exportieren")
    parser.add_argument("--input", required=True, type=Path, help="Pfad zur BAUTEIL_DATEN_MASTER.xlsx")
    parser.add_argument("--site-root", required=True, type=Path, help="Hauptordner der Website")
    parser.add_argument("--write", action="store_true", help="JSON-Dateien wirklich schreiben; ohne Option nur prüfen")
    parser.add_argument("--allow-empty", action="store_true", help="Auch leere optionale Datensätze schreiben")
    args = parser.parse_args()

    input_path = args.input.expanduser().resolve()
    site_root = args.site_root.expanduser().resolve()
    if not input_path.exists():
        raise ExportError(f"Exceldatei nicht gefunden: {input_path}")
    if input_path.suffix.lower() != ".xlsx":
        raise ExportError("Es wird eine XLSX-Datei benötigt.")
    if not site_root.exists():
        raise ExportError(f"Website-Hauptordner nicht gefunden: {site_root}")

    try:
        input_path.relative_to(site_root)
        input_inside_site = True
    except ValueError:
        input_inside_site = False

    reader = XlsxReader(input_path)
    try:
        missing_sheets = REQUIRED_SHEETS - reader.sheet_names()
        if missing_sheets:
            raise ExportError("Pflichtblätter fehlen: " + ", ".join(sorted(missing_sheets)))
        version = source_version(reader)
        workbook_status = source_status(reader)

        finance, finance_warnings = export_finance(reader, version)
        datasets: dict[str, tuple[dict[str, Any], list[str]]] = {
            "targets": export_targets(reader, version),
            "existing_u_values": export_existing_u(reader, version),
            "lambda_values": export_lambda(reader, version),
            "costs": export_costs(reader, version, finance["rounding"]),
            "energy_prices": export_energy_prices(reader, version),
            "emissions": export_emissions(reader, version),
            "finance": (finance, finance_warnings),
            "measure_effects": export_component_effects(reader, version),
        }

        # Zusatzwirkungen besitzen genau eine zentrale Runtime-Datei. Die Excel-Pipeline
        # aktualisiert darin nur die bauteilspezifischen Detailtexte und bewahrt die
        # qualitativen Sanierungsfahrplan-Profile (`items`) unverändert.
        effects_path = site_root / DATASET_PATHS["measure_effects"]
        component_effects, component_effect_warnings = datasets["measure_effects"]
        existing_effects: dict[str, Any] = {}
        if effects_path.exists():
            try:
                existing_effects = json.loads(effects_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                component_effect_warnings.append("Bestehende measure-effects.json konnte nicht gelesen werden; Kartenprofile werden im Export nicht ergänzt.")
        merged_effects = {
            "schema": "energy-tools-measure-effects",
            "version": existing_effects.get("version", version),
            "data_date": existing_effects.get("data_date", dt.date.today().isoformat()),
            "notice": existing_effects.get("notice", "Qualitative Zusatzwirkungen für Beratung und Darstellung. Keine Punktesumme und keine Veränderung technischer oder wirtschaftlicher Berechnungen."),
            "levels": existing_effects.get("levels", ["none", "low", "medium", "high", "variable"]),
            "dimensions": existing_effects.get("dimensions", ["comfort", "health", "climate", "independence", "value", "effort", "summer", "ecology", "resilience"]),
            "components": component_effects.get("components", {}),
            "items": existing_effects.get("items", {}),
        }
        datasets["measure_effects"] = (merged_effects, component_effect_warnings)
    finally:
        reader.close()

    required_counts = {
        "targets": len(datasets["targets"][0].get("components", {})),
        "existing_u_values": len(datasets["existing_u_values"][0].get("components", {})),
        "lambda_values": len(datasets["lambda_values"][0].get("values", [])),
    }
    empty_required = [name for name, count in required_counts.items() if count == 0]
    if empty_required:
        raise ExportError("Pflichtdatensätze sind leer: " + ", ".join(empty_required))

    all_warnings: list[str] = []
    export_plan: dict[str, dict[str, Any]] = {}
    write_paths: list[Path] = []

    for name, (data, warnings) in datasets.items():
        all_warnings.extend(warnings)
        relative = DATASET_PATHS[name]
        target = site_root / relative
        if name == "finance":
            count = sum(value is not None for value in data.get("defaults", {}).values()) + len(data.get("rounding", {}))
        elif name == "measure_effects":
            count = len(data.get("components", {})) + len(data.get("items", {}))
        else:
            count = len(data.get("items", data.get("models", data.get("values", data.get("components", {})))))
        missing_finance = name == "finance" and bool(data.pop("_missing_defaults", []))
        optional_empty = name in {"costs", "energy_prices", "emissions", "measure_effects"} and count == 0
        preserve = (optional_empty or missing_finance) and target.exists() and not args.allow_empty
        action = "beibehalten" if preserve else ("schreiben" if args.write else "würde schreiben")
        export_plan[name] = {"path": relative, "count": count, "action": action, "warnings": warnings}
        if args.write and not preserve:
            write_paths.append(target)

    manifest = {
        "schema": "energy-tools-bauteil-data-manifest",
        "version": version,
        "generated_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "source_workbook": input_path.name,
        "source_sha256": sha256(input_path),
        "source_status": workbook_status,
        "source_inside_public_site": input_inside_site,
        "export_mode": "write" if args.write else "check",
        "datasets": export_plan,
        "warnings": all_warnings + (["Die Exceldatei liegt im Website-Ordner und würde über GitHub Pages veröffentlicht."] if input_inside_site else []),
    }

    print("\nBAUTEIL-DATEN – PRÜFBERICHT")
    print("=" * 72)
    print(f"Excel:       {input_path}")
    print(f"Website:     {site_root}")
    print(f"Datenmodell: {version}")
    print(f"Modus:       {'SCHREIBEN' if args.write else 'NUR PRÜFEN'}")
    if input_inside_site:
        print("WARNUNG: Die Exceldatei liegt im veröffentlichten Website-Ordner.")
    print()
    for name, info in export_plan.items():
        print(f"{name:20} {info['count']:>4} Datensätze · {info['action']} · {info['path']}")
    if all_warnings:
        print("\nHinweise:")
        for warning in all_warnings:
            print(f"- {warning}")

    if args.write:
        manifest_path = site_root / "shared/data/bauteil-data-manifest.json"
        backup_dir = backup_existing(write_paths + ([manifest_path] if manifest_path.exists() else []), input_path.parent, site_root)
        for name, target in [(name, site_root / DATASET_PATHS[name]) for name in datasets]:
            if target not in write_paths:
                continue
            atomic_json_write(target, datasets[name][0])
        atomic_json_write(manifest_path, manifest)
        report_path = input_path.parent / "BAUTEIL_DATEN_EXPORTBERICHT.json"
        atomic_json_write(report_path, manifest)
        print("\nExport abgeschlossen.")
        if backup_dir:
            print(f"Sicherung bisheriger JSON-Dateien: {backup_dir}")
        print(f"Manifest: {manifest_path}")
        print(f"Prüfbericht: {report_path}")
    else:
        print("\nEs wurde nichts verändert. Für den Export BAUTEIL_DATEN_AUFBEREITEN.bat verwenden.")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ExportError as error:
        print(f"\nFEHLER: {error}", file=sys.stderr)
        raise SystemExit(2)
    except zipfile.BadZipFile:
        print("\nFEHLER: Die Datei ist keine gültige XLSX-Datei oder ist beschädigt.", file=sys.stderr)
        raise SystemExit(3)
