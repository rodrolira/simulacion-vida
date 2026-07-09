---
name: sim-runner
description: Ejecuta y gestiona el servidor de la simulación multiagente (start, stop, restart, status, logs, build, dev). Úsala cuando el usuario quiera arrancar, detener, reiniciar o comprobar el estado del servidor, compilar el cliente React, o levantar el modo desarrollo.
---

# sim-runner — Ejecutar y gestionar la simulación

Servidor: **FastAPI + uvicorn** en el puerto **8000**. Cliente: **Vite** en el **5173**.
Usa SIEMPRE el Python del entorno virtual: `.\.venv\Scripts\python.exe`.

Los logs y el PID se guardan en `logs/` (créala si no existe).

## Comandos

### `sim start` — Iniciar el servidor Python
```powershell
if (-not (Test-Path logs)) { New-Item -ItemType Directory logs | Out-Null }
$p = Start-Process -FilePath ".\.venv\Scripts\python.exe" `
  -ArgumentList "-m","uvicorn","main:app","--host","127.0.0.1","--port","8000","--log-level","info" `
  -RedirectStandardOutput "logs\server_out.log" -RedirectStandardError "logs\server.log" -NoNewWindow -PassThru
$p.Id | Out-File logs\server.pid -Encoding ascii
Write-Output "Servidor iniciado (PID $($p.Id)) en http://localhost:8000"
```
Espera ~3s y verifica con `sim status`. Confirma que `logs\server.log` no contenga `ERROR`/`Traceback`.

### `sim stop` — Detener el servidor
```powershell
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  Where-Object { $_.CommandLine -like '*uvicorn*main:app*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force; "Detenido PID $($_.ProcessId)" }
```

### `sim restart` — Reiniciar
Ejecuta `sim stop`, espera 1s y luego `sim start`.

### `sim status` — ¿Está corriendo?
```powershell
$proc = Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -like '*uvicorn*main:app*' }
$port = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($proc) { "CORRIENDO — PID $($proc.ProcessId)" } else { "DETENIDO" }
if ($port) { "Puerto 8000: escuchando" } else { "Puerto 8000: libre" }
```

### `sim logs` — Ver logs recientes
```powershell
if (Test-Path logs\server.log) { Get-Content logs\server.log -Tail 40 } else { "No hay logs todavía." }
```

### `sim build` — Compilar el cliente React
```powershell
cd client; npm run build; cd ..
```
Genera `client/dist/`, que FastAPI sirve automáticamente en producción.

### `sim dev` — Modo desarrollo (servidor + Vite)
Requiere dos procesos. Arranca el backend con `sim start` y luego:
```powershell
cd client; npm run dev
```
Abre **http://localhost:5173** (el proxy de Vite redirige `/ws` y `/api` al backend).

## Notas
- Si el servidor no arranca, revisa `logs\server.log` y usa la skill **sim-debug**.
- No lances `python main.py` con el Python global: puede no tener `websockets` instalado.
