"""
Abstract base class for BDI (Belief-Desire-Intention) agents.
"""

from abc import ABC, abstractmethod
from typing import Any


class BDIAgent(ABC):
    """
    Abstract BDI agent defining the perceive-deliberate-select-execute cycle.
    """

    @abstractmethod
    def perceive(self, race_state: Any) -> None:
        """Step 1: Update belief base from the current race state."""
        ...

    @abstractmethod
    def deliberate(self) -> None:
        """Step 2: Rank desires given current beliefs."""
        ...

    @abstractmethod
    def select_plan(self) -> None:
        """Step 3: Choose or continue a plan (intention selection)."""
        ...

    @abstractmethod
    def execute(self) -> Any:
        """Step 4: Return the next action from the current plan."""
        ...
