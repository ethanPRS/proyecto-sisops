import re

with open("web/index.html", "r") as f:
    html = f.read()

# Add Phosphor Icons
if "phosphor" not in html:
    html = html.replace("</head>", '  <script src="https://unpkg.com/@phosphor-icons/web"></script>\n</head>')

# Title and Name
html = html.replace("OS Simulator — Visual Operating Systems Simulator", "Sisops — Simulador Visual de Sistemas Operativos")
html = html.replace("<h1>OS Simulator</h1>", "<h1>Sisops</h1>")

# Sidebar icons
html = html.replace('aria-hidden="true">⚙️</div>', 'aria-hidden="true"><i class="ph ph-gear"></i></div>')
html = html.replace('aria-hidden="true">🖥️</span>', 'aria-hidden="true"><i class="ph ph-desktop"></i></span>')
html = html.replace('aria-hidden="true">📈</span>', 'aria-hidden="true"><i class="ph ph-chart-line-up"></i></span>')
html = html.replace('aria-hidden="true">🧠</span>', 'aria-hidden="true"><i class="ph ph-brain"></i></span>')
html = html.replace('aria-hidden="true">📄</span>', 'aria-hidden="true"><i class="ph ph-file-text"></i></span>')
html = html.replace('aria-hidden="true">⚖️</span>', 'aria-hidden="true"><i class="ph ph-scales"></i></span>')
html = html.replace('aria-hidden="true">📑</span>', 'aria-hidden="true"><i class="ph ph-file-code"></i></span>')
html = html.replace('aria-hidden="true">🔄</span>', 'aria-hidden="true"><i class="ph ph-arrows-clockwise"></i></span>')

# Card icons and headers
html = html.replace('<span class="card-icon">⚙️</span>', '<span class="card-icon"><i class="ph ph-gear"></i></span>')
html = html.replace('<span class="card-icon">➕</span>', '<span class="card-icon"><i class="ph ph-plus-circle"></i></span>')
html = html.replace('➕ Agregar', '<i class="ph ph-plus"></i> Agregar')
html = html.replace('📂 Sample', '<i class="ph ph-folder-open"></i> Sample')
html = html.replace('▶️ Ejecutar Simulación', '<i class="ph ph-play"></i> Ejecutar Simulación')
html = html.replace('▶️ Ejecutar', '<i class="ph ph-play"></i> Ejecutar')
html = html.replace('🗑️ Limpiar', '<i class="ph ph-trash"></i> Limpiar')

html = html.replace('<span class="card-icon">📋</span>', '<span class="card-icon"><i class="ph ph-clipboard-text"></i></span>')
html = html.replace('<div class="empty-icon">📭</div>', '<div class="empty-icon"><i class="ph ph-mailbox"></i></div>')

html = html.replace('<span class="card-icon">📊</span>', '<span class="card-icon"><i class="ph ph-chart-bar"></i></span>')
html = html.replace('⏮', '<i class="ph ph-skip-back"></i>')
html = html.replace('⏪', '<i class="ph ph-rewind"></i>')
html = html.replace('▶ Play', '<i class="ph ph-play"></i> Play')
html = html.replace('⏩', '<i class="ph ph-fast-forward"></i>')
html = html.replace('⏭', '<i class="ph ph-skip-forward"></i>')

html = html.replace('<span class="card-icon">🔁</span>', '<span class="card-icon"><i class="ph ph-arrows-left-right"></i></span>')
html = html.replace('<span class="card-icon">🎯</span>', '<span class="card-icon"><i class="ph ph-crosshair"></i></span>')
html = html.replace('🧠 Asignar Memoria', '<i class="ph ph-brain"></i> Asignar Memoria')

html = html.replace('<span class="card-icon">🔲</span>', '<span class="card-icon"><i class="ph ph-squares-four"></i></span>')
html = html.replace('<div class="empty-icon">🔲</div>', '<div class="empty-icon"><i class="ph ph-squares-four"></i></div>')

html = html.replace('<span class="card-icon">📖</span>', '<span class="card-icon"><i class="ph ph-book-open"></i></span>')
html = html.replace('<div class="empty-icon">📖</div>', '<div class="empty-icon"><i class="ph ph-book-open"></i></div>')

html = html.replace('<span class="card-icon">🔢</span>', '<span class="card-icon"><i class="ph ph-list-numbers"></i></span>')
html = html.replace('⏮ Reset', '<i class="ph ph-arrow-counter-clockwise"></i> Reset')
html = html.replace('◀ Prev', '<i class="ph ph-caret-left"></i> Prev')
html = html.replace('Next ▶', 'Next <i class="ph ph-caret-right"></i>')

html = html.replace('📊 Comparar Todos los Algoritmos', '<i class="ph ph-chart-bar"></i> Comparar Todos los Algoritmos')

html = html.replace('<span class="card-icon">📝</span>', '<span class="card-icon"><i class="ph ph-note"></i></span>')
html = html.replace('📅 Dates', '<i class="ph ph-calendar"></i> Dates')
html = html.replace('📧 Emails', '<i class="ph ph-envelope"></i> Emails')
html = html.replace('📞 Phones', '<i class="ph ph-phone"></i> Phones')
html = html.replace('👤 Names', '<i class="ph ph-user"></i> Names')
html = html.replace('🏠 Addresses', '<i class="ph ph-house"></i> Addresses')
html = html.replace('🔍 Extraer Datos', '<i class="ph ph-magnifying-glass"></i> Extraer Datos')

html = html.replace('🔒 Safe (Lock)', '<i class="ph ph-lock-key"></i> Safe (Lock)')
html = html.replace('⚠️ Unsafe', '<i class="ph ph-warning"></i> Unsafe')

html = html.replace('<span>🖥️</span>', '<span><i class="ph ph-desktop"></i></span>')

with open("web/index.html", "w") as f:
    f.write(html)
