"""
F1 Driver Profile System — Inspired by EA SPORTS F1 25 / F1 Manager.

Surface-level categories (visible to UI):
  - PAC (Pace)        — raw speed in qualifying and race
  - RAC (Racecraft)   — overtaking + defending + wheel-to-wheel skill
  - AWA (Awareness)   — cleanliness, control, avoids incidents
  - EXP (Experience)  — career maturity, adapts to pressure

Deep sub-attributes (drive BDI thresholds):
  - tire_management   — how gently the driver uses tires (extends stints)
  - overtaking        — success rate and aggressiveness in passing
  - defending         — ability to hold position under attack
  - start_skill       — reaction time off the grid
  - adaptability      — wet-weather and variable-condition performance
  - control           — error avoidance, consistency of lap times
  - racecraft         — ability to gain positions from grid slot

All values are 0–100 integers (like the F1 game).  The BDI agent code
normalises these to 0.0–1.0 internally when needed.

Ratings are calibrated so:
  - Top drivers (VER/HAM/NOR) sit around 90-97
  - Solid midfield (GAS/ALB/HUL) sit around 82-87
  - Rookies (ANT/DOO/BOR/BEA/HAD) sit around 70-82
  - Gaps between drivers are subtle (2-5 pts), not dramatic
"""

from dataclasses import dataclass, field
from typing import Dict


@dataclass
class DriverProfile:
    """
    Complete driver profile combining visible ratings (F1 25-style)
    with deeper sub-attributes (F1 Manager-style).

    Surface ratings (PAC/RAC/AWA/EXP) are computed from sub-attributes.
    """

    # ── Identity ─────────────────────────────────────────────────────
    name: str
    number: int

    # ── Pace sub-attributes ──────────────────────────────────────────
    qualifying_pace: int = 85      # raw one-lap speed
    race_pace: int = 85            # sustained race speed

    # ── Racecraft sub-attributes ─────────────────────────────────────
    overtaking: int = 80           # success in passing manoeuvres
    defending: int = 80            # ability to hold position
    start_skill: int = 80          # grid launch reaction

    # ── Awareness sub-attributes ─────────────────────────────────────
    control: int = 80              # error/crash avoidance
    accuracy: int = 80             # lap-to-lap consistency
    tire_management: int = 80      # tire preservation skill

    # ── Experience / Adaptability ────────────────────────────────────
    experience: int = 70           # career maturity, F1 race starts
    adaptability: int = 80         # wet weather / changing conditions

    # ── Computed surface ratings (F1 25-style) ───────────────────────

    @property
    def pac(self) -> int:
        """Pace — weighted average of qualifying and race pace."""
        return round(self.qualifying_pace * 0.45 + self.race_pace * 0.55)

    @property
    def rac(self) -> int:
        """Racecraft — overtaking + defending + starts."""
        return round(self.overtaking * 0.40 + self.defending * 0.35 + self.start_skill * 0.25)

    @property
    def awa(self) -> int:
        """Awareness — control + accuracy + tire management."""
        return round(self.control * 0.35 + self.accuracy * 0.35 + self.tire_management * 0.30)

    @property
    def exp(self) -> int:
        """Experience — direct mapping."""
        return self.experience

    @property
    def rtg(self) -> int:
        """Overall rating — pace-weighted composite."""
        return round(self.pac * 0.40 + self.rac * 0.25 + self.awa * 0.20 + self.exp * 0.15)

    # ── Normalised accessors for BDI / physics (0.0 – 1.0) ──────────

    @property
    def norm_pace(self) -> float:
        return self.pac / 100.0

    @property
    def norm_overtaking(self) -> float:
        return self.overtaking / 100.0

    @property
    def norm_defending(self) -> float:
        return self.defending / 100.0

    @property
    def norm_tire_management(self) -> float:
        return self.tire_management / 100.0

    @property
    def norm_control(self) -> float:
        return self.control / 100.0

    @property
    def norm_accuracy(self) -> float:
        return self.accuracy / 100.0

    @property
    def norm_adaptability(self) -> float:
        return self.adaptability / 100.0

    @property
    def norm_experience(self) -> float:
        return self.experience / 100.0

    @property
    def norm_start_skill(self) -> float:
        return self.start_skill / 100.0

    # ── Legacy compatibility accessors ───────────────────────────────
    # These map to the fields the existing Driver dataclass exposed,
    # so the engine, physics, and AI controller don't break.

    @property
    def skill(self) -> float:
        """Maps to legacy Driver.skill (0.0–1.0)."""
        return self.rtg / 100.0

    @property
    def aggression(self) -> float:
        """Derived from overtaking and low control (risk-taking)."""
        return min(1.0, (self.overtaking * 0.6 + (100 - self.control) * 0.4) / 100.0)

    @property
    def consistency(self) -> float:
        """Maps from accuracy sub-attribute."""
        return self.norm_accuracy

    @property
    def wet_skill(self) -> float:
        """Maps from adaptability."""
        return self.norm_adaptability

    def to_display_dict(self) -> dict:
        """Serialise for frontend display (F1 25-style card)."""
        return {
            "name": self.name,
            "number": self.number,
            "rtg": self.rtg,
            "pac": self.pac,
            "rac": self.rac,
            "awa": self.awa,
            "exp": self.exp,
            # Sub-attributes for detail panel
            "qualifying_pace": self.qualifying_pace,
            "race_pace": self.race_pace,
            "overtaking": self.overtaking,
            "defending": self.defending,
            "start_skill": self.start_skill,
            "control": self.control,
            "accuracy": self.accuracy,
            "tire_management": self.tire_management,
            "experience": self.experience,
            "adaptability": self.adaptability,
        }


# =============================================================================
# 2025 F1 DRIVER PROFILES
# =============================================================================
# Ratings based on F1 25 game values as reference with sub-attributes
# hand-tuned for realistic BDI behaviour.  Gaps between drivers are
# deliberately subtle (2–5 pts) to avoid cartoonish behaviour differences.
# =============================================================================

DRIVER_PROFILES: Dict[int, DriverProfile] = {

    # ── Max Verstappen — #1 ──────────────────────────────────────────
    # Dominant pace, aggressive overtaker, elite consistency, 10 years XP
    1: DriverProfile(
        name="Max Verstappen", number=1,
        qualifying_pace=97, race_pace=96,
        overtaking=95, defending=90, start_skill=92,
        control=88, accuracy=95, tire_management=82,
        experience=88, adaptability=94,
    ),

    # ── Lando Norris — #4 ────────────────────────────────────────────
    # Very fast, smooth racecraft, strong in wet, improving experience
    4: DriverProfile(
        name="Lando Norris", number=4,
        qualifying_pace=95, race_pace=94,
        overtaking=90, defending=86, start_skill=85,
        control=90, accuracy=92, tire_management=88,
        experience=82, adaptability=91,
    ),

    # ── Charles Leclerc — #16 ────────────────────────────────────────
    # Blistering qualifying pace, aggressive racer, occasional errors
    16: DriverProfile(
        name="Charles Leclerc", number=16,
        qualifying_pace=96, race_pace=93,
        overtaking=91, defending=84, start_skill=88,
        control=82, accuracy=88, tire_management=85,
        experience=82, adaptability=85,
    ),

    # ── George Russell — #63 ─────────────────────────────────────────
    # Precise, strong qualifier, great awareness, solid all-round
    63: DriverProfile(
        name="George Russell", number=63,
        qualifying_pace=94, race_pace=92,
        overtaking=85, defending=88, start_skill=90,
        control=93, accuracy=92, tire_management=87,
        experience=82, adaptability=90,
    ),

    # ── Oscar Piastri — #81 ──────────────────────────────────────────
    # Clinical, calculated, excellent tire management, fast learner
    81: DriverProfile(
        name="Oscar Piastri", number=81,
        qualifying_pace=93, race_pace=93,
        overtaking=88, defending=85, start_skill=84,
        control=92, accuracy=90, tire_management=90,
        experience=70, adaptability=82,
    ),

    # ── Lewis Hamilton — #44 ─────────────────────────────────────────
    # Legendary experience, elite wet driving, patient racer, still fast
    44: DriverProfile(
        name="Lewis Hamilton", number=44,
        qualifying_pace=92, race_pace=93,
        overtaking=92, defending=94, start_skill=87,
        control=92, accuracy=94, tire_management=93,
        experience=98, adaptability=97,
    ),

    # ── Fernando Alonso — #14 ────────────────────────────────────────
    # Supreme experience and racecraft, elite defender, tire whisperer
    14: DriverProfile(
        name="Fernando Alonso", number=14,
        qualifying_pace=89, race_pace=90,
        overtaking=88, defending=94, start_skill=90,
        control=90, accuracy=92, tire_management=92,
        experience=99, adaptability=96,
    ),

    # ── Yuki Tsunoda — #22 ───────────────────────────────────────────
    # Fast but occasionally error-prone, aggressive, improving
    22: DriverProfile(
        name="Yuki Tsunoda", number=22,
        qualifying_pace=88, race_pace=86,
        overtaking=84, defending=78, start_skill=82,
        control=76, accuracy=80, tire_management=77,
        experience=79, adaptability=83,
    ),

    # ── Carlos Sainz — #55 ───────────────────────────────────────────
    # Very consistent, strong race pace, good tire management, reliable
    55: DriverProfile(
        name="Carlos Sainz", number=55,
        qualifying_pace=90, race_pace=91,
        overtaking=86, defending=88, start_skill=86,
        control=90, accuracy=92, tire_management=90,
        experience=88, adaptability=87,
    ),

    # ── Nico Hulkenberg — #27 ────────────────────────────────────────
    # Experienced, consistent, solid defender, great in wet
    27: DriverProfile(
        name="Nico Hulkenberg", number=27,
        qualifying_pace=87, race_pace=86,
        overtaking=82, defending=86, start_skill=84,
        control=88, accuracy=86, tire_management=84,
        experience=88, adaptability=89,
    ),

    # ── Alexander Albon — #23 ────────────────────────────────────────
    # Smooth driver, great tire management, solid all-round
    23: DriverProfile(
        name="Alexander Albon", number=23,
        qualifying_pace=86, race_pace=87,
        overtaking=84, defending=84, start_skill=83,
        control=86, accuracy=88, tire_management=88,
        experience=83, adaptability=84,
    ),

    # ── Pierre Gasly — #10 ───────────────────────────────────────────
    # Quick, aggressive racer, good in wet, emotional under pressure
    10: DriverProfile(
        name="Pierre Gasly", number=10,
        qualifying_pace=87, race_pace=86,
        overtaking=85, defending=82, start_skill=82,
        control=84, accuracy=84, tire_management=82,
        experience=83, adaptability=87,
    ),

    # ── Esteban Ocon — #31 ───────────────────────────────────────────
    # Solid defender, consistent, team player, medium pace
    31: DriverProfile(
        name="Esteban Ocon", number=31,
        qualifying_pace=84, race_pace=84,
        overtaking=80, defending=85, start_skill=80,
        control=85, accuracy=84, tire_management=82,
        experience=83, adaptability=85,
    ),

    # ── Kimi Antonelli — #12 ─────────────────────────────────────────
    # Prodigious talent, raw speed, needs experience, can be wild
    12: DriverProfile(
        name="Kimi Antonelli", number=12,
        qualifying_pace=90, race_pace=86,
        overtaking=82, defending=75, start_skill=78,
        control=73, accuracy=78, tire_management=75,
        experience=69, adaptability=81,
    ),

    # ── Liam Lawson — #30 ────────────────────────────────────────────
    # Aggressive, fearless, raw, inconsistent
    30: DriverProfile(
        name="Liam Lawson", number=30,
        qualifying_pace=84, race_pace=83,
        overtaking=83, defending=78, start_skill=80,
        control=76, accuracy=78, tire_management=76,
        experience=72, adaptability=82,
    ),

    # ── Isack Hadjar — #6 ────────────────────────────────────────────
    # Talented rookie, medium pace, still learning F1
    6: DriverProfile(
        name="Isack Hadjar", number=6,
        qualifying_pace=83, race_pace=82,
        overtaking=80, defending=76, start_skill=78,
        control=78, accuracy=78, tire_management=75,
        experience=70, adaptability=80,
    ),

    # ── Lance Stroll — #18 ───────────────────────────────────────────
    # Strong in wet, inconsistent in dry, good starter, defends well
    18: DriverProfile(
        name="Lance Stroll", number=18,
        qualifying_pace=82, race_pace=83,
        overtaking=76, defending=82, start_skill=84,
        control=80, accuracy=79, tire_management=80,
        experience=84, adaptability=82,
    ),

    # ── Oliver Bearman — #87 ─────────────────────────────────────────
    # Young, brave, aggressive when opportunity comes, learning
    87: DriverProfile(
        name="Oliver Bearman", number=87,
        qualifying_pace=83, race_pace=82,
        overtaking=80, defending=76, start_skill=78,
        control=77, accuracy=78, tire_management=74,
        experience=71, adaptability=80,
    ),

    # ── Gabriel Bortoleto — #5 ───────────────────────────────────────
    # F2 champion, smooth, needs F1 adaptation time
    5: DriverProfile(
        name="Gabriel Bortoleto", number=5,
        qualifying_pace=82, race_pace=81,
        overtaking=78, defending=75, start_skill=76,
        control=78, accuracy=80, tire_management=78,
        experience=68, adaptability=79,
    ),

    # ── Jack Doohan — #7 ─────────────────────────────────────────────
    # F2 graduate, learning, moderate pace, needs time
    7: DriverProfile(
        name="Jack Doohan", number=7,
        qualifying_pace=81, race_pace=80,
        overtaking=76, defending=74, start_skill=75,
        control=76, accuracy=77, tire_management=76,
        experience=68, adaptability=78,
    ),
}


def get_profile(driver_number: int) -> DriverProfile:
    """Get a driver profile by number, or a default midfield profile."""
    if driver_number in DRIVER_PROFILES:
        return DRIVER_PROFILES[driver_number]
    # Return a generic midfield profile
    return DriverProfile(name="Unknown", number=driver_number)
