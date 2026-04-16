"""
theme.py — Centralised dark-theme styling for the OS Simulator GUI.

All colours, font sizes, and animation durations are defined here
so every widget draws from a single source of truth.
"""

# ═══════════════════════════════════════════════════════════════════════
# Colour palette
# ═══════════════════════════════════════════════════════════════════════

BG_PRIMARY   = "#000000"
BG_SURFACE   = "#0A0A0F"
BG_CARD      = "#111122"
BG_CARD_HOVER = "#1A1A2E"
BG_INPUT     = "#16162A"
BORDER       = "#2A2A4A"

TEXT_PRIMARY   = "#FFFFFF"
TEXT_SECONDARY = "#A0A0B8"
TEXT_MUTED     = "#606078"

ACCENT_GREEN  = "#6EEB83"
ACCENT_PURPLE = "#6A00FF"
ACCENT_BLUE   = "#00D4FF"
ERROR_RED     = "#FF4757"
WARNING_AMBER = "#FFA502"
SUCCESS_GREEN = "#2ED573"

# Process state colours
STATE_COLORS = {
    "NEW":        "#6A00FF",
    "READY":      "#00D4FF",
    "RUNNING":    "#6EEB83",
    "WAITING":    "#FFA502",
    "TERMINATED": "#606078",
}

# Per-PID colour cycle (for Gantt chart / memory blocks)
PID_COLORS = [
    "#6EEB83", "#6A00FF", "#00D4FF", "#FF6B81", "#FFA502",
    "#7BED9F", "#70A1FF", "#FF4757", "#ECCC68", "#A29BFE",
    "#FD79A8", "#00CEC9", "#E17055", "#0984E3", "#D63031",
    "#00B894",
]

def pid_color(pid: int) -> str:
    """Return a deterministic colour for the given PID."""
    return PID_COLORS[pid % len(PID_COLORS)]


# ═══════════════════════════════════════════════════════════════════════
# Typography
# ═══════════════════════════════════════════════════════════════════════

FONT_FAMILY  = "'Segoe UI', 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
FONT_MONO    = "'SF Mono', 'Fira Code', 'Consolas', monospace"
FONT_SIZE_SM = 11
FONT_SIZE_MD = 13
FONT_SIZE_LG = 16
FONT_SIZE_XL = 22
FONT_SIZE_TITLE = 28

# ═══════════════════════════════════════════════════════════════════════
# Animation
# ═══════════════════════════════════════════════════════════════════════

ANIM_DURATION_FAST = 150   # ms
ANIM_DURATION      = 300
ANIM_DURATION_SLOW = 600

# ═══════════════════════════════════════════════════════════════════════
# Global QSS Stylesheet
# ═══════════════════════════════════════════════════════════════════════

GLOBAL_STYLESHEET = f"""
/* ── Base ────────────────────────────────────────────────────────── */
QMainWindow, QWidget {{
    background-color: {BG_PRIMARY};
    color: {TEXT_PRIMARY};
    font-family: {FONT_FAMILY};
    font-size: {FONT_SIZE_MD}px;
}}

/* ── Sidebar ─────────────────────────────────────────────────────── */
#sidebar {{
    background-color: {BG_SURFACE};
    border-right: 1px solid {BORDER};
    min-width: 220px;
    max-width: 220px;
}}

#sidebar QPushButton {{
    text-align: left;
    padding: 12px 20px;
    border: none;
    border-radius: 0px;
    color: {TEXT_SECONDARY};
    font-size: {FONT_SIZE_MD}px;
    background: transparent;
}}

#sidebar QPushButton:hover {{
    background-color: {BG_CARD};
    color: {TEXT_PRIMARY};
}}

#sidebar QPushButton:checked {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 {ACCENT_GREEN}22, stop:1 {ACCENT_PURPLE}22);
    color: {ACCENT_GREEN};
    border-left: 3px solid {ACCENT_GREEN};
    font-weight: bold;
}}

/* ── Cards ────────────────────────────────────────────────────────── */
.card {{
    background-color: {BG_CARD};
    border: 1px solid {BORDER};
    border-radius: 12px;
    padding: 16px;
}}

/* ── Tables ───────────────────────────────────────────────────────── */
QTableWidget {{
    background-color: {BG_CARD};
    border: 1px solid {BORDER};
    border-radius: 8px;
    gridline-color: {BORDER};
    selection-background-color: {ACCENT_PURPLE}44;
    font-size: {FONT_SIZE_SM}px;
}}

QTableWidget::item {{
    padding: 6px 10px;
    border-bottom: 1px solid {BORDER};
}}

QHeaderView::section {{
    background-color: {BG_SURFACE};
    color: {TEXT_SECONDARY};
    padding: 8px 10px;
    border: none;
    border-bottom: 2px solid {ACCENT_GREEN};
    font-weight: bold;
    font-size: {FONT_SIZE_SM}px;
}}

/* ── Inputs ───────────────────────────────────────────────────────── */
QLineEdit, QSpinBox, QDoubleSpinBox, QComboBox {{
    background-color: {BG_INPUT};
    border: 1px solid {BORDER};
    border-radius: 6px;
    padding: 8px 12px;
    color: {TEXT_PRIMARY};
    font-size: {FONT_SIZE_MD}px;
    selection-background-color: {ACCENT_PURPLE}66;
}}

QLineEdit:focus, QSpinBox:focus, QComboBox:focus {{
    border-color: {ACCENT_GREEN};
}}

QComboBox::drop-down {{
    border: none;
    width: 24px;
}}

QComboBox QAbstractItemView {{
    background-color: {BG_CARD};
    border: 1px solid {BORDER};
    color: {TEXT_PRIMARY};
    selection-background-color: {ACCENT_PURPLE}44;
}}

/* ── Buttons ──────────────────────────────────────────────────────── */
QPushButton {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 {ACCENT_GREEN}, stop:1 {ACCENT_PURPLE});
    color: {BG_PRIMARY};
    border: none;
    border-radius: 8px;
    padding: 10px 24px;
    font-weight: bold;
    font-size: {FONT_SIZE_MD}px;
}}

QPushButton:hover {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 {ACCENT_GREEN}DD, stop:1 {ACCENT_PURPLE}DD);
}}

QPushButton:pressed {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 {ACCENT_GREEN}AA, stop:1 {ACCENT_PURPLE}AA);
}}

QPushButton:disabled {{
    background: {BG_CARD};
    color: {TEXT_MUTED};
}}

/* Secondary button variant */
QPushButton.secondary {{
    background: {BG_CARD};
    color: {TEXT_PRIMARY};
    border: 1px solid {BORDER};
}}

QPushButton.secondary:hover {{
    border-color: {ACCENT_GREEN};
    color: {ACCENT_GREEN};
}}

/* ── Scroll bars ──────────────────────────────────────────────────── */
QScrollBar:vertical {{
    background: {BG_SURFACE};
    width: 8px;
    border: none;
    border-radius: 4px;
}}

QScrollBar::handle:vertical {{
    background: {BORDER};
    border-radius: 4px;
    min-height: 30px;
}}

QScrollBar::handle:vertical:hover {{
    background: {TEXT_MUTED};
}}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0px;
}}

QScrollBar:horizontal {{
    background: {BG_SURFACE};
    height: 8px;
    border: none;
    border-radius: 4px;
}}

QScrollBar::handle:horizontal {{
    background: {BORDER};
    border-radius: 4px;
    min-width: 30px;
}}

/* ── Labels ───────────────────────────────────────────────────────── */
QLabel {{
    color: {TEXT_PRIMARY};
}}

QLabel.heading {{
    font-size: {FONT_SIZE_XL}px;
    font-weight: bold;
    color: {TEXT_PRIMARY};
}}

QLabel.subheading {{
    font-size: {FONT_SIZE_LG}px;
    color: {TEXT_SECONDARY};
}}

QLabel.accent {{
    color: {ACCENT_GREEN};
    font-weight: bold;
}}

/* ── Progress bar ─────────────────────────────────────────────────── */
QProgressBar {{
    background: {BG_CARD};
    border: 1px solid {BORDER};
    border-radius: 6px;
    text-align: center;
    color: {TEXT_PRIMARY};
    height: 22px;
    font-size: {FONT_SIZE_SM}px;
}}

QProgressBar::chunk {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 {ACCENT_GREEN}, stop:1 {ACCENT_PURPLE});
    border-radius: 5px;
}}

/* ── Group boxes ──────────────────────────────────────────────────── */
QGroupBox {{
    background-color: {BG_CARD};
    border: 1px solid {BORDER};
    border-radius: 10px;
    margin-top: 16px;
    padding-top: 24px;
    font-weight: bold;
    color: {TEXT_PRIMARY};
}}

QGroupBox::title {{
    subcontrol-origin: margin;
    left: 16px;
    padding: 0 8px;
    color: {ACCENT_GREEN};
}}

/* ── Tab widget ───────────────────────────────────────────────────── */
QTabWidget::pane {{
    background: {BG_PRIMARY};
    border: 1px solid {BORDER};
    border-radius: 8px;
}}

QTabBar::tab {{
    background: {BG_SURFACE};
    color: {TEXT_SECONDARY};
    padding: 10px 20px;
    border: none;
    border-bottom: 2px solid transparent;
}}

QTabBar::tab:selected {{
    color: {ACCENT_GREEN};
    border-bottom: 2px solid {ACCENT_GREEN};
}}

QTabBar::tab:hover {{
    color: {TEXT_PRIMARY};
    background: {BG_CARD};
}}

/* ── Status bar ───────────────────────────────────────────────────── */
QStatusBar {{
    background: {BG_SURFACE};
    color: {TEXT_MUTED};
    border-top: 1px solid {BORDER};
    font-size: {FONT_SIZE_SM}px;
}}

/* ── Tooltips ─────────────────────────────────────────────────────── */
QToolTip {{
    background-color: {BG_CARD};
    color: {TEXT_PRIMARY};
    border: 1px solid {BORDER};
    padding: 6px;
    border-radius: 4px;
}}
"""
