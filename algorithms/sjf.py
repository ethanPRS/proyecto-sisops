"""
sjf.py — Shortest Job First (SJF) CPU Scheduling Algorithm.

Non-preemptive: at each decision point, the process with the smallest
burst time (among those arrived) is selected and runs to completion.
"""

from typing import List

from algorithms.process import Process, ProcessState
from algorithms.scheduler import Scheduler, ScheduleResult, GanttEntry


class SJFScheduler(Scheduler):
    """Shortest Job First — non-preemptive, selects by burst time."""

    name = "SJF"
    preemptive = False

    def schedule(self, processes: List[Process]) -> ScheduleResult:
        procs = self._clone_processes(processes)
        procs = [p for p in procs if p.burst_time > 0]

        if not procs:
            return ScheduleResult()

        gantt: List[GanttEntry] = []
        ready_snapshots = {}
        completed: List[Process] = []
        current_time = 0
        context_switches = 0

        remaining = list(procs)

        while remaining:
            # Processes that have arrived by current_time
            available = [p for p in remaining if p.arrival_time <= current_time]

            if not available:
                # CPU idle — jump to next arrival
                next_arrival = min(p.arrival_time for p in remaining)
                gantt.append(GanttEntry(pid=-1, start=current_time, end=next_arrival))
                current_time = next_arrival
                continue

            # Pick shortest burst (tie-break: arrival, then PID)
            available.sort(key=lambda p: (p.burst_time, p.arrival_time, p.pid))
            proc = available[0]

            # Snapshot ready queue
            ready_snapshots[current_time] = [
                p.pid for p in available
            ]

            # Run to completion
            proc.start_time = current_time
            proc.state = ProcessState.RUNNING
            start = current_time
            current_time += proc.burst_time
            proc.remaining_burst = 0
            proc.completion_time = current_time
            proc.state = ProcessState.TERMINATED

            gantt.append(GanttEntry(pid=proc.pid, start=start, end=current_time))
            remaining.remove(proc)
            completed.append(proc)

            if remaining:
                context_switches += 1

        return ScheduleResult(
            gantt=gantt,
            metrics=self._build_metrics(completed),
            ready_queue_snapshots=ready_snapshots,
            context_switches=context_switches,
        )
