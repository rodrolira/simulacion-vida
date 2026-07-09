---
name: sim-world
description: Gestiona el estado del mundo de la simulación (guardar, cargar, reiniciar, estadísticas, listar partidas). Úsala cuando el usuario quiera guardar/cargar el mundo, reiniciarlo o consultar estadísticas globales. Requiere el servidor corriendo.
---

# sim-world — Gestión del mundo

Todas estas operaciones usan los endpoints REST del servidor (puerto **8000**), así que
el servidor debe estar corriendo (`sim start`). Los guardados van a la carpeta `saves/`.

Usa `Invoke-RestMethod` de PowerShell.

## Comandos

### `sim world stats` — Estadísticas globales
```powershell
Invoke-RestMethod http://localhost:8000/api/stats | Format-List
```
Devuelve: tick, día, hora, nº de NPCs, edificios, tiendas, felicidad media, economía total, enfermos.

### `sim world list-saves` — Listar partidas guardadas
```powershell
Invoke-RestMethod http://localhost:8000/api/saves
```

### `sim world save` — Guardar el estado actual
```powershell
Invoke-RestMethod -Method Post http://localhost:8000/api/save
# con nombre concreto:
Invoke-RestMethod -Method Post "http://localhost:8000/api/save?filename=mi_partida.json"
```

### `sim world load <file>` — Cargar un estado
```powershell
Invoke-RestMethod -Method Post "http://localhost:8000/api/load?filename=<file>"
```
(`<file>` debe ser uno de los que aparecen en `sim world list-saves`.)

### `sim world reset` — Reiniciar el mundo
```powershell
Invoke-RestMethod -Method Post http://localhost:8000/api/reset
```
Recrea el mundo desde cero (10 edificios + 8 NPCs) con terreno nuevo.

## Notas
- El servidor autoguarda periódicamente (ver `AUTO_SAVE_INTERVAL` en `world_serializer.py`).
- Si un comando devuelve error de conexión, verifica el servidor con `sim status`.
