"""
web_server.py — Flask REST API for the OS Simulator Web Frontend.

Exposes scheduling, memory, page replacement, concurrency, and regex
algorithms as JSON endpoints. Serves the static web/ directory.
"""

import os
import sys
import json
import logging
import threading

# Ensure project root is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from algorithms import (
    Process, ALGORITHM_MAP, PAGE_REPLACEMENT_MAP,
    MemoryManager,
)
from algorithms.scheduler import ScheduleResult
from concurrency.process_manager import ConcurrencySimulator
from regex_csv.extractor import DataExtractor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder="web", static_url_path="")
CORS(app)


# ═══════════════════════════════════════════════════════════════════════
# Serve the SPA
# ═══════════════════════════════════════════════════════════════════════

@app.route("/")
def serve_index():
    return send_from_directory("web", "index.html")


@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory("web", path)


# ═══════════════════════════════════════════════════════════════════════
# API: List available algorithms
# ═══════════════════════════════════════════════════════════════════════

@app.route("/api/algorithms", methods=["GET"])
def list_algorithms():
    """Return available scheduling and page replacement algorithms."""
    return jsonify({
        "scheduling": list(ALGORITHM_MAP.keys()),
        "page_replacement": list(PAGE_REPLACEMENT_MAP.keys()),
    })


# ═══════════════════════════════════════════════════════════════════════
# API: Schedule
# ═══════════════════════════════════════════════════════════════════════

def _parse_processes(data):
    """Parse process list from JSON request."""
    processes = []
    for p in data.get("processes", []):
        processes.append(Process(
            pid=p["pid"],
            arrival_time=p["arrival_time"],
            burst_time=p["burst_time"],
            priority=p.get("priority", 0),
            num_pages=p.get("num_pages", 1),
        ))
    return processes


def _result_to_dict(result: ScheduleResult, algo_name: str) -> dict:
    """Convert a ScheduleResult to a JSON-serialisable dict."""
    return {
        "algorithm": algo_name,
        "gantt": [
            {"pid": e.pid, "start": e.start, "end": e.end}
            for e in result.gantt
        ],
        "metrics": [
            {
                "pid": m.pid,
                "arrival_time": m.arrival_time,
                "burst_time": m.burst_time,
                "completion_time": m.completion_time,
                "turnaround_time": m.turnaround_time,
                "waiting_time": m.waiting_time,
                "response_time": m.response_time,
            }
            for m in result.metrics
        ],
        "ready_queue_snapshots": {
            str(k): v for k, v in result.ready_queue_snapshots.items()
        },
        "context_switches": result.context_switches,
        "avg_turnaround": round(result.avg_turnaround, 2),
        "avg_waiting": round(result.avg_waiting, 2),
        "avg_response": round(result.avg_response, 2),
        "cpu_utilization": round(result.cpu_utilization, 2),
        "total_time": result.total_time,
    }


@app.route("/api/schedule", methods=["POST"])
def run_schedule():
    """Run a single scheduling algorithm."""
    data = request.get_json()
    algo_name = data.get("algorithm", "FCFS")
    quantum = data.get("quantum", 2)

    cls = ALGORITHM_MAP.get(algo_name)
    if not cls:
        return jsonify({"error": f"Unknown algorithm: {algo_name}"}), 400

    processes = _parse_processes(data)
    if not processes:
        return jsonify({"error": "No processes provided"}), 400

    try:
        if algo_name in ("Round Robin", "MLFQ"):
            scheduler = cls(quantum=quantum)
        else:
            scheduler = cls()
        result = scheduler.schedule(processes)
        return jsonify(_result_to_dict(result, algo_name))
    except Exception as e:
        logger.exception("Scheduling error")
        return jsonify({"error": str(e)}), 500


@app.route("/api/schedule/compare", methods=["POST"])
def compare_algorithms():
    """Run all scheduling algorithms and return comparison."""
    data = request.get_json()
    quantum = data.get("quantum", 2)
    processes = _parse_processes(data)
    if not processes:
        return jsonify({"error": "No processes provided"}), 400

    results = {}
    for name, cls in ALGORITHM_MAP.items():
        try:
            if name in ("Round Robin", "MLFQ"):
                scheduler = cls(quantum=quantum)
            else:
                scheduler = cls()
            result = scheduler.schedule(processes)
            results[name] = _result_to_dict(result, name)
        except Exception as e:
            results[name] = {"error": str(e)}

    return jsonify(results)


# ═══════════════════════════════════════════════════════════════════════
# API: Memory
# ═══════════════════════════════════════════════════════════════════════

@app.route("/api/memory/allocate", methods=["POST"])
def allocate_memory():
    """Simulate memory allocation for processes."""
    data = request.get_json()
    memory_size = data.get("memory_size", 1024)
    page_size = data.get("page_size", 64)
    processes = data.get("processes", [])

    try:
        mgr = MemoryManager(memory_size=memory_size, page_size=page_size)
        allocations = []
        for p in processes:
            pid = p["pid"]
            num_pages = p.get("num_pages", 1)
            record = mgr.allocate(pid, num_pages)
            if record:
                allocations.append({
                    "pid": record.pid,
                    "frames_allocated": record.frames_allocated,
                    "pages_mapped": record.pages_mapped,
                    "internal_fragmentation": record.internal_fragmentation,
                })
            else:
                allocations.append({
                    "pid": pid,
                    "error": "Insufficient memory",
                })

        frame_map = []
        for fid, pid, page_num in mgr.get_frame_map():
            frame_map.append({
                "frame_id": fid,
                "pid": pid,
                "page_number": page_num,
                "is_free": pid is None,
            })

        return jsonify({
            "memory_size": memory_size,
            "page_size": page_size,
            "num_frames": mgr.num_frames,
            "free_frames": mgr.free_frame_count,
            "used_frames": mgr.used_frame_count,
            "allocations": allocations,
            "frame_map": frame_map,
            "page_tables": {
                str(pid): table
                for pid, table in mgr.page_tables.items()
            },
        })
    except Exception as e:
        logger.exception("Memory allocation error")
        return jsonify({"error": str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════
# API: Page Replacement
# ═══════════════════════════════════════════════════════════════════════

@app.route("/api/page-replacement", methods=["POST"])
def run_page_replacement():
    """Run a page replacement algorithm step-by-step."""
    data = request.get_json()
    algo_name = data.get("algorithm", "FIFO")
    ref_string = data.get("reference_string", [])
    num_frames = data.get("num_frames", 3)

    cls = PAGE_REPLACEMENT_MAP.get(algo_name)
    if not cls:
        return jsonify({"error": f"Unknown algorithm: {algo_name}"}), 400

    try:
        algo = cls()
        result = algo.run(ref_string, num_frames)
        return jsonify({
            "algorithm": result.algorithm_name,
            "num_frames": result.num_frames,
            "reference_string": result.reference_string,
            "total_faults": result.total_faults,
            "fault_rate": round(result.fault_rate, 2),
            "steps": [
                {
                    "step_number": s.step_number,
                    "page_requested": s.page_requested,
                    "fault": s.fault,
                    "page_evicted": s.page_evicted,
                    "frames_after": s.frames_after,
                    "fault_count": s.fault_count,
                }
                for s in result.steps
            ],
        })
    except Exception as e:
        logger.exception("Page replacement error")
        return jsonify({"error": str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════
# API: Concurrency
# ═══════════════════════════════════════════════════════════════════════

@app.route("/api/concurrency", methods=["POST"])
def run_concurrency():
    """Run N-thread concurrency simulation."""
    data = request.get_json()
    num_threads = data.get("num_threads", 4)
    iterations = data.get("iterations", 50)
    use_lock = data.get("use_lock", True)

    # Clamp values for safety
    num_threads = max(1, min(num_threads, 16))
    iterations = max(1, min(iterations, 200))

    try:
        sim = ConcurrencySimulator()
        result = sim.run(
            num_threads=num_threads,
            iterations=iterations,
            use_lock=use_lock,
        )
        return jsonify({
            "num_threads": result.num_threads,
            "iterations_per_thread": result.iterations_per_thread,
            "use_lock": result.use_lock,
            "expected_value": result.expected_value,
            "actual_value": result.actual_value,
            "is_correct": result.is_correct,
            "race_condition_detected": result.race_condition_detected,
            "total_duration": round(result.total_duration, 4),
            "timelines": [
                {
                    "thread_id": tl.thread_id,
                    "start_time": round(tl.start_time, 6),
                    "end_time": round(tl.end_time, 6),
                    "event_count": len(tl.events),
                }
                for tl in result.timelines
            ],
            "events": [
                {
                    "thread_id": e.thread_id,
                    "timestamp": round(e.timestamp, 6),
                    "action": e.action,
                    "value_before": e.value_before,
                    "value_after": e.value_after,
                }
                for e in result.all_events[:500]  # Limit for performance
            ],
        })
    except Exception as e:
        logger.exception("Concurrency error")
        return jsonify({"error": str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════
# API: Regex / CSV extraction
# ═══════════════════════════════════════════════════════════════════════

@app.route("/api/regex/extract", methods=["POST"])
def extract_regex():
    """Extract dates, names, emails, etc. from text."""
    data = request.get_json()
    text = data.get("text", "")
    categories = data.get("categories", None)  # None = all

    try:
        extractor = DataExtractor(categories=categories)
        matches = extractor.extract_from_text(text)
        return jsonify({
            "total_matches": len(matches),
            "matches": [
                {
                    "category": m.category,
                    "value": m.value,
                    "line_number": m.line_number,
                    "pattern_used": m.pattern_used,
                }
                for m in matches
            ],
        })
    except Exception as e:
        logger.exception("Regex extraction error")
        return jsonify({"error": str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\n  🖥️  OS Simulator Web UI")
    print("  ─────────────────────────")
    print("  Open http://localhost:5050 in your browser\n")
    app.run(host="0.0.0.0", port=5050, debug=True)
