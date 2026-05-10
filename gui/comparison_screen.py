"""
comparison_screen.py — Algorithm Comparison Dashboard (v2).

Mejoras sobre la versión original:
  • Separación estricta scheduling vs paginación (no se pueden mezclar).
  • Comparación de 2–4 algoritmos de scheduling ó 2–5 de paginación.
  • Cada algoritmo corre en su propio threading.Thread real (paralelismo
    real del SO), con asignación a core simulado mostrada en pantalla.
  • Mensaje de caso de uso en la vida real para cada algoritmo.
  • Métricas extendidas: WT, TAT, RT, CPU%, ctx-switches (scheduling)
    o page faults, hit rate (paginación).
  • Análisis comparativo con "ganador" resaltado por métrica.
"""

import threading
import time
from typing import List, Dict, Optional

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QScrollArea,
    QFrame, QGridLayout, QProgressBar, QComboBox,
)
from PyQt5.QtCore import Qt, QThread, pyqtSignal, QRectF, QTimer
from PyQt5.QtGui import QPainter, QColor, QFont, QBrush, QLinearGradient

from algorithms import ALGORITHM_MAP, PAGE_REPLACEMENT_MAP
from algorithms.process import Process
from algorithms.scheduler import ScheduleResult
from algorithms.page_replacement import ReplacementResult
from gui.theme import (
    ACCENT_GREEN, ACCENT_PURPLE, TEXT_SECONDARY, TEXT_MUTED,
    BG_CARD, BG_SURFACE, BORDER, PID_COLORS,
    BG_PRIMARY, TEXT_PRIMARY, ACCENT_BLUE, ERROR_RED,
)

# ─── Metadatos de algoritmos ────────────────────────────────────────────────

SCHEDULING_META = {
    "FCFS": {
        "short": "First-Come, First-Served",
        "use_case": (
            "Sistemas batch simples y colas de impresión. Ideal cuando el orden "
            "de llegada representa equidad y los burst times son similares. "
            "Sin starvation, pero penaliza procesos cortos que llegan tarde."
        ),
    },
    "SJF": {
        "short": "Shortest Job First",
        "use_case": (
            "Entornos de tiempo compartido donde los burst times se conocen de "
            "antemano (ej. compiladores batch). Minimiza el tiempo de espera "
            "promedio pero puede causar starvation en procesos largos."
        ),
    },
    "HRRN": {
        "short": "Highest Response Ratio Next",
        "use_case": (
            "Sistemas mixtos batch/interactivo que necesitan prevenir starvation "
            "sin sacrificar eficiencia. El ratio de respuesta penaliza naturalmente "
            "a los procesos que han esperado poco y premia a los que llevan más tiempo."
        ),
    },
    "Round Robin": {
        "short": "Quantum configurable",
        "use_case": (
            "Sistemas interactivos y de tiempo real (ej. terminales SSH, shells). "
            "Garantiza equidad y baja latencia de respuesta. El quantum debe "
            "calibrarse: muy pequeño -> overhead de contexto, muy grande -> degrada a FCFS."
        ),
    },
    "SRTF": {
        "short": "Shortest Remaining Time First",
        "use_case": (
            "Variante preemptiva de SJF óptima para minimizar el tiempo de espera "
            "total. Usada en servidores web que conocen el tamaño de las requests. "
            "Alta complejidad y puede causar starvation severo en procesos largos."
        ),
    },
    "Priority (Preemptive)": {
        "short": "Prioridad preemptiva",
        "use_case": (
            "Kernels de SO y sistemas de tiempo real con distintos niveles de "
            "urgencia (ej. interrupciones de hardware > procesos de usuario > batch). "
            "Requiere mecanismos de aging para evitar starvation de baja prioridad."
        ),
    },
    "Multilevel Queue": {
        "short": "Colas por categoría fija",
        "use_case": (
            "Sistemas con clases de procesos bien definidas y estáticas: cola del "
            "sistema, cola interactiva, cola batch. Cada cola tiene su propio "
            "algoritmo interno. Los procesos no cambian de cola."
        ),
    },
    "MLFQ": {
        "short": "Feedback dinámico",
        "use_case": (
            "Sistemas de propósito general modernos (el Linux CFS comparte estos "
            "principios). Aprende el comportamiento de cada proceso: los I/O-bound "
            "suben de prioridad, los CPU-bound bajan. No requiere conocer burst times."
        ),
    },
}

PAGING_META = {
    "FIFO": {
        "short": "First-In, First-Out",
        "use_case": (
            "Implementación más simple de sustitución de páginas. Útil como línea "
            "base de comparación. Sufre la anomalía de Bélady: añadir más frames "
            "puede incrementar los fallos de página."
        ),
    },
    "LRU": {
        "short": "Least Recently Used",
        "use_case": (
            "El algoritmo más usado en la práctica (Linux, Windows). Aprovecha el "
            "principio de localidad temporal. Costoso de implementar en hardware puro; "
            "en la práctica se aproxima con contadores de tiempo o bit de referencia."
        ),
    },
    "Optimal": {
        "short": "Algoritmo de Bélady (teórico)",
        "use_case": (
            "Referencia teórica imposible de implementar en tiempo real (requiere "
            "conocer el futuro). Sirve como benchmark: mide qué tan cerca está un "
            "algoritmo práctico del número mínimo posible de fallos de página."
        ),
    },
    "Clock": {
        "short": "Reloj circular",
        "use_case": (
            "Aproximación eficiente a LRU usada en el page daemon de Linux. El "
            "puntero avanza en círculo limpiando bits de referencia. O(1) por "
            "sustitución, bajo overhead de hardware."
        ),
    },
    "Second Chance": {
        "short": "Enhanced Clock",
        "use_case": (
            "Variante del Clock que añade el bit dirty para distinguir páginas "
            "solo leídas de las modificadas. Reduce el I/O de swap priorizando "
            "la expulsión de páginas limpias."
        ),
    },
}

ALGO_COLORS = [
    ACCENT_GREEN, ACCENT_PURPLE, ACCENT_BLUE, "#FF6B81",
    "#FFA502", "#7BED9F", "#A29BFE",
]

CORE_OPTIONS = [1, 2, 4, 8]


# ─── Workers con threads reales ─────────────────────────────────────────────

class SchedulingWorker(QThread):
    done  = pyqtSignal(str, object, float)
    error = pyqtSignal(str, str)

    def __init__(self, name, processes, quantum=2, core_id=0):
        super().__init__()
        self.name = name
        self.processes = [p.clone() for p in processes]
        self.quantum = quantum
        self.core_id = core_id

    def run(self):
        t0 = time.perf_counter()
        try:
            cls = ALGORITHM_MAP[self.name]
            sched = cls(quantum=self.quantum) if self.name in ("Round Robin", "MLFQ") else cls()
            result = sched.schedule(self.processes)
            self.done.emit(self.name, result, (time.perf_counter() - t0) * 1000)
        except Exception as exc:
            self.error.emit(self.name, str(exc))


class PagingWorker(QThread):
    done  = pyqtSignal(str, object, float)
    error = pyqtSignal(str, str)

    def __init__(self, name, ref_string, num_frames=4, core_id=0):
        super().__init__()
        self.name = name
        self.ref_string = ref_string[:]
        self.num_frames = num_frames
        self.core_id = core_id

    def run(self):
        t0 = time.perf_counter()
        try:
            algo = PAGE_REPLACEMENT_MAP[self.name]()
            result = algo.run(self.ref_string, self.num_frames)
            self.done.emit(self.name, result, (time.perf_counter() - t0) * 1000)
        except Exception as exc:
            self.error.emit(self.name, str(exc))


# ─── Bar chart ──────────────────────────────────────────────────────────────

class BarChartWidget(QWidget):
    BAR_H = 30; GAP = 6; L_MARGIN = 180; R_MARGIN = 70

    def __init__(self, parent=None):
        super().__init__(parent)
        self._data = []; self._title = ""; self._winner = ""
        self.setMinimumHeight(60)

    def set_data(self, title, data, winner=""):
        self._title, self._data, self._winner = title, data, winner
        self.setMinimumHeight(max(28 + len(data)*(self.BAR_H+self.GAP)+10, 60))
        self.update()

    def paintEvent(self, _e):
        if not self._data: return
        p = QPainter(self); p.setRenderHint(QPainter.Antialiasing)
        w = self.width()
        p.setPen(QColor(ACCENT_GREEN)); p.setFont(QFont("sans-serif",11,QFont.Bold))
        p.drawText(8, 20, self._title)
        mx = max((v for _,v,_ in self._data), default=1) or 1
        cw = w - self.L_MARGIN - self.R_MARGIN
        for i,(lbl,val,col) in enumerate(self._data):
            y = 28 + i*(self.BAR_H+self.GAP)
            best = lbl == self._winner
            p.setPen(QColor(ACCENT_GREEN if best else TEXT_SECONDARY))
            p.setFont(QFont("sans-serif",9,QFont.Bold if best else QFont.Normal))
            p.drawText(8, int(y+self.BAR_H*0.68), lbl)
            bw = max((val/mx)*cw, 2)
            g = QLinearGradient(self.L_MARGIN, y, self.L_MARGIN+bw, y)
            g.setColorAt(0, QColor(col)); c2=QColor(col); c2.setAlpha(150); g.setColorAt(1,c2)
            p.setPen(Qt.NoPen); p.setBrush(QBrush(g))
            p.drawRoundedRect(QRectF(self.L_MARGIN,y,bw,self.BAR_H),6,6)
            p.setPen(QColor(ACCENT_GREEN if best else TEXT_MUTED))
            p.setFont(QFont("monospace",9,QFont.Bold if best else QFont.Normal))
            suffix = " ★" if best else ""
            p.drawText(int(self.L_MARGIN+bw+8), int(y+self.BAR_H*0.68), f"{val:.2f}{suffix}")
        p.end()


# ─── Tarjeta de algoritmo ────────────────────────────────────────────────────

class AlgoCard(QFrame):
    toggled = pyqtSignal(str, bool)

    def __init__(self, name, short, color, parent=None):
        super().__init__(parent)
        self.algo_name = name; self._selected = False; self._color = color
        self.setCursor(Qt.PointingHandCursor); self.setFixedHeight(64)
        lay = QVBoxLayout(self); lay.setContentsMargins(10,8,10,8); lay.setSpacing(2)
        self.lbl_name = QLabel(name)
        self.lbl_name.setStyleSheet(f"font-size:12px;font-weight:bold;color:{TEXT_PRIMARY};")
        self.lbl_short = QLabel(short)
        self.lbl_short.setStyleSheet(f"font-size:10px;color:{TEXT_MUTED};")
        lay.addWidget(self.lbl_name); lay.addWidget(self.lbl_short)
        self._restyle()

    def _restyle(self):
        if self._selected:
            s = f"QFrame{{background:{self._color}22;border:2px solid {self._color};border-radius:8px;}}"
        else:
            s = f"QFrame{{background:{BG_CARD};border:1px solid {BORDER};border-radius:8px;}}"
        self.setStyleSheet(s)

    def mousePressEvent(self, _e):
        self._selected = not self._selected
        self._restyle()
        self.toggled.emit(self.algo_name, self._selected)

    def set_selected(self, v):
        self._selected = v; self._restyle()

    @property
    def selected(self): return self._selected


# ─── Pantalla principal ──────────────────────────────────────────────────────

class ComparisonScreen(QWidget):
    """
    Pantalla de comparación de algoritmos.
    Cada algoritmo se ejecuta en un QThread (pthread real) independiente.
    Un threading.Semaphore limita el paralelismo real al número de cores
    seleccionado.
    """

    def __init__(self, parent=None):
        super().__init__(parent)
        self._processes: List[Process] = []
        self._sched_results: Dict[str, tuple] = {}
        self._page_results:  Dict[str, tuple] = {}
        self._workers: List[QThread] = []
        self._pending = 0
        self._num_cores = 4
        self._lock = threading.Lock()
        self._ref_string = [7,0,1,2,0,3,0,4,2,3,0,3,2,1,2,0,1,7,0,1]
        self._num_frames = 3
        self._category = "scheduling"
        self._selected: List[str] = []
        self._cards: Dict[str, AlgoCard] = {}
        self._build_ui()

    # ── UI ───────────────────────────────────────────────────────────────────

    def _build_ui(self):
        root = QVBoxLayout(self)
        root.setContentsMargins(24, 20, 24, 16)
        root.setSpacing(12)

        # Encabezado
        hdr = QHBoxLayout()
        title = QLabel("⚖️  Algorithm Comparison")
        title.setStyleSheet(f"font-size:22px;font-weight:bold;color:{ACCENT_GREEN};")
        hdr.addWidget(title); hdr.addStretch()
        core_lbl = QLabel("Cores:")
        core_lbl.setStyleSheet(f"color:{TEXT_SECONDARY};font-size:12px;")
        self._core_combo = QComboBox()
        for c in CORE_OPTIONS:
            self._core_combo.addItem(f"{c} core{'s' if c>1 else ''}", c)
        self._core_combo.setCurrentIndex(2)
        self._core_combo.currentIndexChanged.connect(
            lambda i: setattr(self, '_num_cores', self._core_combo.itemData(i))
        )
        self._core_combo.setFixedWidth(110)
        hdr.addWidget(core_lbl); hdr.addWidget(self._core_combo)
        root.addLayout(hdr)

        sub = QLabel("Cada algoritmo corre en su propio thread real del SO.")
        sub.setStyleSheet(f"color:{TEXT_MUTED};font-size:12px;")
        root.addWidget(sub)

        # Tabs categoría
        tab_row = QHBoxLayout()
        tab_style = (
            f"QPushButton{{background:{BG_CARD};color:{TEXT_MUTED};"
            f"border:1px solid {BORDER};border-radius:6px;font-size:12px;padding:0 16px;}}"
            f"QPushButton:checked{{background:{ACCENT_GREEN}22;color:{ACCENT_GREEN};"
            f"border-color:{ACCENT_GREEN};}}"
            f"QPushButton:hover{{color:{TEXT_PRIMARY};}}"
        )
        self._btn_sched = QPushButton("📈  Scheduling")
        self._btn_sched.setCheckable(True); self._btn_sched.setChecked(True)
        self._btn_page  = QPushButton("📄  Paginación")
        self._btn_page.setCheckable(True)
        for b in (self._btn_sched, self._btn_page):
            b.setFixedHeight(32); b.setStyleSheet(tab_style)
        self._btn_sched.clicked.connect(lambda: self._set_category("scheduling"))
        self._btn_page.clicked.connect(lambda: self._set_category("paging"))
        tab_row.addWidget(self._btn_sched); tab_row.addWidget(self._btn_page)
        tab_row.addStretch()
        root.addLayout(tab_row)

        # Header del grid
        algo_hdr = QHBoxLayout()
        self._algo_lbl = QLabel("Selecciona 2–4 algoritmos de scheduling")
        self._algo_lbl.setStyleSheet(f"color:{TEXT_SECONDARY};font-size:11px;")
        self._count_lbl = QLabel("0 / 4")
        self._count_lbl.setStyleSheet(f"color:{TEXT_MUTED};font-size:11px;")
        algo_hdr.addWidget(self._algo_lbl); algo_hdr.addStretch()
        algo_hdr.addWidget(self._count_lbl)
        root.addLayout(algo_hdr)

        self._algo_grid = QGridLayout(); self._algo_grid.setSpacing(6)
        root.addLayout(self._algo_grid)

        # Fila de botón + log
        btn_row = QHBoxLayout()
        self._btn_cmp = QPushButton("▶  Comparar")
        self._btn_cmp.setEnabled(False); self._btn_cmp.setFixedHeight(36)
        self._btn_cmp.clicked.connect(self._run_comparison)
        self._thread_log = QLabel("")
        self._thread_log.setStyleSheet(f"color:{TEXT_MUTED};font-size:10px;")
        btn_row.addWidget(self._btn_cmp); btn_row.addStretch()
        btn_row.addWidget(self._thread_log)
        root.addLayout(btn_row)

        self._progress = QProgressBar()
        self._progress.setVisible(False); self._progress.setFixedHeight(6)
        root.addWidget(self._progress)

        # Scroll de resultados
        scroll = QScrollArea(); scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        self._res_w = QWidget()
        self._res_lay = QVBoxLayout(self._res_w)
        self._res_lay.setSpacing(14); self._res_lay.setContentsMargins(0,4,0,0)
        self._res_lay.addStretch()
        scroll.setWidget(self._res_w)
        root.addWidget(scroll, 1)

        self._populate_cards()

    # ── Lógica ───────────────────────────────────────────────────────────────

    def _set_category(self, cat):
        self._category = cat; self._selected.clear()
        self._btn_sched.setChecked(cat == "scheduling")
        self._btn_page.setChecked(cat == "paging")
        mx = 4 if cat == "scheduling" else 5
        tipo = "scheduling" if cat == "scheduling" else "paginación"
        self._algo_lbl.setText(f"Selecciona 2–{mx} algoritmos de {tipo}")
        self._populate_cards(); self._clear_results()
        self._btn_cmp.setEnabled(False); self._update_count()

    def _populate_cards(self):
        while self._algo_grid.count():
            item = self._algo_grid.takeAt(0)
            if item.widget(): item.widget().deleteLater()
        self._cards.clear()
        meta = SCHEDULING_META if self._category == "scheduling" else PAGING_META
        for i, (name, info) in enumerate(meta.items()):
            color = ALGO_COLORS[i % len(ALGO_COLORS)]
            card = AlgoCard(name, info["short"], color)
            card.toggled.connect(self._on_toggle)
            self._cards[name] = card
            self._algo_grid.addWidget(card, i//4, i%4)

    def _on_toggle(self, name, selected):
        mx = 4 if self._category == "scheduling" else 5
        if selected:
            if len(self._selected) >= mx:
                self._cards[name].set_selected(False); return
            self._selected.append(name)
        else:
            if name in self._selected: self._selected.remove(name)
        self._update_count()
        self._btn_cmp.setEnabled(len(self._selected) >= 2)

    def _update_count(self):
        mx = 4 if self._category == "scheduling" else 5
        self._count_lbl.setText(f"{len(self._selected)} / {mx}")

    def set_processes(self, processes):
        self._processes = processes

    # ── Lanzamiento de threads ────────────────────────────────────────────────

    def _run_comparison(self):
        if len(self._selected) < 2: return
        self._clear_results()
        self._sched_results.clear(); self._page_results.clear()
        for w in self._workers: w.quit()
        self._workers.clear()

        n = len(self._selected)
        self._pending = n
        self._progress.setMaximum(n); self._progress.setValue(0)
        self._progress.setVisible(True); self._btn_cmp.setEnabled(False)

        # Semáforo: limita threads activos a num_cores
        sem = threading.Semaphore(self._num_cores)

        self._thread_log.setText(
            f"⚙  {n} threads  |  {self._num_cores} core(s)  |  "
            f"{min(n, self._num_cores)} en paralelo…"
        )

        for i, name in enumerate(self._selected):
            core_id = i % self._num_cores
            if self._category == "scheduling":
                if not self._processes:
                    self._thread_log.setText("⚠  Carga procesos primero desde la pantalla de procesos.")
                    self._progress.setVisible(False); self._btn_cmp.setEnabled(True); return
                w = SchedulingWorker(name, self._processes, quantum=2, core_id=core_id)
                w.done.connect(self._on_sched_done)
                w.error.connect(self._on_err)
            else:
                w = PagingWorker(name, self._ref_string, self._num_frames, core_id)
                w.done.connect(self._on_page_done)
                w.error.connect(self._on_err)

            # Envolver run() con semáforo
            orig = w.run
            def _guarded(fn=orig, s=sem):
                s.acquire()
                try: fn()
                finally: s.release()
            w.run = _guarded
            self._workers.append(w); w.start()

    def _on_sched_done(self, name, result, elapsed):
        with self._lock:
            self._sched_results[name] = (result, elapsed)
            done = len(self._sched_results)
            self._progress.setValue(done)
        if done == self._pending:
            QTimer.singleShot(0, self._show_sched)

    def _on_page_done(self, name, result, elapsed):
        with self._lock:
            self._page_results[name] = (result, elapsed)
            done = len(self._page_results)
            self._progress.setValue(done)
        if done == self._pending:
            QTimer.singleShot(0, self._show_page)

    def _on_err(self, name, msg):
        with self._lock: self._pending -= 1
        self._thread_log.setText(f"❌  {name}: {msg}")

    # ── Mostrar resultados scheduling ─────────────────────────────────────────

    def _show_sched(self):
        self._progress.setVisible(False); self._btn_cmp.setEnabled(True)
        R = self._sched_results

        def best(fn, lo=True):
            v = {n: fn(r) for n,(r,_) in R.items()}
            return (min if lo else max)(v, key=v.get)

        ww = best(lambda r: r.avg_waiting)
        tw = best(lambda r: r.avg_turnaround)
        rw = best(lambda r: r.avg_response)
        cw = best(lambda r: r.cpu_utilization, lo=False)

        self._thread_log.setText(
            f"✓  {len(R)} threads  |  mejor WT: {ww}  |  mejor TAT: {tw}"
        )

        # Resumen
        card = self._section("Resumen de métricas")
        g = QGridLayout(); g.setSpacing(8)
        for col,(lbl,w,val) in enumerate([
            ("Mejor Waiting Time",    ww, f"{R[ww][0].avg_waiting:.2f} ms"),
            ("Mejor Turnaround",      tw, f"{R[tw][0].avg_turnaround:.2f} ms"),
            ("Mejor Response Time",   rw, f"{R[rw][0].avg_response:.2f} ms"),
            ("Mayor CPU Utilization", cw, f"{R[cw][0].cpu_utilization:.1f}%"),
        ]):
            g.addWidget(self._metric(lbl, val, w), 0, col)
        card.layout().addLayout(g)
        self._push(card)

        # Gráficas
        charts = self._section("Comparación gráfica")
        for title, key_fn, winner in [
            ("Avg Waiting Time (ms)",     lambda r: r.avg_waiting,     ww),
            ("Avg Turnaround Time (ms)",  lambda r: r.avg_turnaround,  tw),
            ("Avg Response Time (ms)",    lambda r: r.avg_response,    rw),
            ("CPU Utilization (%)",       lambda r: r.cpu_utilization, cw),
        ]:
            ch = BarChartWidget()
            data = [(n, key_fn(r), ALGO_COLORS[i%len(ALGO_COLORS)])
                    for i,(n,(r,_)) in enumerate(R.items())]
            ch.set_data(title, data, winner)
            charts.layout().addWidget(ch)
        self._push(charts)

        # Tabla
        tc = self._section("Tabla de métricas")
        hdrs = ["Algoritmo","Core","Avg WT","Avg TAT","Avg RT","CPU %","Ctx Sw.","Tiempo"]
        tbl = self._table(hdrs); tbl.setRowCount(len(R))
        for row,(name,(res,elapsed)) in enumerate(R.items()):
            color = ALGO_COLORS[row%len(ALGO_COLORS)]
            vals = [name, f"Core {row%self._num_cores}",
                    f"{res.avg_waiting:.2f}", f"{res.avg_turnaround:.2f}",
                    f"{res.avg_response:.2f}", f"{res.cpu_utilization:.1f}",
                    str(res.context_switches), f"{elapsed:.1f} ms"]
            for col,val in enumerate(vals):
                it = QTableWidgetItem(val); it.setTextAlignment(Qt.AlignCenter)
                if col==0: it.setForeground(QColor(color))
                if name in (ww,tw) and col in (2,3): it.setForeground(QColor(ACCENT_GREEN))
                tbl.setItem(row,col,it)
        tbl.setFixedHeight(36+34*len(R))
        tc.layout().addWidget(tbl); self._push(tc)

        self._use_cases(list(R.keys()), SCHEDULING_META)

    # ── Mostrar resultados paginación ─────────────────────────────────────────

    def _show_page(self):
        self._progress.setVisible(False); self._btn_cmp.setEnabled(True)
        R = self._page_results

        wf = min(R, key=lambda n: R[n][0].total_faults)
        wr = min(R, key=lambda n: R[n][0].fault_rate)
        self._thread_log.setText(f"✓  {len(R)} threads  |  menos fallos: {wf}")

        # Resumen
        card = self._section("Resumen de métricas")
        g = QGridLayout(); g.setSpacing(8)
        rf,_ = R[wf]; rr,_ = R[wr]
        for col,(lbl,w,val) in enumerate([
            ("Menos Page Faults", wf, str(rf.total_faults)),
            ("Menor Fault Rate",  wr, f"{rr.fault_rate:.1f}%"),
            ("Frames usados",     "",  str(self._num_frames)),
            ("Ref string len",    "",  str(len(self._ref_string))),
        ]):
            g.addWidget(self._metric(lbl,val,w),0,col)
        card.layout().addLayout(g); self._push(card)

        # Gráficas
        charts = self._section("Comparación gráfica")
        for title, fn, w in [
            ("Total Page Faults", lambda r: float(r.total_faults), wf),
            ("Fault Rate (%)",    lambda r: r.fault_rate,          wr),
        ]:
            ch = BarChartWidget()
            data = [(n, fn(r), ALGO_COLORS[i%len(ALGO_COLORS)])
                    for i,(n,(r,_)) in enumerate(R.items())]
            ch.set_data(title, data, w); charts.layout().addWidget(ch)
        self._push(charts)

        # Tabla
        tc = self._section("Tabla de métricas")
        hdrs = ["Algoritmo","Core","Page Faults","Hit Rate %","Fault Rate %","Frames","Tiempo"]
        tbl = self._table(hdrs); tbl.setRowCount(len(R))
        for row,(name,(res,elapsed)) in enumerate(R.items()):
            color = ALGO_COLORS[row%len(ALGO_COLORS)]
            hits = len(res.reference_string)-res.total_faults
            hr = hits/len(res.reference_string)*100 if res.reference_string else 0
            vals = [name, f"Core {row%self._num_cores}",
                    str(res.total_faults), f"{hr:.1f}",
                    f"{res.fault_rate:.1f}", str(res.num_frames), f"{elapsed:.1f} ms"]
            for col,val in enumerate(vals):
                it = QTableWidgetItem(val); it.setTextAlignment(Qt.AlignCenter)
                if col==0: it.setForeground(QColor(color))
                if name==wf and col==2: it.setForeground(QColor(ACCENT_GREEN))
                tbl.setItem(row,col,it)
        tbl.setFixedHeight(36+34*len(R))
        tc.layout().addWidget(tbl); self._push(tc)

        self._use_cases(list(R.keys()), PAGING_META)

    # ── Helpers de widgets ────────────────────────────────────────────────────

    def _section(self, title):
        f = QFrame()
        f.setStyleSheet(f"QFrame{{background:{BG_CARD};border:1px solid {BORDER};border-radius:10px;}}")
        lay = QVBoxLayout(f); lay.setContentsMargins(14,12,14,12); lay.setSpacing(10)
        lbl = QLabel(title)
        lbl.setStyleSheet(f"color:{TEXT_SECONDARY};font-size:11px;font-weight:bold;")
        lay.addWidget(lbl); return f

    def _metric(self, label, value, algo):
        f = QFrame()
        f.setStyleSheet(f"QFrame{{background:{BG_SURFACE};border:1px solid {BORDER};border-radius:8px;}}")
        lay = QVBoxLayout(f); lay.setContentsMargins(10,8,10,8); lay.setSpacing(2)
        lay.addWidget(self._lbl(label, f"color:{TEXT_MUTED};font-size:10px;"))
        lay.addWidget(self._lbl(value, f"color:{ACCENT_GREEN};font-size:18px;font-weight:bold;"))
        lay.addWidget(self._lbl(algo,  f"color:{TEXT_SECONDARY};font-size:10px;"))
        return f

    def _lbl(self, text, style):
        l = QLabel(text); l.setStyleSheet(style); return l

    def _table(self, headers):
        t = QTableWidget(0, len(headers))
        t.setHorizontalHeaderLabels(headers)
        t.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        for i in range(1, len(headers)):
            t.horizontalHeader().setSectionResizeMode(i, QHeaderView.ResizeToContents)
        t.verticalHeader().setVisible(False)
        t.setEditTriggers(QTableWidget.NoEditTriggers)
        t.setSelectionBehavior(QTableWidget.SelectRows)
        return t

    def _use_cases(self, names, meta):
        uc = self._section("¿Cuándo usar cada algoritmo en la vida real?")
        for i, name in enumerate(names):
            if name not in meta: continue
            color = ALGO_COLORS[i%len(ALGO_COLORS)]
            box = QFrame()
            box.setStyleSheet(
                f"QFrame{{background:{BG_SURFACE};"
                f"border-left:3px solid {color};border-radius:0 6px 6px 0;}}"
            )
            bl = QVBoxLayout(box); bl.setContentsMargins(10,6,10,6); bl.setSpacing(3)
            bl.addWidget(self._lbl(
                f"{name}  —  {meta[name]['short']}",
                f"color:{color};font-size:12px;font-weight:bold;"
            ))
            d = QLabel(meta[name]["use_case"]); d.setWordWrap(True)
            d.setStyleSheet(f"color:{TEXT_SECONDARY};font-size:11px;")
            bl.addWidget(d); uc.layout().addWidget(box)
        self._push(uc)

    def _push(self, widget):
        self._res_lay.insertWidget(self._res_lay.count()-1, widget)

    def _clear_results(self):
        while self._res_lay.count() > 1:
            item = self._res_lay.takeAt(0)
            if item.widget(): item.widget().deleteLater()
        self._progress.setVisible(False)