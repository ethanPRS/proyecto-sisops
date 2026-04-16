"""
page_replacement.py — Page Replacement Algorithms.

Implements FIFO, LRU, Optimal, Clock, and Second Chance.
Each algorithm processes a reference string step-by-step,
producing ReplacementStep records for animation playback.
"""

from abc import ABC, abstractmethod
from collections import deque, OrderedDict
from dataclasses import dataclass, field
from typing import List, Optional, Dict


@dataclass
class ReplacementStep:
    """One step of a page replacement simulation."""
    step_number: int
    page_requested: int
    fault: bool                         # True if a page fault occurred
    page_evicted: Optional[int]         # The page that was removed (None if no eviction)
    frames_after: List[Optional[int]]   # State of all frames after this step
    fault_count: int                    # Cumulative fault count so far


@dataclass
class ReplacementResult:
    """Full result of a page replacement simulation."""
    algorithm_name: str
    num_frames: int
    reference_string: List[int]
    steps: List[ReplacementStep] = field(default_factory=list)

    @property
    def total_faults(self) -> int:
        return self.steps[-1].fault_count if self.steps else 0

    @property
    def fault_rate(self) -> float:
        if not self.reference_string:
            return 0.0
        return self.total_faults / len(self.reference_string) * 100


# ═══════════════════════════════════════════════════════════════════════
# Abstract base
# ═══════════════════════════════════════════════════════════════════════

class PageReplacementAlgorithm(ABC):
    """Base class for all page replacement algorithms."""

    name: str = "Base"

    @abstractmethod
    def run(self, reference_string: List[int], num_frames: int) -> ReplacementResult:
        """
        Simulate page replacement on the given reference string.

        Args:
            reference_string: Sequence of page numbers being accessed.
            num_frames:       Number of physical frames available.

        Returns:
            ReplacementResult with a step-by-step trace.
        """
        ...


# ═══════════════════════════════════════════════════════════════════════
# FIFO
# ═══════════════════════════════════════════════════════════════════════

class FIFOReplacement(PageReplacementAlgorithm):
    """First-In, First-Out page replacement."""

    name = "FIFO"

    def run(self, reference_string: List[int], num_frames: int) -> ReplacementResult:
        frames: deque = deque()
        steps: List[ReplacementStep] = []
        fault_count = 0

        for i, page in enumerate(reference_string):
            fault = False
            evicted = None

            if page not in frames:
                fault = True
                fault_count += 1
                if len(frames) >= num_frames:
                    evicted = frames.popleft()
                frames.append(page)

            # Snapshot
            frame_state = list(frames) + [None] * (num_frames - len(frames))
            steps.append(ReplacementStep(
                step_number=i,
                page_requested=page,
                fault=fault,
                page_evicted=evicted,
                frames_after=frame_state,
                fault_count=fault_count,
            ))

        return ReplacementResult(
            algorithm_name=self.name,
            num_frames=num_frames,
            reference_string=reference_string,
            steps=steps,
        )


# ═══════════════════════════════════════════════════════════════════════
# LRU
# ═══════════════════════════════════════════════════════════════════════

class LRUReplacement(PageReplacementAlgorithm):
    """Least Recently Used page replacement."""

    name = "LRU"

    def run(self, reference_string: List[int], num_frames: int) -> ReplacementResult:
        # OrderedDict preserves insertion order; move_to_end marks recent use
        frames: OrderedDict = OrderedDict()
        steps: List[ReplacementStep] = []
        fault_count = 0

        for i, page in enumerate(reference_string):
            fault = False
            evicted = None

            if page in frames:
                # Move to end (most recently used)
                frames.move_to_end(page)
            else:
                fault = True
                fault_count += 1
                if len(frames) >= num_frames:
                    # Evict least recently used (first item)
                    evicted, _ = frames.popitem(last=False)
                frames[page] = True

            frame_state = list(frames.keys()) + [None] * (num_frames - len(frames))
            steps.append(ReplacementStep(
                step_number=i,
                page_requested=page,
                fault=fault,
                page_evicted=evicted,
                frames_after=frame_state,
                fault_count=fault_count,
            ))

        return ReplacementResult(
            algorithm_name=self.name,
            num_frames=num_frames,
            reference_string=reference_string,
            steps=steps,
        )


# ═══════════════════════════════════════════════════════════════════════
# Optimal
# ═══════════════════════════════════════════════════════════════════════

class OptimalReplacement(PageReplacementAlgorithm):
    """Optimal (Bélády's) page replacement — evicts farthest future use."""

    name = "Optimal"

    def run(self, reference_string: List[int], num_frames: int) -> ReplacementResult:
        frames: List[int] = []
        steps: List[ReplacementStep] = []
        fault_count = 0

        for i, page in enumerate(reference_string):
            fault = False
            evicted = None

            if page not in frames:
                fault = True
                fault_count += 1
                if len(frames) >= num_frames:
                    # Find page with farthest (or no) future use
                    farthest_idx = -1
                    farthest_page = frames[0]
                    for fp in frames:
                        try:
                            next_use = reference_string[i + 1:].index(fp)
                        except ValueError:
                            # Never used again — best to evict
                            farthest_page = fp
                            break
                        if next_use > farthest_idx:
                            farthest_idx = next_use
                            farthest_page = fp
                    evicted = farthest_page
                    frames.remove(farthest_page)
                frames.append(page)

            frame_state = list(frames) + [None] * (num_frames - len(frames))
            steps.append(ReplacementStep(
                step_number=i,
                page_requested=page,
                fault=fault,
                page_evicted=evicted,
                frames_after=frame_state,
                fault_count=fault_count,
            ))

        return ReplacementResult(
            algorithm_name=self.name,
            num_frames=num_frames,
            reference_string=reference_string,
            steps=steps,
        )


# ═══════════════════════════════════════════════════════════════════════
# Clock
# ═══════════════════════════════════════════════════════════════════════

class ClockReplacement(PageReplacementAlgorithm):
    """Clock (Second-Chance FIFO with circular buffer) page replacement."""

    name = "Clock"

    def run(self, reference_string: List[int], num_frames: int) -> ReplacementResult:
        frames: List[Optional[int]] = [None] * num_frames
        use_bits: List[int] = [0] * num_frames
        pointer = 0
        steps: List[ReplacementStep] = []
        fault_count = 0

        for i, page in enumerate(reference_string):
            fault = False
            evicted = None

            # Check if page is already in frames
            if page in frames:
                idx = frames.index(page)
                use_bits[idx] = 1
            else:
                fault = True
                fault_count += 1
                # Find a frame with use_bit = 0
                while True:
                    if use_bits[pointer] == 0:
                        evicted = frames[pointer]
                        frames[pointer] = page
                        use_bits[pointer] = 1
                        pointer = (pointer + 1) % num_frames
                        break
                    else:
                        use_bits[pointer] = 0
                        pointer = (pointer + 1) % num_frames

            frame_state = list(frames)
            steps.append(ReplacementStep(
                step_number=i,
                page_requested=page,
                fault=fault,
                page_evicted=evicted,
                frames_after=frame_state,
                fault_count=fault_count,
            ))

        return ReplacementResult(
            algorithm_name=self.name,
            num_frames=num_frames,
            reference_string=reference_string,
            steps=steps,
        )


# ═══════════════════════════════════════════════════════════════════════
# Second Chance
# ═══════════════════════════════════════════════════════════════════════

class SecondChanceReplacement(PageReplacementAlgorithm):
    """
    Second Chance page replacement (queue-based variant).

    Uses a FIFO queue with a reference bit.  On eviction the front page
    is checked: if its bit is set, clear it and move to back; repeat
    until a page with bit=0 is found and evicted.
    """

    name = "Second Chance"

    def run(self, reference_string: List[int], num_frames: int) -> ReplacementResult:
        queue: deque = deque()           # (page, ref_bit)
        page_set: Dict[int, bool] = {}   # page → ref_bit for O(1) lookup
        steps: List[ReplacementStep] = []
        fault_count = 0

        for i, page in enumerate(reference_string):
            fault = False
            evicted = None

            if page in page_set:
                # Hit — set reference bit
                page_set[page] = True
            else:
                fault = True
                fault_count += 1
                if len(page_set) >= num_frames:
                    # Evict: scan queue for ref_bit = False
                    while True:
                        front_page, ref_bit = queue.popleft()
                        if ref_bit:
                            # Second chance — clear bit, move to back
                            queue.append((front_page, False))
                            page_set[front_page] = False
                        else:
                            evicted = front_page
                            del page_set[front_page]
                            break
                # Insert new page
                queue.append((page, True))
                page_set[page] = True

            # Rebuild frame state from queue order
            frame_state = [p for p, _ in queue] + [None] * (num_frames - len(queue))
            steps.append(ReplacementStep(
                step_number=i,
                page_requested=page,
                fault=fault,
                page_evicted=evicted,
                frames_after=frame_state,
                fault_count=fault_count,
            ))

        return ReplacementResult(
            algorithm_name=self.name,
            num_frames=num_frames,
            reference_string=reference_string,
            steps=steps,
        )
