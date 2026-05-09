"""
F1 Track Database Module

Defines the Track dataclass and a comprehensive database of all 24 Formula 1 circuits
used in the championship. Each track includes realistic physical characteristics,
strategic parameters, and reference lap times that influence race simulation outcomes.
"""

from dataclasses import dataclass, field
from typing import Dict


@dataclass(frozen=True)
class Track:
    """
    Immutable dataclass representing a Formula 1 racing circuit.

    Attributes:
        name: Official circuit name (e.g., 'Bahrain International Circuit').
        location: City or region where the circuit is located.
        country: Host country of the Grand Prix.
        length_km: Length of one lap in kilometers.
        laps: Total number of racing laps for the Grand Prix.
        corners: Total number of corners (left and right combined).
        drs_zones: Number of DRS (Drag Reduction System) zones on the circuit.
        pit_loss_time: Time lost (in seconds) for a full pit stop including entry and exit.
        tire_severity: Tire degradation severity rating, 1 (low) to 10 (extreme).
        overtaking_difficulty: Difficulty rating for overtaking maneuvers, 1 (easy) to 10 (nearly impossible).
        downforce_level: Required downforce level as a descriptive string.
        sc_probability: Historical probability (0-1) of a Safety Car deployment during the race.
        fuel_per_lap: Fuel consumption per lap in kilograms.
        rain_probability: Dict mapping month number (1-12) to probability (0-1) of race-day rain.
        reference_lap_times: Dict mapping tire compound to reference dry-weather lap time in seconds.
    """

    name: str
    location: str
    country: str
    length_km: float
    laps: int
    corners: int
    drs_zones: int
    pit_loss_time: float
    tire_severity: int          # 1 (low) to 10 (extreme)
    overtaking_difficulty: int  # 1 (easy) to 10 (nearly impossible)
    downforce_level: str
    sc_probability: float
    fuel_per_lap: float
    rain_probability: Dict[int, float]
    reference_lap_times: Dict[str, float]


# =============================================================================
# 2024 F1 CIRCUIT DATABASE
# =============================================================================

BAHRAIN = Track(
    name="Bahrain International Circuit",
    location="Sakhir",
    country="Bahrain",
    length_km=5.412,
    laps=57,
    corners=15,
    drs_zones=3,
    pit_loss_time=22.5,
    tire_severity=8,
    overtaking_difficulty=4,
    downforce_level="high",
    sc_probability=0.35,
    fuel_per_lap=1.52,
    rain_probability={1: 0.02, 2: 0.03, 3: 0.01, 4: 0.01, 5: 0.01,
                      6: 0.00, 7: 0.00, 8: 0.00, 9: 0.00, 10: 0.01,
                      11: 0.02, 12: 0.02},
    reference_lap_times={"SOFT": 91.5, "MEDIUM": 93.2, "HARD": 95.0},
)

JEDDAH = Track(
    name="Jeddah Street Circuit",
    location="Jeddah",
    country="Saudi Arabia",
    length_km=6.174,
    laps=50,
    corners=27,
    drs_zones=3,
    pit_loss_time=23.0,
    tire_severity=5,
    overtaking_difficulty=6,
    downforce_level="medium-high",
    sc_probability=0.55,
    fuel_per_lap=1.68,
    rain_probability={1: 0.01, 2: 0.02, 3: 0.05, 4: 0.03, 5: 0.01,
                      6: 0.00, 7: 0.00, 8: 0.00, 9: 0.00, 10: 0.01,
                      11: 0.02, 12: 0.02},
    reference_lap_times={"SOFT": 88.2, "MEDIUM": 90.0, "HARD": 91.8},
)

MELBOURNE = Track(
    name="Albert Park Circuit",
    location="Melbourne",
    country="Australia",
    length_km=5.278,
    laps=58,
    corners=14,
    drs_zones=4,
    pit_loss_time=21.5,
    tire_severity=6,
    overtaking_difficulty=5,
    downforce_level="medium",
    sc_probability=0.45,
    fuel_per_lap=1.48,
    rain_probability={1: 0.15, 2: 0.12, 3: 0.18, 4: 0.22, 5: 0.25,
                      6: 0.22, 7: 0.25, 8: 0.24, 9: 0.20, 10: 0.18,
                      11: 0.16, 12: 0.14},
    reference_lap_times={"SOFT": 77.5, "MEDIUM": 79.2, "HARD": 81.0},
)

SUZUKA = Track(
    name="Suzuka International Racing Course",
    location="Suzuka",
    country="Japan",
    length_km=5.807,
    laps=53,
    corners=18,
    drs_zones=1,
    pit_loss_time=22.0,
    tire_severity=7,
    overtaking_difficulty=8,
    downforce_level="high",
    sc_probability=0.30,
    fuel_per_lap=1.58,
    rain_probability={1: 0.12, 2: 0.14, 3: 0.18, 4: 0.22, 5: 0.20,
                      6: 0.28, 7: 0.22, 8: 0.25, 9: 0.30, 10: 0.18,
                      11: 0.12, 12: 0.10},
    reference_lap_times={"SOFT": 89.5, "MEDIUM": 91.2, "HARD": 93.0},
)

SHANGHAI = Track(
    name="Shanghai International Circuit",
    location="Shanghai",
    country="China",
    length_km=5.451,
    laps=56,
    corners=16,
    drs_zones=2,
    pit_loss_time=22.5,
    tire_severity=7,
    overtaking_difficulty=5,
    downforce_level="medium-high",
    sc_probability=0.40,
    fuel_per_lap=1.50,
    rain_probability={1: 0.10, 2: 0.12, 3: 0.18, 4: 0.20, 5: 0.22,
                      6: 0.28, 7: 0.20, 8: 0.25, 9: 0.18, 10: 0.12,
                      11: 0.14, 12: 0.08},
    reference_lap_times={"SOFT": 94.0, "MEDIUM": 95.8, "HARD": 97.5},
)

MIAMI = Track(
    name="Miami International Autodrome",
    location="Miami",
    country="USA",
    length_km=5.412,
    laps=57,
    corners=18,
    drs_zones=3,
    pit_loss_time=22.0,
    tire_severity=6,
    overtaking_difficulty=6,
    downforce_level="medium-high",
    sc_probability=0.45,
    fuel_per_lap=1.55,
    rain_probability={1: 0.10, 2: 0.12, 3: 0.15, 4: 0.18, 5: 0.22,
                      6: 0.28, 7: 0.30, 8: 0.28, 9: 0.25, 10: 0.20,
                      11: 0.12, 12: 0.08},
    reference_lap_times={"SOFT": 88.5, "MEDIUM": 90.2, "HARD": 92.0},
)

IMOLA = Track(
    name="Autodromo Enzo e Dino Ferrari",
    location="Imola",
    country="Italy",
    length_km=4.909,
    laps=63,
    corners=17,
    drs_zones=1,
    pit_loss_time=21.5,
    tire_severity=7,
    overtaking_difficulty=8,
    downforce_level="high",
    sc_probability=0.40,
    fuel_per_lap=1.45,
    rain_probability={1: 0.10, 2: 0.12, 3: 0.15, 4: 0.20, 5: 0.18,
                      6: 0.15, 7: 0.12, 8: 0.14, 9: 0.18, 10: 0.20,
                      11: 0.16, 12: 0.12},
    reference_lap_times={"SOFT": 75.5, "MEDIUM": 77.2, "HARD": 79.0},
)

MONACO = Track(
    name="Circuit de Monaco",
    location="Monte Carlo",
    country="Monaco",
    length_km=3.337,
    laps=78,
    corners=19,
    drs_zones=1,
    pit_loss_time=20.0,
    tire_severity=4,
    overtaking_difficulty=10,
    downforce_level="maximum",
    sc_probability=0.60,
    fuel_per_lap=1.10,
    rain_probability={1: 0.10, 2: 0.12, 3: 0.15, 4: 0.18, 5: 0.20,
                      6: 0.15, 7: 0.08, 8: 0.10, 9: 0.15, 10: 0.18,
                      11: 0.14, 12: 0.12},
    reference_lap_times={"SOFT": 72.5, "MEDIUM": 74.2, "HARD": 76.0},
)

CANADA = Track(
    name="Circuit Gilles Villeneuve",
    location="Montreal",
    country="Canada",
    length_km=4.361,
    laps=70,
    corners=14,
    drs_zones=2,
    pit_loss_time=21.0,
    tire_severity=6,
    overtaking_difficulty=4,
    downforce_level="low-medium",
    sc_probability=0.50,
    fuel_per_lap=1.38,
    rain_probability={1: 0.15, 2: 0.12, 3: 0.15, 4: 0.18, 5: 0.20,
                      6: 0.22, 7: 0.20, 8: 0.18, 9: 0.20, 10: 0.18,
                      11: 0.16, 12: 0.14},
    reference_lap_times={"SOFT": 73.0, "MEDIUM": 74.8, "HARD": 76.5},
)

SPAIN = Track(
    name="Circuit de Barcelona-Catalunya",
    location="Montmelo",
    country="Spain",
    length_km=4.675,
    laps=66,
    corners=16,
    drs_zones=2,
    pit_loss_time=22.0,
    tire_severity=9,
    overtaking_difficulty=7,
    downforce_level="high",
    sc_probability=0.30,
    fuel_per_lap=1.38,
    rain_probability={1: 0.10, 2: 0.12, 3: 0.15, 4: 0.18, 5: 0.15,
                      6: 0.12, 7: 0.08, 8: 0.10, 9: 0.15, 10: 0.18,
                      11: 0.12, 12: 0.10},
    reference_lap_times={"SOFT": 77.0, "MEDIUM": 78.8, "HARD": 80.5},
)

AUSTRIA = Track(
    name="Red Bull Ring",
    location="Spielberg",
    country="Austria",
    length_km=4.318,
    laps=71,
    corners=10,
    drs_zones=3,
    pit_loss_time=20.5,
    tire_severity=6,
    overtaking_difficulty=3,
    downforce_level="low",
    sc_probability=0.35,
    fuel_per_lap=1.35,
    rain_probability={1: 0.15, 2: 0.12, 3: 0.18, 4: 0.22, 5: 0.25,
                      6: 0.30, 7: 0.28, 8: 0.25, 9: 0.20, 10: 0.15,
                      11: 0.18, 12: 0.14},
    reference_lap_times={"SOFT": 66.0, "MEDIUM": 67.5, "HARD": 69.0},
)

SILVERSTONE = Track(
    name="Silverstone Circuit",
    location="Silverstone",
    country="United Kingdom",
    length_km=5.891,
    laps=52,
    corners=18,
    drs_zones=2,
    pit_loss_time=22.5,
    tire_severity=7,
    overtaking_difficulty=5,
    downforce_level="medium-high",
    sc_probability=0.35,
    fuel_per_lap=1.58,
    rain_probability={1: 0.18, 2: 0.15, 3: 0.14, 4: 0.16, 5: 0.15,
                      6: 0.18, 7: 0.16, 8: 0.18, 9: 0.16, 10: 0.18,
                      11: 0.20, 12: 0.18},
    reference_lap_times={"SOFT": 87.0, "MEDIUM": 88.8, "HARD": 90.5},
)

HUNGARY = Track(
    name="Hungaroring",
    location="Budapest",
    country="Hungary",
    length_km=4.381,
    laps=70,
    corners=14,
    drs_zones=2,
    pit_loss_time=21.5,
    tire_severity=8,
    overtaking_difficulty=9,
    downforce_level="maximum",
    sc_probability=0.35,
    fuel_per_lap=1.35,
    rain_probability={1: 0.15, 2: 0.12, 3: 0.15, 4: 0.18, 5: 0.20,
                      6: 0.18, 7: 0.15, 8: 0.14, 9: 0.16, 10: 0.15,
                      11: 0.18, 12: 0.16},
    reference_lap_times={"SOFT": 77.0, "MEDIUM": 78.8, "HARD": 80.5},
)

SPA = Track(
    name="Circuit de Spa-Francorchamps",
    location="Spa",
    country="Belgium",
    length_km=7.004,
    laps=44,
    corners=19,
    drs_zones=2,
    pit_loss_time=23.0,
    tire_severity=7,
    overtaking_difficulty=4,
    downforce_level="medium-low",
    sc_probability=0.45,
    fuel_per_lap=1.78,
    rain_probability={1: 0.20, 2: 0.18, 3: 0.18, 4: 0.16, 5: 0.18,
                      6: 0.20, 7: 0.22, 8: 0.20, 9: 0.18, 10: 0.18,
                      11: 0.20, 12: 0.22},
    reference_lap_times={"SOFT": 105.0, "MEDIUM": 107.0, "HARD": 109.0},
)

ZANDVOORT = Track(
    name="Circuit Zandvoort",
    location="Zandvoort",
    country="Netherlands",
    length_km=4.259,
    laps=72,
    corners=14,
    drs_zones=2,
    pit_loss_time=21.0,
    tire_severity=8,
    overtaking_difficulty=8,
    downforce_level="high",
    sc_probability=0.40,
    fuel_per_lap=1.42,
    rain_probability={1: 0.18, 2: 0.16, 3: 0.15, 4: 0.14, 5: 0.16,
                      6: 0.18, 7: 0.20, 8: 0.20, 9: 0.22, 10: 0.20,
                      11: 0.22, 12: 0.20},
    reference_lap_times={"SOFT": 73.0, "MEDIUM": 74.8, "HARD": 76.5},
)

MONZA = Track(
    name="Autodromo Nazionale Monza",
    location="Monza",
    country="Italy",
    length_km=5.793,
    laps=53,
    corners=11,
    drs_zones=2,
    pit_loss_time=21.5,
    tire_severity=3,
    overtaking_difficulty=4,
    downforce_level="low",
    sc_probability=0.30,
    fuel_per_lap=1.48,
    rain_probability={1: 0.08, 2: 0.10, 3: 0.12, 4: 0.18, 5: 0.20,
                      6: 0.18, 7: 0.15, 8: 0.16, 9: 0.18, 10: 0.16,
                      11: 0.18, 12: 0.10},
    reference_lap_times={"SOFT": 81.0, "MEDIUM": 82.8, "HARD": 84.5},
)

BAKU = Track(
    name="Baku City Circuit",
    location="Baku",
    country="Azerbaijan",
    length_km=6.003,
    laps=51,
    corners=20,
    drs_zones=2,
    pit_loss_time=22.5,
    tire_severity=4,
    overtaking_difficulty=5,
    downforce_level="low-medium",
    sc_probability=0.55,
    fuel_per_lap=1.62,
    rain_probability={1: 0.12, 2: 0.10, 3: 0.12, 4: 0.10, 5: 0.08,
                      6: 0.05, 7: 0.03, 8: 0.03, 9: 0.05, 10: 0.10,
                      11: 0.14, 12: 0.12},
    reference_lap_times={"SOFT": 102.0, "MEDIUM": 104.0, "HARD": 106.0},
)

SINGAPORE = Track(
    name="Marina Bay Street Circuit",
    location="Singapore",
    country="Singapore",
    length_km=4.940,
    laps=62,
    corners=19,
    drs_zones=2,
    pit_loss_time=23.5,
    tire_severity=9,
    overtaking_difficulty=8,
    downforce_level="maximum",
    sc_probability=0.50,
    fuel_per_lap=1.42,
    rain_probability={1: 0.35, 2: 0.30, 3: 0.32, 4: 0.30, 5: 0.28,
                      6: 0.25, 7: 0.22, 8: 0.24, 9: 0.25, 10: 0.30,
                      11: 0.35, 12: 0.38},
    reference_lap_times={"SOFT": 92.0, "MEDIUM": 94.0, "HARD": 96.0},
)

COTA = Track(
    name="Circuit of the Americas",
    location="Austin",
    country="USA",
    length_km=5.513,
    laps=56,
    corners=20,
    drs_zones=2,
    pit_loss_time=22.0,
    tire_severity=8,
    overtaking_difficulty=5,
    downforce_level="medium-high",
    sc_probability=0.35,
    fuel_per_lap=1.52,
    rain_probability={1: 0.10, 2: 0.12, 3: 0.15, 4: 0.18, 5: 0.22,
                      6: 0.15, 7: 0.10, 8: 0.12, 9: 0.18, 10: 0.15,
                      11: 0.12, 12: 0.10},
    reference_lap_times={"SOFT": 95.0, "MEDIUM": 96.8, "HARD": 98.5},
)

LAS_VEGAS = Track(
    name="Las Vegas Strip Circuit",
    location="Las Vegas",
    country="USA",
    length_km=6.201,
    laps=50,
    corners=17,
    drs_zones=2,
    pit_loss_time=22.5,
    tire_severity=4,
    overtaking_difficulty=4,
    downforce_level="low",
    sc_probability=0.45,
    fuel_per_lap=1.65,
    rain_probability={1: 0.05, 2: 0.06, 3: 0.05, 4: 0.04, 5: 0.03,
                      6: 0.02, 7: 0.02, 8: 0.02, 9: 0.03, 10: 0.03,
                      11: 0.04, 12: 0.05},
    reference_lap_times={"SOFT": 93.0, "MEDIUM": 94.8, "HARD": 96.5},
)

QATAR = Track(
    name="Lusail International Circuit",
    location="Lusail",
    country="Qatar",
    length_km=5.419,
    laps=57,
    corners=16,
    drs_zones=2,
    pit_loss_time=22.0,
    tire_severity=10,
    overtaking_difficulty=6,
    downforce_level="medium-high",
    sc_probability=0.30,
    fuel_per_lap=1.52,
    rain_probability={1: 0.02, 2: 0.02, 3: 0.03, 4: 0.02, 5: 0.01,
                      6: 0.00, 7: 0.00, 8: 0.00, 9: 0.00, 10: 0.01,
                      11: 0.02, 12: 0.02},
    reference_lap_times={"SOFT": 84.0, "MEDIUM": 85.8, "HARD": 87.5},
)

ABU_DHABI = Track(
    name="Yas Marina Circuit",
    location="Abu Dhabi",
    country="UAE",
    length_km=5.281,
    laps=58,
    corners=16,
    drs_zones=2,
    pit_loss_time=22.5,
    tire_severity=6,
    overtaking_difficulty=5,
    downforce_level="medium-high",
    sc_probability=0.30,
    fuel_per_lap=1.48,
    rain_probability={1: 0.03, 2: 0.03, 3: 0.02, 4: 0.02, 5: 0.01,
                      6: 0.00, 7: 0.00, 8: 0.00, 9: 0.00, 10: 0.01,
                      11: 0.02, 12: 0.03},
    reference_lap_times={"SOFT": 85.0, "MEDIUM": 86.8, "HARD": 88.5},
)

BRAZIL = Track(
    name="Autodromo Jose Carlos Pace",
    location="Sao Paulo",
    country="Brazil",
    length_km=4.309,
    laps=71,
    corners=15,
    drs_zones=2,
    pit_loss_time=21.0,
    tire_severity=5,
    overtaking_difficulty=4,
    downforce_level="medium",
    sc_probability=0.40,
    fuel_per_lap=1.32,
    rain_probability={1: 0.25, 2: 0.22, 3: 0.20, 4: 0.18, 5: 0.15,
                      6: 0.12, 7: 0.10, 8: 0.12, 9: 0.15, 10: 0.18,
                      11: 0.20, 12: 0.22},
    reference_lap_times={"SOFT": 70.0, "MEDIUM": 71.5, "HARD": 73.0},
)

PORTUGAL = Track(
    name="Autodromo Internacional do Algarve",
    location="Portimao",
    country="Portugal",
    length_km=4.653,
    laps=66,
    corners=15,
    drs_zones=1,
    pit_loss_time=21.5,
    tire_severity=8,
    overtaking_difficulty=6,
    downforce_level="medium-high",
    sc_probability=0.35,
    fuel_per_lap=1.42,
    rain_probability={1: 0.12, 2: 0.10, 3: 0.12, 4: 0.15, 5: 0.12,
                      6: 0.08, 7: 0.03, 8: 0.03, 9: 0.08, 10: 0.12,
                      11: 0.14, 12: 0.13},
    reference_lap_times={"SOFT": 79.0, "MEDIUM": 80.8, "HARD": 82.5},
)

# =============================================================================
# TRACK REGISTRY
# =============================================================================

TRACK_DATABASE: Dict[str, Track] = {
    "Bahrain": BAHRAIN,
    "Jeddah": JEDDAH,
    "Melbourne": MELBOURNE,
    "Suzuka": SUZUKA,
    "Shanghai": SHANGHAI,
    "Miami": MIAMI,
    "Imola": IMOLA,
    "Monaco": MONACO,
    "Canada": CANADA,
    "Spain": SPAIN,
    "Austria": AUSTRIA,
    "Silverstone": SILVERSTONE,
    "Hungary": HUNGARY,
    "Spa": SPA,
    "Zandvoort": ZANDVOORT,
    "Monza": MONZA,
    "Baku": BAKU,
    "Singapore": SINGAPORE,
    "COTA": COTA,
    "Las Vegas": LAS_VEGAS,
    "Qatar": QATAR,
    "Abu Dhabi": ABU_DHABI,
    "Brazil": BRAZIL,
    "Portugal": PORTUGAL,
}


def get_track(name: str) -> Track:
    """
    Retrieve a Track by its short name identifier.

    Args:
        name: Short name key (e.g., 'Bahrain', 'Spa', 'Monza').

    Returns:
        The matching Track dataclass instance.

    Raises:
        KeyError: If the track name is not found in the database.
    """
    if name not in TRACK_DATABASE:
        available = ", ".join(sorted(TRACK_DATABASE.keys()))
        raise KeyError(f"Track '{name}' not found. Available: {available}")
    return TRACK_DATABASE[name]


def list_tracks() -> list[str]:
    """
    Return a sorted list of all available track short names.

    Returns:
        List of track name strings.
    """
    return sorted(TRACK_DATABASE.keys())
