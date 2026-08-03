#!/usr/bin/env python3
r"""Erzeugt ein jahresweises INCA-T2M-Paket aus Monats-NetCDF-Dateien.

Aufruf (normalerweise über die BAT-Datei):
  python inca_year_precompute.py --year 2026 --input "C:\INCA\2026" \
      --climate-dir "..\..\..\shared\data\climate\inca"

Die bestehende Berechnungsmethodik wird nachgebildet. Das Ergebnis wird
kachelweise gespeichert, damit der Browser für einen Standort nur die
betroffene Kachel je Jahr laden muss.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

try:
    import numpy as np
    import xarray as xr
except ImportError as exc:  # pragma: no cover - verständliche Windows-Hilfe
    raise SystemExit(
        "Fehlendes Python-Paket. Bitte die BAT-Datei verwenden oder installieren:\n"
        "  python -m pip install numpy xarray netCDF4\n"
        f"Technisches Detail: {exc}"
    )

NORMALIZED_HOURS = 8760
HEATING_LIMIT_C = 15.0
HOT_DAY_C = 30.0
EXTREME_HOT_DAY_C = 35.0
TROPICAL_NIGHT_C = 20.0
MIN_VALID_HOURS = 8000

TILE_NAME_RE = re.compile(r"^-?\d+_-?\d+\.json$")


@dataclass(frozen=True)
class TargetPoint:
    profile_id: str
    tile_id: str
    grid_x_m: float
    grid_y_m: float
    latitude: float
    longitude: float


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload, pretty: bool = False):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        if pretty:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
        else:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")


def discover_targets(climate_dir: Path) -> tuple[list[TargetPoint], dict[str, list[int]]]:
    tiles_dir = climate_dir / "tiles"
    if not tiles_dir.is_dir():
        raise SystemExit(f"Kachelordner fehlt: {tiles_dir}")

    targets: list[TargetPoint] = []
    tile_positions: dict[str, list[int]] = {}

    for tile_path in sorted(tiles_dir.glob("*.json")):
        if not TILE_NAME_RE.match(tile_path.name):
            continue
        payload = load_json(tile_path)
        if not isinstance(payload, dict):
            continue
        tile_id = tile_path.stem
        for profile_id, profile in payload.items():
            try:
                point = TargetPoint(
                    profile_id=str(profile_id),
                    tile_id=tile_id,
                    grid_x_m=float(profile["grid_x_m"]),
                    grid_y_m=float(profile["grid_y_m"]),
                    latitude=float(profile["grid_latitude"]),
                    longitude=float(profile["grid_longitude"]),
                )
            except (KeyError, TypeError, ValueError):
                continue
            tile_positions.setdefault(tile_id, []).append(len(targets))
            targets.append(point)

    if not targets:
        raise SystemExit(
            "Keine bestehenden Klimaprofile in shared/data/climate/inca/tiles gefunden. "
            "Die Jahrespakete verwenden deren Rasterpunkte als Zielraster."
        )

    return targets, tile_positions


def discover_input_files(input_dir: Path) -> list[Path]:
    patterns = ("*.nc", "*.nc4", "*.netcdf")
    files: list[Path] = []
    for pattern in patterns:
        files.extend(input_dir.rglob(pattern))
    return sorted(set(files))


def identify_temperature_variable(dataset: xr.Dataset) -> xr.DataArray:
    for name in ("T2M", "t2m"):
        if name in dataset.data_vars:
            return dataset[name]
    for name, variable in dataset.data_vars.items():
        long_name = str(variable.attrs.get("long_name", "")).lower()
        if "air temperature" in long_name and variable.ndim >= 3:
            return variable
    raise ValueError("T2M wurde in der NetCDF-Datei nicht gefunden.")


def identify_dimensions(variable: xr.DataArray) -> tuple[str, str, str]:
    time_dim = None
    for dim in variable.dims:
        coord = variable.coords.get(dim)
        if "time" in dim.lower() or (coord is not None and np.issubdtype(coord.dtype, np.datetime64)):
            time_dim = dim
            break
    if not time_dim:
        raise ValueError(f"Zeitdimension nicht erkannt: {variable.dims}")

    spatial = [dim for dim in variable.dims if dim != time_dim and variable.sizes.get(dim, 0) > 1]
    if len(spatial) != 2:
        raise ValueError(f"Zwei räumliche Dimensionen erwartet, gefunden: {spatial}")

    x_dim = next((dim for dim in spatial if dim.lower() in {"x", "lon", "longitude"}), None)
    y_dim = next((dim for dim in spatial if dim.lower() in {"y", "lat", "latitude"}), None)
    if not x_dim or not y_dim:
        x_dim, y_dim = spatial[-1], spatial[0]
    return time_dim, x_dim, y_dim


def nearest_indices(coord_values: np.ndarray, targets: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    values = np.asarray(coord_values, dtype=float).reshape(-1)
    order = np.argsort(values)
    sorted_values = values[order]
    positions = np.searchsorted(sorted_values, targets)
    positions = np.clip(positions, 0, len(sorted_values) - 1)
    left = np.clip(positions - 1, 0, len(sorted_values) - 1)
    right = positions
    choose_left = np.abs(sorted_values[left] - targets) <= np.abs(sorted_values[right] - targets)
    chosen_sorted = np.where(choose_left, left, right)
    indices = order[chosen_sorted]
    distance = np.abs(values[indices] - targets)
    return indices.astype(int), distance


def read_month_file(path: Path, targets: list[TargetPoint], year: int) -> tuple[np.ndarray, np.ndarray]:
    with xr.open_dataset(path, decode_times=True) as dataset:
        variable = identify_temperature_variable(dataset).squeeze(drop=True)
        time_dim, x_dim, y_dim = identify_dimensions(variable)

        x_values = np.asarray(variable.coords[x_dim].values)
        y_values = np.asarray(variable.coords[y_dim].values)
        geographic = np.nanmax(np.abs(x_values)) <= 180 and np.nanmax(np.abs(y_values)) <= 90

        target_x = np.array([point.longitude if geographic else point.grid_x_m for point in targets], dtype=float)
        target_y = np.array([point.latitude if geographic else point.grid_y_m for point in targets], dtype=float)

        x_index, x_distance = nearest_indices(x_values, target_x)
        y_index, y_distance = nearest_indices(y_values, target_y)

        tolerance = 0.02 if geographic else 600.0
        if np.nanmax(x_distance) > tolerance or np.nanmax(y_distance) > tolerance:
            raise ValueError(
                f"Raster passt nicht zu den bekannten INCA-Punkten ({path.name}). "
                f"Max. Abweichung x={np.nanmax(x_distance):.3f}, y={np.nanmax(y_distance):.3f}."
            )

        point_dim = "__target_point__"
        selected = variable.isel({
            x_dim: xr.DataArray(x_index, dims=point_dim),
            y_dim: xr.DataArray(y_index, dims=point_dim),
        }).transpose(time_dim, point_dim)

        times = np.asarray(selected.coords[time_dim].values).astype("datetime64[h]")
        values = np.asarray(selected.values, dtype=np.float32)

        # Nur Zieljahr übernehmen; zusätzliche Randstunden dürfen in der Eingabe liegen.
        years = times.astype("datetime64[Y]").astype(int) + 1970
        mask = years == year
        times = times[mask]
        values = values[mask, :]

        units = str(variable.attrs.get("units", variable.attrs.get("unit", ""))).lower()
        finite = values[np.isfinite(values)]
        if finite.size and ("kelvin" in units or units.strip() == "k" or np.nanmedian(finite) > 100):
            values = values - np.float32(273.15)

        return times, values


def build_full_year(files: list[Path], targets: list[TargetPoint], year: int) -> tuple[np.ndarray, np.ndarray, list[str]]:
    chunks: list[tuple[np.ndarray, np.ndarray, str]] = []
    months_seen: set[int] = set()

    for index, path in enumerate(files, start=1):
        print(f"[{index:02d}/{len(files):02d}] lese {path.name}")
        times, values = read_month_file(path, targets, year)
        if not len(times):
            continue
        months = (times.astype("datetime64[M]").astype(int) % 12) + 1
        months_seen.update(int(month) for month in np.unique(months))
        chunks.append((times, values, path.name))

    if not chunks:
        raise SystemExit(f"Keine T2M-Stundenwerte für {year} gefunden.")

    all_times = np.concatenate([item[0] for item in chunks])
    all_values = np.concatenate([item[1] for item in chunks], axis=0)
    order = np.argsort(all_times)
    all_times = all_times[order]
    all_values = all_values[order, :]

    # Doppelte Randstunden aus Monatsdateien entfernen.
    unique_times, unique_index = np.unique(all_times, return_index=True)
    all_values = all_values[unique_index, :]
    all_times = unique_times

    start = np.datetime64(f"{year:04d}-01-01T00", "h")
    end = np.datetime64(f"{year + 1:04d}-01-01T00", "h")
    full_times = np.arange(start, end, np.timedelta64(1, "h"), dtype="datetime64[h]")
    matrix = np.full((len(full_times), len(targets)), np.nan, dtype=np.float32)

    offsets = ((all_times - start) / np.timedelta64(1, "h")).astype(int)
    valid = (offsets >= 0) & (offsets < len(full_times))
    matrix[offsets[valid], :] = all_values[valid, :]

    if months_seen != set(range(1, 13)):
        missing = sorted(set(range(1, 13)) - months_seen)
        print(f"WARNUNG: Nicht alle 12 Monate erkannt. Fehlend: {missing}")

    return full_times, matrix, [item[2] for item in chunks]


def js_round_scalar(value: float) -> int:
    """Entspricht Math.round() für endliche Zahlen (wichtig auch bei negativen .5-Werten)."""
    return int(math.floor(value + 0.5))


def q100(value: float | None) -> int | None:
    if value is None or not math.isfinite(value):
        return None
    return js_round_scalar(value * 100)


def js_round(values: np.ndarray) -> np.ndarray:
    return np.floor(values + 0.5)


def min_24h_mean(values: np.ndarray) -> float | None:
    if len(values) < 24:
        return None
    valid = np.isfinite(values)
    safe = np.where(valid, values, 0.0).astype(np.float64)
    sums = np.convolve(safe, np.ones(24), mode="valid")
    counts = np.convolve(valid.astype(np.int16), np.ones(24, dtype=np.int16), mode="valid")
    candidates = sums[counts == 24] / 24.0
    return float(np.min(candidates)) if candidates.size else None


def daily_metrics(values: np.ndarray) -> tuple[int, int, int, int, float | None]:
    days = values.reshape((-1, 24))
    valid_count = np.sum(np.isfinite(days), axis=1)
    valid_day = valid_count >= 20
    safe = np.where(np.isfinite(days), days, -np.inf)
    maxima = np.max(safe, axis=1)
    evaluated = maxima[valid_day]
    if not evaluated.size:
        return 0, 0, 0, int(len(days)), None
    return (
        int(np.sum(evaluated >= HOT_DAY_C)),
        int(np.sum(evaluated >= EXTREME_HOT_DAY_C)),
        int(np.sum(valid_day)),
        int(np.sum(~valid_day)),
        float(np.max(evaluated)),
    )


def night_metrics(
    values: np.ndarray,
    previous_dec31_evening: np.ndarray | None = None,
) -> tuple[int, int, int, float | None]:
    """Nacht = 18–23 UTC des Vortags + 00–06 UTC des Morgens.

    Für den 1. Jänner kann die im Vorjahrespaket gespeicherte 31.-Dezember-
    Abendgrenze verwendet werden. So bleibt die Methodik nach der einmaligen
    Migration auch bei später angehängten Jahren identisch zur Mehrjahresauswertung.
    """
    days = values.reshape((-1, 24))
    tropical = 0
    valid_nights = 0
    incomplete = 0
    warmest_min = -np.inf

    for day in range(len(days)):
        if day == 0:
            if previous_dec31_evening is not None and len(previous_dec31_evening) == 6:
                night = np.concatenate([previous_dec31_evening, days[day, 0:7]])
            else:
                night = days[day, 0:7]
        else:
            night = np.concatenate([days[day - 1, 18:24], days[day, 0:7]])
        night = night[np.isfinite(night)]
        if len(night) != 13:
            incomplete += 1
            continue
        valid_nights += 1
        minimum = float(np.min(night))
        warmest_min = max(warmest_min, minimum)
        if minimum >= TROPICAL_NIGHT_C:
            tropical += 1

    return tropical, valid_nights, incomplete, (warmest_min if math.isfinite(warmest_min) else None)


def duration_samples(valid_values: np.ndarray, sample_indices: list[int]) -> list[int]:
    sorted_values = np.sort(valid_values.astype(np.float64))
    source_last = len(sorted_values) - 1
    target_last = NORMALIZED_HOURS - 1
    samples: list[int] = []
    for target_index in sample_indices:
        source_position = (target_index / target_last) * source_last
        lower = int(math.floor(source_position))
        upper = int(math.ceil(source_position))
        weight = source_position - lower
        value = sorted_values[lower] * (1 - weight) + sorted_values[upper] * weight
        samples.append(q100(float(value)) or 0)
    return samples


def analyze_point(values: np.ndarray, year: int, manifest: dict, previous_dec31_evening: np.ndarray | None = None) -> tuple[list, list[int]]:
    valid_values = values[np.isfinite(values)].astype(np.float64)
    if len(valid_values) < MIN_VALID_HOURS:
        raise ValueError(f"Nur {len(valid_values)} gültige Stundenwerte vorhanden.")

    hot_days, extreme_hot_days, valid_days, incomplete_days, maximum_hourly = daily_metrics(values)
    tropical_nights, valid_nights, incomplete_nights, warmest_night = night_metrics(values, previous_dec31_evening)

    frequency_min = int(manifest.get("frequency_min_c", -35))
    frequency_max = int(manifest.get("frequency_max_c", 40))
    bins = frequency_max - frequency_min + 1
    rounded = js_round(valid_values).astype(int)
    frequency_counts = np.zeros(bins, dtype=np.float64)
    inside = (rounded >= frequency_min) & (rounded <= frequency_max)
    np.add.at(frequency_counts, rounded[inside] - frequency_min, 1)
    frequency_hours = frequency_counts * (NORMALIZED_HOURS / len(valid_values))
    frequency_q10 = [js_round_scalar(float(value) * 10) for value in frequency_hours]

    nat_thresholds = [float(value) for value in manifest.get("nat_thresholds_c", [])]
    nat_counts = [int(np.sum(valid_values <= threshold)) for threshold in nat_thresholds]

    heating_degree_hours = float(np.sum(np.maximum(0.0, HEATING_LIMIT_C - valid_values)))

    field_values = {
        "year": int(year),
        "received_hours": int(len(values)),
        "expected_hours": int(len(values)),
        "valid_hours": int(len(valid_values)),
        "missing_values": int(len(values) - len(valid_values)),
        "minimum_hourly_c_q100": q100(float(np.min(valid_values))),
        "minimum_24h_mean_c_q100": q100(min_24h_mean(values)),
        "maximum_hourly_c_q100": q100(maximum_hourly),
        "hours_below_0": int(np.sum(valid_values < 0)),
        "hours_below_minus_5": int(np.sum(valid_values < -5)),
        "hours_below_minus_10": int(np.sum(valid_values < -10)),
        "heating_demand_hours": int(np.sum(valid_values < HEATING_LIMIT_C)),
        "heating_degree_hours_q100": q100(heating_degree_hours),
        "hot_days": hot_days,
        "extreme_hot_days": extreme_hot_days,
        "valid_heat_days": valid_days,
        "incomplete_heat_days": incomplete_days,
        "tropical_nights": tropical_nights,
        "valid_nights": valid_nights,
        "incomplete_nights": incomplete_nights,
        "warmest_night_minimum_c_q100": q100(warmest_night),
        "frequency_q10": frequency_q10,
        "nat_counts": nat_counts,
    }

    schema = manifest.get("annual_schema", [])
    missing_fields = [name for name in schema if name not in field_values]
    if missing_fields:
        raise ValueError(f"annual_schema enthält unbekannte Felder: {missing_fields}")

    row = [field_values[name] for name in schema]
    duration = duration_samples(valid_values, [int(value) for value in manifest.get("duration_sample_indices", [])])
    return row, duration


def load_previous_boundaries(climate_dir: Path, year: int, tile_ids: Iterable[str]) -> dict[str, np.ndarray]:
    """Lädt die sechs Abendstunden 18–23 UTC vom 31.12. des Vorjahres.

    Fehlt das Vorjahrespaket (typisch beim ersten Basisjahr), bleibt nur die
    Nacht zum 1. Jänner unvollständig – genauso wie im bisherigen Basispaket
    beim allerersten Auswertungsjahr.
    """
    previous_year = year - 1
    boundaries: dict[str, np.ndarray] = {}
    for tile_id in tile_ids:
        path = climate_dir / "yearly" / str(previous_year) / f"{tile_id}.json"
        if not path.is_file():
            continue
        try:
            payload = load_json(path)
        except (OSError, json.JSONDecodeError):
            continue
        for profile_id, profile in payload.items():
            packed = profile.get("dec31_evening_q100")
            if not isinstance(packed, list) or len(packed) != 6 or any(value is None for value in packed):
                continue
            boundaries[str(profile_id)] = np.asarray(packed, dtype=np.float64) / 100.0
    return boundaries


def dec31_evening_q100(values: np.ndarray) -> list[int | None]:
    if len(values) < 24:
        return []
    evening = values[-6:]
    return [q100(float(value)) if np.isfinite(value) else None for value in evening]


def update_yearly_index(climate_dir: Path, targets: list[TargetPoint], manifest: dict):
    index_payload = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "grid_crs": manifest.get("grid_crs", "EPSG:31287"),
        "grid_spacing_m": manifest.get("grid_spacing_m", 1000),
        "lookup_max_distance_m": manifest.get("lookup_max_distance_m", 850),
        "profile_count": len(targets),
        "index": [
            [point.profile_id, point.latitude, point.longitude, point.tile_id]
            for point in targets
        ],
    }
    write_json(climate_dir / "yearly" / "index.json", index_payload, pretty=False)


def update_global_manifest(climate_dir: Path, manifest: dict, year: int, profile_count: int):
    baseline_years = sorted(int(value) for value in manifest.get("years", []))
    yearly = manifest.setdefault("yearly_packages", {})
    yearly.setdefault("schema_version", 1)
    yearly.setdefault("index_path", "yearly/index.json")
    yearly.setdefault("year_manifest_pattern", "yearly/{year}.json")

    previously_generated = yearly.get("available_years", yearly.get("years", []))
    generated = sorted(set(int(value) for value in previously_generated) | {int(year)})
    yearly["available_years"] = generated

    start_year = min(baseline_years) if baseline_years else (min(generated) if generated else year)
    generated_set = set(generated)
    contiguous: list[int] = []
    current = start_year
    while current in generated_set:
        contiguous.append(current)
        current += 1

    baseline_complete = bool(baseline_years) and set(baseline_years).issubset(set(contiguous))
    if not baseline_years:
        baseline_complete = bool(contiguous)

    yearly["enabled"] = baseline_complete
    yearly["years"] = contiguous

    if baseline_complete:
        manifest["years"] = contiguous
        manifest["coverage_mode"] = "full"
        manifest["status"] = "yearly_packages_active"
        manifest["profile_count"] = int(profile_count)
        manifest["note"] = (
            "Vollständige Tirol-Abdeckung über jahresweise vorberechnete INCA-Pakete. "
            "Fehlende Einzeljahre werden im Browser gezielt live ergänzt."
        )
        pending = sorted(set(generated) - set(contiguous))
        if pending:
            yearly["note"] = (
                "Jahrespakete aktiv. Noch nicht lückenlos anschließende Pakete liegen bereit: "
                + ", ".join(str(value) for value in pending)
                + ". Sie werden automatisch aktiv, sobald die fehlenden Zwischenjahre ergänzt sind."
            )
        else:
            yearly["note"] = "Jahrespakete aktiv. Neue lückenlos anschließende Jahre erweitern den Zeitraum automatisch."
    else:
        missing_baseline = sorted(set(baseline_years) - set(contiguous))
        yearly["note"] = (
            "Jahrespakete vorbereitet, aber noch nicht aktiv. Für die einmalige Migration fehlen: "
            + ", ".join(str(value) for value in missing_baseline)
        )

    write_json(climate_dir / "manifest.json", manifest, pretty=True)


def update_tool_datenstand(climate_dir: Path, manifest: dict):
    """Hält den sichtbaren Wartungsmetadatensatz mit dem aktiven Zeitraum synchron."""
    path = climate_dir.parent / "datenstand.json"
    if not path.is_file():
        return
    try:
        payload = load_json(path)
    except (OSError, json.JSONDecodeError):
        return

    years = [int(value) for value in manifest.get("years", [])]
    inca = payload.setdefault("inca", {})
    if years:
        inca["start_year"] = min(years)
        inca["end_year"] = max(years)
    yearly = manifest.get("yearly_packages", {})
    inca["yearly_package_status"] = (
        "aktiv" if yearly.get("enabled") else "vorbereitet, noch nicht aktiviert"
    )
    payload["generated_at"] = datetime.now(timezone.utc).isoformat()
    write_json(path, payload, pretty=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="INCA-Jahr aus Monats-NetCDF-Dateien vorberechnen")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--input", type=Path, required=True, help="Ordner mit Monats-NetCDF-Dateien")
    parser.add_argument("--climate-dir", type=Path, required=True, help="Ordner shared/data/climate/inca")
    args = parser.parse_args()

    climate_dir = args.climate_dir.resolve()
    input_dir = args.input.resolve()
    manifest_path = climate_dir / "manifest.json"
    if not manifest_path.is_file():
        raise SystemExit(f"Manifest fehlt: {manifest_path}")
    if not input_dir.is_dir():
        raise SystemExit(f"Eingabeordner fehlt: {input_dir}")

    manifest = load_json(manifest_path)
    # Bei einem 1-km-Raster kann ein beliebiger Standort geometrisch bis
    # rund 707 m vom nächstgelegenen Rasterzentrum entfernt liegen. 180 m
    # war nur für die frühere Demoabdeckung geeignet und würde reale
    # Standorte unnötig in den Live-Fallback schicken.
    manifest["lookup_max_distance_m"] = max(
        850,
        int(manifest.get("lookup_max_distance_m", 0) or 0),
    )
    targets, tile_positions = discover_targets(climate_dir)
    files = discover_input_files(input_dir)
    if not files:
        raise SystemExit(f"Keine NetCDF-Dateien in {input_dir} gefunden.")

    print(f"Zieljahr: {args.year}")
    print(f"NetCDF-Dateien gefunden: {len(files)}")
    print(f"INCA-Rasterpunkte aus bestehendem Bestand: {len(targets)}")

    full_times, matrix, used_files = build_full_year(files, targets, args.year)
    print(f"Stundenraster: {len(full_times)} · Punkte: {len(targets)}")

    year_dir = climate_dir / "yearly" / str(args.year)
    tile_payloads: dict[str, dict] = {tile_id: {} for tile_id in tile_positions}
    previous_boundaries = load_previous_boundaries(climate_dir, args.year, tile_positions.keys())
    warnings: list[str] = []
    if previous_boundaries:
        print(f"Vorjahresgrenze für Tropennächte: {len(previous_boundaries)} Profile verfügbar.")
    else:
        print("Hinweis: Keine Vorjahresgrenze gefunden; die Nacht zum 1. Jänner kann unvollständig sein.")

    for point_index, point in enumerate(targets, start=1):
        if point_index == 1 or point_index % 250 == 0 or point_index == len(targets):
            print(f"berechne Rasterpunkt {point_index}/{len(targets)}")
        values = matrix[:, point_index - 1]
        try:
            annual_row, duration = analyze_point(values, args.year, manifest, previous_boundaries.get(point.profile_id))
        except ValueError as exc:
            warnings.append(f"{point.profile_id}: {exc}")
            continue
        tile_payloads[point.tile_id][point.profile_id] = {
            "annual_row": annual_row,
            "duration_q100": duration,
            "dec31_evening_q100": dec31_evening_q100(values),
        }

    tiles_map: dict[str, str] = {}
    for tile_id, payload in tile_payloads.items():
        if not payload:
            continue
        relative = f"yearly/{args.year}/{tile_id}.json"
        write_json(climate_dir / relative, payload, pretty=False)
        tiles_map[tile_id] = relative

    year_manifest = {
        "schema_version": 1,
        "year": args.year,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "GeoSphere Austria INCA-v1-1h-1km T2M",
        "license": "CC BY 4.0",
        "parameter": "T2M",
        "timezone": "UTC",
        "grid_crs": manifest.get("grid_crs", "EPSG:31287"),
        "annual_schema": manifest.get("annual_schema", []),
        "duration_sample_indices": manifest.get("duration_sample_indices", []),
        "duration_temperature_scale": manifest.get("duration_temperature_scale", 100),
        "frequency_scale": manifest.get("frequency_scale", 10),
        "profile_count": sum(len(payload) for payload in tile_payloads.values()),
        "tile_count": len(tiles_map),
        "tiles": tiles_map,
        "input_files": used_files,
        "boundary_note": "Für die Tropennacht zum 1. Jänner wird – wenn vorhanden – die im Vorjahrespaket gespeicherte 31.-Dezember-Abendgrenze verwendet. Beim ersten Basisjahr ohne Vorjahrespaket kann diese eine Nacht unvollständig bleiben.",
        "previous_year_boundary_profiles": len(previous_boundaries),
        "warnings": warnings[:200],
        "warning_count": len(warnings),
    }
    write_json(climate_dir / "yearly" / f"{args.year}.json", year_manifest, pretty=True)
    update_yearly_index(climate_dir, targets, manifest)
    update_global_manifest(climate_dir, manifest, args.year, len(targets))
    update_tool_datenstand(climate_dir, manifest)

    print()
    print(f"FERTIG: Jahrespaket {args.year}")
    print(f"Jahresmanifest: {climate_dir / 'yearly' / f'{args.year}.json'}")
    print(f"Kacheln: {len(tiles_map)}")
    if warnings:
        print(f"Warnungen: {len(warnings)} (siehe Jahresmanifest)")
    print("Das Hauptmanifest wurde aktualisiert.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
