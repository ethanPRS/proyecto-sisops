"""
gantt_widget.py — Animated Gantt Chart Widget.

Custom QWidget that paints a horizontal Gantt chart with per-PID
colours, a time axis, context-switch markers, and a smooth
left-to-right reveal animation.
"""

from PyQt5.QtWidgets import QWidget, QToolTip
from PyQt5.QtCore import Qt, QTimer, QRectF, QPointF
from PyQt5.QtGui import QPainter, QColor, QFont, QPen, QLinearGradient, QBrush

from algorithms.scheduler import GanttEntry
from gui.theme import (
    BG_CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
    ACCENT_GREEN, ACCENT_PURPLE, pid_color, FONT_MONO,
    ANIM_DURATION,
)
from typing import List


class GanttWidget(QWidget):
    """
    Animated Gantt chart.

    Call `set_data(gantt_entries)` to display a new schedule.
    The chart animates column-by-column from left to right.
    """

    BAR_HEIGHT = 36
    ROW_GAP    = 6
    LEFT_MARGIN = 60
    RIGHT_MARGIN = 20
    TOP_MARGIN   = 40
    BOTTOM_MARGIN = 40
    LABEL_WIDTH  = 50

    def __init__(self, parent=None):
        super().__init__(parent)
        self._entries: List[GanttEntry] = []
        self._total_time = 0
        self._reveal_progress = 0.0  # 0.0 → 1.0
        self._timer = QTimer(self)
        self._timer.setInterval(16)  # ~60 fps
        self._timer.timeout.connect(self._tick_animation)
        self.setMinimumHeight(120)
        self.setMouseTracking(True)
        self._hover_entry = None

    # ── Public API ───────────────────────────────────────────────────

    def set_data(self, entries: List[GanttEntry]):
        """Load new Gantt data and start the reveal animation."""
        self._entries = entries
        self._total_time = max((e.end for e in entries), default=0)
        self._reveal_progress = 0.0
        self._hover_entry = None

        # Compute needed height
        pids = sorted(set(e.pid for e in entries if e.pid >= 0))
        row_count = max(len(pids), 1)
        needed_h = self.TOP_MARGIN + row_count * (self.BAR_HEIGHT + self.ROW_GAP) + self.BOTTOM_MARGIN
        self.setMinimumHeight(max(needed_h, 120))

        self._timer.start()
        self.update()

    def clear_data(self):
        self._entries = []
        self._total_time = 0
        self._reveal_progress = 0.0
        self._timer.stop()
        self.update()

    # ── Animation ────────────────────────────────────────────────────

    def _tick_animation(self):
        self._reveal_progress = min(self._reveal_progress + 0.015, 1.0)
        if self._reveal_progress >= 1.0:
            self._timer.stop()
        self.update()

    # ── Paint ────────────────────────────────────────────────────────

    def paintEvent(self, event):
        if not self._entries or self._total_time == 0:
            return

        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        w = self.width()
        h = self.height()

        # Background
        painter.fillRect(0, 0, w, h, QColor(BG_CARD))

        chart_w = w - self.LEFT_MARGIN - self.RIGHT_MARGIN
        if chart_w <= 0:
            return

        pids = sorted(set(e.pid for e in self._entries if e.pid >= 0))
        pid_to_row = {pid: i for i, pid in enumerate(pids)}

        scale = chart_w / self._total_time
        revealed_time = self._reveal_progress * self._total_time

        # ── Draw grid lines ──────────────────────────────────────────
        painter.setPen(QPen(QColor(BORDER), 1, Qt.DotLine))
        for t in range(self._total_time + 1):
            x = self.LEFT_MARGIN + t * scale
            painter.drawLine(int(x), self.TOP_MARGIN,
                             int(x), h - self.BOTTOM_MARGIN)

        # ── Draw time axis labels ────────────────────────────────────
        painter.setPen(QColor(TEXT_MUTED))
        font = QFont("monospace", 9)
        painter.setFont(font)
        for t in range(self._total_time + 1):
            x = self.LEFT_MARGIN + t * scale
            painter.drawText(int(x) - 6, h - self.BOTTOM_MARGIN + 16, str(t))

        # ── Draw PID labels ──────────────────────────────────────────
        painter.setPen(QColor(TEXT_SECONDARY))
        font.setPointSize(10)
        font.setBold(True)
        painter.setFont(font)
        for pid, row in pid_to_row.items():
            y = self.TOP_MARGIN + row * (self.BAR_HEIGHT + self.ROW_GAP)
            painter.drawText(8, int(y + self.BAR_HEIGHT * 0.65), f"P{pid}")

        # ── Draw bars ────────────────────────────────────────────────
        for entry in self._entries:
            if entry.pid < 0:
                continue  # Skip idle gaps
            if entry.start >= revealed_time:
                continue  # Not yet revealed

            row = pid_to_row.get(entry.pid, 0)
            visible_end = min(entry.end, revealed_time)

            x = self.LEFT_MARGIN + entry.start * scale
            bar_w = (visible_end - entry.start) * scale
            y = self.TOP_MARGIN + row * (self.BAR_HEIGHT + self.ROW_GAP)

            # Gradient fill
            color = QColor(pid_color(entry.pid))
            grad = QLinearGradient(x, y, x + bar_w, y)
            grad.setColorAt(0, color)
            lighter = QColor(color)
            lighter.setAlpha(180)
            grad.setColorAt(1, lighter)

            painter.setPen(Qt.NoPen)
            painter.setBrush(QBrush(grad))
            rect = QRectF(x + 1, y + 1, max(bar_w - 2, 1), self.BAR_HEIGHT - 2)
            painter.drawRoundedRect(rect, 6, 6)

            # Bar label
            if bar_w > 30:
                painter.setPen(QColor("#000000"))
                label_font = QFont("monospace", 9, QFont.Bold)
                painter.setFont(label_font)
                painter.drawText(rect, Qt.AlignCenter, f"P{entry.pid}")

        # ── Title ────────────────────────────────────────────────────
        painter.setPen(QColor(ACCENT_GREEN))
        title_font = QFont("sans-serif", 11, QFont.Bold)
        painter.setFont(title_font)
        painter.drawText(self.LEFT_MARGIN, 24, "Gantt Chart")

        painter.end()

    # ── Hover tooltip ────────────────────────────────────────────────

    def mouseMoveEvent(self, event):
        if not self._entries or self._total_time == 0:
            return
        chart_w = self.width() - self.LEFT_MARGIN - self.RIGHT_MARGIN
        scale = chart_w / self._total_time
        pids = sorted(set(e.pid for e in self._entries if e.pid >= 0))
        pid_to_row = {pid: i for i, pid in enumerate(pids)}

        for entry in self._entries:
            if entry.pid < 0:
                continue
            row = pid_to_row.get(entry.pid, 0)
            x = self.LEFT_MARGIN + entry.start * scale
            y = self.TOP_MARGIN + row * (self.BAR_HEIGHT + self.ROW_GAP)
            bar_w = (entry.end - entry.start) * scale
            rect = QRectF(x, y, bar_w, self.BAR_HEIGHT)
            if rect.contains(QPointF(event.x(), event.y())):
                QToolTip.showText(
                    event.globalPos(),
                    f"PID: {entry.pid}\n"
                    f"Start: {entry.start}\n"
                    f"End: {entry.end}\n"
                    f"Duration: {entry.end - entry.start}",
                )
                return
        QToolTip.hideText()
