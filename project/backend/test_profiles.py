"""Quick standalone verification of DriverProfile + Personality."""
import sys, os

# ── Inline the DriverProfile to avoid import chain ──────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "app", "simulation"))
from driver_profile import DRIVER_PROFILES, DriverProfile

# ── Inline the personality builder (no agent imports needed) ────────
from dataclasses import dataclass

@dataclass
class PersonalityTest:
    name: str
    aggression: float; patience: float; defensiveness: float
    risk_tolerance: float; calculation: float; team_player: float
    attack_gap_threshold: float; defence_gap_threshold: float
    tire_pit_wear: float; rain_switch_threshold: float
    commitment_override: float; stint_extension: float
    overtake_intensity: float; push_intensity: float; manage_intensity: float

def build(p: DriverProfile) -> PersonalityTest:
    aggression = min(1.0, (p.overtaking * 0.6 + (100 - p.control) * 0.4) / 100.0)
    patience = min(1.0, (p.experience * 0.5 + p.tire_management * 0.3 + p.accuracy * 0.2) / 100.0)
    defensiveness = min(1.0, (p.defending * 0.6 + p.accuracy * 0.4) / 100.0)
    risk_tolerance = min(1.0, (p.overtaking * 0.3 + p.adaptability * 0.3 + (100 - p.accuracy) * 0.2 + p.start_skill * 0.2) / 100.0)
    calculation = min(1.0, (p.experience * 0.4 + p.accuracy * 0.3 + p.control * 0.3) / 100.0)
    team_player = min(1.0, (p.control * 0.4 + p.accuracy * 0.3 + (100 - p.overtaking) * 0.3) / 100.0)

    overtake_norm = p.overtaking / 100.0
    patience_factor = 1.0 - patience
    attack_gap = 0.80 + overtake_norm * 0.25 + patience_factor * 0.20
    defend_norm = p.defending / 100.0
    defence_gap = 1.50 + defend_norm * 0.80
    tire_norm = p.tire_management / 100.0
    tire_pit = 0.85 + tire_norm * 0.10
    adapt_norm = p.adaptability / 100.0
    rain_thresh = 0.55 + adapt_norm * 0.20
    control_norm = p.control / 100.0
    exp_norm = p.experience / 100.0
    commitment = 0.80 + control_norm * 0.05 + exp_norm * 0.05
    stint_ext = 2.0 + tire_norm * 2.0
    push_int = 1.08 + aggression * 0.08
    attack_int = 1.10 + aggression * 0.10
    manage_int = 0.90 - patience * 0.10

    return PersonalityTest(
        name=p.name, aggression=aggression, patience=patience,
        defensiveness=defensiveness, risk_tolerance=risk_tolerance,
        calculation=calculation, team_player=team_player,
        attack_gap_threshold=attack_gap, defence_gap_threshold=defence_gap,
        tire_pit_wear=tire_pit, rain_switch_threshold=rain_thresh,
        commitment_override=commitment, stint_extension=stint_ext,
        overtake_intensity=attack_int, push_intensity=push_int,
        manage_intensity=manage_int,
    )

# ── Print all 20 drivers ────────────────────────────────────────────
print(f"\n{'Driver':<20} {'RTG':>3} {'PAC':>3} {'RAC':>3} {'AWA':>3} {'EXP':>3}  "
      f"{'atk_gap':>7} {'def_gap':>7} {'tire_pt':>7} {'rain_sw':>7} {'push':>5} {'mng':>5} {'commit':>6} {'stint+':>6}")
print("-" * 118)

for num, prof in sorted(DRIVER_PROFILES.items(), key=lambda x: x[1].rtg, reverse=True):
    pe = build(prof)
    print(f"{prof.name:<20} {prof.rtg:>3} {prof.pac:>3} {prof.rac:>3} {prof.awa:>3} {prof.exp:>3}  "
          f"{pe.attack_gap_threshold:>7.3f} {pe.defence_gap_threshold:>7.3f} "
          f"{pe.tire_pit_wear:>7.3f} {pe.rain_switch_threshold:>7.3f} "
          f"{pe.push_intensity:>5.3f} {pe.manage_intensity:>5.3f} {pe.commitment_override:>6.3f} {pe.stint_extension:>6.2f}")
