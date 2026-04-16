"""
process_manager.py — Concurrency Simulator.

Spawns N threads that concurrently operate on shared state.
Emits Qt signals for real-time GUI updates and returns a per-thread
timeline for visualization.
"""

import threading
import time
from dataclasses import dataclass, field
from typing import List, Optional, Callable

from concurrency.shared_state import SharedCounter, SafeCounter, ThreadEvent


@dataclass
class ThreadTimeline:
    """Execution timeline for a single thread."""
    thread_id: int
    events: List[ThreadEvent] = field(default_factory=list)
    start_time: float = 0.0
    end_time: float = 0.0


@dataclass
class ConcurrencyResult:
    """Full result of a concurrency simulation run."""
    num_threads: int
    iterations_per_thread: int
    use_lock: bool
    expected_value: int
    actual_value: int
    timelines: List[ThreadTimeline] = field(default_factory=list)
    all_events: List[ThreadEvent] = field(default_factory=list)
    total_duration: float = 0.0

    @property
    def is_correct(self) -> bool:
        return self.expected_value == self.actual_value

    @property
    def race_condition_detected(self) -> bool:
        return not self.is_correct


class ConcurrencySimulator:
    """
    Runs N threads incrementing a shared counter.

    Can operate in safe mode (with Lock) or unsafe mode (without Lock)
    to demonstrate race conditions visually.
    """

    def __init__(self):
        self._running = False
        self._threads: List[threading.Thread] = []

    def run(
        self,
        num_threads: int = 4,
        iterations: int = 50,
        use_lock: bool = True,
        progress_callback: Optional[Callable[[int, int, int], None]] = None,
    ) -> ConcurrencyResult:
        """
        Execute the concurrency simulation.

        Args:
            num_threads:       Number of threads to spawn.
            iterations:        Increments per thread.
            use_lock:          If True, use SafeCounter; else SharedCounter.
            progress_callback: Optional (thread_id, current_iter, total_iter) callback.

        Returns:
            ConcurrencyResult with timelines and final value.
        """
        counter = SafeCounter() if use_lock else SharedCounter()
        start_time = time.time()
        counter.reset(start_time)

        timelines: List[ThreadTimeline] = []
        timeline_lock = threading.Lock()
        self._running = True

        def worker(tid: int):
            t_start = time.time() - start_time
            counter.increment(tid, iterations)
            t_end = time.time() - start_time

            with timeline_lock:
                tl = ThreadTimeline(
                    thread_id=tid,
                    events=[e for e in counter.events if e.thread_id == tid],
                    start_time=t_start,
                    end_time=t_end,
                )
                timelines.append(tl)

            if progress_callback:
                progress_callback(tid, iterations, iterations)

        # Spawn threads
        self._threads = []
        for i in range(num_threads):
            t = threading.Thread(target=worker, args=(i,), daemon=True)
            self._threads.append(t)

        for t in self._threads:
            t.start()
        for t in self._threads:
            t.join()

        self._running = False
        total_duration = time.time() - start_time

        expected = num_threads * iterations
        actual = counter.value

        return ConcurrencyResult(
            num_threads=num_threads,
            iterations_per_thread=iterations,
            use_lock=use_lock,
            expected_value=expected,
            actual_value=actual,
            timelines=sorted(timelines, key=lambda tl: tl.thread_id),
            all_events=counter.events,
            total_duration=total_duration,
        )

    @property
    def is_running(self) -> bool:
        return self._running
