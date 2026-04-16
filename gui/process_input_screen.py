"""
process_input_screen.py — Process input form and simulation controls.

Allows users to add/edit/remove processes, select a scheduling
algorithm, configure quantum, and launch the simulation.
"""

import csv
from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem,
    QPushButton, QComboBox, QSpinBox, QLabel, QFileDialog,
    QHeaderView, QMessageBox, QGroupBox, QGridLayout,
)
from PyQt5.QtCore import Qt, pyqtSignal

from algorithms import ALGORITHM_MAP
from algorithms.process import Process
from gui.theme import ACCENT_GREEN, ACCENT_PURPLE, TEXT_SECONDARY, BG_CARD, BORDER


class ProcessInputScreen(QWidget):
    """
    Screen #1 — Process Input.

    Signals:
        run_requested(algorithm_name: str, processes: list, quantum: int)
    """

    run_requested = pyqtSignal(str, list, int)

    HEADERS = ["PID", "Arrival Time", "Burst Time", "Priority", "Pages"]

    def __init__(self, parent=None):
        super().__init__(parent)
        self._pid_counter = 1
        self._build_ui()

    def _build_ui(self):
        main = QVBoxLayout(self)
        main.setSpacing(16)
        main.setContentsMargins(24, 24, 24, 24)

        # ── Title ────────────────────────────────────────────────────
        title = QLabel("🖥️  Process Configuration")
        title.setStyleSheet(f"font-size: 22px; font-weight: bold; color: {ACCENT_GREEN};")
        main.addWidget(title)

        subtitle = QLabel("Define processes and choose a scheduling algorithm to simulate.")
        subtitle.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 13px; margin-bottom: 8px;")
        main.addWidget(subtitle)

        # ── Controls row ─────────────────────────────────────────────
        ctrl_group = QGroupBox("Algorithm Settings")
        ctrl_layout = QGridLayout(ctrl_group)
        ctrl_layout.setSpacing(12)

        ctrl_layout.addWidget(QLabel("Algorithm:"), 0, 0)
        self.algo_combo = QComboBox()
        self.algo_combo.addItems(ALGORITHM_MAP.keys())
        self.algo_combo.setMinimumWidth(200)
        ctrl_layout.addWidget(self.algo_combo, 0, 1)

        ctrl_layout.addWidget(QLabel("Quantum:"), 0, 2)
        self.quantum_spin = QSpinBox()
        self.quantum_spin.setRange(1, 100)
        self.quantum_spin.setValue(2)
        self.quantum_spin.setToolTip("Time quantum for Round Robin / MLFQ")
        ctrl_layout.addWidget(self.quantum_spin, 0, 3)

        main.addWidget(ctrl_group)

        # ── Process table ────────────────────────────────────────────
        self.table = QTableWidget(0, len(self.HEADERS))
        self.table.setHorizontalHeaderLabels(self.HEADERS)
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table.verticalHeader().setVisible(False)
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        main.addWidget(self.table, 1)

        # ── Buttons row ──────────────────────────────────────────────
        btn_row = QHBoxLayout()
        btn_row.setSpacing(12)

        self.btn_add = QPushButton("＋ Add Process")
        self.btn_add.clicked.connect(self._add_process_row)
        btn_row.addWidget(self.btn_add)

        self.btn_remove = QPushButton("✕ Remove Selected")
        self.btn_remove.setProperty("class", "secondary")
        self.btn_remove.clicked.connect(self._remove_selected)
        self.btn_remove.setStyleSheet(
            f"background: {BG_CARD}; color: #FF4757; border: 1px solid {BORDER};"
        )
        btn_row.addWidget(self.btn_remove)

        self.btn_import = QPushButton("📂 Import CSV")
        self.btn_import.setProperty("class", "secondary")
        self.btn_import.clicked.connect(self._import_csv)
        self.btn_import.setStyleSheet(
            f"background: {BG_CARD}; color: white; border: 1px solid {BORDER};"
        )
        btn_row.addWidget(self.btn_import)

        btn_row.addStretch()

        self.btn_run = QPushButton("▶  Run Simulation")
        self.btn_run.setMinimumWidth(180)
        self.btn_run.clicked.connect(self._on_run)
        btn_row.addWidget(self.btn_run)

        main.addLayout(btn_row)

        # Seed with some default processes
        self._seed_defaults()

    # ── Helpers ──────────────────────────────────────────────────────

    def _seed_defaults(self):
        defaults = [
            (1, 0, 5, 2, 3),
            (2, 1, 3, 1, 2),
            (3, 2, 8, 3, 4),
            (4, 3, 2, 4, 1),
            (5, 4, 4, 2, 2),
        ]
        for pid, arr, burst, pri, pages in defaults:
            self._add_row(pid, arr, burst, pri, pages)
        self._pid_counter = 6

    def _add_row(self, pid, arrival, burst, priority, pages):
        row = self.table.rowCount()
        self.table.insertRow(row)
        for col, val in enumerate([pid, arrival, burst, priority, pages]):
            item = QTableWidgetItem(str(val))
            item.setTextAlignment(Qt.AlignCenter)
            self.table.setItem(row, col, item)

    def _add_process_row(self):
        self._add_row(self._pid_counter, 0, 1, 0, 1)
        self._pid_counter += 1

    def _remove_selected(self):
        rows = sorted(set(idx.row() for idx in self.table.selectedIndexes()), reverse=True)
        for r in rows:
            self.table.removeRow(r)

    def _import_csv(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "Import Processes CSV", "", "CSV Files (*.csv);;All Files (*)"
        )
        if not path:
            return
        try:
            with open(path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                header = next(reader, None)  # skip header
                self.table.setRowCount(0)
                self._pid_counter = 1
                for row_data in reader:
                    if len(row_data) < 5:
                        continue
                    pid, arr, burst, pri, pages = [int(x.strip()) for x in row_data[:5]]
                    self._add_row(pid, arr, burst, pri, pages)
                    self._pid_counter = max(self._pid_counter, pid + 1)
        except Exception as e:
            QMessageBox.warning(self, "Import Error", f"Could not import CSV:\n{e}")

    def _on_run(self):
        processes = self.get_processes()
        if not processes:
            QMessageBox.warning(self, "No Processes", "Please add at least one process.")
            return
        algo_name = self.algo_combo.currentText()
        quantum = self.quantum_spin.value()
        self.run_requested.emit(algo_name, processes, quantum)

    def get_processes(self):
        """Read processes from the table."""
        procs = []
        for row in range(self.table.rowCount()):
            try:
                pid    = int(self.table.item(row, 0).text())
                arr    = int(self.table.item(row, 1).text())
                burst  = int(self.table.item(row, 2).text())
                pri    = int(self.table.item(row, 3).text())
                pages  = int(self.table.item(row, 4).text())
                procs.append(Process(pid=pid, arrival_time=arr, burst_time=burst,
                                     priority=pri, num_pages=pages))
            except (ValueError, AttributeError):
                continue
        return procs
