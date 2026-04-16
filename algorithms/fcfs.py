"""
fcfs.py — First-Come, First-Served (FCFS) CPU Scheduling Algorithm.

Non-preemptive: processes run in the order they arrive, each running to
completion before the next one starts.
"""

from typing import List

from algorithms.process import Process, ProcessState
from algorithms.scheduler import Scheduler, ScheduleResult, GanttEntry


class FCFSScheduler(Scheduler):
    """First-Come, First-Served — the simplest scheduling algorithm."""

    name = "FCFS"
    preemptive = False

    def schedule(self, processes: List[Process]) -> ScheduleResult:
        procs = self._clone_processes(processes)
        # Skip processes with zero burst
        procs = [p for p in procs if p.burst_time > 0]

        if not procs:
            return ScheduleResult()

        # Sort by arrival time, tie-break by PID
        procs.sort(key=lambda p: (p.arrival_time, p.pid))

        gantt: List[GanttEntry] = []
        ready_snapshots = {}
        current_time = 0
        context_switches = 0

        for i, proc in enumerate(procs):
            # If CPU is idle, jump to the next arrival
            if current_time < proc.arrival_time:
                gantt.append(GanttEntry(pid=-1, start=current_time, end=proc.arrival_time))
                current_time = proc.arrival_time

            # Record ready queue (all arrived but not yet run)
            ready_pids = [
                p.pid for p in procs[i:]
                if p.arrival_time <= current_time and p.state != ProcessState.TERMINATED
            ]
            ready_snapshots[current_time] = ready_pids

            # Run this process to completion
            proc.start_time = current_time
            proc.state = ProcessState.RUNNING
            start = current_time
            current_time += proc.burst_time
            proc.remaining_burst = 0
            proc.completion_time = current_time
            proc.state = ProcessState.TERMINATED

            gantt.append(GanttEntry(pid=proc.pid, start=start, end=current_time))

            # Context switch (not counted for last process)
            if i < len(procs) - 1:
                context_switches += 1

        return ScheduleResult(
            gantt=gantt,
            metrics=self._build_metrics(procs),
            ready_queue_snapshots=ready_snapshots,
            context_switches=context_switches,
        )
