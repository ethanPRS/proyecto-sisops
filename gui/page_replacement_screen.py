"""
page_replacement_screen.py — Step-by-step Page Replacement Visualization.

Users enter a reference string and number of frames, pick an algorithm,
and watch the simulation step-by-step with animated frame states.
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QSpinBox, QComboBox, QPushButton, QGroupBox, QTableWidget,
    QTableWidgetItem, QHeaderView, QProgressBar,
)
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QColor

from algorithms import PAGE_REPLACEMENT_MAP
from algorithms.page_replacement import ReplacementResult, ReplacementStep
from gui.theme import (
    ACCENT_GREEN, ACCENT_PURPLE, ERROR_RED, TEXT_SECONDARY,
    TEXT_MUTED, BG_CARD, BORDER,
)
from typing import Optional, List


class PageReplacementScreen(QWidget):
    """
    Screen #4 — Page Replacement Visualisation.

    Step-by-step or auto-play animation of page replacement algorithms.
    """

    def __init__(self, parent=None):
        super().__init__(parent)
        self._result: Optional[ReplacementResult] = None
        self._current_step = 0
        self._auto_timer = QTimer(self)
        self._auto_timer.setInterval(600)
        self._auto_timer.timeout.connect(self._auto_step)
        self._build_ui()

    def _build_ui(self):
        main = QVBoxLayout(self)
        main.setSpacing(16)
        main.setContentsMargins(24, 24, 24, 24)

        # ── Title ────────────────────────────────────────────────────
        title = QLabel("📄  Page Replacement Simulation")
        title.setStyleSheet(f"font-size: 22px; font-weight: bold; color: {ACCENT_GREEN};")
        main.addWidget(title)

        # ── Config ───────────────────────────────────────────────────
        config = QGroupBox("Configuration")
        cfg_layout = QHBoxLayout(config)
        cfg_layout.setSpacing(12)

        cfg_layout.addWidget(QLabel("Reference String:"))
        self.ref_input = QLineEdit("7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1")
        self.ref_input.setPlaceholderText("e.g. 7 0 1 2 0 3 0 4")
        self.ref_input.setMinimumWidth(300)
        cfg_layout.addWidget(self.ref_input, 1)

        cfg_layout.addWidget(QLabel("Frames:"))
        self.spin_frames = QSpinBox()
        self.spin_frames.setRange(1, 20)
        self.spin_frames.setValue(3)
        cfg_layout.addWidget(self.spin_frames)

        cfg_layout.addWidget(QLabel("Algorithm:"))
        self.algo_combo = QComboBox()
        self.algo_combo.addItems(PAGE_REPLACEMENT_MAP.keys())
        cfg_layout.addWidget(self.algo_combo)

        btn_run = QPushButton("▶ Run")
        btn_run.clicked.connect(self._run_simulation)
        cfg_layout.addWidget(btn_run)

        main.addWidget(config)

        # ── Playback controls ────────────────────────────────────────
        ctrl = QHBoxLayout()
        ctrl.setSpacing(8)

        self.btn_prev = QPushButton("◀ Prev")
        self.btn_prev.clicked.connect(self._prev_step)
        self.btn_prev.setEnabled(False)
        ctrl.addWidget(self.btn_prev)

        self.btn_next = QPushButton("Next ▶")
        self.btn_next.clicked.connect(self._next_step)
        self.btn_next.setEnabled(False)
        ctrl.addWidget(self.btn_next)

        self.btn_auto = QPushButton("⏵ Auto Play")
        self.btn_auto.clicked.connect(self._toggle_auto)
        self.btn_auto.setEnabled(False)
        ctrl.addWidget(self.btn_auto)

        self.btn_reset = QPushButton("⟲ Reset")
        self.btn_reset.clicked.connect(self._reset_playback)
        self.btn_reset.setStyleSheet(f"background: {BG_CARD}; color: white; border: 1px solid {BORDER};")
        ctrl.addWidget(self.btn_reset)

        ctrl.addStretch()

        # Stats
        self.lbl_step = self._stat("Step: 0/0")
        self.lbl_faults = self._stat("Faults: 0")
        self.lbl_rate = self._stat("Fault Rate: 0%")
        ctrl.addWidget(self.lbl_step)
        ctrl.addWidget(self.lbl_faults)
        ctrl.addWidget(self.lbl_rate)

        main.addLayout(ctrl)

        # ── Step table ───────────────────────────────────────────────
        self.step_table = QTableWidget(0, 1)
        self.step_table.setHorizontalHeaderLabels(["Page"])
        self.step_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.step_table.verticalHeader().setVisible(False)
        self.step_table.setEditTriggers(QTableWidget.NoEditTriggers)
        main.addWidget(self.step_table, 1)

    # ── Simulation ───────────────────────────────────────────────────

    def _parse_ref_string(self) -> List[int]:
        raw = self.ref_input.text().strip()
        parts = raw.replace(",", " ").split()
        return [int(p) for p in parts if p.isdigit()]

    def _run_simulation(self):
        ref_string = self._parse_ref_string()
        if not ref_string:
            return
        num_frames = self.spin_frames.value()
        algo_name = self.algo_combo.currentText()
        algo_class = PAGE_REPLACEMENT_MAP[algo_name]
        algo = algo_class()
        self._result = algo.run(ref_string, num_frames)
        self._current_step = 0
        self._setup_table()
        self._show_step(0)

        self.btn_prev.setEnabled(True)
        self.btn_next.setEnabled(True)
        self.btn_auto.setEnabled(True)

    def _setup_table(self):
        if not self._result:
            return
        num_frames = self._result.num_frames
        # Columns: Step# | Page | Frame0 | Frame1 | ... | Fault
        headers = ["Step", "Page"] + [f"F{i}" for i in range(num_frames)] + ["Evicted", "Fault"]
        self.step_table.setColumnCount(len(headers))
        self.step_table.setHorizontalHeaderLabels(headers)
        self.step_table.setRowCount(len(self._result.steps))

        for s in self._result.steps:
            row = s.step_number
            # Initially hide all rows, reveal step by step
            self.step_table.setRowHidden(row, True)

    def _show_step(self, step_idx: int):
        if not self._result or step_idx >= len(self._result.steps):
            return
        self._current_step = step_idx

        for i in range(step_idx + 1):
            self.step_table.setRowHidden(i, False)
            s = self._result.steps[i]
            num_frames = self._result.num_frames

            items = [
                str(s.step_number + 1),
                str(s.page_requested),
            ]
            for f_idx in range(num_frames):
                val = s.frames_after[f_idx] if f_idx < len(s.frames_after) else None
                items.append(str(val) if val is not None else "—")
            items.append(str(s.page_evicted) if s.page_evicted is not None else "—")
            items.append("✗ FAULT" if s.fault else "✓ HIT")

            for col, val in enumerate(items):
                item = QTableWidgetItem(val)
                item.setTextAlignment(Qt.AlignCenter)
                if col == len(items) - 1:
                    item.setForeground(QColor(ERROR_RED) if s.fault else QColor(ACCENT_GREEN))
                self.step_table.setItem(i, col, item)

        # Highlight current step row
        self.step_table.selectRow(step_idx)
        self.step_table.scrollToItem(
            self.step_table.item(step_idx, 0)
        )

        # Update stats
        s = self._result.steps[step_idx]
        total = len(self._result.steps)
        self.lbl_step.setText(f"Step: {step_idx + 1}/{total}")
        self.lbl_faults.setText(f"Faults: {s.fault_count}")
        rate = s.fault_count / (step_idx + 1) * 100
        self.lbl_rate.setText(f"Fault Rate: {rate:.1f}%")

    def _next_step(self):
        if self._result and self._current_step < len(self._result.steps) - 1:
            self._show_step(self._current_step + 1)

    def _prev_step(self):
        if self._current_step > 0:
            self._show_step(self._current_step - 1)

    def _toggle_auto(self):
        if self._auto_timer.isActive():
            self._auto_timer.stop()
            self.btn_auto.setText("⏵ Auto Play")
        else:
            self._auto_timer.start()
            self.btn_auto.setText("⏸ Pause")

    def _auto_step(self):
        if self._result and self._current_step < len(self._result.steps) - 1:
            self._next_step()
        else:
            self._auto_timer.stop()
            self.btn_auto.setText("⏵ Auto Play")

    def _reset_playback(self):
        self._auto_timer.stop()
        self.btn_auto.setText("⏵ Auto Play")
        self._current_step = 0
        if self._result:
            for i in range(len(self._result.steps)):
                self.step_table.setRowHidden(i, True)
            self._show_step(0)

    @staticmethod
    def _stat(text: str) -> QLabel:
        lbl = QLabel(text)
        lbl.setStyleSheet(
            f"padding: 6px 14px; background: {BG_CARD}; "
            f"border: 1px solid {BORDER}; border-radius: 6px; "
            f"font-weight: bold; font-size: 12px;"
        )
        return lbl
