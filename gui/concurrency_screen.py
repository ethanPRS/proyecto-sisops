"""
concurrency_screen.py — Concurrency Simulation Visualization.

Configurable N threads, safe/unsafe mode toggle, visual timeline
bars, shared-resource state, lock acquisition display.
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QSpinBox, QCheckBox, QGroupBox, QScrollArea, QFrame,
)
from PyQt5.QtCore import Qt, QThread, pyqtSignal, QRectF
from PyQt5.QtGui import QPainter, QColor, QFont, QBrush, QPen, QLinearGradient

from concurrency.process_manager import ConcurrencySimulator, ConcurrencyResult
from gui.theme import (
    ACCENT_GREEN, ACCENT_PURPLE, ERROR_RED, SUCCESS_GREEN,
    TEXT_SECONDARY, TEXT_MUTED, BG_CARD, BG_SURFACE, BORDER, PID_COLORS,
)
from typing import Optional


class TimelineWidget(QWidget):
    """Custom-painted thread timeline visualization."""

    BAR_HEIGHT = 28
    GAP = 6
    LEFT_MARGIN = 80
    RIGHT_MARGIN = 20
    TOP_MARGIN = 30

    def __init__(self, parent=None):
        super().__init__(parent)
        self._result: Optional[ConcurrencyResult] = None
        self.setMinimumHeight(100)

    def set_result(self, result: ConcurrencyResult):
        self._result = result
        n = result.num_threads
        needed_h = self.TOP_MARGIN + n * (self.BAR_HEIGHT + self.GAP) + 20
        self.setMinimumHeight(max(needed_h, 100))
        self.update()

    def paintEvent(self, event):
        if not self._result or not self._result.timelines:
            return
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        w = self.width()

        total_dur = self._result.total_duration
        if total_dur <= 0:
            total_dur = 1

        chart_w = w - self.LEFT_MARGIN - self.RIGHT_MARGIN

        # Title
        painter.setPen(QColor(ACCENT_GREEN))
        painter.setFont(QFont("sans-serif", 11, QFont.Bold))
        painter.drawText(8, 20, "Thread Timeline")

        for tl in self._result.timelines:
            y = self.TOP_MARGIN + tl.thread_id * (self.BAR_HEIGHT + self.GAP)

            # Label
            painter.setPen(QColor(TEXT_SECONDARY))
            painter.setFont(QFont("sans-serif", 9))
            painter.drawText(8, int(y + self.BAR_HEIGHT * 0.65), f"Thread {tl.thread_id}")

            # Bar background
            painter.setPen(Qt.NoPen)
            painter.setBrush(QColor(BG_SURFACE))
            painter.drawRoundedRect(
                QRectF(self.LEFT_MARGIN, y, chart_w, self.BAR_HEIGHT), 4, 4
            )

            # Active bar
            x_start = self.LEFT_MARGIN + (tl.start_time / total_dur) * chart_w
            x_end = self.LEFT_MARGIN + (tl.end_time / total_dur) * chart_w
            bar_w = max(x_end - x_start, 4)

            color = QColor(PID_COLORS[tl.thread_id % len(PID_COLORS)])
            grad = QLinearGradient(x_start, y, x_end, y)
            grad.setColorAt(0, color)
            c2 = QColor(color)
            c2.setAlpha(160)
            grad.setColorAt(1, c2)
            painter.setBrush(QBrush(grad))
            painter.drawRoundedRect(
                QRectF(x_start, y, bar_w, self.BAR_HEIGHT), 4, 4
            )

            # Lock events as small markers
            for ev in tl.events:
                if ev.action in ("lock_acquire", "lock_release"):
                    ex = self.LEFT_MARGIN + (ev.timestamp / total_dur) * chart_w
                    marker_color = QColor(ACCENT_GREEN) if ev.action == "lock_acquire" else QColor(ERROR_RED)
                    painter.setPen(QPen(marker_color, 2))
                    painter.drawLine(int(ex), int(y), int(ex), int(y + self.BAR_HEIGHT))

        painter.end()


class ConcurrencyWorker(QThread):
    """Worker thread to run concurrency simulation off the main thread."""
    result_ready = pyqtSignal(object)  # ConcurrencyResult

    def __init__(self, num_threads, iterations, use_lock):
        super().__init__()
        self.num_threads = num_threads
        self.iterations = iterations
        self.use_lock = use_lock

    def run(self):
        sim = ConcurrencySimulator()
        result = sim.run(
            num_threads=self.num_threads,
            iterations=self.iterations,
            use_lock=self.use_lock,
        )
        self.result_ready.emit(result)


class ConcurrencyScreen(QWidget):
    """
    Screen #8 — Concurrency Simulation.

    Configure N threads, safe/unsafe, run, and visualize.
    """

    def __init__(self, parent=None):
        super().__init__(parent)
        self._worker = None
        self._build_ui()

    def _build_ui(self):
        main = QVBoxLayout(self)
        main.setSpacing(16)
        main.setContentsMargins(24, 24, 24, 24)

        title = QLabel("🔄  Concurrency Simulation")
        title.setStyleSheet(f"font-size: 22px; font-weight: bold; color: {ACCENT_GREEN};")
        main.addWidget(title)

        subtitle = QLabel("Simulate N threads incrementing a shared counter — compare safe (Lock) vs unsafe (race condition).")
        subtitle.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 13px;")
        main.addWidget(subtitle)

        # ── Config ───────────────────────────────────────────────────
        config_group = QGroupBox("Configuration")
        cfg = QHBoxLayout(config_group)
        cfg.setSpacing(16)

        cfg.addWidget(QLabel("Threads:"))
        self.spin_threads = QSpinBox()
        self.spin_threads.setRange(2, 32)
        self.spin_threads.setValue(4)
        cfg.addWidget(self.spin_threads)

        cfg.addWidget(QLabel("Iterations/thread:"))
        self.spin_iters = QSpinBox()
        self.spin_iters.setRange(10, 1000)
        self.spin_iters.setValue(50)
        self.spin_iters.setSingleStep(10)
        cfg.addWidget(self.spin_iters)

        self.chk_lock = QCheckBox("Use Lock (mutex)")
        self.chk_lock.setChecked(True)
        self.chk_lock.setStyleSheet(f"color: {TEXT_SECONDARY};")
        cfg.addWidget(self.chk_lock)

        self.btn_run = QPushButton("▶ Run Simulation")
        self.btn_run.clicked.connect(self._run)
        cfg.addWidget(self.btn_run)

        main.addWidget(config_group)

        # ── Stats bar ────────────────────────────────────────────────
        stats = QHBoxLayout()
        self.lbl_expected = self._stat("Expected: —")
        self.lbl_actual = self._stat("Actual: —")
        self.lbl_correct = self._stat("Result: —")
        self.lbl_duration = self._stat("Duration: —")
        stats.addWidget(self.lbl_expected)
        stats.addWidget(self.lbl_actual)
        stats.addWidget(self.lbl_correct)
        stats.addWidget(self.lbl_duration)
        stats.addStretch()
        main.addLayout(stats)

        # ── Timeline ─────────────────────────────────────────────────
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        self.timeline = TimelineWidget()
        scroll.setWidget(self.timeline)
        main.addWidget(scroll, 1)

    def _run(self):
        self.btn_run.setEnabled(False)
        self.btn_run.setText("Running...")
        self._worker = ConcurrencyWorker(
            num_threads=self.spin_threads.value(),
            iterations=self.spin_iters.value(),
            use_lock=self.chk_lock.isChecked(),
        )
        self._worker.result_ready.connect(self._on_result)
        self._worker.start()

    def _on_result(self, result: ConcurrencyResult):
        self.btn_run.setEnabled(True)
        self.btn_run.setText("▶ Run Simulation")

        self.lbl_expected.setText(f"Expected: {result.expected_value}")
        self.lbl_actual.setText(f"Actual: {result.actual_value}")
        self.lbl_duration.setText(f"Duration: {result.total_duration:.4f}s")

        if result.is_correct:
            self.lbl_correct.setText("Result: ✓ CORRECT")
            self.lbl_correct.setStyleSheet(
                f"padding: 6px 14px; background: {BG_CARD}; "
                f"border: 1px solid {SUCCESS_GREEN}; border-radius: 6px; "
                f"font-weight: bold; font-size: 12px; color: {SUCCESS_GREEN};"
            )
        else:
            self.lbl_correct.setText(f"Result: ✗ RACE CONDITION (lost {result.expected_value - result.actual_value})")
            self.lbl_correct.setStyleSheet(
                f"padding: 6px 14px; background: {BG_CARD}; "
                f"border: 1px solid {ERROR_RED}; border-radius: 6px; "
                f"font-weight: bold; font-size: 12px; color: {ERROR_RED};"
            )

        self.timeline.set_result(result)

    @staticmethod
    def _stat(text: str) -> QLabel:
        lbl = QLabel(text)
        lbl.setStyleSheet(
            f"padding: 6px 14px; background: {BG_CARD}; "
            f"border: 1px solid {BORDER}; border-radius: 6px; "
            f"font-weight: bold; font-size: 12px;"
        )
        return lbl
