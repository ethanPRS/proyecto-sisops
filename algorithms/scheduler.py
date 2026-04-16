"""
scheduler.py — Abstract Scheduler base class and result containers.

Every scheduling algorithm inherits from `Scheduler` and implements
`schedule()`, which returns a `ScheduleResult` containing the Gantt
timeline and per-process metrics.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Optional

from algorithms.process import Process


# ═══════════════════════════════════════════════════════════════════════
# Data containers used by the Gantt chart and metrics dashboard
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class GanttEntry:
    """One horizontal bar segment in the Gantt chart."""
    pid: int          # Process ID (use -1 for idle/gap)
    start: int        # Start time unit
    end: int          # End time unit (exclusive)


@dataclass
class ProcessMetrics:
    """Computed metrics for a single process after scheduling."""
    pid: int
    arrival_time: int
    burst_time: int
    completion_time: int
    turnaround_time: int   # CT − AT
    waiting_time: int      # TAT − BT
    response_time: int     # First-CPU − AT


@dataclass
class ScheduleResult:
    """Full output of a scheduling simulation run."""
    gantt: List[GanttEntry] = field(default_factory=list)
    metrics: List[ProcessMetrics] = field(default_factory=list)

    # ── Ready-queue snapshots (for queue animation) ──────────────────
    # Each entry maps time → list of PIDs in the ready queue at that instant
    ready_queue_snapshots: Dict[int, List[int]] = field(default_factory=dict)

    # ── Context switches ─────────────────────────────────────────────
    context_switches: int = 0

    # ── Aggregate stats ──────────────────────────────────────────────

    @property
    def avg_turnaround(self) -> float:
        if not self.metrics:
            return 0.0
        return sum(m.turnaround_time for m in self.metrics) / len(self.metrics)

    @property
    def avg_waiting(self) -> float:
        if not self.metrics:
            return 0.0
        return sum(m.waiting_time for m in self.metrics) / len(self.metrics)

    @property
    def avg_response(self) -> float:
        if not self.metrics:
            return 0.0
        return sum(m.response_time for m in self.metrics) / len(self.metrics)

    @property
    def cpu_utilization(self) -> float:
        """Percentage of time the CPU was busy."""
        if not self.gantt:
            return 0.0
        total_time = max(e.end for e in self.gantt)
        busy_time = sum(e.end - e.start for e in self.gantt if e.pid >= 0)
        return (busy_time / total_time * 100) if total_time > 0 else 0.0

    @property
    def total_time(self) -> int:
        if not self.gantt:
            return 0
        return max(e.end for e in self.gantt)


# ═══════════════════════════════════════════════════════════════════════
# Abstract base class
# ═══════════════════════════════════════════════════════════════════════

class Scheduler(ABC):
    """
    Abstract base class for all CPU scheduling algorithms.

    Subclasses must implement `schedule(processes)` which receives a
    list of Process objects and returns a ScheduleResult.
    """

    name: str = "Base Scheduler"
    preemptive: bool = False

    @abstractmethod
    def schedule(self, processes: List[Process]) -> ScheduleResult:
        """
        Run the scheduling algorithm on the given process list.

        Args:
            processes: List of Process objects (will be cloned internally).

        Returns:
            ScheduleResult with Gantt chart entries and per-process metrics.
        """
        ...

    @staticmethod
    def _clone_processes(processes: List[Process]) -> List[Process]:
        """Clone all processes to avoid mutating the originals."""
        return [p.clone() for p in processes]

    @staticmethod
    def _build_metrics(processes: List[Process]) -> List[ProcessMetrics]:
        """Build ProcessMetrics list from completed processes."""
        result = []
        for p in sorted(processes, key=lambda x: x.pid):
            ct = p.completion_time if p.completion_time is not None else 0
            tat = ct - p.arrival_time
            wt = tat - p.burst_time
            rt = (p.start_time - p.arrival_time) if p.start_time is not None else 0
            result.append(ProcessMetrics(
                pid=p.pid,
                arrival_time=p.arrival_time,
                burst_time=p.burst_time,
                completion_time=ct,
                turnaround_time=tat,
                waiting_time=max(wt, 0),
                response_time=max(rt, 0),
            ))
        return result

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(preemptive={self.preemptive})"
