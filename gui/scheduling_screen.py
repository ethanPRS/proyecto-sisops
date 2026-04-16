"""
scheduling_screen.py — Main scheduling visualization screen.

Combines the Gantt chart, ready queue, running process badge,
state diagram, and context-switch counter into one view.
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QScrollArea,
    QSplitter, QFrame,
)
from PyQt5.QtCore import Qt

from gui.gantt_widget import GanttWidget
from gui.queue_widget import QueueWidget
from gui.metrics_table import MetricsTable
from gui.theme import (
    ACCENT_GREEN, ACCENT_PURPLE, TEXT_SECONDARY, TEXT_MUTED,
    BG_CARD, BORDER, STATE_COLORS,
)

from algorithms.scheduler import ScheduleResult


class SchedulingScreen(QWidget):
    """
    Screen #2 — Scheduling Visualisation.

    Call `show_result(result)` after running a simulation.
    """

    def __init__(self, parent=None):
        super().__init__(parent)
        self._build_ui()

    def _build_ui(self):
        main = QVBoxLayout(self)
        main.setSpacing(16)
        main.setContentsMargins(24, 24, 24, 24)

        # ── Title ────────────────────────────────────────────────────
        title = QLabel("📈  Scheduling Visualization")
        title.setStyleSheet(f"font-size: 22px; font-weight: bold; color: {ACCENT_GREEN};")
        main.addWidget(title)

        # ── Top info bar ─────────────────────────────────────────────
        info_bar = QHBoxLayout()
        info_bar.setSpacing(16)

        self.lbl_algo = self._info_badge("Algorithm: —")
        self.lbl_running = self._info_badge("Running: —")
        self.lbl_switches = self._info_badge("Context Switches: 0")
        self.lbl_time = self._info_badge("Total Time: 0")

        info_bar.addWidget(self.lbl_algo)
        info_bar.addWidget(self.lbl_running)
        info_bar.addWidget(self.lbl_switches)
        info_bar.addWidget(self.lbl_time)
        info_bar.addStretch()
        main.addLayout(info_bar)

        # ── State diagram row ────────────────────────────────────────
        state_bar = QHBoxLayout()
        state_bar.setSpacing(8)
        state_label = QLabel("Process States:  ")
        state_label.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px;")
        state_bar.addWidget(state_label)
        for state_name, color in STATE_COLORS.items():
            dot = QLabel(f"● {state_name}")
            dot.setStyleSheet(f"color: {color}; font-size: 11px; font-weight: bold;")
            state_bar.addWidget(dot)
        state_bar.addStretch()
        main.addLayout(state_bar)

        # ── Splitter: Gantt (top) + Queue + Metrics (bottom) ─────────
        splitter = QSplitter(Qt.Vertical)

        # Gantt chart in scroll area
        gantt_container = QWidget()
        gantt_layout = QVBoxLayout(gantt_container)
        gantt_layout.setContentsMargins(0, 0, 0, 0)
        self.gantt = GanttWidget()
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setWidget(self.gantt)
        scroll.setFrameShape(QFrame.NoFrame)
        gantt_layout.addWidget(scroll)
        splitter.addWidget(gantt_container)

        # Bottom section
        bottom = QWidget()
        bottom_layout = QVBoxLayout(bottom)
        bottom_layout.setContentsMargins(0, 0, 0, 0)
        bottom_layout.setSpacing(12)

        self.queue_widget = QueueWidget("Ready Queue")
        self.queue_widget.setMaximumHeight(90)
        bottom_layout.addWidget(self.queue_widget)

        self.metrics = MetricsTable()
        bottom_layout.addWidget(self.metrics)

        splitter.addWidget(bottom)
        splitter.setStretchFactor(0, 2)
        splitter.setStretchFactor(1, 3)

        main.addWidget(splitter, 1)

    def show_result(self, result: ScheduleResult, algo_name: str = ""):
        """Display simulation results in all sub-widgets."""
        self.lbl_algo.setText(f"Algorithm: {algo_name}")
        self.lbl_switches.setText(f"Context Switches: {result.context_switches}")
        self.lbl_time.setText(f"Total Time: {result.total_time}")

        # Running process — show last one from Gantt
        if result.gantt:
            last = [e for e in result.gantt if e.pid >= 0]
            if last:
                self.lbl_running.setText(f"Last Running: P{last[-1].pid}")

        # Gantt chart
        self.gantt.set_data(result.gantt)

        # Ready queue — show final snapshot
        if result.ready_queue_snapshots:
            last_time = max(result.ready_queue_snapshots.keys())
            self.queue_widget.set_queue(result.ready_queue_snapshots[last_time])
        else:
            self.queue_widget.set_queue([])

        # Metrics table
        self.metrics.set_result(result)

    def clear_data(self):
        self.gantt.clear_data()
        self.queue_widget.set_queue([])
        self.metrics.clear_data()
        self.lbl_algo.setText("Algorithm: —")
        self.lbl_running.setText("Running: —")
        self.lbl_switches.setText("Context Switches: 0")
        self.lbl_time.setText("Total Time: 0")

    @staticmethod
    def _info_badge(text: str) -> QLabel:
        lbl = QLabel(text)
        lbl.setStyleSheet(
            f"padding: 6px 14px; background: {BG_CARD}; "
            f"border: 1px solid {BORDER}; border-radius: 6px; "
            f"font-weight: bold; font-size: 12px;"
        )
        return lbl
