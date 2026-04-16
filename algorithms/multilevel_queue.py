"""
multilevel_queue.py — Multilevel Queue (MLQ) CPU Scheduling Algorithm.

Three fixed-priority queues:
  Queue 0 (System / highest):   Round Robin, quantum=2
  Queue 1 (Interactive / mid):  Round Robin, quantum=4
  Queue 2 (Batch / lowest):     FCFS

Processes are permanently assigned to a queue based on their `priority`
field:  priority 0-1 → Q0,  priority 2-3 → Q1,  priority ≥4 → Q2.
Higher queues are always serviced first (strict priority between queues).
"""

from collections import deque
from typing import List, Dict, Optional

from algorithms.process import Process, ProcessState
from algorithms.scheduler import Scheduler, ScheduleResult, GanttEntry


class MultilevelQueueScheduler(Scheduler):
    """Multilevel Queue — 3 fixed queues with strict inter-queue priority."""

    name = "Multilevel Queue"
    preemptive = True  # Higher-queue arrivals preempt lower queues

    # Queue assignment thresholds
    QUEUE_BOUNDARIES = [(0, 1), (2, 3)]  # priority ranges for Q0, Q1; rest → Q2

    # Per-queue quantum (Q2 = FCFS = effectively ∞)
    QUEUE_QUANTA = {0: 2, 1: 4, 2: 10**9}

    @staticmethod
    def _assign_queue(priority: int) -> int:
        if priority <= 1:
            return 0
        elif priority <= 3:
            return 1
        return 2

    def schedule(self, processes: List[Process]) -> ScheduleResult:
        procs = self._clone_processes(processes)
        procs = [p for p in procs if p.burst_time > 0]

        if not procs:
            return ScheduleResult()

        procs.sort(key=lambda p: (p.arrival_time, p.pid))

        # Assign each process to its queue
        for p in procs:
            p.queue_level = self._assign_queue(p.priority)

        queues: Dict[int, deque] = {0: deque(), 1: deque(), 2: deque()}
        gantt: List[GanttEntry] = []
        ready_snapshots: Dict[int, List[int]] = {}
        context_switches = 0
        current_time = 0
        entered = set()
        completed: List[Process] = []
        last_pid: Optional[int] = None

        def admit_arrivals(up_to: int):
            for p in procs:
                if p.pid not in entered and p.arrival_time <= up_to and not p.is_complete:
                    queues[p.queue_level].append(p)
                    entered.add(p.pid)

        admit_arrivals(current_time)

        while len(completed) < len(procs):
            # Find highest-priority non-empty queue
            active_q = None
            for q in (0, 1, 2):
                if queues[q]:
                    active_q = q
                    break

            if active_q is None:
                # Advance to next arrival
                unarrived = [p for p in procs if not p.is_complete and p.pid not in entered]
                if not unarrived:
                    break
                next_arrival = min(p.arrival_time for p in unarrived)
                gantt.append(GanttEntry(pid=-1, start=current_time, end=next_arrival))
                current_time = next_arrival
                admit_arrivals(current_time)
                continue

            proc = queues[active_q].popleft()
            quantum = self.QUEUE_QUANTA[active_q]

            ready_snapshots[current_time] = [
                p.pid
                for q in (0, 1, 2) for p in queues[q]
            ]

            if proc.start_time is None:
                proc.start_time = current_time

            if last_pid is not None and last_pid != proc.pid:
                context_switches += 1
            last_pid = proc.pid

            run_time = min(quantum, proc.remaining_burst)

            # Check if a higher-queue process arrives during this run
            for p in procs:
                if (p.pid not in entered
                        and not p.is_complete
                        and p.arrival_time > current_time
                        and p.arrival_time < current_time + run_time
                        and self._assign_queue(p.priority) < active_q):
                    # Preempt at that arrival time
                    run_time = p.arrival_time - current_time
                    break

            proc.state = ProcessState.RUNNING
            gantt.append(GanttEntry(pid=proc.pid, start=current_time, end=current_time + run_time))
            proc.remaining_burst -= run_time
            current_time += run_time

            # Admit new arrivals
            admit_arrivals(current_time)

            if proc.is_complete:
                proc.completion_time = current_time
                proc.state = ProcessState.TERMINATED
                completed.append(proc)
            else:
                proc.state = ProcessState.READY
                queues[active_q].append(proc)

        return ScheduleResult(
            gantt=gantt,
            metrics=self._build_metrics(completed),
            ready_queue_snapshots=ready_snapshots,
            context_switches=context_switches,
        )
