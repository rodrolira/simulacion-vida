# Simulación de Vida Multiagente — Guía para Claude Code

Simulación ECS en Python (FastAPI + WebSocket) con frontend React + PixiJS (pixel art).

## Cómo ejecutar (entorno)
- Usa SIEMPRE el Python del venv: `.\.venv\Scripts\python.exe`. **Nunca** `python main.py` con
  el intérprete global (allí puede faltar `websockets` → falso "uvicorn no detecta websockets").
- Arrancar servidor: `.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000`
- Cliente dev: `cd client; npm run dev` (Vite en :5173, con proxy `/ws` y `/api` → :8000)
- Build: `cd client; npm run build` (genera `client/dist/`, servido por FastAPI en producción)

## Reglas del proyecto (obligatorias)
1. **NUNCA modificar `systems.py`** sin antes revisar TODAS sus dependencias (Grep en
   `systems.py`, `main.py`, `world_serializer.py`, y el orden de `run_tick()`).
2. **SIEMPRE probar que el servidor arranca** tras cualquier cambio
   (`.\.venv\Scripts\python.exe -c "import main"`) y, si afecta al WS, probar la conexión.
3. **Type hints** en todo el código Python.
4. **Estilo pixel art** en el frontend: nada que rompa la estética pixelada.
5. **Documentar** cada skill/comando nuevo y **crear tests simples** para verificar funcionalidad.

## Serialización (¡importante!)
El estado se envía por WebSocket como JSON. Los componentes con dataclasses anidadas
(`Memory.entries` → `MemoryEntry`, `Relationships.relations` → `Relationship`) **no** se pueden
serializar con `.__dict__`. Usa el helper `component_to_dict()` de `main.py`
(basado en `dataclasses.asdict()`) en `serialize_entity`, `get_changed_entities` y `get_info`.
No reintroduzcas `.__dict__` crudo: causa `TypeError: ... is not JSON serializable` y cierra el WS.

## Skills disponibles (.claude/skills/)
`sim-runner` (ejecutar), `sim-debug` (diagnosticar/reparar), `sim-world` (mundo),
`sim-npc` (inspeccionar NPCs), `sim-event` (disparar eventos).

## Agentes (.claude/agents/)
`arquitecto-simulacion` (ECS/systems), `frontend-developer` (React/PixiJS),
`devops-infra` (servidor/WS/deps), `qa-tester` (pruebas/reportes).

## Permisos recomendados (opcional)
Para reducir prompts, puedes añadir a tu `settings.json` reglas de permiso para
`.\.venv\Scripts\python.exe`, `Invoke-RestMethod`, `npm run build/dev/install`, etc.
(o ejecuta `/fewer-permission-prompts`). No se incluyen por defecto para no ampliar permisos sin tu revisión.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
