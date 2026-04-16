"""
multilevel_feedback_queue.py — Multilevel Feedback Queue (MLFQ) Scheduling.

Three queues with increasing quanta and demotion:
  Queue 0:  RR quantum=2  (highest priority)
  Queue 1:  RR quantum=4
  Queue 2:  FCFS           (lowest priority)

All processes start in Queue 0.  If a process uses its full quantum
without finishing, it is demoted to the next lower queue.
"""

from collections import deque
from typing import List, Dict, Optional

from algorithms.process import Process, ProcessState
from algorithms.scheduler import Scheduler, ScheduleResult, GanttEntry


class MultilevelFeedbackQueueScheduler(Scheduler):
    """MLFQ — 3 queues with demotion on quantum expiry."""

    name = "MLFQ"
    preemptive = True

    QUEUE_QUANTA = {0: 2, 1: 4, 2: 10**9}
    NUM_QUEUES = 3

    def schedule(self, processes: List[Process]) -> ScheduleResult:
        procs = self._clone_processes(processes)
        procs = [p for p in procs if p.burst_time > 0]

        if not procs:
            return ScheduleResult()

        procs.sort(key=lambda p: (p.arrival_time, p.pid))

        # All processes start in Q0
        for p in procs:
            p.queue_level = 0

        queues: Dict[int, deque] = {i: deque() for i in range(self.NUM_QUEUES)}
        gantt: List[GanttEntry] = []
        ready_snapshots: Dict[int, List[int]] = {}
        context_switches = 0
        current_time = 0
        entered = set()
        completed: List[Process] = []
        last_pid: Optional[int] = None

        def admit(up_to: int):
            for p in procs:
                if p.pid not in entered and p.arrival_time <= up_to and not p.is_complete:
                    queues[p.queue_level].append(p)
                    entered.add(p.pid)

        admit(current_time)

        while len(completed) < len(procs):
            # Find highest non-empty queue
            active_q = None
            for q in range(self.NUM_QUEUES):
                if queues[q]:
                    active_q = q
                    break

            if active_q is None:
                unarrived = [p for p in procs if not p.is_complete and p.pid not in entered]
                if not unarrived:
                    break
                next_arrival = min(p.arrival_time for p in unarrived)
                gantt.append(GanttEntry(pid=-1, start=current_time, end=next_arrival))
                current_time = next_arrival
                admit(current_time)
                continue

            proc = queues[active_q].popleft()
            quantum = self.QUEUE_QUANTA[active_q]

            ready_snapshots[current_time] = [
                p.pid for q in range(self.NUM_QUEUES) for p in queues[q]
            ]

            if proc.start_time is None:
                proc.start_time = current_time

            if last_pid is not None and last_pid != proc.pid:
                context_switches += 1
            last_pid = proc.pid

            run_time = min(quantum, proc.remaining_burst)

            # Preempt if higher-queue arrival during run
            for p in procs:
                if (p.pid not in entered
                        and not p.is_complete
                        and current_time < p.arrival_time < current_time + run_time):
                    # New arrivals go to Q0 which may be higher
                    if 0 < active_q:
                        run_time = p.arrival_time - current_time
                        break

            proc.state = ProcessState.RUNNING
            gantt.append(GanttEntry(pid=proc.pid, start=current_time, end=current_time + run_time))
            proc.remaining_burst -= run_time
            current_time += run_time

            admit(current_time)

            if proc.is_complete:
                proc.completion_time = current_time
                proc.state = ProcessState.TERMINATED
                completed.append(proc)
            else:
                # Demote if used full quantum
                used_full_quantum = (run_time >= quantum)
                if used_full_quantum and proc.queue_level < self.NUM_QUEUES - 1:
                    proc.queue_level += 1
                proc.state = ProcessState.READY
                queues[proc.queue_level].append(proc)

        return ScheduleResult(
            gantt=gantt,
            metrics=self._build_metrics(completed),
            ready_queue_snapshots=ready_snapshots,
            context_switches=context_switches,
        )
