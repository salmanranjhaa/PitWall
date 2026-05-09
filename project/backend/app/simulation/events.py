"""
F1 Race Events Module

Provides the event bus for decoupled communication between simulation components,
SafetyCarController for managing race interruptions, and the FlagState enumeration
for race control states.
"""

import random
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Callable, Dict, List, Optional


# =============================================================================
# FLAG STATE ENUMERATION
# =============================================================================

class FlagState(Enum):
    """
    Race control flag states that govern on-track behavior.

    GREEN: Normal racing conditions.
    YELLOW: Caution in a specific sector - no overtaking.
    VSC: Virtual Safety Car - reduced speed, no overtaking.
    SAFETY_CAR: Physical safety car on track - no overtaking, follow pace car.
    RED: Race stopped - all cars return to pit lane.
    """
    GREEN = auto()
    YELLOW = auto()
    VSC = auto()
    SAFETY_CAR = auto()
    RED = auto()


# =============================================================================
# RACE EVENT BUS
# =============================================================================

@dataclass
class RaceEvent:
    """
    Represents a single event that occurred during the race.

    Attributes:
        event_type: Category of the event (e.g., 'incident', 'pit', 'overtake').
        lap: Lap number when the event occurred.
        data: Arbitrary data payload specific to the event type.
    """
    event_type: str
    lap: int
    data: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize the event to a dictionary."""
        return {
            "event_type": self.event_type,
            "lap": self.lap,
            "data": self.data,
        }


class RaceEventBus:
    """
    Publish-subscribe event bus for race simulation events.

    Components can subscribe to specific event types and receive callbacks
    whenever matching events are emitted. Decouples event producers from
    consumers for clean architecture.
    """

    def __init__(self) -> None:
        """Initialize the event bus with empty subscriber lists."""
        self._subscribers: Dict[str, List[Callable[[RaceEvent], None]]] = {}
        self._event_log: List[RaceEvent] = []

    def subscribe(
        self,
        event_type: str,
        callback: Callable[[RaceEvent], None],
    ) -> None:
        """
        Register a callback for a specific event type.

        Args:
            event_type: Event type string to listen for (e.g., 'incident').
            callback: Function called when matching events are emitted.
        """
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(callback)

    def unsubscribe(
        self,
        event_type: str,
        callback: Callable[[RaceEvent], None],
    ) -> None:
        """
        Remove a previously registered callback.

        Args:
            event_type: Event type string.
            callback: Callback function to remove.
        """
        if event_type in self._subscribers:
            if callback in self._subscribers[event_type]:
                self._subscribers[event_type].remove(callback)

    def emit(self, event: RaceEvent) -> None:
        """
        Publish an event to all subscribers.

        Args:
            event: The RaceEvent to publish.
        """
        self._event_log.append(event)

        # Notify type-specific subscribers
        if event.event_type in self._subscribers:
            for callback in self._subscribers[event.event_type]:
                try:
                    callback(event)
                except Exception:
                    pass  # Silently handle subscriber errors

        # Notify wildcard subscribers (listening to "*")
        if "*" in self._subscribers:
            for callback in self._subscribers["*"]:
                try:
                    callback(event)
                except Exception:
                    pass

    def get_events(
        self,
        event_type: Optional[str] = None,
        lap: Optional[int] = None,
    ) -> List[RaceEvent]:
        """
        Retrieve logged events with optional filtering.

        Args:
            event_type: Filter by event type string.
            lap: Filter by lap number.

        Returns:
            List of matching RaceEvent objects.
        """
        events = self._event_log
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        if lap is not None:
            events = [e for e in events if e.lap == lap]
        return events

    def clear_log(self) -> None:
        """Clear all logged events."""
        self._event_log.clear()


# =============================================================================
# SAFETY CAR CONTROLLER
# =============================================================================

class SafetyCarController:
    """
    Manages Safety Car and Virtual Safety Car deployments.

    Processes incidents to determine if a safety car is needed, manages the
    duration of safety car periods, and tracks the laps remaining under SC.
    """

    # SC duration by incident severity (in laps)
    SC_DURATION = {
        "minor": 0,         # Minor incidents: no SC
        "moderate": 0,      # Spin and continue: no SC, maybe local yellow
        "major": 3,         # Crash into barrier: 3 laps SC
        "critical": 5,      # Major crash / stopped car: 5 laps SC
    }

    # VSC duration by incident severity (when full SC is not warranted)
    VSC_DURATION = {
        "minor": 0,
        "moderate": 2,
        "major": 0,  # Major always goes to full SC
        "critical": 0,  # Critical always goes to full SC
    }

    def __init__(
        self,
        random_seed: Optional[int] = None,
    ) -> None:
        """
        Initialize the Safety Car controller.

        Args:
            random_seed: Optional seed for reproducible behavior.
        """
        self._rng = random.Random(random_seed)
        self._sc_laps_remaining: int = 0
        self._vsc_laps_remaining: int = 0
        self._total_sc_deployments: int = 0
        self._current_incident: Optional[Dict[str, Any]] = None

    @property
    def is_sc_active(self) -> bool:
        """Return True if a full Safety Car period is currently active."""
        return self._sc_laps_remaining > 0

    @property
    def is_vsc_active(self) -> bool:
        """Return True if a Virtual Safety Car period is currently active."""
        return self._vsc_laps_remaining > 0

    @property
    def is_any_sc_active(self) -> bool:
        """Return True if either SC or VSC is currently active."""
        return self.is_sc_active or self.is_vsc_active

    @property
    def sc_laps_remaining(self) -> int:
        """Number of laps remaining under full Safety Car."""
        return self._sc_laps_remaining

    @property
    def vsc_laps_remaining(self) -> int:
        """Number of laps remaining under Virtual Safety Car."""
        return self._vsc_laps_remaining

    def check_incident(
        self,
        race_state: Any,
    ) -> Optional[Dict[str, Any]]:
        """
        Check if the current race state requires a safety car deployment.

        Evaluates active incidents in the race state and determines whether
        a full Safety Car, Virtual Safety Car, or no intervention is needed.

        Args:
            race_state: Current RaceState with incidents list.

        Returns:
            Incident dict if a new SC/VSC is triggered, None otherwise.
        """
        if race_state is None or not hasattr(race_state, 'incidents'):
            return None

        # Process any new incidents that require SC
        for incident in race_state.incidents:
            if not incident.get("processed", False):
                severity = incident.get("severity", "minor")

                if incident.get("requires_sc", False) and severity in ("major", "critical"):
                    incident["processed"] = True
                    self._sc_laps_remaining = self.get_sc_duration(severity)
                    self._total_sc_deployments += 1
                    self._current_incident = incident
                    return incident

                elif severity == "moderate" and not self.is_any_sc_active:
                    incident["processed"] = True
                    self._vsc_laps_remaining = self.VSC_DURATION.get(severity, 0)
                    return incident

        return None

    def get_sc_duration(self, severity: str) -> int:
        """
        Get the safety car duration for a given incident severity.

        Args:
            severity: Incident severity string (minor, moderate, major, critical).

        Returns:
            Number of laps the safety car will be deployed.
        """
        base_duration = self.SC_DURATION.get(severity, 0)
        if base_duration > 0:
            # Add some randomness (+/- 1 lap)
            variation = self._rng.randint(-1, 1)
            return max(2, base_duration + variation)
        return 0

    def tick(self) -> None:
        """
        Decrement the safety car countdown by one lap.

        Called each race lap to count down active SC/VSC periods.
        """
        if self._sc_laps_remaining > 0:
            self._sc_laps_remaining -= 1
        if self._vsc_laps_remaining > 0:
            self._vsc_laps_remaining -= 1

    def get_flag_state(self) -> FlagState:
        """
        Determine the current race flag state based on active safety car periods.

        Returns:
            Current FlagState enumeration value.
        """
        if self._sc_laps_remaining > 0:
            return FlagState.SAFETY_CAR
        elif self._vsc_laps_remaining > 0:
            return FlagState.VSC
        return FlagState.GREEN

    def reset(self) -> None:
        """Reset the safety car controller to initial state."""
        self._sc_laps_remaining = 0
        self._vsc_laps_remaining = 0
        self._total_sc_deployments = 0
        self._current_incident = None


# =============================================================================
# INCIDENT LOG
# =============================================================================

@dataclass
class Incident:
    """
    Record of a specific incident that occurred during the race.

    Attributes:
        driver_number: Racing number of the involved driver.
        driver_name: Name of the involved driver.
        severity: Incident severity (minor, moderate, major, critical).
        description: Human-readable description of the incident.
        lap: Lap number when the incident occurred.
        sector: Track sector (1, 2, or 3) where the incident occurred.
        requires_sc: Whether the incident warrants a safety car.
        processed: Whether the incident has been handled by race control.
    """
    driver_number: int
    driver_name: str
    severity: str
    description: str
    lap: int
    sector: int
    requires_sc: bool
    processed: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Serialize the incident to a dictionary."""
        return {
            "driver_number": self.driver_number,
            "driver_name": self.driver_name,
            "severity": self.severity,
            "description": self.description,
            "lap": self.lap,
            "sector": self.sector,
            "requires_sc": self.requires_sc,
            "processed": self.processed,
        }
