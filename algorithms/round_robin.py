"""
round_robin.py — Round Robin (RR) CPU Scheduling Algorithm.

Preemptive: each process gets a fixed time quantum.  If it doesn't
finish within the quantum it is moved to the back of the ready queue.
"""

from collections import deque
from typing import List

from algorithms.process import Process, ProcessState
from algorithms.scheduler import Scheduler, ScheduleResult, GanttEntry


class RoundRobinScheduler(Scheduler):
    """Round Robin — preemptive with configurable quantum."""

    name = "Round Robin"
    preemptive = True

    def __init__(self, quantum: int = 2):
        self.quantum = max(1, quantum)

    def schedule(self, processes: List[Process]) -> ScheduleResult:
        procs = self._clone_processes(processes)
        procs = [p for p in procs if p.burst_time > 0]

        if not procs:
            return ScheduleResult()

        procs.sort(key=lambda p: (p.arrival_time, p.pid))

        gantt: List[GanttEntry] = []
        ready_snapshots = {}
        current_time = 0
        context_switches = 0
        queue: deque[Process] = deque()

        # Track which processes have entered the queue
        entered = set()
        remaining = list(procs)
        last_pid = -1

        # Seed: add all processes arriving at time 0
        for p in remaining:
            if p.arrival_time <= current_time:
                queue.append(p)
                entered.add(p.pid)

        while queue or remaining:
            # If queue is empty, advance to the next arrival
            if not queue:
                unarrived = [p for p in remaining if p.pid not in entered]
                if not unarrived:
                    break
                next_arrival = min(p.arrival_time for p in unarrived)
                gantt.append(GanttEntry(pid=-1, start=current_time, end=next_arrival))
                current_time = next_arrival
                for p in remaining:
                    if p.arrival_time <= current_time and p.pid not in entered:
                        queue.append(p)
                        entered.add(p.pid)
                continue

            proc = queue.popleft()

            # Snapshot ready queue
            ready_snapshots[current_time] = [p.pid for p in queue]

            # Set start_time for response-time calculation
            if proc.start_time is None:
                proc.start_time = current_time

            proc.state = ProcessState.RUNNING
            run_time = min(self.quantum, proc.remaining_burst)
            start = current_time
            current_time += run_time
            proc.remaining_burst -= run_time

            gantt.append(GanttEntry(pid=proc.pid, start=start, end=current_time))

            # Context switch tracking
            if last_pid != proc.pid and last_pid != -1:
                context_switches += 1
            last_pid = proc.pid

            # Admit newly arrived processes BEFORE re-queuing current
            for p in remaining:
                if (p.pid not in entered
                        and p.arrival_time <= current_time):
                    queue.append(p)
                    entered.add(p.pid)

            if proc.remaining_burst > 0:
                proc.state = ProcessState.READY
                queue.append(proc)
            else:
                proc.completion_time = current_time
                proc.state = ProcessState.TERMINATED

        # Collect all completed
        completed = [p for p in procs if p.completion_time is not None]
        return ScheduleResult(
            gantt=gantt,
            metrics=self._build_metrics(completed),
            ready_queue_snapshots=ready_snapshots,
            context_switches=context_switches,
        )
