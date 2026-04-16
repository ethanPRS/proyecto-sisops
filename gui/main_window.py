"""
main_window.py — Main application window with sidebar navigation.

Assembles all screens into a QMainWindow with a dark-themed sidebar
and a stacked widget for page switching.
"""

import threading
from PyQt5.QtWidgets import (
    QMainWindow, QWidget, QHBoxLayout, QVBoxLayout,
    QPushButton, QStackedWidget, QLabel, QStatusBar,
    QButtonGroup,
)
from PyQt5.QtCore import Qt

from gui.theme import GLOBAL_STYLESHEET, ACCENT_GREEN, ACCENT_PURPLE, TEXT_MUTED, BG_SURFACE
from gui.process_input_screen import ProcessInputScreen
from gui.scheduling_screen import SchedulingScreen
from gui.memory_screen import MemoryScreen
from gui.page_replacement_screen import PageReplacementScreen
from gui.comparison_screen import ComparisonScreen
from gui.csv_view import CSVViewScreen
from gui.concurrency_screen import ConcurrencyScreen

from algorithms import ALGORITHM_MAP
from algorithms.round_robin import RoundRobinScheduler

from server.server import SimServer
from client.client import SimClient


class MainWindow(QMainWindow):
    """
    Root application window.

    Sidebar navigation with 7 screens:
      1. Process Input
      2. Scheduling (Gantt)
      3. Memory Visualization
      4. Page Replacement
      5. Algorithm Comparison
      6. CSV Live View
      7. Concurrency
    """

    NAV_ITEMS = [
        ("🖥️  Processes",        0),
        ("📈  Scheduling",       1),
        ("🧠  Memory",            2),
        ("📄  Page Replace",     3),
        ("⚖️  Comparison",       4),
        ("📑  CSV Extract",      5),
        ("🔄  Concurrency",      6),
    ]

    def __init__(self):
        super().__init__()
        self.setWindowTitle("OS Simulator — Visual Operating Systems Simulator")
        self.setMinimumSize(1280, 800)
        self.resize(1440, 900)

        # Apply global stylesheet
        self.setStyleSheet(GLOBAL_STYLESHEET)

        # ── Server / Client ──────────────────────────────────────────
        self._server = SimServer()
        self._server_thread = threading.Thread(target=self._server.start, daemon=True)
        self._server_thread.start()

        self._client = SimClient()
        self._client_connected = self._client.connect()

        # ── Central widget ───────────────────────────────────────────
        central = QWidget()
        self.setCentralWidget(central)
        root_layout = QHBoxLayout(central)
        root_layout.setContentsMargins(0, 0, 0, 0)
        root_layout.setSpacing(0)

        # ── Sidebar ──────────────────────────────────────────────────
        sidebar = QWidget()
        sidebar.setObjectName("sidebar")
        sidebar_layout = QVBoxLayout(sidebar)
        sidebar_layout.setContentsMargins(0, 0, 0, 0)
        sidebar_layout.setSpacing(0)

        # Logo / brand
        brand = QLabel("  ⚙️ OS Simulator")
        brand.setStyleSheet(
            f"font-size: 17px; font-weight: bold; color: {ACCENT_GREEN}; "
            f"padding: 20px 16px 16px 16px; background: transparent;"
        )
        sidebar_layout.addWidget(brand)

        divider = QLabel()
        divider.setFixedHeight(1)
        divider.setStyleSheet(f"background: {ACCENT_PURPLE}44;")
        sidebar_layout.addWidget(divider)

        # Nav buttons
        self._nav_group = QButtonGroup(self)
        self._nav_group.setExclusive(True)

        for label, idx in self.NAV_ITEMS:
            btn = QPushButton(label)
            btn.setCheckable(True)
            btn.setChecked(idx == 0)
            btn.clicked.connect(lambda checked, i=idx: self._switch_page(i))
            self._nav_group.addButton(btn, idx)
            sidebar_layout.addWidget(btn)

        sidebar_layout.addStretch()

        # Connection indicator
        conn_status = "🟢 Connected" if self._client_connected else "🔴 Disconnected"
        self._conn_label = QLabel(f"  {conn_status}")
        self._conn_label.setStyleSheet(f"color: {TEXT_MUTED}; font-size: 11px; padding: 12px;")
        sidebar_layout.addWidget(self._conn_label)

        root_layout.addWidget(sidebar)

        # ── Stacked pages ────────────────────────────────────────────
        self._stack = QStackedWidget()

        self._process_screen = ProcessInputScreen()
        self._scheduling_screen = SchedulingScreen()
        self._memory_screen = MemoryScreen()
        self._page_replace_screen = PageReplacementScreen()
        self._comparison_screen = ComparisonScreen()
        self._csv_screen = CSVViewScreen()
        self._concurrency_screen = ConcurrencyScreen()

        self._stack.addWidget(self._process_screen)       # 0
        self._stack.addWidget(self._scheduling_screen)     # 1
        self._stack.addWidget(self._memory_screen)         # 2
        self._stack.addWidget(self._page_replace_screen)   # 3
        self._stack.addWidget(self._comparison_screen)     # 4
        self._stack.addWidget(self._csv_screen)            # 5
        self._stack.addWidget(self._concurrency_screen)    # 6

        root_layout.addWidget(self._stack, 1)

        # ── Status bar ───────────────────────────────────────────────
        status = QStatusBar()
        status.showMessage("Ready — Configure processes and run a simulation")
        self.setStatusBar(status)

        # ── Wire signals ─────────────────────────────────────────────
        self._process_screen.run_requested.connect(self._on_run_simulation)

    # ── Navigation ───────────────────────────────────────────────────

    def _switch_page(self, index: int):
        self._stack.setCurrentIndex(index)

    # ── Simulation runner ────────────────────────────────────────────

    def _on_run_simulation(self, algo_name: str, processes: list, quantum: int):
        """Handle the run_requested signal from ProcessInputScreen."""
        # Create scheduler
        cls = ALGORITHM_MAP.get(algo_name)
        if not cls:
            return

        if algo_name in ("Round Robin", "MLFQ"):
            scheduler = cls(quantum=quantum)
        else:
            scheduler = cls()

        result = scheduler.schedule(processes)

        # Update scheduling screen
        self._scheduling_screen.show_result(result, algo_name)

        # Update memory screen
        self._memory_screen.allocate_processes(processes)

        # Update comparison screen (store processes)
        self._comparison_screen.set_processes(processes)

        # Switch to scheduling view
        self._switch_page(1)
        btn = self._nav_group.button(1)
        if btn:
            btn.setChecked(True)

        # Notify server
        if self._client.is_connected:
            self._client.send_command("add", event="simulation_run")
            self._client.send_command("trigger", event="simulation_run", data={
                "algorithm": algo_name,
                "num_processes": len(processes),
                "avg_turnaround": result.avg_turnaround,
            })

        self.statusBar().showMessage(
            f"Simulation complete — {algo_name} | "
            f"Avg TAT: {result.avg_turnaround:.2f} | "
            f"Avg WT: {result.avg_waiting:.2f} | "
            f"CPU: {result.cpu_utilization:.1f}%"
        )

    # ── Cleanup ──────────────────────────────────────────────────────

    def closeEvent(self, event):
        """Clean shutdown of server and client."""
        if self._client.is_connected:
            self._client.disconnect()
        self._server.stop()
        event.accept()
