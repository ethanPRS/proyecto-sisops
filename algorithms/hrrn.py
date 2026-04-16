"""
hrrn.py — Highest Response Ratio Next (HRRN) CPU Scheduling Algorithm.

Non-preemptive: selects the process with the highest response ratio:
    RR = (Waiting Time + Burst Time) / Burst Time
This balances short jobs and long-waiting jobs.
"""

from typing import List

from algorithms.process import Process, ProcessState
from algorithms.scheduler import Scheduler, ScheduleResult, GanttEntry


class HRRNScheduler(Scheduler):
    """Highest Response Ratio Next — non-preemptive, ratio-based."""

    name = "HRRN"
    preemptive = False

    @staticmethod
    def _response_ratio(proc: Process, current_time: int) -> float:
        """Compute (waiting + burst) / burst."""
        waiting = current_time - proc.arrival_time
        if proc.burst_time == 0:
            return float('inf')
        return (waiting + proc.burst_time) / proc.burst_time

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
            available = [p for p in remaining if p.arrival_time <= current_time]

            if not available:
                next_arrival = min(p.arrival_time for p in remaining)
                gantt.append(GanttEntry(pid=-1, start=current_time, end=next_arrival))
                current_time = next_arrival
                continue

            # Pick highest response ratio (tie-break: arrival, PID)
            available.sort(
                key=lambda p: (-self._response_ratio(p, current_time),
                               p.arrival_time, p.pid)
            )
            proc = available[0]

            ready_snapshots[current_time] = [p.pid for p in available]

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
