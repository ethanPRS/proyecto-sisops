"""
extractor.py — Regex-based data extraction from text files.

Extracts dates, names, emails, addresses, and phone numbers using
compiled regular expressions.  Results are yielded incrementally so
the GUI can update a live CSV view row by row.
"""

import re
from dataclasses import dataclass
from typing import List, Generator, Tuple


@dataclass
class ExtractedMatch:
    """One piece of extracted data."""
    category: str       # "date", "name", "email", "address", "phone"
    value: str          # The matched text
    line_number: int    # 1-indexed line where found
    pattern_used: str   # The regex pattern that matched


# ── Compiled patterns ────────────────────────────────────────────────

PATTERNS = {
    "date": re.compile(
        r"""
        (?:                         # Non-capturing group for alternatives
            \d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}   # DD/MM/YYYY or MM-DD-YY etc.
          | \d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2}      # YYYY-MM-DD
          | (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)
            [a-z]*\.?\s+\d{1,2},?\s+\d{4}          # January 15, 2024
        )
        """,
        re.VERBOSE | re.IGNORECASE,
    ),
    "email": re.compile(
        r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
    ),
    "phone": re.compile(
        r"""
        (?:                         
            \+?\d{1,3}[\s\-]?       # Country code
        )?
        (?:\(?\d{2,4}\)?[\s\-]?)    # Area code
        \d{3,4}[\s\-]?             
        \d{3,4}                     
        """,
        re.VERBOSE,
    ),
    "name": re.compile(
        r"\b[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+(?:\s+[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+){1,3}\b"
    ),
    "address": re.compile(
        r"""
        \d{1,5}\s+                          # Street number
        [A-Za-záéíóúñü\s]+                  # Street name
        (?:St\.?|Ave\.?|Blvd\.?|Dr\.?|Rd\.?|Calle|Avenida|Col\.?)  # Street type
        (?:\s*[#,]\s*\d+)?                  # Optional apt/suite
        """,
        re.VERBOSE | re.IGNORECASE,
    ),
}


class DataExtractor:
    """
    Extracts structured data from text files using regex patterns.

    Usage:
        extractor = DataExtractor()
        for match in extractor.extract_from_file("data.txt"):
            print(match.category, match.value)
    """

    def __init__(self, categories: List[str] = None):
        """
        Args:
            categories: List of category names to extract.
                        Defaults to all available patterns.
        """
        if categories is None:
            categories = list(PATTERNS.keys())
        self.active_patterns = {
            cat: PATTERNS[cat]
            for cat in categories
            if cat in PATTERNS
        }

    def extract_from_text(self, text: str) -> List[ExtractedMatch]:
        """Extract all matches from a text string."""
        results: List[ExtractedMatch] = []
        for line_num, line in enumerate(text.splitlines(), start=1):
            for cat, pattern in self.active_patterns.items():
                for m in pattern.finditer(line):
                    results.append(ExtractedMatch(
                        category=cat,
                        value=m.group().strip(),
                        line_number=line_num,
                        pattern_used=pattern.pattern.strip(),
                    ))
        return results

    def extract_from_file(self, filepath: str) -> List[ExtractedMatch]:
        """Extract all matches from a file."""
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                text = f.read()
        except (FileNotFoundError, PermissionError, UnicodeDecodeError) as e:
            raise IOError(f"Cannot read file '{filepath}': {e}")
        return self.extract_from_text(text)

    def extract_incremental(self, filepath: str) -> Generator[ExtractedMatch, None, None]:
        """
        Yield matches one by one (for live GUI updates).

        The GUI can consume this generator in a worker thread,
        emitting a signal after each match to update the CSV table.
        """
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                for line_num, line in enumerate(f, start=1):
                    for cat, pattern in self.active_patterns.items():
                        for m in pattern.finditer(line):
                            yield ExtractedMatch(
                                category=cat,
                                value=m.group().strip(),
                                line_number=line_num,
                                pattern_used=pattern.pattern.strip(),
                            )
        except (FileNotFoundError, PermissionError, UnicodeDecodeError) as e:
            raise IOError(f"Cannot read file '{filepath}': {e}")
