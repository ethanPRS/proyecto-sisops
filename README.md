# 🖥️ Simulador Visual de Sistemas Operativos

Un simulador de sistemas operativos **educativo y de calidad de producción** construido con **Python 3** y **PyQt5**. Abarca la planificación de CPU, paginación de memoria, reemplazo de páginas, concurrencia, extracción con regex/CSV y comunicación cliente-servidor — todo con **visualizaciones interactivas y animadas**.

---

## 👥 Integrantes del Equipo

| Nombre | Matrícula |
|---|---|
| José Ricardo Jáuregui Guevara | 608995 |
| Ethan Patricio Rivera Saldivar | 615347 |
| Roberto De La Fuente Constantino | 593303 |
| Andres Siqueiros Cuellar | 609026 |

---

## 🤝 Coevaluación del Equipo

| Integrante | Rol / Contribuciones Principales | Porcentaje de Participación |
|---|---|---|
| **José Ricardo Jáuregui Guevara** | [Estructura del Proyecto, FrontEnd, Desarrollo de Algoritmos SRTF, Priority, Multilevel Queue, MFLQ y Desarrollo de juegos interactivos tipo “Mario”] | 100% |
| **Ethan Patricio Rivera Saldivar** | [Estructura del Proyecto, FrontEnd, Desarollo de Algoritmos FCFS, SJF, HRRN, Round Robin, Desarollo de Juegos tipo Mario para FCFS, SJF, HRRN, Round Robin. Desarollo de la Seccion Scheduling] | 100% |
| **Roberto De La Fuente Constantino** | [Testing y corrección de errores. Integración en Ubiquitos] | 100% |
| **Andres Siqueiros Cuellar** | [Estructuras de proyecto, desarrollo de juegos interactivos para Memoria y page replace, Regex y forks, testing de CSV] | 100% |

---

## 🚀 Paso a Paso para Levantar el Proyecto en Local

Sigue estos pasos para ejecutar el simulador en tu máquina local:

### 1. Prerrequisitos
Asegúrate de tener instalado en tu sistema:
- **Python 3.8** o superior.
- **Git** (opcional, para clonar el repositorio).

### 2. Clonar el Repositorio (Opcional)
Si aún no tienes el código localmente, clona el repositorio y entra a la carpeta:
```bash
git clone <URL_DEL_REPOSITORIO>
cd proyecto-sisops
```

### 3. Crear Entorno e Instalar Dependencias (Backend)
Aunque el proyecto cuenta con páginas web y juegos de Mario, la interfaz principal del simulador necesita el backend en Python para calcular los algoritmos de Scheduling, Memoria y Concurrencia a través de una API.

```bash
# Crear el entorno virtual (si no lo tienes aún)
python3 -m venv venv

# Activar el entorno virtual en macOS/Linux:
source venv/bin/activate
# En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements-web.txt
```

### 4. Levantar el Servidor Local
Para que la API del simulador funcione y no te marque error de `Unexpected token '<'`, debes usar el servidor Flask integrado que levanta tanto la interfaz web como la API:

```bash
python web_server.py
```

### 5. Acceder al Simulador
Abre tu navegador y dirígete a:
👉 **[http://localhost:5050](http://localhost:5050)**
---

## 📸 Características Principales

| Característica | Detalles |
|---|---|
| **Planificación de CPU** | FCFS, SJF, HRRN, Round Robin, SRTF, Prioridad, Cola Multinivel, MLFQ |
| **Paginación de Memoria** | Tamaño de memoria/página configurable, cuadrícula de marcos, tablas de páginas, fragmentación |
| **Reemplazo de Páginas** | FIFO, LRU, Óptimo, Reloj, Segunda Oportunidad — animación paso a paso |
| **Concurrencia** | Simulación de N-hilos, modo seguro (Lock) vs inseguro, detección de condiciones de carrera |
| **Regex + CSV** | Extracción de fechas/nombres/emails/teléfonos/direcciones, vista CSV en vivo |
| **Cliente-Servidor** | Sistema de eventos TCP con pub/sub, protocolo de agregar/remover/activar/salir |
| **Métricas** | CT, TAT, WT, RT, utilización de CPU, gráficos de comparación de algoritmos |

---

## 🏗️ Arquitectura del Proyecto

```text
proyecto-sisops/
├── main.py                    # Punto de entrada
├── requirements.txt
├── README.md
│
├── algorithms/                # Algoritmos centrales (planificación, memoria, reemplazo)
├── server/                    # Servidor de eventos TCP
├── client/                    # Cliente TCP
├── gui/                       # Interfaz gráfica (PyQt5)
├── concurrency/               # Simulación de concurrencia
├── regex_csv/                 # Módulo de Regex y CSV
├── tests/                     # Pruebas unitarias
└── docs/                      # Documentación (Diagramas, Reportes)
```

---

## 🎨 Pantallas de la Interfaz (GUI)

1. **Ingreso de Procesos** — Agregar/editar procesos, seleccionar algoritmo, configurar quantum.
2. **Planificación** — Gráfico de Gantt animado, cola de listos, diagrama de estados.
3. **Memoria** — Cuadrícula de marcos, tablas de páginas, estadísticas de fragmentación.
4. **Reemplazo de Páginas** — Animación paso a paso de FIFO/LRU/Óptimo/Reloj/Segunda Oportunidad.
5. **Comparación de Algoritmos** — Gráficos de barras que comparan todos los algoritmos.
6. **Extracción CSV** — Seleccionar archivo .txt, extraer datos, vista CSV en vivo.
7. **Concurrencia** — Línea de tiempo de N-hilos, modo seguro vs inseguro.

---

## 🧪 Pruebas (Testing)

| Suite de Pruebas | Cobertura |
|---|---|
| `test_scheduling.py` | Los 8 algoritmos de planificación + casos límite |
| `test_memory.py` | Asignación de memoria + 5 algoritmos de reemplazo de páginas |
| `test_regex.py` | Extracción de fechas, correos, nombres, direcciones |
| `test_server.py` | Protocolo de servidor + transmisión pub/sub |

---

## ⚙️ Tecnologías Utilizadas

- **Python 3.8+**
- **PyQt5** — Framework para la Interfaz Gráfica
- **socket** — Cliente-servidor TCP
- **threading** — Simulación de concurrencia
- **re** — Extracción mediante expresiones regulares (Regex)
- **csv** — Manejo de archivos CSV
