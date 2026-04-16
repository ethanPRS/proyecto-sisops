"""
csv_view.py — Live CSV Extraction View.

File picker → extract via regex → live table update.
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QFileDialog,
    QProgressBar, QGroupBox,
)
from PyQt5.QtCore import Qt, QThread, pyqtSignal
from PyQt5.QtGui import QColor

from regex_csv.extractor import DataExtractor, ExtractedMatch
from regex_csv.csv_writer import IncrementalCSVWriter
from gui.theme import (
    ACCENT_GREEN, ACCENT_PURPLE, TEXT_SECONDARY, TEXT_MUTED,
    BG_CARD, BORDER, ERROR_RED,
)

import os
import time


class ExtractionWorker(QThread):
    """Worker thread that extracts data and emits one row at a time."""
    match_found = pyqtSignal(object)   # ExtractedMatch
    finished = pyqtSignal(int)          # total count

    def __init__(self, filepath: str, csv_path: str):
        super().__init__()
        self.filepath = filepath
        self.csv_path = csv_path

    def run(self):
        extractor = DataExtractor()
        writer = IncrementalCSVWriter(self.csv_path)
        writer.reset()
        count = 0
        try:
            for match in extractor.extract_incremental(self.filepath):
                writer.write_match(match)
                self.match_found.emit(match)
                count += 1
                time.sleep(0.05)  # Slow down for visual effect
        except IOError:
            pass
        self.finished.emit(count)


class CSVViewScreen(QWidget):
    """
    Screen #7 — Live CSV Extraction View.

    Pick a .txt file, extract with regex, show CSV updating live.
    """

    HEADERS = ["Category", "Value", "Line #", "Pattern"]

    def __init__(self, parent=None):
        super().__init__(parent)
        self._worker = None
        self._build_ui()

    def _build_ui(self):
        main = QVBoxLayout(self)
        main.setSpacing(16)
        main.setContentsMargins(24, 24, 24, 24)

        title = QLabel("📑  Regex Extraction → Live CSV")
        title.setStyleSheet(f"font-size: 22px; font-weight: bold; color: {ACCENT_GREEN};")
        main.addWidget(title)

        subtitle = QLabel("Select a text file to extract dates, names, emails, phones, and addresses using regex.")
        subtitle.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 13px;")
        main.addWidget(subtitle)

        # ── Controls ─────────────────────────────────────────────────
        ctrl = QHBoxLayout()
        ctrl.setSpacing(12)

        self.btn_pick = QPushButton("📂 Pick .txt File")
        self.btn_pick.clicked.connect(self._pick_file)
        self.btn_pick.setStyleSheet(f"background: {BG_CARD}; color: white; border: 1px solid {BORDER};")
        ctrl.addWidget(self.btn_pick)

        self.lbl_file = QLabel("No file selected")
        self.lbl_file.setStyleSheet(f"color: {TEXT_MUTED}; font-size: 12px;")
        ctrl.addWidget(self.lbl_file, 1)

        self.btn_extract = QPushButton("▶ Extract")
        self.btn_extract.clicked.connect(self._start_extraction)
        self.btn_extract.setEnabled(False)
        ctrl.addWidget(self.btn_extract)

        self.btn_save = QPushButton("💾 Save CSV")
        self.btn_save.clicked.connect(self._save_csv)
        self.btn_save.setEnabled(False)
        self.btn_save.setStyleSheet(f"background: {BG_CARD}; color: white; border: 1px solid {BORDER};")
        ctrl.addWidget(self.btn_save)

        main.addLayout(ctrl)

        # ── Progress ─────────────────────────────────────────────────
        self.progress = QProgressBar()
        self.progress.setRange(0, 0)  # indeterminate
        self.progress.setVisible(False)
        main.addWidget(self.progress)

        # ── Stats ────────────────────────────────────────────────────
        stats = QHBoxLayout()
        self.lbl_count = self._stat("Matches: 0")
        self.lbl_status = self._stat("Status: Idle")
        stats.addWidget(self.lbl_count)
        stats.addWidget(self.lbl_status)
        stats.addStretch()
        main.addLayout(stats)

        # ── Live table ───────────────────────────────────────────────
        self.table = QTableWidget(0, len(self.HEADERS))
        self.table.setHorizontalHeaderLabels(self.HEADERS)
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table.verticalHeader().setVisible(False)
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)
        main.addWidget(self.table, 1)

        self._filepath = ""
        self._csv_path = ""

    def _pick_file(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "Select Text File", "", "Text Files (*.txt);;All Files (*)"
        )
        if path:
            self._filepath = path
            self.lbl_file.setText(os.path.basename(path))
            self.lbl_file.setStyleSheet(f"color: {ACCENT_GREEN}; font-size: 12px;")
            self.btn_extract.setEnabled(True)

    def _start_extraction(self):
        if not self._filepath:
            return

        self.table.setRowCount(0)
        self._csv_path = os.path.splitext(self._filepath)[0] + "_extracted.csv"

        self.progress.setVisible(True)
        self.lbl_status.setText("Status: Extracting...")
        self.btn_extract.setEnabled(False)

        self._worker = ExtractionWorker(self._filepath, self._csv_path)
        self._worker.match_found.connect(self._on_match)
        self._worker.finished.connect(self._on_done)
        self._worker.start()

    def _on_match(self, match: ExtractedMatch):
        row = self.table.rowCount()
        self.table.insertRow(row)
        vals = [match.category, match.value, str(match.line_number), match.pattern_used[:50]]
        cat_colors = {
            "date": "#6EEB83", "email": "#6A00FF", "phone": "#00D4FF",
            "name": "#FFA502", "address": "#FF6B81",
        }
        color = cat_colors.get(match.category, "#FFFFFF")
        for col, val in enumerate(vals):
            item = QTableWidgetItem(val)
            item.setTextAlignment(Qt.AlignCenter)
            if col == 0:
                item.setForeground(QColor(color))
            self.table.setItem(row, col, item)
        self.table.scrollToBottom()
        self.lbl_count.setText(f"Matches: {row + 1}")

    def _on_done(self, count: int):
        self.progress.setVisible(False)
        self.lbl_status.setText(f"Status: Done — {count} matches extracted")
        self.btn_extract.setEnabled(True)
        self.btn_save.setEnabled(True)

    def _save_csv(self):
        if self._csv_path:
            dest, _ = QFileDialog.getSaveFileName(
                self, "Save CSV", self._csv_path, "CSV Files (*.csv)"
            )
            if dest and dest != self._csv_path:
                import shutil
                shutil.copy2(self._csv_path, dest)

    @staticmethod
    def _stat(text: str) -> QLabel:
        lbl = QLabel(text)
        lbl.setStyleSheet(
            f"padding: 6px 14px; background: {BG_CARD}; "
            f"border: 1px solid {BORDER}; border-radius: 6px; "
            f"font-weight: bold; font-size: 12px;"
        )
        return lbl
