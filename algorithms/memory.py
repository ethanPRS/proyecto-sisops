"""
memory.py — Memory Paging Manager.

Simulates a paged memory system with configurable memory size and
page size.  Provides frame allocation / deallocation and tracks
internal fragmentation.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


@dataclass
class FrameEntry:
    """One physical frame in memory."""
    frame_id: int
    pid: Optional[int] = None
    page_number: Optional[int] = None

    @property
    def is_free(self) -> bool:
        return self.pid is None


@dataclass
class AllocationRecord:
    """Records a single allocation event for animation playback."""
    pid: int
    frames_allocated: List[int]     # frame IDs
    pages_mapped: List[int]         # page numbers
    internal_fragmentation: int     # bytes wasted in last frame


class MemoryManager:
    """
    Manages a paged physical memory.

    Attributes:
        memory_size:  Total physical memory in bytes.
        page_size:    Size of each page/frame in bytes.
        num_frames:   Computed as memory_size // page_size.
        frames:       List of FrameEntry objects.
    """

    def __init__(self, memory_size: int = 1024, page_size: int = 64):
        if page_size <= 0:
            raise ValueError("page_size must be > 0")
        if memory_size <= 0:
            raise ValueError("memory_size must be > 0")

        self.memory_size = memory_size
        self.page_size = page_size
        self.num_frames = memory_size // page_size
        self.frames: List[FrameEntry] = [
            FrameEntry(frame_id=i) for i in range(self.num_frames)
        ]
        # Per-process page table:  pid → {page_number: frame_id}
        self.page_tables: Dict[int, Dict[int, int]] = {}
        # History for animation
        self.history: List[AllocationRecord] = []

    # ── Queries ──────────────────────────────────────────────────────

    @property
    def free_frame_count(self) -> int:
        return sum(1 for f in self.frames if f.is_free)

    @property
    def used_frame_count(self) -> int:
        return self.num_frames - self.free_frame_count

    def get_process_frames(self, pid: int) -> List[FrameEntry]:
        """Return all frames allocated to a process."""
        return [f for f in self.frames if f.pid == pid]

    def get_frame_map(self) -> List[Tuple[int, Optional[int], Optional[int]]]:
        """Return (frame_id, pid, page_number) for every frame."""
        return [(f.frame_id, f.pid, f.page_number) for f in self.frames]

    # ── Allocation ───────────────────────────────────────────────────

    def allocate(self, pid: int, num_pages: int) -> Optional[AllocationRecord]:
        """
        Allocate `num_pages` frames to process `pid`.

        Returns:
            AllocationRecord on success, None if insufficient frames.
        """
        if num_pages <= 0:
            return AllocationRecord(pid=pid, frames_allocated=[], pages_mapped=[], internal_fragmentation=0)

        free_frames = [f for f in self.frames if f.is_free]
        if len(free_frames) < num_pages:
            return None  # Not enough memory

        allocated_ids = []
        page_nums = []

        for page_num in range(num_pages):
            frame = free_frames[page_num]
            frame.pid = pid
            frame.page_number = page_num
            allocated_ids.append(frame.frame_id)
            page_nums.append(page_num)

        # Build page table
        self.page_tables[pid] = {
            page_num: frame_id
            for page_num, frame_id in zip(page_nums, allocated_ids)
        }

        # Internal fragmentation: only in the last page
        # Assume each process uses exactly page_size per page
        # (fragmentation is simulated as a fraction for educational purposes)
        internal_frag = 0  # Can be set externally if process size is known

        record = AllocationRecord(
            pid=pid,
            frames_allocated=allocated_ids,
            pages_mapped=page_nums,
            internal_fragmentation=internal_frag,
        )
        self.history.append(record)
        return record

    def deallocate(self, pid: int) -> List[int]:
        """
        Free all frames belonging to `pid`.

        Returns:
            List of frame IDs that were freed.
        """
        freed = []
        for frame in self.frames:
            if frame.pid == pid:
                freed.append(frame.frame_id)
                frame.pid = None
                frame.page_number = None
        self.page_tables.pop(pid, None)
        return freed

    def reset(self):
        """Reset all frames to free state."""
        for frame in self.frames:
            frame.pid = None
            frame.page_number = None
        self.page_tables.clear()
        self.history.clear()

    # ── Display helpers ──────────────────────────────────────────────

    def frame_summary(self) -> str:
        """Human-readable frame table."""
        lines = [f"Memory: {self.memory_size}B | Page: {self.page_size}B | Frames: {self.num_frames}"]
        lines.append(f"Used: {self.used_frame_count} | Free: {self.free_frame_count}")
        for f in self.frames:
            status = f"P{f.pid}:pg{f.page_number}" if not f.is_free else "FREE"
            lines.append(f"  Frame {f.frame_id:3d}: {status}")
        return "\n".join(lines)
