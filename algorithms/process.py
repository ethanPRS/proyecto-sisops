"""
process.py — Core Process Data Model for the OS Simulator.

Defines the Process class and ProcessState enum used throughout
every scheduling and memory management algorithm.
"""

from enum import Enum, auto
from dataclasses import dataclass, field
from typing import Optional


class ProcessState(Enum):
    """Represents the five-state process lifecycle model."""
    NEW = auto()
    READY = auto()
    RUNNING = auto()
    WAITING = auto()
    TERMINATED = auto()


@dataclass
class Process:
    """
    Represents a single process in the operating system simulator.

    Attributes:
        pid:             Unique process identifier.
        arrival_time:    Time unit when the process enters the system.
        burst_time:      Total CPU burst time required.
        priority:        Priority level (lower number = higher priority).
        num_pages:       Number of memory pages this process requires.
        state:           Current lifecycle state.
        remaining_burst: Burst time still left to execute.
        start_time:      Time when the process first receives the CPU (None if not started).
        completion_time: Time when the process finishes execution (None if not complete).
        waiting_time:    Total time spent in the READY queue.
        queue_level:     Current queue level for multilevel feedback queues.
    """
    pid: int
    arrival_time: int
    burst_time: int
    priority: int = 0
    num_pages: int = 1
    state: ProcessState = ProcessState.NEW

    # ── Runtime bookkeeping (set during simulation) ──────────────────
    remaining_burst: int = -1  # Initialised in __post_init__
    start_time: Optional[int] = None
    completion_time: Optional[int] = None
    waiting_time: int = 0
    queue_level: int = 0  # For multilevel feedback queue

    def __post_init__(self):
        """Initialise remaining_burst from burst_time if not explicitly set."""
        if self.remaining_burst < 0:
            self.remaining_burst = self.burst_time

    # ── Computed metrics ─────────────────────────────────────────────

    @property
    def turnaround_time(self) -> Optional[int]:
        """Turnaround = Completion − Arrival."""
        if self.completion_time is None:
            return None
        return self.completion_time - self.arrival_time

    @property
    def response_time(self) -> Optional[int]:
        """Response = First-CPU − Arrival."""
        if self.start_time is None:
            return None
        return self.start_time - self.arrival_time

    @property
    def is_complete(self) -> bool:
        return self.remaining_burst <= 0

    # ── Helpers ──────────────────────────────────────────────────────

    def clone(self) -> "Process":
        """Return a deep copy with runtime fields reset."""
        return Process(
            pid=self.pid,
            arrival_time=self.arrival_time,
            burst_time=self.burst_time,
            priority=self.priority,
            num_pages=self.num_pages,
        )

    def transition(self, new_state: ProcessState):
        """Perform a state transition (can be extended for validation)."""
        self.state = new_state

    def __repr__(self) -> str:
        return (
            f"Process(pid={self.pid}, arr={self.arrival_time}, "
            f"burst={self.burst_time}, rem={self.remaining_burst}, "
            f"pri={self.priority}, state={self.state.name})"
        )
