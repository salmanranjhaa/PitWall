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
# 2026 F1 DRIVER PROFILES (22 drivers, 11 teams — Cadillac joins, Audi debuts)
# =============================================================================
# Sub-attributes hand-tuned for realistic BDI behaviour. The hierarchy is
# deliberate: Verstappen sits alone at the top, Hamilton/Alonso own racecraft
# and experience, the McLaren pair are the class field benchmark, and the
# rookies make mistakes. Keyed by 2026 race number.
# =============================================================================

DRIVER_PROFILES: Dict[int, DriverProfile] = {

    # ── Max Verstappen — #33 (Red Bull Racing) ───────────────────────
    # Generational outlier: peerless one-lap speed, race pace, wet mastery
    33: DriverProfile(
        name="Max Verstappen", number=33,
        qualifying_pace=99, race_pace=99,
        overtaking=97, defending=95, start_skill=93,
        control=93, accuracy=97, tire_management=90,
        experience=93, adaptability=99,
    ),

    # ── Lando Norris — #1 (McLaren, reigning champion) ───────────────
    1: DriverProfile(
        name="Lando Norris", number=1,
        qualifying_pace=96, race_pace=95,
        overtaking=90, defending=88, start_skill=86,
        control=91, accuracy=93, tire_management=90,
        experience=86, adaptability=92,
    ),

    # ── Oscar Piastri — #81 (McLaren) ────────────────────────────────
    # Ice-cold, clinical, elite tire life, now a proven race winner
    81: DriverProfile(
        name="Oscar Piastri", number=81,
        qualifying_pace=95, race_pace=95,
        overtaking=90, defending=88, start_skill=86,
        control=94, accuracy=93, tire_management=92,
        experience=80, adaptability=87,
    ),

    # ── Charles Leclerc — #16 (Ferrari) ──────────────────────────────
    # Still the outright qualifying ace; race-day errors under pressure
    16: DriverProfile(
        name="Charles Leclerc", number=16,
        qualifying_pace=97, race_pace=93,
        overtaking=91, defending=85, start_skill=89,
        control=84, accuracy=89, tire_management=86,
        experience=86, adaptability=87,
    ),

    # ── Lewis Hamilton — #44 (Ferrari) ───────────────────────────────
    # The racecraft/experience GOAT: peak one-lap edge faded, everything
    # else — defending, wet driving, tire whispering — still best-in-class
    44: DriverProfile(
        name="Lewis Hamilton", number=44,
        qualifying_pace=91, race_pace=93,
        overtaking=93, defending=96, start_skill=88,
        control=93, accuracy=94, tire_management=95,
        experience=99, adaptability=98,
    ),

    # ── George Russell — #63 (Mercedes) ──────────────────────────────
    # Technical, metronomic, maximises the car on Saturdays
    63: DriverProfile(
        name="George Russell", number=63,
        qualifying_pace=95, race_pace=93,
        overtaking=86, defending=89, start_skill=90,
        control=94, accuracy=93, tire_management=88,
        experience=86, adaptability=91,
    ),

    # ── Kimi Antonelli — #12 (Mercedes) ──────────────────────────────
    # The 2026 revelation: leading the championship in year two, poles,
    # sprint wins — raw speed now matched by far better control
    12: DriverProfile(
        name="Kimi Antonelli", number=12,
        qualifying_pace=95, race_pace=94,
        overtaking=88, defending=84, start_skill=86,
        control=87, accuracy=89, tire_management=86,
        experience=78, adaptability=90,
    ),

    # ── Fernando Alonso — #14 (Aston Martin) ─────────────────────────
    # Supreme racecraft and cunning; the sport's canniest strategist
    14: DriverProfile(
        name="Fernando Alonso", number=14,
        qualifying_pace=89, race_pace=91,
        overtaking=90, defending=95, start_skill=91,
        control=91, accuracy=92, tire_management=93,
        experience=99, adaptability=97,
    ),

    # ── Lance Stroll — #18 (Aston Martin) ────────────────────────────
    18: DriverProfile(
        name="Lance Stroll", number=18,
        qualifying_pace=82, race_pace=83,
        overtaking=76, defending=82, start_skill=85,
        control=80, accuracy=79, tire_management=80,
        experience=86, adaptability=83,
    ),

    # ── Carlos Sainz — #55 (Williams) ────────────────────────────────
    # Mr Reliable: strong race pace, smart calls, rarely puts a foot wrong
    55: DriverProfile(
        name="Carlos Sainz", number=55,
        qualifying_pace=90, race_pace=91,
        overtaking=87, defending=89, start_skill=87,
        control=91, accuracy=92, tire_management=91,
        experience=91, adaptability=88,
    ),

    # ── Alexander Albon — #23 (Williams) ─────────────────────────────
    23: DriverProfile(
        name="Alexander Albon", number=23,
        qualifying_pace=87, race_pace=88,
        overtaking=85, defending=85, start_skill=84,
        control=87, accuracy=89, tire_management=89,
        experience=86, adaptability=85,
    ),

    # ── Isack Hadjar — #6 (Red Bull Racing) ──────────────────────────
    # Earned the big-team seat with a standout sophomore season
    6: DriverProfile(
        name="Isack Hadjar", number=6,
        qualifying_pace=88, race_pace=86,
        overtaking=84, defending=80, start_skill=82,
        control=82, accuracy=83, tire_management=80,
        experience=75, adaptability=84,
    ),

    # ── Liam Lawson — #30 (Racing Bulls) ─────────────────────────────
    # Team leader now: three straight double-points finishes in 2026,
    # combative but far more complete than the 2025 version
    30: DriverProfile(
        name="Liam Lawson", number=30,
        qualifying_pace=87, race_pace=87,
        overtaking=86, defending=83, start_skill=83,
        control=82, accuracy=84, tire_management=82,
        experience=80, adaptability=85,
    ),

    # ── Arvid Lindblad — #41 (Racing Bulls) ──────────────────────────
    # Teenage rookie showing consistency few expected — regular points
    41: DriverProfile(
        name="Arvid Lindblad", number=41,
        qualifying_pace=86, race_pace=84,
        overtaking=83, defending=77, start_skill=80,
        control=77, accuracy=80, tire_management=77,
        experience=66, adaptability=81,
    ),

    # ── Pierre Gasly — #10 (Alpine) ──────────────────────────────────
    10: DriverProfile(
        name="Pierre Gasly", number=10,
        qualifying_pace=88, race_pace=87,
        overtaking=85, defending=83, start_skill=83,
        control=85, accuracy=85, tire_management=83,
        experience=87, adaptability=88,
    ),

    # ── Franco Colapinto — #43 (Alpine) ──────────────────────────────
    # Fast and fearless, still calming the crash rate
    43: DriverProfile(
        name="Franco Colapinto", number=43,
        qualifying_pace=84, race_pace=83,
        overtaking=82, defending=76, start_skill=80,
        control=74, accuracy=78, tire_management=77,
        experience=72, adaptability=80,
    ),

    # ── Esteban Ocon — #31 (Haas) ────────────────────────────────────
    31: DriverProfile(
        name="Esteban Ocon", number=31,
        qualifying_pace=85, race_pace=85,
        overtaking=81, defending=87, start_skill=81,
        control=85, accuracy=85, tire_management=83,
        experience=87, adaptability=86,
    ),

    # ── Oliver Bearman — #87 (Haas) ──────────────────────────────────
    # Rapidly maturing: brave in battle, much cleaner in year two
    87: DriverProfile(
        name="Oliver Bearman", number=87,
        qualifying_pace=86, race_pace=85,
        overtaking=83, defending=79, start_skill=81,
        control=80, accuracy=82, tire_management=79,
        experience=75, adaptability=83,
    ),

    # ── Nico Hulkenberg — #27 (Audi) ─────────────────────────────────
    # Veteran anchor of the Audi works project; podium-proven at last
    27: DriverProfile(
        name="Nico Hulkenberg", number=27,
        qualifying_pace=87, race_pace=86,
        overtaking=82, defending=87, start_skill=85,
        control=89, accuracy=87, tire_management=85,
        experience=93, adaptability=90,
    ),

    # ── Gabriel Bortoleto — #5 (Audi) ────────────────────────────────
    # Smooth F2 champion, impressive rookie year, keeps it clean
    5: DriverProfile(
        name="Gabriel Bortoleto", number=5,
        qualifying_pace=85, race_pace=84,
        overtaking=81, defending=79, start_skill=79,
        control=83, accuracy=84, tire_management=83,
        experience=73, adaptability=82,
    ),

    # ── Sergio Perez — #11 (Cadillac) ────────────────────────────────
    # Back from a year out to lead the new American team; tire specialist
    11: DriverProfile(
        name="Sergio Perez", number=11,
        qualifying_pace=84, race_pace=87,
        overtaking=85, defending=86, start_skill=82,
        control=86, accuracy=86, tire_management=92,
        experience=95, adaptability=86,
    ),

    # ── Valtteri Bottas — #77 (Cadillac) ─────────────────────────────
    # Experienced benchmark, ultra-consistent, brings the team along
    77: DriverProfile(
        name="Valtteri Bottas", number=77,
        qualifying_pace=85, race_pace=85,
        overtaking=79, defending=83, start_skill=86,
        control=88, accuracy=88, tire_management=86,
        experience=95, adaptability=85,
    ),
}


def get_profile(driver_number: int) -> DriverProfile:
    """Get a driver profile by number, or a default midfield profile."""
    if driver_number in DRIVER_PROFILES:
        return DRIVER_PROFILES[driver_number]
    # Return a generic midfield profile
    return DriverProfile(name="Unknown", number=driver_number)
