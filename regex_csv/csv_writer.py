"""
csv_writer.py — Incremental CSV Writer.

Writes extracted data to a CSV file row by row, suitable for
live updates in the GUI.  Thread-safe via a lock.
"""

import csv
import os
import threading
from typing import List, Optional

from regex_csv.extractor import ExtractedMatch


class IncrementalCSVWriter:
    """
    Appends rows to a CSV file one at a time.

    Thread-safe: multiple threads can call `write_match()` safely.
    """

    HEADERS = ["Category", "Value", "Line Number", "Pattern"]

    def __init__(self, output_path: str):
        """
        Args:
            output_path: Path to the CSV file to create/overwrite.
        """
        self.output_path = output_path
        self._lock = threading.Lock()
        self._row_count = 0
        self._initialised = False

    def _ensure_header(self):
        """Write the CSV header if the file hasn't been initialised."""
        if not self._initialised:
            # Create parent directories if needed
            os.makedirs(os.path.dirname(self.output_path) or ".", exist_ok=True)
            with open(self.output_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(self.HEADERS)
            self._initialised = True

    def write_match(self, match: ExtractedMatch) -> int:
        """
        Append one extracted match as a CSV row.

        Returns:
            The 1-based row number of the written row.
        """
        with self._lock:
            self._ensure_header()
            with open(self.output_path, "a", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow([
                    match.category,
                    match.value,
                    match.line_number,
                    match.pattern_used,
                ])
            self._row_count += 1
            return self._row_count

    def write_all(self, matches: List[ExtractedMatch]) -> int:
        """
        Write all matches to the CSV at once.

        Returns:
            Total number of rows written.
        """
        with self._lock:
            self._ensure_header()
            with open(self.output_path, "a", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                for match in matches:
                    writer.writerow([
                        match.category,
                        match.value,
                        match.line_number,
                        match.pattern_used,
                    ])
                    self._row_count += 1
            return self._row_count

    def reset(self):
        """Clear the CSV and reset the row counter."""
        with self._lock:
            self._initialised = False
            self._row_count = 0
            if os.path.exists(self.output_path):
                os.remove(self.output_path)

    @property
    def row_count(self) -> int:
        return self._row_count

    def read_all_rows(self) -> List[List[str]]:
        """Read all data rows from the CSV (for GUI display)."""
        if not os.path.exists(self.output_path):
            return []
        with self._lock:
            with open(self.output_path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                next(reader, None)  # skip header
                return [row for row in reader]
