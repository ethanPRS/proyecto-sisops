"""
shared_state.py — Shared state objects for concurrency simulation.

Provides both an *unsafe* counter (demonstrating race conditions)
and a *safe* counter (using threading.Lock), along with per-operation
logging for the GUI timeline visualization.
"""

import threading
import time
from dataclasses import dataclass, field
from typing import List


@dataclass
class ThreadEvent:
    """One logged operation performed by a thread."""
    thread_id: int
    timestamp: float        # time.time() relative to simulation start
    action: str             # "read", "increment", "write", "lock_acquire", "lock_release"
    value_before: int
    value_after: int


class SharedCounter:
    """
    Intentionally UNSAFE shared counter to demonstrate race conditions.

    Multiple threads reading and writing without synchronisation will
    produce incorrect results — useful for educational comparison.
    """

    def __init__(self):
        self.value = 0
        self.events: List[ThreadEvent] = []
        self._start_time = 0.0

    def reset(self, start_time: float):
        self.value = 0
        self.events.clear()
        self._start_time = start_time

    def increment(self, thread_id: int, iterations: int = 100):
        """Increment counter `iterations` times WITHOUT locking."""
        for _ in range(iterations):
            old = self.value
            # Simulate a read-modify-write race window
            time.sleep(0.0001)
            self.value = old + 1
            self.events.append(ThreadEvent(
                thread_id=thread_id,
                timestamp=time.time() - self._start_time,
                action="increment_unsafe",
                value_before=old,
                value_after=self.value,
            ))


class SafeCounter:
    """
    Thread-safe shared counter using a mutex (threading.Lock).

    Demonstrates correct concurrent access.
    """

    def __init__(self):
        self.value = 0
        self.lock = threading.Lock()
        self.events: List[ThreadEvent] = []
        self._start_time = 0.0

    def reset(self, start_time: float):
        self.value = 0
        self.events.clear()
        self._start_time = start_time

    def increment(self, thread_id: int, iterations: int = 100):
        """Increment counter `iterations` times WITH locking."""
        for _ in range(iterations):
            self.lock.acquire()
            self.events.append(ThreadEvent(
                thread_id=thread_id,
                timestamp=time.time() - self._start_time,
                action="lock_acquire",
                value_before=self.value,
                value_after=self.value,
            ))
            old = self.value
            self.value = old + 1
            self.events.append(ThreadEvent(
                thread_id=thread_id,
                timestamp=time.time() - self._start_time,
                action="increment_safe",
                value_before=old,
                value_after=self.value,
            ))
            self.lock.release()
            self.events.append(ThreadEvent(
                thread_id=thread_id,
                timestamp=time.time() - self._start_time,
                action="lock_release",
                value_before=self.value,
                value_after=self.value,
            ))
