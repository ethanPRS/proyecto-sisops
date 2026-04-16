"""
test_memory.py — Unit tests for memory paging and page replacement.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import unittest
from algorithms.memory import MemoryManager
from algorithms.page_replacement import (
    FIFOReplacement, LRUReplacement, OptimalReplacement,
    ClockReplacement, SecondChanceReplacement,
)


class TestMemoryManager(unittest.TestCase):
    def test_init(self):
        mm = MemoryManager(memory_size=1024, page_size=64)
        self.assertEqual(mm.num_frames, 16)
        self.assertEqual(mm.free_frame_count, 16)

    def test_allocate(self):
        mm = MemoryManager(memory_size=256, page_size=64)  # 4 frames
        rec = mm.allocate(pid=1, num_pages=2)
        self.assertIsNotNone(rec)
        self.assertEqual(len(rec.frames_allocated), 2)
        self.assertEqual(mm.free_frame_count, 2)
        self.assertEqual(mm.used_frame_count, 2)

    def test_allocate_insufficient(self):
        mm = MemoryManager(memory_size=128, page_size=64)  # 2 frames
        rec = mm.allocate(pid=1, num_pages=3)
        self.assertIsNone(rec)

    def test_deallocate(self):
        mm = MemoryManager(memory_size=256, page_size=64)
        mm.allocate(pid=1, num_pages=2)
        freed = mm.deallocate(pid=1)
        self.assertEqual(len(freed), 2)
        self.assertEqual(mm.free_frame_count, 4)

    def test_reset(self):
        mm = MemoryManager(memory_size=256, page_size=64)
        mm.allocate(pid=1, num_pages=2)
        mm.reset()
        self.assertEqual(mm.free_frame_count, 4)

    def test_page_table(self):
        mm = MemoryManager(memory_size=256, page_size=64)
        mm.allocate(pid=1, num_pages=2)
        self.assertIn(1, mm.page_tables)
        pt = mm.page_tables[1]
        self.assertEqual(len(pt), 2)
        self.assertIn(0, pt)
        self.assertIn(1, pt)


class TestPageReplacement(unittest.TestCase):
    """Test all 5 page replacement algorithms with known reference string."""

    REF_STRING = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1]
    NUM_FRAMES = 3

    def _run_algo(self, algo_class):
        algo = algo_class()
        return algo.run(self.REF_STRING, self.NUM_FRAMES)

    def test_fifo(self):
        result = self._run_algo(FIFOReplacement)
        self.assertEqual(len(result.steps), len(self.REF_STRING))
        self.assertGreater(result.total_faults, 0)
        # FIFO with 3 frames on this string → 15 faults (known)
        self.assertEqual(result.total_faults, 15)

    def test_lru(self):
        result = self._run_algo(LRUReplacement)
        self.assertEqual(len(result.steps), len(self.REF_STRING))
        self.assertGreater(result.total_faults, 0)
        # LRU → 12 faults on this string
        self.assertEqual(result.total_faults, 12)

    def test_optimal(self):
        result = self._run_algo(OptimalReplacement)
        self.assertEqual(len(result.steps), len(self.REF_STRING))
        # Optimal should have fewest faults
        self.assertGreater(result.total_faults, 0)
        self.assertEqual(result.total_faults, 9)

    def test_clock(self):
        result = self._run_algo(ClockReplacement)
        self.assertEqual(len(result.steps), len(self.REF_STRING))
        self.assertGreater(result.total_faults, 0)

    def test_second_chance(self):
        result = self._run_algo(SecondChanceReplacement)
        self.assertEqual(len(result.steps), len(self.REF_STRING))
        self.assertGreater(result.total_faults, 0)

    def test_fault_rate(self):
        result = self._run_algo(FIFOReplacement)
        self.assertGreater(result.fault_rate, 0)
        self.assertLess(result.fault_rate, 100)

    def test_empty_ref_string(self):
        result = FIFOReplacement().run([], 3)
        self.assertEqual(len(result.steps), 0)
        self.assertEqual(result.total_faults, 0)


if __name__ == "__main__":
    unittest.main()
