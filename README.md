# 🖥️ Visual Operating Systems Simulator

A **production-quality, educational** operating systems simulator built with **Python 3** and **PyQt5**. Covers CPU scheduling, memory paging, page replacement, concurrency, regex/CSV extraction, and client-server communication — all with **animated, interactive visualizations**.

---

## 📸 Features

| Feature | Details |
|---|---|
| **CPU Scheduling** | FCFS, SJF, HRRN, Round Robin, SRTF, Priority, Multilevel Queue, MLFQ |
| **Memory Paging** | Configurable memory/page size, frame grid, page tables, fragmentation |
| **Page Replacement** | FIFO, LRU, Optimal, Clock, Second Chance — step-by-step animation |
| **Concurrency** | N-thread simulation, safe (Lock) vs unsafe, race condition detection |
| **Regex + CSV** | Extract dates/names/emails/phones/addresses, live CSV view |
| **Client-Server** | TCP event system with pub/sub, add/remove/trigger/exit protocol |
| **Metrics** | CT, TAT, WT, RT, CPU utilization, algorithm comparison charts |

---

## 🏗️ Architecture

```
proyecto-sisops/
├── main.py                    # Entry point
├── requirements.txt
├── README.md
│
├── algorithms/                # Core algorithms (scheduling, memory, page replacement)
│   ├── process.py             # Process dataclass + ProcessState enum
│   ├── scheduler.py           # Abstract Scheduler + result containers
│   ├── fcfs.py                # First-Come, First-Served
│   ├── sjf.py                 # Shortest Job First
│   ├── hrrn.py                # Highest Response Ratio Next
│   ├── round_robin.py         # Round Robin (configurable quantum)
│   ├── srtf.py                # Shortest Remaining Time First
│   ├── priority_preemptive.py # Preemptive Priority
│   ├── multilevel_queue.py    # Multilevel Queue (3 fixed levels)
│   ├── multilevel_feedback_queue.py  # MLFQ with demotion
│   ├── memory.py              # Memory paging manager
│   ├── page_replacement.py    # FIFO, LRU, Optimal, Clock, Second Chance
│   └── __init__.py            # Exports + ALGORITHM_MAP
│
├── server/                    # TCP event server
│   ├── server.py              # Threaded TCP server
│   ├── event_manager.py       # Event add/remove/trigger
│   ├── subscription.py        # Pub/sub manager
│   └── __init__.py
│
├── client/                    # TCP client
│   ├── client.py              # SimClient with background listener
│   ├── client_config.py       # Connection constants
│   └── __init__.py
│
├── gui/                       # PyQt5 GUI
│   ├── main_window.py         # Main window + sidebar navigation
│   ├── theme.py               # Dark theme stylesheet + colors
│   ├── process_input_screen.py
│   ├── scheduling_screen.py
│   ├── gantt_widget.py        # Animated Gantt chart
│   ├── queue_widget.py        # Animated queue visualization
│   ├── metrics_table.py       # Per-process metrics table
│   ├── memory_screen.py       # Memory frame grid
│   ├── page_replacement_screen.py
│   ├── comparison_screen.py   # Algorithm comparison charts
│   ├── csv_view.py            # Live CSV extraction view
│   ├── concurrency_screen.py  # Thread timeline visualization
│   └── __init__.py
│
├── concurrency/               # Concurrency simulation
│   ├── process_manager.py     # N-thread simulator
│   ├── shared_state.py        # Safe/unsafe shared counters
│   └── __init__.py
│
├── regex_csv/                 # Regex + CSV module
│   ├── extractor.py           # Regex data extraction
│   ├── csv_writer.py          # Incremental CSV writer
│   └── __init__.py
│
├── tests/                     # Unit tests
│   ├── test_scheduling.py
│   ├── test_memory.py
│   ├── test_regex.py
│   ├── test_server.py
│   └── scenarios/             # Sample input files
│       ├── sample_processes.csv
│       ├── sample_text.txt
│       ├── edge_case_burst0.csv
│       └── edge_case_same_arrival.csv
│
└── docs/                      # Documentation
    ├── diagrama_arquitectura.png
    └── reporte_tecnico.pdf
```

---

## 🚀 How to Run

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Launch the Simulator

```bash
python main.py
```

The application will:
1. Start the TCP event server on `127.0.0.1:9999`
2. Launch the PyQt5 GUI window

### 3. Run Unit Tests

```bash
python -m pytest tests/ -v
```

---

## 🎨 GUI Screens

1. **Process Input** — Add/edit processes, select algorithm, set quantum
2. **Scheduling** — Animated Gantt chart, ready queue, state diagram
3. **Memory** — Frame grid, page tables, fragmentation stats
4. **Page Replacement** — Step-by-step animation of FIFO/LRU/Optimal/Clock/SC
5. **Algorithm Comparison** — Bar charts comparing all algorithms
6. **CSV Extraction** — Pick a .txt file, extract data, live CSV view
7. **Concurrency** — N-thread timeline, safe vs unsafe mode

---

## 🎯 Design

- **Dark theme**: `#000000` background, `#6EEB83` green accent, `#6A00FF` purple accent
- **Animated**: Gantt chart reveals, queue slides, auto-step page replacement
- **Modular**: Each algorithm is a standalone class inheriting from `Scheduler`
- **Educational**: Every concept is visual, interactive, and intuitive

---

## 📊 Sample Input

Use the CSV files in `tests/scenarios/`:
- `sample_processes.csv` — 6 standard test processes
- `sample_text.txt` — Text with dates, names, emails for regex testing
- `edge_case_burst0.csv` — Process with burst time = 0
- `edge_case_same_arrival.csv` — All processes arrive at t=0

---

## 🧪 Testing

| Test Suite | Coverage |
|---|---|
| `test_scheduling.py` | All 8 algorithms + edge cases |
| `test_memory.py` | Memory allocation + 5 page replacement algorithms |
| `test_regex.py` | Date, email, name, address extraction |
| `test_server.py` | Server protocol + pub/sub broadcast |

---

## ⚙️ Technology Stack

- **Python 3.8+**
- **PyQt5** — GUI framework
- **socket** — TCP client-server
- **threading** — Concurrency simulation
- **re** — Regex extraction
- **csv** — CSV handling

---

## 👥 Authors

UDEM — Ingeniería en Tecnologías Computacionales  
Sistemas Operativos — 6to Semestre — Proyecto Final
