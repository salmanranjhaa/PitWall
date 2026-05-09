"""
F1 Circuit Track Path Extractor

Extracts real F1 circuit outlines from FastF1 telemetry data and outputs them
as TypeScript-ready coordinate arrays normalized to a 0-100 x 0-75 viewport.

Run from the project/backend directory:
    uv run python scripts/extract_track_paths.py
"""

import os
import sys
import warnings

warnings.filterwarnings("ignore")

# Make sure the app package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

import numpy as np
import fastf1

# FastF1 cache
CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "cache")
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "track_paths_output.txt")

# Circuits to extract: (year, event_name, key)
CIRCUITS = [
    (2024, "Bahrain Grand Prix",        "Bahrain"),
    (2024, "Saudi Arabian Grand Prix",  "Jeddah"),
    (2024, "Australian Grand Prix",     "Melbourne"),
    (2024, "Japanese Grand Prix",       "Suzuka"),
    (2024, "Chinese Grand Prix",        "Shanghai"),
    (2024, "Miami Grand Prix",          "Miami"),
    (2024, "Emilia Romagna Grand Prix", "Imola"),
    (2024, "Monaco Grand Prix",         "Monaco"),
    (2024, "Canadian Grand Prix",       "Canada"),
    (2024, "Spanish Grand Prix",        "Spain"),
    (2024, "Austrian Grand Prix",       "Austria"),
    (2024, "British Grand Prix",        "Silverstone"),
    (2024, "Hungarian Grand Prix",      "Hungary"),
    (2024, "Belgian Grand Prix",        "Spa"),
    (2024, "Dutch Grand Prix",          "Zandvoort"),
    (2024, "Italian Grand Prix",        "Monza"),
    (2024, "Azerbaijan Grand Prix",     "Baku"),
    (2024, "Singapore Grand Prix",      "Singapore"),
    (2024, "United States Grand Prix",  "COTA"),
    (2024, "Mexico City Grand Prix",    "Mexico"),
    (2024, "São Paulo Grand Prix",      "Brazil"),
    (2024, "Las Vegas Grand Prix",      "LasVegas"),
    (2024, "Qatar Grand Prix",          "Qatar"),
    (2024, "Abu Dhabi Grand Prix",      "AbuDhabi"),
]

# Known approximate sector splits (fraction of total distance)
SECTOR_SPLITS = {
    "Bahrain":    {"s1": 0.34, "s2": 0.66},
    "Jeddah":     {"s1": 0.30, "s2": 0.64},
    "Melbourne":  {"s1": 0.32, "s2": 0.65},
    "Suzuka":     {"s1": 0.38, "s2": 0.70},
    "Shanghai":   {"s1": 0.28, "s2": 0.62},
    "Miami":      {"s1": 0.35, "s2": 0.67},
    "Imola":      {"s1": 0.38, "s2": 0.72},
    "Monaco":     {"s1": 0.29, "s2": 0.64},
    "Canada":     {"s1": 0.33, "s2": 0.67},
    "Spain":      {"s1": 0.36, "s2": 0.70},
    "Austria":    {"s1": 0.42, "s2": 0.72},
    "Silverstone":{"s1": 0.30, "s2": 0.65},
    "Hungary":    {"s1": 0.35, "s2": 0.70},
    "Spa":        {"s1": 0.25, "s2": 0.58},
    "Zandvoort":  {"s1": 0.34, "s2": 0.68},
    "Monza":      {"s1": 0.32, "s2": 0.65},
    "Baku":       {"s1": 0.24, "s2": 0.56},
    "Singapore":  {"s1": 0.31, "s2": 0.63},
    "COTA":       {"s1": 0.35, "s2": 0.68},
    "Mexico":     {"s1": 0.34, "s2": 0.68},
    "Brazil":     {"s1": 0.30, "s2": 0.62},
    "LasVegas":   {"s1": 0.28, "s2": 0.62},
    "Qatar":      {"s1": 0.33, "s2": 0.67},
    "AbuDhabi":   {"s1": 0.34, "s2": 0.68},
}

NUM_POINTS = 80
VIEWPORT_W = 100.0
VIEWPORT_H = 75.0
PADDING = 3.0  # units of padding on each side
USABLE_W = VIEWPORT_W - 2 * PADDING  # 94
USABLE_H = VIEWPORT_H - 2 * PADDING  # 69


def downsample_path(x, y, n_points):
    """Resample a path to n evenly-spaced points using cumulative arc length."""
    dx = np.diff(x)
    dy = np.diff(y)
    seg_lengths = np.sqrt(dx**2 + dy**2)
    cum_dist = np.concatenate([[0.0], np.cumsum(seg_lengths)])
    total = cum_dist[-1]
    if total == 0:
        raise ValueError("Zero-length path")
    # Evenly-spaced sample positions along the cumulative distance
    sample_dist = np.linspace(0, total, n_points)
    x_new = np.interp(sample_dist, cum_dist, x)
    y_new = np.interp(sample_dist, cum_dist, y)
    return x_new, y_new


def normalize_path(x, y):
    """
    Normalize coordinates to fit within the 0-100 x 0-75 viewport
    with PADDING units of border. Preserves aspect ratio.
    Returns (x_norm, y_norm).
    """
    x_min, x_max = x.min(), x.max()
    y_min, y_max = y.min(), y.max()
    span_x = x_max - x_min
    span_y = y_max - y_min

    if span_x == 0 or span_y == 0:
        raise ValueError("Degenerate bounding box (zero span on one axis)")

    # Scale uniformly to fit within the usable area (94 x 69)
    scale = min(USABLE_W / span_x, USABLE_H / span_y)

    x_scaled = (x - x_min) * scale
    y_scaled = (y - y_min) * scale

    # Center within the usable box
    scaled_w = span_x * scale
    scaled_h = span_y * scale
    offset_x = PADDING + (USABLE_W - scaled_w) / 2.0
    offset_y = PADDING + (USABLE_H - scaled_h) / 2.0

    x_norm = x_scaled + offset_x
    y_norm = y_scaled + offset_y

    return x_norm, y_norm


def extract_circuit(year, event_name, key):
    """
    Load session, get fastest lap telemetry, extract and normalize path.
    Returns (x_norm, y_norm) or raises on failure.
    """
    years_to_try = [year]
    if year == 2024:
        years_to_try = [2024, 2023, 2022]

    last_error = None
    for yr in years_to_try:
        try:
            session = fastf1.get_session(yr, event_name, "R")
            session.load(laps=True, telemetry=True, weather=False, messages=False)

            fastest_lap = session.laps.pick_fastest()
            if fastest_lap is None or fastest_lap.empty:
                raise ValueError("No fastest lap found")

            telemetry = fastest_lap.get_telemetry()
            if telemetry is None or telemetry.empty:
                raise ValueError("Empty telemetry")

            if "X" not in telemetry.columns or "Y" not in telemetry.columns:
                raise ValueError("No X/Y columns in telemetry")

            x_raw = telemetry["X"].dropna().values.astype(float)
            y_raw = telemetry["Y"].dropna().values.astype(float)

            if len(x_raw) < 20:
                raise ValueError(f"Too few telemetry points: {len(x_raw)}")

            # Flip Y axis (FastF1 Y is inverted relative to screen coordinates)
            y_raw = -y_raw

            # Downsample to NUM_POINTS
            x_ds, y_ds = downsample_path(x_raw, y_raw, NUM_POINTS)

            # Normalize to viewport
            x_norm, y_norm = normalize_path(x_ds, y_ds)

            # Round to 1 decimal
            x_norm = np.round(x_norm, 1)
            y_norm = np.round(y_norm, 1)

            print(f"  OK ({yr}, {len(x_raw)} raw points -> {NUM_POINTS} downsampled)")
            return x_norm, y_norm

        except Exception as e:
            last_error = e
            print(f"  Attempt {yr} failed: {e}")
            continue

    raise RuntimeError(f"All attempts failed for {key}: {last_error}")


def format_coords(x_norm, y_norm):
    """Format as a TypeScript array literal (compact, 5 pairs per line)."""
    pairs = []
    for xv, yv in zip(x_norm, y_norm):
        pairs.append(f"[{xv},{yv}]")

    # Group into rows of 5 pairs for readability
    lines = []
    for i in range(0, len(pairs), 5):
        lines.append("  " + ",".join(pairs[i:i+5]))
    return "\n".join(lines)


def main():
    results = {}
    failed = []

    for year, event_name, key in CIRCUITS:
        print(f"Extracting {key} ({event_name} {year})...")
        try:
            x_norm, y_norm = extract_circuit(year, event_name, key)
            results[key] = (x_norm, y_norm)
        except Exception as e:
            print(f"  FAILED: {e}")
            failed.append((key, str(e)))

    print(f"\n--- Summary ---")
    print(f"Extracted: {len(results)}/{len(CIRCUITS)}")
    if failed:
        print(f"Failed circuits:")
        for key, err in failed:
            print(f"  {key}: {err}")

    # Write output file
    output_path = os.path.join(os.path.dirname(__file__), "..", "data", "track_paths_output.txt")
    output_path = os.path.normpath(output_path)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("// F1 Circuit Track Paths\n")
        f.write("// Generated by extract_track_paths.py\n")
        f.write("// Coordinate system: 0-100 (width) x 0-75 (height), 3-unit padding\n")
        f.write("// Points: 80 evenly-spaced along fastest lap telemetry\n\n")

        for year, event_name, key in CIRCUITS:
            if key not in results:
                f.write(f"// {key}: EXTRACTION FAILED\n\n")
                continue

            x_norm, y_norm = results[key]
            splits = SECTOR_SPLITS.get(key, {"s1": 0.33, "s2": 0.67})

            f.write(f"{key}: [\n")
            f.write(format_coords(x_norm, y_norm))
            f.write(f"\n],\n")
            f.write(f"// {key} sector splits: s1End={splits['s1']}, s2End={splits['s2']}\n\n")

    print(f"\nOutput written to: {output_path}")
    print("EXTRACTION COMPLETE")


if __name__ == "__main__":
    main()
