"""
comparison_screen.py — Algorithm Comparison Dashboard.

Runs the same process set through multiple algorithms and displays
side-by-side bar charts comparing avg WT, TAT, RT, and CPU utilization.
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QCheckBox,
    QGroupBox, QGridLayout, QScrollArea, QFrame,
)
from PyQt5.QtCore import Qt, QRectF
from PyQt5.QtGui import QPainter, QColor, QFont, QBrush, QLinearGradient

from algorithms import ALGORITHM_MAP
from algorithms.process import Process
from algorithms.scheduler import ScheduleResult
from algorithms.round_robin import RoundRobinScheduler
from gui.theme import (
    ACCENT_GREEN, ACCENT_PURPLE, TEXT_SECONDARY, TEXT_MUTED,
    BG_CARD, BG_SURFACE, BORDER, PID_COLORS,
)
from typing import List, Dict


class BarChartWidget(QWidget):
    """Simple horizontal bar chart widget."""

    BAR_HEIGHT = 28
    GAP = 8
    LEFT_MARGIN = 130
    RIGHT_MARGIN = 60

    def __init__(self, parent=None):
        super().__init__(parent)
        self._data: List[tuple] = []  # (label, value, color)
        self._title = ""
        self.setMinimumHeight(80)

    def set_data(self, title: str, data: List[tuple]):
        self._title = title
        self._data = data
        needed_h = 30 + len(data) * (self.BAR_HEIGHT + self.GAP) + 10
        self.setMinimumHeight(max(needed_h, 80))
        self.update()

    def paintEvent(self, event):
        if not self._data:
            return
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        w = self.width()

        # Title
        painter.setPen(QColor(ACCENT_GREEN))
        painter.setFont(QFont("sans-serif", 11, QFont.Bold))
        painter.drawText(8, 20, self._title)

        max_val = max(v for _, v, _ in self._data) if self._data else 1
        if max_val == 0:
            max_val = 1
        chart_w = w - self.LEFT_MARGIN - self.RIGHT_MARGIN

        for i, (label, value, color) in enumerate(self._data):
            y = 30 + i * (self.BAR_HEIGHT + self.GAP)

            # Label
            painter.setPen(QColor(TEXT_SECONDARY))
            painter.setFont(QFont("sans-serif", 9))
            painter.drawText(8, int(y + self.BAR_HEIGHT * 0.65), label)

            # Bar
            bar_w = (value / max_val) * chart_w if max_val > 0 else 0
            grad = QLinearGradient(self.LEFT_MARGIN, y, self.LEFT_MARGIN + bar_w, y)
            grad.setColorAt(0, QColor(color))
            c2 = QColor(color)
            c2.setAlpha(160)
            grad.setColorAt(1, c2)
            painter.setPen(Qt.NoPen)
            painter.setBrush(QBrush(grad))
            painter.drawRoundedRect(
                QRectF(self.LEFT_MARGIN, y, max(bar_w, 2), self.BAR_HEIGHT), 6, 6
            )

            # Value label
            painter.setPen(QColor(TEXT_SECONDARY))
            painter.setFont(QFont("monospace", 9, QFont.Bold))
            painter.drawText(int(self.LEFT_MARGIN + bar_w + 8),
                             int(y + self.BAR_HEIGHT * 0.65),
                             f"{value:.2f}")

        painter.end()


class ComparisonScreen(QWidget):
    """
    Screen #6 — Algorithm Comparison.

    Users select algorithms, click Compare, and see charts.
    """

    def __init__(self, parent=None):
        super().__init__(parent)
        self._processes: List[Process] = []
        self._results: Dict[str, ScheduleResult] = {}
        self._build_ui()

    def _build_ui(self):
        main = QVBoxLayout(self)
        main.setSpacing(16)
        main.setContentsMargins(24, 24, 24, 24)

        title = QLabel("⚖️  Algorithm Comparison")
        title.setStyleSheet(f"font-size: 22px; font-weight: bold; color: {ACCENT_GREEN};")
        main.addWidget(title)

        subtitle = QLabel("Select algorithms to compare using the same process set from the input screen.")
        subtitle.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 13px;")
        main.addWidget(subtitle)

        # ── Algorithm checkboxes ─────────────────────────────────────
        algo_group = QGroupBox("Select Algorithms")
        algo_layout = QGridLayout(algo_group)
        self._checkboxes: Dict[str, QCheckBox] = {}
        for i, name in enumerate(ALGORITHM_MAP.keys()):
            cb = QCheckBox(name)
            cb.setChecked(True)
            cb.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px;")
            self._checkboxes[name] = cb
            algo_layout.addWidget(cb, i // 4, i % 4)
        main.addWidget(algo_group)

        # ── Compare button ───────────────────────────────────────────
        btn_row = QHBoxLayout()
        self.btn_compare = QPushButton("▶  Compare All")
        self.btn_compare.clicked.connect(self._run_comparison)
        btn_row.addWidget(self.btn_compare)
        btn_row.addStretch()
        main.addLayout(btn_row)

        # ── Charts area ──────────────────────────────────────────────
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)

        charts_container = QWidget()
        self.charts_layout = QVBoxLayout(charts_container)
        self.charts_layout.setSpacing(16)

        self.chart_tat = BarChartWidget()
        self.chart_wt = BarChartWidget()
        self.chart_rt = BarChartWidget()
        self.chart_cpu = BarChartWidget()

        self.charts_layout.addWidget(self.chart_tat)
        self.charts_layout.addWidget(self.chart_wt)
        self.charts_layout.addWidget(self.chart_rt)
        self.charts_layout.addWidget(self.chart_cpu)

        # Summary table
        self.summary_table = QTableWidget(0, 6)
        self.summary_table.setHorizontalHeaderLabels([
            "Algorithm", "Avg TAT", "Avg WT", "Avg RT", "CPU Util %", "Ctx Switches"
        ])
        self.summary_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.summary_table.verticalHeader().setVisible(False)
        self.summary_table.setEditTriggers(QTableWidget.NoEditTriggers)
        self.charts_layout.addWidget(self.summary_table)

        scroll.setWidget(charts_container)
        main.addWidget(scroll, 1)

    def set_processes(self, processes: List[Process]):
        self._processes = processes

    def _run_comparison(self):
        if not self._processes:
            return

        self._results.clear()
        selected = [name for name, cb in self._checkboxes.items() if cb.isChecked()]

        for name in selected:
            cls = ALGORITHM_MAP[name]
            if name == "Round Robin" or name == "MLFQ":
                scheduler = cls(quantum=2)  # default quantum for comparison
            else:
                scheduler = cls()
            try:
                result = scheduler.schedule(self._processes)
                self._results[name] = result
            except Exception:
                continue

        self._update_charts()

    def _update_charts(self):
        colors = PID_COLORS
        data_tat = []
        data_wt = []
        data_rt = []
        data_cpu = []

        for i, (name, result) in enumerate(self._results.items()):
            c = colors[i % len(colors)]
            data_tat.append((name, result.avg_turnaround, c))
            data_wt.append((name, result.avg_waiting, c))
            data_rt.append((name, result.avg_response, c))
            data_cpu.append((name, result.cpu_utilization, c))

        self.chart_tat.set_data("Average Turnaround Time", data_tat)
        self.chart_wt.set_data("Average Waiting Time", data_wt)
        self.chart_rt.set_data("Average Response Time", data_rt)
        self.chart_cpu.set_data("CPU Utilization (%)", data_cpu)

        # Summary table
        self.summary_table.setRowCount(0)
        for name, result in self._results.items():
            row = self.summary_table.rowCount()
            self.summary_table.insertRow(row)
            vals = [
                name,
                f"{result.avg_turnaround:.2f}",
                f"{result.avg_waiting:.2f}",
                f"{result.avg_response:.2f}",
                f"{result.cpu_utilization:.1f}",
                str(result.context_switches),
            ]
            for col, val in enumerate(vals):
                item = QTableWidgetItem(val)
                item.setTextAlignment(Qt.AlignCenter)
                self.summary_table.setItem(row, col, item)
