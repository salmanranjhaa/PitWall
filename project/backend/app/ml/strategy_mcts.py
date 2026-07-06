"""
Monte Carlo Tree Search strategy planner.

The planner evaluates the next strategic action for the player car using a
proper UCT tree search. It keeps the simulation deliberately lightweight so it
can run inside API requests, but it still expands action nodes, rolls out race
states, and backpropagates rewards instead of comparing two hard-coded
rollout buckets.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


DRY_COMPOUNDS = ("SOFT", "MEDIUM", "HARD")
ALL_COMPOUNDS = ("SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET")

POINTS_BY_POSITION = {
    1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
    6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
}

PIT_LOSS_SECONDS = {
    "bahrain": 22.5, "jeddah": 23.0, "albert_park": 21.5,
    "suzuka": 22.0, "shanghai": 22.0, "miami": 21.5,
    "imola": 24.0, "monaco": 25.0, "canada": 19.0,
    "barcelona": 22.0, "red_bull_ring": 20.0, "silverstone": 22.0,
    "hungaroring": 21.0, "spa": 23.5, "zandvoort": 20.5,
    "monza": 20.0, "baku": 20.5, "singapore": 28.0,
    "cota": 22.0, "mexico_city": 21.0, "interlagos": 21.5,
    "las_vegas": 21.0, "qatar": 24.0, "yas_marina": 22.0,
    "default": 22.0,
}

TRACK_BASE_TIMES = {
    "bahrain": 93.0, "jeddah": 90.0, "albert_park": 79.0,
    "suzuka": 91.0, "shanghai": 95.0, "miami": 92.0,
    "monaco": 75.0, "silverstone": 88.5, "spa": 106.0,
    "monza": 82.0, "barcelona": 81.0, "red_bull_ring": 70.0,
    "yas_marina": 85.0, "default": 88.0,
}


@dataclass(frozen=True)
class StrategyAction:
    """One strategic action available to the search."""

    name: str
    compound: Optional[str] = None

    @property
    def is_pit(self) -> bool:
        return self.name == "PIT"

    def label(self) -> str:
        if self.is_pit:
            return f"PIT_{self.compound}"
        return self.name


@dataclass
class SearchState:
    """Compact race state used inside MCTS rollouts."""

    current_lap: int
    total_laps: int
    position: int
    compound: str
    tire_age: int
    fuel: float
    pits: int
    dry_compounds_used: Tuple[str, ...]
    own_time: float
    gap_ahead: float
    gap_behind: float
    track: str
    weather: Dict[str, Any]
    weather_forecast: List[Dict[str, Any]] = field(default_factory=list)
    just_pitted: bool = False

    def terminal(self) -> bool:
        return self.current_lap >= self.total_laps

    def laps_remaining(self) -> int:
        return max(0, self.total_laps - self.current_lap)

    def dry_rule_met(self) -> bool:
        if self._wet_race():
            return True
        return len(set(c for c in self.dry_compounds_used if c in DRY_COMPOUNDS)) >= 2

    def _wet_race(self) -> bool:
        dampness = float(self.weather.get("track_dampness", 0.0))
        rain = float(self.weather.get("rain_intensity", 0.0))
        return dampness >= 0.2 or rain >= 0.35


class MCTSNode:
    """A node in the UCT search tree."""

    def __init__(
        self,
        state: SearchState,
        parent: Optional["MCTSNode"] = None,
        action: Optional[StrategyAction] = None,
    ) -> None:
        self.state = state
        self.parent = parent
        self.action = action
        self.children: List[MCTSNode] = []
        self.untried_actions: List[StrategyAction] = []
        self.visits = 0
        self.total_reward = 0.0

    @property
    def average_reward(self) -> float:
        return self.total_reward / self.visits if self.visits else 0.0

    def best_child(self, exploration: float) -> "MCTSNode":
        def uct(child: MCTSNode) -> float:
            if child.visits == 0:
                return float("inf")
            exploit = child.average_reward
            explore = exploration * math.sqrt(math.log(self.visits + 1) / child.visits)
            return exploit + explore

        return max(self.children, key=uct)


class MCTSStrategyPlanner:
    """
    Strategy planner using Monte Carlo Tree Search.

    The injected predictor can be the existing ``MLPredictor`` instance. Only
    ``predict_lap_time`` is required; when absent, the planner falls back to a
    simple physics heuristic.
    """

    def __init__(
        self,
        predictor: Optional[Any] = None,
        iterations: int = 320,
        rollout_depth: int = 18,
        random_seed: Optional[int] = None,
    ) -> None:
        self.predictor = predictor
        self.iterations = iterations
        self.rollout_depth = rollout_depth
        self._rng = random.Random(random_seed)

    def recommend(self, race_state: Dict[str, Any]) -> Dict[str, Any]:
        """Return the best first action from the current race state."""
        root_state = self._from_race_state(race_state)
        root = MCTSNode(root_state)
        root.untried_actions = self._actions(root_state)

        if not root.untried_actions:
            return self._fallback(root_state)

        for _ in range(self.iterations):
            node = self._select(root)
            reward = self._rollout(node.state)
            self._backpropagate(node, reward)

        if not root.children:
            return self._fallback(root_state)

        best = max(root.children, key=lambda c: (c.average_reward, c.visits))
        urgent_compound = self._urgent_pit_compound(root_state)
        if urgent_compound and (best.action is None or not best.action.is_pit):
            urgent_child = next(
                (
                    c for c in root.children
                    if c.action and c.action.is_pit and c.action.compound == urgent_compound
                ),
                None,
            )
            if urgent_child and urgent_child.average_reward >= best.average_reward - 1.5:
                best = urgent_child
        stay_child = next(
            (c for c in root.children if c.action and c.action.name == "STAY_OUT"),
            None,
        )

        best_action = best.action or StrategyAction("STAY_OUT")
        recommended_compound = best_action.compound or self._best_compound(root_state)
        confidence = self._confidence(root.children, best)
        expected_stay = stay_child.average_reward if stay_child else best.average_reward

        messages = self._messages(root_state, best_action, confidence)
        return {
            "recommendation": "PIT_NOW" if best_action.is_pit else "STAY_OUT",
            "recommended_compound": recommended_compound,
            "confidence": round(confidence, 2),
            "reason": self._reason(root_state, best_action),
            "messages": messages,
            "expected_pit_score": round(best.average_reward, 4) if best_action.is_pit else 0.0,
            "expected_stay_score": round(expected_stay, 4),
            "mcts": {
                "iterations": self.iterations,
                "rollout_depth": self.rollout_depth,
                "root_visits": root.visits,
                "children": [
                    {
                        "action": child.action.label() if child.action else "UNKNOWN",
                        "visits": child.visits,
                        "score": round(child.average_reward, 4),
                    }
                    for child in sorted(root.children, key=lambda c: c.visits, reverse=True)
                ],
            },
        }

    def _select(self, root: MCTSNode) -> MCTSNode:
        node = root
        while not node.state.terminal():
            if node.untried_actions:
                return self._expand(node)

            if not node.children:
                return node

            node = node.best_child(exploration=1.25)
        return node

    def _expand(self, node: MCTSNode) -> MCTSNode:
        action = node.untried_actions.pop(self._rng.randrange(len(node.untried_actions)))
        child_state = self._transition(node.state, action)
        child = MCTSNode(child_state, parent=node, action=action)
        child.untried_actions = self._actions(child_state)
        node.children.append(child)
        return child

    def _rollout(self, state: SearchState) -> float:
        sim = state
        depth = min(self.rollout_depth, sim.laps_remaining())
        for _ in range(depth):
            if sim.terminal():
                break
            actions = self._actions(sim)
            action = self._rollout_policy(sim, actions)
            sim = self._transition(sim, action)
        return self._evaluate(sim)

    @staticmethod
    def _backpropagate(node: MCTSNode, reward: float) -> None:
        while node is not None:
            node.visits += 1
            node.total_reward += reward
            node = node.parent

    def _actions(self, state: SearchState) -> List[StrategyAction]:
        if state.terminal():
            return []

        actions = [StrategyAction("STAY_OUT")]
        if state.just_pitted or state.laps_remaining() <= 1:
            return actions

        dampness = float(state.weather.get("track_dampness", 0.0))
        rain = float(state.weather.get("rain_intensity", 0.0))

        if dampness >= 0.62 or rain >= 0.75:
            pit_compounds = ("WET", "INTERMEDIATE")
        elif dampness >= 0.16 or rain >= 0.25:
            pit_compounds = ("INTERMEDIATE", "WET", "MEDIUM")
        else:
            pit_compounds = DRY_COMPOUNDS

        for compound in pit_compounds:
            if compound != state.compound:
                actions.append(StrategyAction("PIT", compound))
        return actions

    def _rollout_policy(self, state: SearchState, actions: List[StrategyAction]) -> StrategyAction:
        if not actions:
            return StrategyAction("STAY_OUT")

        dampness = float(state.weather.get("track_dampness", 0.0))
        wet_mismatch = dampness >= 0.22 and state.compound in DRY_COMPOUNDS
        dry_mismatch = dampness < 0.08 and state.compound in ("INTERMEDIATE", "WET")
        tire_cliff = self._tire_life(state.compound) - state.tire_age <= 2
        rule_pressure = (
            not state.dry_rule_met()
            and state.compound in DRY_COMPOUNDS
            and state.laps_remaining() <= 12
        )

        if wet_mismatch:
            for action in actions:
                if action.compound == ("WET" if dampness >= 0.62 else "INTERMEDIATE"):
                    return action
        if dry_mismatch:
            for action in actions:
                if action.compound == self._best_compound(state):
                    return action
        if tire_cliff or rule_pressure:
            pit_actions = [a for a in actions if a.is_pit]
            if pit_actions:
                return min(pit_actions, key=lambda a: self._compound_fit(state, a.compound or "MEDIUM"))

        stay_weight = 0.68 if not tire_cliff else 0.35
        if self._rng.random() < stay_weight:
            return StrategyAction("STAY_OUT")
        return self._rng.choice(actions)

    def _transition(self, state: SearchState, action: StrategyAction) -> SearchState:
        next_lap = state.current_lap + 1
        weather = self._weather_for_lap(state, next_lap)
        compound = state.compound
        tire_age = state.tire_age
        pits = state.pits
        fuel = max(5.0, state.fuel - 1.55)
        own_time = state.own_time
        dry_used = set(state.dry_compounds_used)
        just_pitted = False

        if action.is_pit and action.compound:
            pit_loss = PIT_LOSS_SECONDS.get(state.track, PIT_LOSS_SECONDS["default"])
            own_time += pit_loss
            compound = action.compound
            tire_age = 0
            pits += 1
            just_pitted = True
            if compound in DRY_COMPOUNDS:
                dry_used.add(compound)

        lap_time = self._lap_time(state.track, compound, tire_age, fuel, weather)
        lap_time += self._rng.gauss(0.0, 0.18)
        if tire_age >= self._tire_life(compound):
            lap_time += 3.0 + (tire_age - self._tire_life(compound)) * 1.4
        dampness = float(weather.get("track_dampness", 0.0))
        if dampness >= 0.22 and compound in DRY_COMPOUNDS:
            lap_time += 4.0 + dampness * 4.0
        elif dampness < 0.08 and compound in ("INTERMEDIATE", "WET"):
            lap_time += 2.5 if compound == "INTERMEDIATE" else 5.0
        own_time += lap_time

        position, gap_ahead, gap_behind = self._update_virtual_position(
            state, lap_time, weather
        )

        if compound in DRY_COMPOUNDS:
            dry_used.add(compound)

        return SearchState(
            current_lap=next_lap,
            total_laps=state.total_laps,
            position=position,
            compound=compound,
            tire_age=tire_age + 1,
            fuel=fuel,
            pits=pits,
            dry_compounds_used=tuple(sorted(dry_used)),
            own_time=own_time,
            gap_ahead=gap_ahead,
            gap_behind=gap_behind,
            track=state.track,
            weather=weather,
            weather_forecast=state.weather_forecast,
            just_pitted=just_pitted,
        )

    def _update_virtual_position(
        self,
        state: SearchState,
        lap_time: float,
        weather: Dict[str, Any],
    ) -> Tuple[int, float, float]:
        base = TRACK_BASE_TIMES.get(state.track, TRACK_BASE_TIMES["default"])
        field_spread = (state.position - 10) * 0.04
        ahead_lap = base + field_spread + self._rng.gauss(0.0, 0.22)
        behind_lap = base + field_spread + self._rng.gauss(0.08, 0.25)

        if float(weather.get("track_dampness", 0.0)) > 0.2:
            ahead_lap += self._rng.gauss(0.4, 0.45)
            behind_lap += self._rng.gauss(0.4, 0.45)

        gap_ahead = max(0.0, state.gap_ahead + lap_time - ahead_lap)
        gap_behind = max(0.0, state.gap_behind + behind_lap - lap_time)
        position = state.position

        if position > 1 and gap_ahead <= 0.15:
            position -= 1
            gap_ahead = self._rng.uniform(0.8, 2.5)
        if position < 22 and gap_behind <= 0.10:
            position += 1
            gap_behind = self._rng.uniform(0.7, 2.2)

        return position, gap_ahead, gap_behind

    def _evaluate(self, state: SearchState) -> float:
        projected_position = state.position
        laps_left = state.laps_remaining()

        # Project tire cliff if rollout horizon ended before the race did.
        life_left = self._tire_life(state.compound) - state.tire_age
        if life_left < laps_left:
            projected_position += min(5, math.ceil((laps_left - life_left) / 4))

        if not state.dry_rule_met() and state.compound in DRY_COMPOUNDS:
            projected_position += 8

        projected_position = max(1, min(22, projected_position))
        points = POINTS_BY_POSITION.get(projected_position, 0)
        position_score = (21 - projected_position) * 0.8
        time_score = -state.own_time / 18.0
        pit_penalty = -0.4 * max(0, state.pits - 2)
        return points + position_score + time_score + pit_penalty

    def _from_race_state(self, race_state: Dict[str, Any]) -> SearchState:
        compound = str(race_state.get("compound", "MEDIUM")).upper()
        weather = dict(race_state.get("weather", {}) or {})
        dry_used = set(race_state.get("dry_compounds_used", []) or [])
        if compound in DRY_COMPOUNDS:
            dry_used.add(compound)

        track = self._normalize_track(race_state.get("track_name", "bahrain"))
        return SearchState(
            current_lap=int(race_state.get("current_lap", 1)),
            total_laps=int(race_state.get("total_laps", 57)),
            position=max(1, min(22, int(race_state.get("current_position", 10)))),
            compound=compound,
            tire_age=max(0, int(race_state.get("tire_age", 0))),
            fuel=max(5.0, float(race_state.get("fuel_remaining_kg", 50.0))),
            pits=max(0, int(race_state.get("pits", 0))),
            dry_compounds_used=tuple(sorted(dry_used)),
            own_time=0.0,
            gap_ahead=max(0.0, float(race_state.get("gap_to_next", 3.0) or 3.0)),
            gap_behind=max(0.0, float(race_state.get("gap_to_behind", 4.0) or 4.0)),
            track=track,
            weather=weather,
            weather_forecast=list(race_state.get("weather_forecast", []) or []),
        )

    def _weather_for_lap(self, state: SearchState, lap: int) -> Dict[str, Any]:
        offset = lap - state.current_lap - 1
        if 0 <= offset < len(state.weather_forecast):
            forecast = dict(state.weather_forecast[offset])
            forecast.setdefault("is_raining", float(forecast.get("rain_intensity", 0.0)) > 0.05)
            return forecast
        return dict(state.weather)

    def _lap_time(
        self,
        track: str,
        compound: str,
        tire_age: int,
        fuel: float,
        weather: Dict[str, Any],
    ) -> float:
        if self.predictor is not None and hasattr(self.predictor, "predict_lap_time"):
            try:
                return float(self.predictor.predict_lap_time(
                    track=track,
                    driver="PLAYER",
                    compound=compound,
                    tire_age=tire_age,
                    fuel_load=fuel,
                    weather_state=weather,
                ))
            except Exception:
                pass

        base = TRACK_BASE_TIMES.get(track, TRACK_BASE_TIMES["default"])
        compound_delta = {"SOFT": -0.6, "MEDIUM": 0.0, "HARD": 0.7, "INTERMEDIATE": 2.5, "WET": 5.5}.get(compound, 0.0)
        deg = max(0.0, tire_age) ** 1.25 * {"SOFT": 0.055, "MEDIUM": 0.035, "HARD": 0.022, "INTERMEDIATE": 0.03, "WET": 0.025}.get(compound, 0.035)
        fuel_delta = fuel * 0.03
        dampness = float(weather.get("track_dampness", 0.0))
        weather_delta = self._weather_mismatch_penalty(compound, dampness)
        return base + compound_delta + deg + fuel_delta + weather_delta

    @staticmethod
    def _weather_mismatch_penalty(compound: str, dampness: float) -> float:
        if dampness < 0.08 and compound in ("INTERMEDIATE", "WET"):
            return 3.0 if compound == "INTERMEDIATE" else 8.0
        if 0.18 <= dampness < 0.58 and compound in DRY_COMPOUNDS:
            return 5.0 + dampness * 10.0
        if dampness >= 0.58 and compound != "WET":
            return 10.0 if compound == "INTERMEDIATE" else 22.0
        return 0.0

    @staticmethod
    def _tire_life(compound: str) -> int:
        return {"SOFT": 22, "MEDIUM": 32, "HARD": 45, "INTERMEDIATE": 28, "WET": 36}.get(compound, 30)

    def _best_compound(self, state: SearchState) -> str:
        dampness = float(state.weather.get("track_dampness", 0.0))
        rain = float(state.weather.get("rain_intensity", 0.0))
        if dampness >= 0.62 or rain >= 0.75:
            return "WET"
        if dampness >= 0.18 or rain >= 0.25:
            return "INTERMEDIATE"
        if state.laps_remaining() <= 12:
            return "SOFT"
        if state.laps_remaining() <= 28:
            return "MEDIUM"
        return "HARD"

    def _urgent_pit_compound(self, state: SearchState) -> Optional[str]:
        dampness = float(state.weather.get("track_dampness", 0.0))
        rain = float(state.weather.get("rain_intensity", 0.0))
        if (dampness >= 0.22 or rain >= 0.35) and state.compound in DRY_COMPOUNDS:
            return "WET" if dampness >= 0.62 or rain >= 0.75 else "INTERMEDIATE"
        if dampness < 0.08 and state.compound in ("INTERMEDIATE", "WET"):
            return self._best_compound(state)
        if state.tire_age >= self._tire_life(state.compound):
            return self._best_compound(state)
        if not state.dry_rule_met() and state.laps_remaining() <= 10:
            return self._best_compound(state)
        return None

    def _compound_fit(self, state: SearchState, compound: str) -> float:
        target = self._best_compound(state)
        if compound == target:
            return 0.0
        order = list(ALL_COMPOUNDS)
        return abs(order.index(compound) - order.index(target))

    def _confidence(self, children: List[MCTSNode], best: MCTSNode) -> float:
        if not children:
            return 0.5
        ordered = sorted(children, key=lambda c: c.average_reward, reverse=True)
        if len(ordered) == 1:
            return 0.65
        margin = ordered[0].average_reward - ordered[1].average_reward
        visit_share = best.visits / max(1, sum(c.visits for c in children))
        return max(0.45, min(0.96, 0.50 + margin / 4.0 + visit_share * 0.25))

    def _messages(
        self,
        state: SearchState,
        action: StrategyAction,
        confidence: float,
    ) -> List[Dict[str, Any]]:
        messages: List[Dict[str, Any]] = []
        life_left = self._tire_life(state.compound) - state.tire_age
        if life_left <= 3:
            messages.append({
                "type": "WARNING",
                "text": "Tire cliff is within the next three laps.",
                "confidence": round(confidence, 2),
            })
        if not state.dry_rule_met() and state.laps_remaining() <= 12:
            messages.append({
                "type": "URGENT",
                "text": "Dry compound obligation is not covered.",
                "confidence": 0.94,
            })
        if action.is_pit:
            messages.append({
                "type": "INFO",
                "text": f"MCTS selected {action.compound} for the next stint.",
                "confidence": round(confidence, 2),
            })
        else:
            messages.append({
                "type": "INFO",
                "text": "MCTS favours track position for now.",
                "confidence": round(confidence, 2),
            })
        return messages

    def _reason(self, state: SearchState, action: StrategyAction) -> str:
        if action.is_pit:
            return (
                f"Tree search prefers boxing for {action.compound}: "
                f"{state.laps_remaining()} laps remain, tire age {state.tire_age}."
            )
        return (
            f"Tree search prefers staying out: P{state.position}, "
            f"{state.laps_remaining()} laps remain, tire age {state.tire_age}."
        )

    def _fallback(self, state: SearchState) -> Dict[str, Any]:
        compound = self._best_compound(state)
        pit = self._tire_life(state.compound) - state.tire_age <= 2
        return {
            "recommendation": "PIT_NOW" if pit else "STAY_OUT",
            "recommended_compound": compound,
            "confidence": 0.5,
            "reason": "MCTS fallback heuristic.",
            "messages": [],
            "expected_pit_score": 0.0,
            "expected_stay_score": 0.0,
            "mcts": {"iterations": 0, "rollout_depth": 0, "root_visits": 0, "children": []},
        }

    @staticmethod
    def _normalize_track(track: Any) -> str:
        return str(track).lower().replace(" ", "_")
