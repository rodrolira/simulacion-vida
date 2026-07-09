---
name: sim-debug
description: Diagnostica y repara problemas de la simulación (dependencias, puertos, WebSocket, conexión). Úsala cuando el WebSocket no conecte, el servidor falle al arrancar, falten dependencias, o el usuario quiera un chequeo de salud del entorno.
---

# sim-debug — Diagnóstico y reparación

Python del venv: `.\.venv\Scripts\python.exe`. Servidor en el puerto **8000**.

## Comandos

### `sim check` — Chequeo de salud (dependencias, puertos, imports)
```powershell
$py = ".\.venv\Scripts\python.exe"
Write-Output "== Python =="; & $py --version
Write-Output "== Dependencias clave =="; & $py -m pip list | Select-String "fastapi|uvicorn|websockets|wsproto|starlette"
Write-Output "== Importa main.py? =="; & $py -c "import main; print('main OK')"
Write-Output "== Puerto 8000 =="; if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) { "ocupado (servidor corriendo)" } else { "libre" }
```

### `sim fix-deps` — Instalar/reinstalar dependencias
```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt --upgrade
```
Para el cliente: `cd client; npm install; cd ..`

### `sim fix-websocket` — Diagnóstico y reparación del WebSocket
El síntoma "el WebSocket no conecta" tiene **dos causas** habituales. Compruébalas EN ORDEN:

1. **Python equivocado / librería ausente.** Verifica que el venv importa `websockets`:
   ```powershell
   .\.venv\Scripts\python.exe -c "import websockets, wsproto; print('ws', websockets.__version__)"
   ```
   Si falla → `sim fix-deps`. Y asegúrate de lanzar SIEMPRE con `.\.venv\Scripts\python.exe -m uvicorn ...`,
   nunca con `python main.py` del sistema.

2. **Crash de serialización JSON en el servidor** (la conexión se abre y se cierra al instante).
   Arranca el servidor, mira `logs\server.log` y busca `is not JSON serializable`. Causa típica:
   `serialize_entity`/`get_changed_entities` usan `.__dict__` en vez de convertir las dataclasses
   anidadas (`MemoryEntry`, `Relationship`). **Solución:** serializar cada componente con
   `dataclasses.asdict()` (helper `component_to_dict()` en `main.py`). Verifica que estos tres
   puntos usen el helper: `serialize_entity`, `get_changed_entities` y el handler `get_info`.

Tras cualquier arreglo, ejecuta `sim test-connection`.

### `sim test-connection` — Probar el WebSocket end-to-end
Requiere el servidor corriendo (`sim start`). Guarda este script en `logs\ws_probe.py`
y ejecútalo con el venv (`.\.venv\Scripts\python.exe logs\ws_probe.py`):
```python
import asyncio, json, websockets
async def t():
    async with websockets.connect("ws://127.0.0.1:8000/ws") as ws:
        full = json.loads(await asyncio.wait_for(ws.recv(), 5))
        print("OK: entidades =", len(full.get("entities", [])))
asyncio.run(t())
```
Salida esperada: `OK: entidades = 8` (o el número de NPCs). Si lanza `ConnectionClosedError`,
revisa `logs\server.log` (probable crash de serialización → ver `sim fix-websocket`).
