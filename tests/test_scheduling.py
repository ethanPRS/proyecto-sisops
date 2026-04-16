"""
test_scheduling.py — Unit tests for all CPU scheduling algorithms.

Tests correctness of Gantt chart output, per-process metrics,
and edge cases.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import unittest
from algorithms.process import Process
from algorithms.fcfs import FCFSScheduler
from algorithms.sjf import SJFScheduler
from algorithms.hrrn import HRRNScheduler
from algorithms.round_robin import RoundRobinScheduler
from algorithms.srtf import SRTFScheduler
from algorithms.priority_preemptive import PriorityPreemptiveScheduler
from algorithms.multilevel_queue import MultilevelQueueScheduler
from algorithms.multilevel_feedback_queue import MultilevelFeedbackQueueScheduler


def make_processes():
    """Standard test set: 4 processes."""
    return [
        Process(pid=1, arrival_time=0, burst_time=5, priority=2, num_pages=2),
        Process(pid=2, arrival_time=1, burst_time=3, priority=1, num_pages=1),
        Process(pid=3, arrival_time=2, burst_time=8, priority=3, num_pages=3),
        Process(pid=4, arrival_time=3, burst_time=2, priority=4, num_pages=1),
    ]


class TestFCFS(unittest.TestCase):
    def test_basic(self):
        result = FCFSScheduler().schedule(make_processes())
        self.assertEqual(len(result.metrics), 4)
        # FCFS: P1(0-5), P2(5-8), P3(8-16), P4(16-18)
        ct = {m.pid: m.completion_time for m in result.metrics}
        self.assertEqual(ct[1], 5)
        self.assertEqual(ct[2], 8)
        self.assertEqual(ct[3], 16)
        self.assertEqual(ct[4], 18)

    def test_empty(self):
        result = FCFSScheduler().schedule([])
        self.assertEqual(len(result.metrics), 0)

    def test_single_process(self):
        result = FCFSScheduler().schedule([Process(pid=1, arrival_time=0, burst_time=3)])
        self.assertEqual(result.metrics[0].completion_time, 3)
        self.assertEqual(result.metrics[0].turnaround_time, 3)
        self.assertEqual(result.metrics[0].waiting_time, 0)

    def test_burst_zero(self):
        procs = [Process(pid=1, arrival_time=0, burst_time=0)]
        result = FCFSScheduler().schedule(procs)
        self.assertEqual(len(result.metrics), 0)


class TestSJF(unittest.TestCase):
    def test_basic(self):
        result = SJFScheduler().schedule(make_processes())
        self.assertEqual(len(result.metrics), 4)
        # At t=0 only P1 available, runs to t=5
        # At t=5: P2(3), P3(8), P4(2) → P4 shortest → runs to 7
        # At t=7: P2(3), P3(8) → P2 → runs to 10
        # P3 runs to 18
        ct = {m.pid: m.completion_time for m in result.metrics}
        self.assertEqual(ct[1], 5)
        self.assertEqual(ct[4], 7)
        self.assertEqual(ct[2], 10)
        self.assertEqual(ct[3], 18)

    def test_same_arrival(self):
        procs = [
            Process(pid=1, arrival_time=0, burst_time=4),
            Process(pid=2, arrival_time=0, burst_time=2),
            Process(pid=3, arrival_time=0, burst_time=6),
        ]
        result = SJFScheduler().schedule(procs)
        ct = {m.pid: m.completion_time for m in result.metrics}
        self.assertEqual(ct[2], 2)   # shortest first
        self.assertEqual(ct[1], 6)
        self.assertEqual(ct[3], 12)


class TestHRRN(unittest.TestCase):
    def test_basic(self):
        result = HRRNScheduler().schedule(make_processes())
        self.assertEqual(len(result.metrics), 4)
        self.assertTrue(all(m.turnaround_time >= 0 for m in result.metrics))


class TestRoundRobin(unittest.TestCase):
    def test_quantum_2(self):
        result = RoundRobinScheduler(quantum=2).schedule(make_processes())
        self.assertEqual(len(result.metrics), 4)
        # All processes should complete
        self.assertTrue(all(m.completion_time > 0 for m in result.metrics))

    def test_quantum_1(self):
        result = RoundRobinScheduler(quantum=1).schedule(make_processes())
        self.assertEqual(len(result.metrics), 4)

    def test_large_quantum(self):
        # Quantum larger than all bursts → behaves like FCFS
        result = RoundRobinScheduler(quantum=100).schedule(make_processes())
        ct = {m.pid: m.completion_time for m in result.metrics}
        self.assertEqual(ct[1], 5)


class TestSRTF(unittest.TestCase):
    def test_basic(self):
        result = SRTFScheduler().schedule(make_processes())
        self.assertEqual(len(result.metrics), 4)
        # P1 starts at 0, preempted by P2 at t=1 (rem=4 vs 3)
        # Check P4 (burst=2) completes before P3
        ct = {m.pid: m.completion_time for m in result.metrics}
        self.assertTrue(ct[4] < ct[3])


class TestPriorityPreemptive(unittest.TestCase):
    def test_basic(self):
        result = PriorityPreemptiveScheduler().schedule(make_processes())
        self.assertEqual(len(result.metrics), 4)
        # P2 has priority 1 (highest), should get CPU early
        ct = {m.pid: m.completion_time for m in result.metrics}
        self.assertTrue(ct[2] <= ct[1])  # P2 finishes before or same as P1


class TestMultilevelQueue(unittest.TestCase):
    def test_basic(self):
        result = MultilevelQueueScheduler().schedule(make_processes())
        self.assertEqual(len(result.metrics), 4)
        self.assertTrue(all(m.completion_time > 0 for m in result.metrics))


class TestMLFQ(unittest.TestCase):
    def test_basic(self):
        result = MultilevelFeedbackQueueScheduler().schedule(make_processes())
        self.assertEqual(len(result.metrics), 4)
        self.assertTrue(all(m.completion_time > 0 for m in result.metrics))

    def test_single(self):
        result = MultilevelFeedbackQueueScheduler().schedule(
            [Process(pid=1, arrival_time=0, burst_time=10)]
        )
        self.assertEqual(result.metrics[0].completion_time, 10)


class TestMetrics(unittest.TestCase):
    """Cross-algorithm metric sanity checks."""
    def test_turnaround_non_negative(self):
        for name, cls in [
            ("FCFS", FCFSScheduler), ("SJF", SJFScheduler),
            ("RR", lambda: RoundRobinScheduler(2)),
        ]:
            scheduler = cls() if callable(cls) and not isinstance(cls, type) else cls()
            result = scheduler.schedule(make_processes())
            for m in result.metrics:
                self.assertGreaterEqual(m.turnaround_time, 0, f"{name}: TAT < 0 for P{m.pid}")
                self.assertGreaterEqual(m.waiting_time, 0, f"{name}: WT < 0 for P{m.pid}")
                self.assertGreaterEqual(m.response_time, 0, f"{name}: RT < 0 for P{m.pid}")

    def test_cpu_utilization_range(self):
        result = FCFSScheduler().schedule(make_processes())
        self.assertGreaterEqual(result.cpu_utilization, 0)
        self.assertLessEqual(result.cpu_utilization, 100)


if __name__ == "__main__":
    unittest.main()
