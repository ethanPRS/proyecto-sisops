"""
memory_screen.py — Memory Paging Visualization Screen.

Displays a grid of memory frames colour-coded by process,
page table, fragmentation info, and config controls.
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout, QLabel,
    QSpinBox, QPushButton, QGroupBox, QTableWidget,
    QTableWidgetItem, QHeaderView, QScrollArea, QFrame,
)
from PyQt5.QtCore import Qt, QRectF
from PyQt5.QtGui import QPainter, QColor, QFont, QBrush

from algorithms.memory import MemoryManager
from algorithms.process import Process
from gui.theme import (
    ACCENT_GREEN, ACCENT_PURPLE, TEXT_SECONDARY, TEXT_MUTED,
    BG_CARD, BG_SURFACE, BORDER, pid_color,
)
from typing import List, Optional


class MemoryGridWidget(QWidget):
    """Custom widget that draws the memory frame grid."""

    CELL_SIZE = 54
    GAP = 3

    def __init__(self, parent=None):
        super().__init__(parent)
        self._manager: Optional[MemoryManager] = None
        self.setMinimumHeight(100)

    def set_manager(self, manager: MemoryManager):
        self._manager = manager
        cols = max(int(self.width() / (self.CELL_SIZE + self.GAP)), 4)
        rows = (manager.num_frames + cols - 1) // cols
        needed_h = rows * (self.CELL_SIZE + self.GAP) + 30
        self.setMinimumHeight(max(needed_h, 100))
        self.update()

    def paintEvent(self, event):
        if not self._manager:
            return
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        w = self.width()

        cols = max(int(w / (self.CELL_SIZE + self.GAP)), 1)
        for i, frame in enumerate(self._manager.frames):
            col = i % cols
            row = i // cols
            x = col * (self.CELL_SIZE + self.GAP) + 4
            y = row * (self.CELL_SIZE + self.GAP) + 4

            rect = QRectF(x, y, self.CELL_SIZE, self.CELL_SIZE)

            if frame.is_free:
                painter.setPen(QColor(BORDER))
                painter.setBrush(QColor(BG_SURFACE))
            else:
                color = QColor(pid_color(frame.pid))
                painter.setPen(Qt.NoPen)
                painter.setBrush(QBrush(color))

            painter.drawRoundedRect(rect, 6, 6)

            # Label
            painter.setPen(QColor("#000000") if not frame.is_free else QColor(TEXT_MUTED))
            font = QFont("monospace", 8, QFont.Bold)
            painter.setFont(font)
            if frame.is_free:
                painter.drawText(rect, Qt.AlignCenter, f"F{frame.frame_id}")
            else:
                painter.drawText(rect, Qt.AlignCenter,
                                 f"P{frame.pid}\npg{frame.page_number}")

        painter.end()


class MemoryScreen(QWidget):
    """
    Screen #3 — Memory Paging Visualisation.

    Users configure memory/page sizes, then allocate processes.
    """

    def __init__(self, parent=None):
        super().__init__(parent)
        self._manager = MemoryManager(memory_size=1024, page_size=64)
        self._build_ui()

    def _build_ui(self):
        main = QVBoxLayout(self)
        main.setSpacing(16)
        main.setContentsMargins(24, 24, 24, 24)

        # ── Title ────────────────────────────────────────────────────
        title = QLabel("🧠  Memory Paging Visualization")
        title.setStyleSheet(f"font-size: 22px; font-weight: bold; color: {ACCENT_GREEN};")
        main.addWidget(title)

        # ── Config controls ──────────────────────────────────────────
        config_group = QGroupBox("Memory Configuration")
        config_layout = QHBoxLayout(config_group)
        config_layout.setSpacing(16)

        config_layout.addWidget(QLabel("Memory Size (bytes):"))
        self.spin_mem = QSpinBox()
        self.spin_mem.setRange(64, 65536)
        self.spin_mem.setValue(1024)
        self.spin_mem.setSingleStep(64)
        config_layout.addWidget(self.spin_mem)

        config_layout.addWidget(QLabel("Page Size (bytes):"))
        self.spin_page = QSpinBox()
        self.spin_page.setRange(16, 4096)
        self.spin_page.setValue(64)
        self.spin_page.setSingleStep(16)
        config_layout.addWidget(self.spin_page)

        self.lbl_frames = QLabel("Frames: 16")
        self.lbl_frames.setStyleSheet(f"color: {ACCENT_GREEN}; font-weight: bold;")
        config_layout.addWidget(self.lbl_frames)

        btn_apply = QPushButton("Apply Config")
        btn_apply.clicked.connect(self._apply_config)
        config_layout.addWidget(btn_apply)

        btn_reset = QPushButton("Reset Memory")
        btn_reset.setStyleSheet(f"background: {BG_CARD}; color: #FF4757; border: 1px solid {BORDER};")
        btn_reset.clicked.connect(self._reset)
        config_layout.addWidget(btn_reset)

        main.addWidget(config_group)

        # ── Stats bar ────────────────────────────────────────────────
        stats_bar = QHBoxLayout()
        self.lbl_used = self._stat_label("Used: 0")
        self.lbl_free = self._stat_label("Free: 16")
        self.lbl_frag = self._stat_label("Fragmentation: 0 B")
        stats_bar.addWidget(self.lbl_used)
        stats_bar.addWidget(self.lbl_free)
        stats_bar.addWidget(self.lbl_frag)
        stats_bar.addStretch()
        main.addLayout(stats_bar)

        # ── Memory grid + Page table side by side ────────────────────
        content = QHBoxLayout()
        content.setSpacing(16)

        # Grid
        grid_scroll = QScrollArea()
        grid_scroll.setWidgetResizable(True)
        grid_scroll.setFrameShape(QFrame.NoFrame)
        self.grid_widget = MemoryGridWidget()
        grid_scroll.setWidget(self.grid_widget)
        content.addWidget(grid_scroll, 2)

        # Page table
        pt_group = QGroupBox("Page Tables")
        pt_layout = QVBoxLayout(pt_group)
        self.page_table = QTableWidget(0, 3)
        self.page_table.setHorizontalHeaderLabels(["PID", "Page #", "Frame #"])
        self.page_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.page_table.verticalHeader().setVisible(False)
        self.page_table.setEditTriggers(QTableWidget.NoEditTriggers)
        pt_layout.addWidget(self.page_table)
        content.addWidget(pt_group, 1)

        main.addLayout(content, 1)

        self._refresh()

    # ── Actions ──────────────────────────────────────────────────────

    def allocate_processes(self, processes: List[Process]):
        """Allocate memory for a list of processes and refresh display."""
        self._manager.reset()
        for p in processes:
            self._manager.allocate(p.pid, p.num_pages)
        self._refresh()

    def _apply_config(self):
        self._manager = MemoryManager(
            memory_size=self.spin_mem.value(),
            page_size=self.spin_page.value(),
        )
        self._refresh()

    def _reset(self):
        self._manager.reset()
        self._refresh()

    def _refresh(self):
        self.lbl_frames.setText(f"Frames: {self._manager.num_frames}")
        self.lbl_used.setText(f"Used: {self._manager.used_frame_count}")
        self.lbl_free.setText(f"Free: {self._manager.free_frame_count}")

        # Grid
        self.grid_widget.set_manager(self._manager)

        # Page table
        self.page_table.setRowCount(0)
        for pid, pt in sorted(self._manager.page_tables.items()):
            for page_num, frame_id in sorted(pt.items()):
                row = self.page_table.rowCount()
                self.page_table.insertRow(row)
                for col, val in enumerate([f"P{pid}", str(page_num), str(frame_id)]):
                    item = QTableWidgetItem(val)
                    item.setTextAlignment(Qt.AlignCenter)
                    self.page_table.setItem(row, col, item)

    @staticmethod
    def _stat_label(text: str) -> QLabel:
        lbl = QLabel(text)
        lbl.setStyleSheet(
            f"padding: 6px 14px; background: {BG_CARD}; "
            f"border: 1px solid {BORDER}; border-radius: 6px; "
            f"font-weight: bold; font-size: 12px;"
        )
        return lbl
