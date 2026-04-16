"""
srtf.py — Shortest Remaining Time First (SRTF) CPU Scheduling Algorithm.

Preemptive version of SJF: at every time unit, the process with the
smallest remaining burst time is selected. A running process can be
preempted if a newly arriving process has a shorter remaining time.
"""

from typing import List, Optional

from algorithms.process import Process, ProcessState
from algorithms.scheduler import Scheduler, ScheduleResult, GanttEntry


class SRTFScheduler(Scheduler):
    """Shortest Remaining Time First — preemptive SJF."""

    name = "SRTF"
    preemptive = True

    def schedule(self, processes: List[Process]) -> ScheduleResult:
        procs = self._clone_processes(processes)
        procs = [p for p in procs if p.burst_time > 0]

        if not procs:
            return ScheduleResult()

        procs.sort(key=lambda p: (p.arrival_time, p.pid))

        gantt: List[GanttEntry] = []
        ready_snapshots = {}
        context_switches = 0
        current_time = 0
        completed: List[Process] = []
        total_procs = len(procs)

        last_pid: Optional[int] = None

        while len(completed) < total_procs:
            # Available = arrived and not terminated
            available = [
                p for p in procs
                if p.arrival_time <= current_time and not p.is_complete
            ]

            if not available:
                next_arrival = min(
                    p.arrival_time for p in procs if not p.is_complete
                )
                gantt.append(GanttEntry(pid=-1, start=current_time, end=next_arrival))
                current_time = next_arrival
                continue

            # Pick shortest remaining (tie: arrival, pid)
            available.sort(key=lambda p: (p.remaining_burst, p.arrival_time, p.pid))
            proc = available[0]

            # Snapshot
            ready_snapshots[current_time] = [
                p.pid for p in available if p.pid != proc.pid
            ]

            if proc.start_time is None:
                proc.start_time = current_time

            # Context switch
            if last_pid is not None and last_pid != proc.pid:
                context_switches += 1
            last_pid = proc.pid

            # Determine how long to run before next possible preemption
            # Run until a new process arrives or this one finishes
            future_arrivals = [
                p.arrival_time for p in procs
                if p.arrival_time > current_time and not p.is_complete
            ]
            if future_arrivals:
                next_event = min(min(future_arrivals), current_time + proc.remaining_burst)
            else:
                next_event = current_time + proc.remaining_burst

            run_time = next_event - current_time
            proc.state = ProcessState.RUNNING
            gantt.append(GanttEntry(pid=proc.pid, start=current_time, end=current_time + run_time))
            proc.remaining_burst -= run_time
            current_time += run_time

            if proc.is_complete:
                proc.completion_time = current_time
                proc.state = ProcessState.TERMINATED
                completed.append(proc)

        # Merge contiguous Gantt entries for the same PID
        merged_gantt = self._merge_gantt(gantt)

        return ScheduleResult(
            gantt=merged_gantt,
            metrics=self._build_metrics(completed),
            ready_queue_snapshots=ready_snapshots,
            context_switches=context_switches,
        )

    @staticmethod
    def _merge_gantt(gantt: List[GanttEntry]) -> List[GanttEntry]:
        """Merge adjacent Gantt entries with the same PID."""
        if not gantt:
            return gantt
        merged = [gantt[0]]
        for entry in gantt[1:]:
            if entry.pid == merged[-1].pid and entry.start == merged[-1].end:
                merged[-1] = GanttEntry(pid=entry.pid, start=merged[-1].start, end=entry.end)
            else:
                merged.append(entry)
        return merged
