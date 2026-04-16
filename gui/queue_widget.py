"""
queue_widget.py — Animated Ready Queue Visualisation.

Displays processes as colour-coded blocks in a horizontal queue.
New processes enter from the right, departures slide out left.
"""

from PyQt5.QtWidgets import QWidget
from PyQt5.QtCore import Qt, QRectF, QTimer
from PyQt5.QtGui import QPainter, QColor, QFont, QLinearGradient, QBrush

from gui.theme import (
    BG_CARD, BORDER, TEXT_PRIMARY, TEXT_MUTED,
    ACCENT_GREEN, pid_color,
)
from typing import List


class QueueWidget(QWidget):
    """
    Animated horizontal queue of process blocks.

    Call `set_queue(pids)` to update the displayed queue.
    """

    BLOCK_W = 56
    BLOCK_H = 40
    GAP     = 6
    PADDING = 16

    def __init__(self, title: str = "Ready Queue", parent=None):
        super().__init__(parent)
        self._title = title
        self._pids: List[int] = []
        self._target_pids: List[int] = []
        self._anim_progress = 1.0
        self._timer = QTimer(self)
        self._timer.setInterval(16)
        self._timer.timeout.connect(self._tick)
        self.setMinimumHeight(self.BLOCK_H + 60)
        self.setMinimumWidth(200)

    def set_queue(self, pids: List[int]):
        """Update the queue contents with animation."""
        if pids == self._pids:
            return
        self._target_pids = list(pids)
        self._anim_progress = 0.0
        self._timer.start()

    def _tick(self):
        self._anim_progress = min(self._anim_progress + 0.05, 1.0)
        if self._anim_progress >= 1.0:
            self._pids = list(self._target_pids)
            self._timer.stop()
        self.update()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        w = self.width()
        h = self.height()

        # Background
        painter.fillRect(0, 0, w, h, QColor(BG_CARD))

        # Title
        painter.setPen(QColor(ACCENT_GREEN))
        font = QFont("sans-serif", 10, QFont.Bold)
        painter.setFont(font)
        painter.drawText(self.PADDING, 20, self._title)

        # Draw queue blocks
        display = self._target_pids if self._anim_progress < 1.0 else self._pids
        if not display:
            painter.setPen(QColor(TEXT_MUTED))
            painter.setFont(QFont("sans-serif", 10))
            painter.drawText(self.PADDING, 50, "Empty")
            painter.end()
            return

        # Arrow at left
        arrow_x = self.PADDING
        painter.setPen(QColor(TEXT_MUTED))
        painter.drawText(arrow_x, 50, "→")
        start_x = arrow_x + 20

        for i, pid in enumerate(display):
            x = start_x + i * (self.BLOCK_W + self.GAP)
            y = 32

            # Apply entrance slide
            if self._anim_progress < 1.0:
                offset = (1.0 - self._anim_progress) * 20
                x += offset

            color = QColor(pid_color(pid))
            grad = QLinearGradient(x, y, x, y + self.BLOCK_H)
            grad.setColorAt(0, color)
            c2 = QColor(color)
            c2.setAlpha(160)
            grad.setColorAt(1, c2)

            painter.setPen(Qt.NoPen)
            painter.setBrush(QBrush(grad))
            painter.drawRoundedRect(QRectF(x, y, self.BLOCK_W, self.BLOCK_H), 8, 8)

            # PID label
            painter.setPen(QColor("#000000"))
            painter.setFont(QFont("monospace", 10, QFont.Bold))
            painter.drawText(QRectF(x, y, self.BLOCK_W, self.BLOCK_H),
                             Qt.AlignCenter, f"P{pid}")

        painter.end()
