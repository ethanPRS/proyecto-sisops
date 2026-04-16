"""
metrics_table.py — Per-process scheduling metrics table + summary.

Displays CT, TAT, WT, RT for each process with averages row
and a CPU utilisation progress bar.
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QTableWidget, QTableWidgetItem,
    QProgressBar, QLabel, QHBoxLayout, QHeaderView,
)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QColor, QFont

from algorithms.scheduler import ScheduleResult
from gui.theme import (
    ACCENT_GREEN, ACCENT_PURPLE, TEXT_PRIMARY, TEXT_SECONDARY,
    TEXT_MUTED, BG_CARD, BORDER,
)


class MetricsTable(QWidget):
    """
    Displays scheduling metrics in a styled table.

    Call `set_result(schedule_result)` after running a simulation.
    """

    HEADERS = ["PID", "Arrival", "Burst", "Completion", "Turnaround", "Waiting", "Response"]

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(12)

        # ── Title ────────────────────────────────────────────────────
        title = QLabel("📊  Scheduling Metrics")
        title.setStyleSheet(f"font-size: 16px; font-weight: bold; color: {ACCENT_GREEN};")
        layout.addWidget(title)

        # ── Table ────────────────────────────────────────────────────
        self.table = QTableWidget(0, len(self.HEADERS))
        self.table.setHorizontalHeaderLabels(self.HEADERS)
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table.verticalHeader().setVisible(False)
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        layout.addWidget(self.table)

        # ── Summary bar ──────────────────────────────────────────────
        summary_layout = QHBoxLayout()
        summary_layout.setSpacing(24)

        self.lbl_avg_tat = self._make_stat_label("Avg TAT")
        self.lbl_avg_wt  = self._make_stat_label("Avg WT")
        self.lbl_avg_rt  = self._make_stat_label("Avg RT")
        self.lbl_ctx     = self._make_stat_label("Context Switches")

        summary_layout.addWidget(self.lbl_avg_tat)
        summary_layout.addWidget(self.lbl_avg_wt)
        summary_layout.addWidget(self.lbl_avg_rt)
        summary_layout.addWidget(self.lbl_ctx)
        summary_layout.addStretch()
        layout.addLayout(summary_layout)

        # ── CPU utilisation bar ──────────────────────────────────────
        cpu_layout = QHBoxLayout()
        cpu_label = QLabel("CPU Utilization")
        cpu_label.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px;")
        self.cpu_bar = QProgressBar()
        self.cpu_bar.setRange(0, 100)
        self.cpu_bar.setValue(0)
        self.cpu_bar.setFixedHeight(22)
        cpu_layout.addWidget(cpu_label)
        cpu_layout.addWidget(self.cpu_bar, 1)
        layout.addLayout(cpu_layout)

    def set_result(self, result: ScheduleResult):
        """Populate the table with metrics from a schedule result."""
        self.table.setRowCount(0)

        for m in result.metrics:
            row = self.table.rowCount()
            self.table.insertRow(row)
            items = [
                f"P{m.pid}", str(m.arrival_time), str(m.burst_time),
                str(m.completion_time), str(m.turnaround_time),
                str(m.waiting_time), str(m.response_time),
            ]
            for col, val in enumerate(items):
                item = QTableWidgetItem(val)
                item.setTextAlignment(Qt.AlignCenter)
                self.table.setItem(row, col, item)

        # Averages row
        row = self.table.rowCount()
        self.table.insertRow(row)
        avg_items = [
            "AVG", "", "",
            f"{sum(m.completion_time for m in result.metrics)/max(len(result.metrics),1):.1f}",
            f"{result.avg_turnaround:.1f}",
            f"{result.avg_waiting:.1f}",
            f"{result.avg_response:.1f}",
        ]
        for col, val in enumerate(avg_items):
            item = QTableWidgetItem(val)
            item.setTextAlignment(Qt.AlignCenter)
            item.setForeground(QColor(ACCENT_GREEN))
            font = item.font()
            font.setBold(True)
            item.setFont(font)
            self.table.setItem(row, col, item)

        # Summary labels
        self.lbl_avg_tat.setText(f"Avg TAT: {result.avg_turnaround:.2f}")
        self.lbl_avg_wt.setText(f"Avg WT: {result.avg_waiting:.2f}")
        self.lbl_avg_rt.setText(f"Avg RT: {result.avg_response:.2f}")
        self.lbl_ctx.setText(f"Context Switches: {result.context_switches}")

        # CPU utilisation
        self.cpu_bar.setValue(int(result.cpu_utilization))

    def clear_data(self):
        """Reset the table and summary."""
        self.table.setRowCount(0)
        self.lbl_avg_tat.setText("Avg TAT: —")
        self.lbl_avg_wt.setText("Avg WT: —")
        self.lbl_avg_rt.setText("Avg RT: —")
        self.lbl_ctx.setText("Context Switches: —")
        self.cpu_bar.setValue(0)

    @staticmethod
    def _make_stat_label(text: str) -> QLabel:
        lbl = QLabel(f"{text}: —")
        lbl.setStyleSheet(
            f"color: {TEXT_PRIMARY}; font-size: 13px; font-weight: bold;"
            f"padding: 6px 12px; background: {BG_CARD}; border-radius: 6px;"
        )
        return lbl
