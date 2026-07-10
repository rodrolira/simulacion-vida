# 🌍 Simulación de Vida Multiagente

Simulación de vida artificial con un sistema **ECS (Entity-Component-System)** en Python
y visualización en tiempo real con **React + PixiJS** (estilo pixel art). Los NPCs tienen
necesidades, personalidad, emociones, memoria, relaciones, trabajo y economía, y el mundo
reacciona a eventos emergentes (epidemias, crisis económicas, migraciones, clima, innovación).

El **mundo se expande con la población**: empieza como un pequeño asentamiento iluminado
rodeado de niebla, y a medida que llegan más NPCs el área explorada crece y aparecen nuevos
edificios en la frontera (casas, tiendas, oficinas, granjas). Cada tipo de edificio —casa,
hospital, escuela, granja, oficina, tienda— tiene su propio diseño en pixel-art.

---

## 📁 Estructura del proyecto

```
simulacion/
├── main.py                # Servidor FastAPI (WebSocket + REST) y bucle de simulación
├── world.py               # Núcleo ECS (entidades, componentes, consultas)
├── components.py          # Dataclasses de componentes
├── systems.py             # Todos los sistemas de simulación
├── world_serializer.py    # Guardado/carga del mundo
├── terrain_generator.py   # Generación procedural de terreno
├── requirements.txt       # Dependencias Python
├── README.md              # Este archivo
├── .claude/               # Configuración de Claude Code (skills + agentes + reglas)
├── saves/                 # Partidas guardadas (JSON)
├── .venv/                 # Entorno virtual de Python
└── client/                # Frontend React + PixiJS
    ├── package.json
    ├── vite.config.js     # Proxy /ws y /api → backend :8000
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── hooks/useWebSocket.js
        ├── store/WorldState.js
        ├── components/     # HUD, InfoPanel, Minimap, PixiCanvas, Notifications, AdminPanel
        └── pixi/           # GameScene, Tilemap, SpriteManager, LightingSystem, ...
```

---

## ✅ Requisitos

- **Python 3.11+** (el proyecto viene con un entorno virtual en `.venv/`)
- **Node.js 18+** y npm (para el cliente)

---

## 🚀 Instalación

### Backend (Python)

El proyecto ya incluye un entorno virtual en `.venv/`. Para instalar/actualizar dependencias:

```powershell
# Windows PowerShell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

> **Importante:** usa siempre el Python del venv (`.\.venv\Scripts\python.exe`).
> Si lanzas el servidor con el Python global, es posible que `websockets` no esté
> instalado ahí y el WebSocket no funcione. (Ver *Solución de problemas*.)

### Frontend (React)

```powershell
cd client
npm install
```

---

## ▶️ Ejecución

### Modo desarrollo (recomendado)

Necesitas **dos terminales**:

**Terminal 1 — Backend:**
```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

**Terminal 2 — Frontend (Vite con hot-reload):**
```powershell
cd client
npm run dev
```

Abre **http://localhost:5173**. Vite redirige `/ws` y `/api` al backend en `:8000`
mediante su proxy (ver `client/vite.config.js`).

### Modo producción (un solo servidor)

```powershell
# 1. Compilar el cliente
cd client
npm run build      # genera client/dist/

# 2. Servir todo desde FastAPI
cd ..
.\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Abre **http://localhost:8000** (FastAPI sirve `client/dist/` automáticamente si existe).

### 🎮 Controles del mapa
- **Arrastrar** con el ratón (o el dedo) → mover la cámara por el mundo.
- **Rueda del ratón** → acercar / alejar (zoom). Aleja para ver la frontera explorada y la niebla.
- **Clic en un NPC** → ver su ficha en vivo: **conversaciones con otros NPCs** (con quién habló, sobre qué y el impacto emocional), con quién habla **ahora mismo**, relaciones (por nombre), necesidades, emociones, personalidad y memoria.

---

## 🔌 API

### WebSocket
- `ws://localhost:8000/ws` — streaming del estado del mundo.
  - Al conectar recibe el **estado completo** (`{full: true, entities: [...]}`) y el **terreno**.
  - Luego recibe **deltas** (`{changed: {...}, removed: [...], tick, time, day, weather, ...}`).
  - Comandos del cliente → servidor (JSON): `set_speed`, `pause`, `resume`, `get_info`.

### REST
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET  | `/api/stats`        | Estadísticas globales del mundo |
| GET  | `/api/npcs`         | Lista resumida de NPCs |
| GET  | `/api/npc/{id}`     | Detalle completo de un NPC |
| POST | `/api/npc/create`   | Crear un NPC (body opcional: name, age, sex, profession, x, y) |
| DELETE | `/api/npc/{id}`   | Eliminar un NPC |
| PATCH | `/api/npc/{id}`    | Modificar un atributo escalar (body: attr, value, component?) |
| GET  | `/api/terrain`      | Datos del terreno |
| GET  | `/api/weather`      | Clima actual |
| GET  | `/api/events`       | Eventos globales recientes |
| GET  | `/api/innovations`  | Innovaciones descubiertas |
| GET  | `/api/saves`        | Lista de partidas guardadas |
| POST | `/api/save`         | Guardar el mundo |
| POST | `/api/load?filename=...` | Cargar un mundo |
| POST | `/api/reset`        | Reiniciar el mundo |
| POST | `/api/admin/trigger_event?event_type=...` | Disparar un evento |

**Eventos disponibles** (`event_type`): `epidemic`, `economic_crisis`, `migration`,
`storm`, `drought`, `miracle`, `party`.

---

## 🤖 Herramientas de Claude Code

Este proyecto incluye configuración de **Claude Code** en `.claude/`:

### Skills (`.claude/skills/`)
| Skill | Propósito |
|-------|-----------|
| **sim-runner** | Ejecutar/gestionar la simulación (start, stop, restart, status, logs, build, dev) |
| **sim-debug**  | Diagnosticar y reparar problemas (check, fix-deps, fix-websocket, test-connection) |
| **sim-world**  | Gestionar el mundo (save, load, reset, stats, list-saves) |
| **sim-npc**    | Inspeccionar NPCs (list, info) |
| **sim-event**  | Disparar eventos (epidemic, crisis, migration, storm, miracle, party) |

### Agentes (`.claude/agents/`)
- **arquitecto-simulacion** — diseño de sistemas ECS (`systems.py`, `world.py`, `components.py`)
- **frontend-developer** — React/PixiJS, renderizado, rendimiento
- **devops-infra** — servidor, WebSocket, dependencias, persistencia
- **qa-tester** — pruebas, verificación de logs, detección de bugs

---

## 🛠️ Solución de problemas

### "El WebSocket no se conecta" / "uvicorn no detecta websockets"

Este síntoma tiene **dos causas** frecuentes:

1. **Estás lanzando el servidor con el Python equivocado.** Si ejecutas `python main.py`
   con el Python global (en vez del `.venv`), es posible que ahí no estén instaladas
   `uvicorn`/`websockets`. **Solución:** usa siempre `.\.venv\Scripts\python.exe -m uvicorn main:app`.

2. **Error de serialización en el servidor** (la conexión se abre y se cae al instante).
   Si el estado del mundo contiene objetos que `json.dumps` no sabe convertir (p. ej.
   dataclasses anidadas como `MemoryEntry`), el handler del WebSocket lanza una excepción
   y cierra la conexión — desde el navegador parece "no conecta". **Solución (ya aplicada):**
   `main.py` serializa cada componente con `dataclasses.asdict()` mediante el helper
   `component_to_dict()`, que convierte recursivamente cualquier dataclass anidada.

Para diagnosticar rápido, usa la skill **sim-debug** (`sim check` / `sim fix-websocket`).

### La página se queda en blanco / "WebSocket cerrado, reconectando..." en bucle

Si el WebSocket **conecta** pero la web se queda en blanco y el WS se cierra y reconecta
en bucle, casi seguro es un **error de render de PixiJS** que tumba el árbol de React
(al desmontarse, se cierra el WebSocket). Revisa la consola del navegador: si ves algo
como `X is not a function` o `Texture Error: frame does not fit...`, es un fallo de la capa
de render, no del WebSocket. La app incluye un **ErrorBoundary** que evita que un fallo de
render deje toda la página en blanco.

### No veo nada al abrir http://localhost:8000

El servidor solo sirve la interfaz web si existe `client/dist/`. **Compila el cliente primero**
(`cd client && npm run build`) y reinicia el servidor. En desarrollo, abre
**http://localhost:5173** (Vite) en su lugar. Verifica también que el servidor esté corriendo
(`sim status`).

---

## ☁️ Despliegue en la web (Render)

El proyecto incluye un [Dockerfile](Dockerfile) multi-etapa (compila el cliente y arranca
el servidor) y un blueprint [render.yaml](render.yaml). Vercel **no** sirve para este
backend: la simulación necesita un proceso continuo y WebSockets persistentes, cosas que
el modelo serverless no ofrece.

Pasos (una sola vez):
1. Entra en [render.com](https://render.com) y regístrate con tu cuenta de GitHub.
2. **New + → Blueprint** → conecta el repo `rodrolira/simulacion-vida` → **Apply**.
3. Espera el build (~5 min). Tu simulación quedará en `https://simulacion-vida.onrender.com`.

Cada `git push` a `main` redespliega automáticamente.

Limitaciones del plan gratuito:
- El servicio **duerme tras ~15 min sin visitas** y tarda ~1 min en despertar.
- El estado vive en memoria y el disco es efímero: al dormir o redesplegar,
  **el mundo se reinicia** (los guardados de `saves/` no persisten).

Probar la imagen Docker en local:
```powershell
docker build -t simulacion-vida .
docker run --rm -p 8000:8000 simulacion-vida   # → http://localhost:8000
```

---

## 🧪 Tests

Tests unitarios simples (sin necesidad de servidor) en `tests/`:

```powershell
.\.venv\Scripts\python.exe -m tests.test_serialization   # regresión del fix de WebSocket
.\.venv\Scripts\python.exe -m tests.test_epidemic        # regresión del crash de epidemia
# o con pytest, si lo instalas:  .\.venv\Scripts\python.exe -m pytest tests/
```

---

## 📜 Convenciones del proyecto

- **Type hints** en todo el código Python nuevo.
- **Nunca** modificar `systems.py` sin revisar antes todas sus dependencias.
- **Siempre** verificar que el servidor arranca tras cualquier cambio.
- Mantener el **estilo pixel art** en el frontend.
