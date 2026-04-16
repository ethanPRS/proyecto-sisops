"""
test_regex.py — Unit tests for regex data extraction.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import unittest
import tempfile
from regex_csv.extractor import DataExtractor


SAMPLE_TEXT = """
Meeting on 15/03/2024 with Juan Carlos Martínez about the project.
Contact: juan.carlos@example.com or call +52 81 1234 5678.
Address: 1234 Avenida Reforma Col. Centro.
Another date: 2025-01-20 and email admin@udem.edu.
María Elena García signed the contract on January 5, 2024.
Office at 567 Calle Hidalgo, #3.
Phone: (81) 9876 5432
"""


class TestDataExtractor(unittest.TestCase):
    def setUp(self):
        self.extractor = DataExtractor()

    def test_extract_dates(self):
        results = self.extractor.extract_from_text(SAMPLE_TEXT)
        dates = [r for r in results if r.category == "date"]
        self.assertGreaterEqual(len(dates), 2)
        date_values = [d.value for d in dates]
        self.assertTrue(any("15/03/2024" in v for v in date_values))
        self.assertTrue(any("2025-01-20" in v for v in date_values))

    def test_extract_emails(self):
        results = self.extractor.extract_from_text(SAMPLE_TEXT)
        emails = [r for r in results if r.category == "email"]
        self.assertGreaterEqual(len(emails), 2)
        email_values = [e.value for e in emails]
        self.assertIn("juan.carlos@example.com", email_values)
        self.assertIn("admin@udem.edu", email_values)

    def test_extract_names(self):
        results = self.extractor.extract_from_text(SAMPLE_TEXT)
        names = [r for r in results if r.category == "name"]
        self.assertGreaterEqual(len(names), 1)

    def test_extract_from_file(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
            f.write(SAMPLE_TEXT)
            path = f.name
        try:
            results = self.extractor.extract_from_file(path)
            self.assertGreater(len(results), 0)
        finally:
            os.unlink(path)

    def test_extract_file_not_found(self):
        with self.assertRaises(IOError):
            self.extractor.extract_from_file("/nonexistent/file.txt")

    def test_incremental_extraction(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
            f.write(SAMPLE_TEXT)
            path = f.name
        try:
            matches = list(self.extractor.extract_incremental(path))
            self.assertGreater(len(matches), 0)
        finally:
            os.unlink(path)

    def test_category_filter(self):
        extractor = DataExtractor(categories=["email"])
        results = extractor.extract_from_text(SAMPLE_TEXT)
        for r in results:
            self.assertEqual(r.category, "email")


if __name__ == "__main__":
    unittest.main()
