"""
algorithms/__init__.py — Package exports and algorithm registry.

Provides ALGORITHM_MAP for the GUI dropdown to look up scheduler
classes by display name.
"""

from algorithms.process import Process, ProcessState
from algorithms.scheduler import Scheduler, ScheduleResult, GanttEntry, ProcessMetrics
from algorithms.fcfs import FCFSScheduler
from algorithms.sjf import SJFScheduler
from algorithms.hrrn import HRRNScheduler
from algorithms.round_robin import RoundRobinScheduler
from algorithms.srtf import SRTFScheduler
from algorithms.priority_preemptive import PriorityPreemptiveScheduler
from algorithms.multilevel_queue import MultilevelQueueScheduler
from algorithms.multilevel_feedback_queue import MultilevelFeedbackQueueScheduler
from algorithms.memory import MemoryManager
from algorithms.page_replacement import (
    PageReplacementAlgorithm,
    FIFOReplacement,
    LRUReplacement,
    OptimalReplacement,
    ClockReplacement,
    SecondChanceReplacement,
    ReplacementStep,
)

# ── Registry: display-name → class ───────────────────────────────────
ALGORITHM_MAP = {
    "FCFS":                     FCFSScheduler,
    "SJF":                      SJFScheduler,
    "HRRN":                     HRRNScheduler,
    "Round Robin":              RoundRobinScheduler,
    "SRTF":                     SRTFScheduler,
    "Priority (Preemptive)":    PriorityPreemptiveScheduler,
    "Multilevel Queue":         MultilevelQueueScheduler,
    "MLFQ":                     MultilevelFeedbackQueueScheduler,
}

PAGE_REPLACEMENT_MAP = {
    "FIFO":          FIFOReplacement,
    "LRU":           LRUReplacement,
    "Optimal":       OptimalReplacement,
    "Clock":         ClockReplacement,
    "Second Chance": SecondChanceReplacement,
}

__all__ = [
    "Process", "ProcessState",
    "Scheduler", "ScheduleResult", "GanttEntry", "ProcessMetrics",
    "FCFSScheduler", "SJFScheduler", "HRRNScheduler",
    "RoundRobinScheduler", "SRTFScheduler",
    "PriorityPreemptiveScheduler",
    "MultilevelQueueScheduler", "MultilevelFeedbackQueueScheduler",
    "MemoryManager",
    "PageReplacementAlgorithm", "FIFOReplacement", "LRUReplacement",
    "OptimalReplacement", "ClockReplacement", "SecondChanceReplacement",
    "ReplacementStep",
    "ALGORITHM_MAP", "PAGE_REPLACEMENT_MAP",
]
