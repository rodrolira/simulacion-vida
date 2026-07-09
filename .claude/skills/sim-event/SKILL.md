---
name: sim-event
description: Dispara eventos globales en la simulación (epidemia, crisis económica, migración, tormenta, milagro, fiesta). Úsala cuando el usuario quiera provocar un evento en el mundo. Requiere el servidor corriendo.
---

# sim-event — Disparar eventos en la simulación

Usa el endpoint `POST /api/admin/trigger_event?event_type=...` del servidor (puerto **8000**),
que debe estar corriendo (`sim start`).

## Comandos

### `sim event epidemic` — Iniciar una epidemia
```powershell
Invoke-RestMethod -Method Post "http://localhost:8000/api/admin/trigger_event?event_type=epidemic"
```

### `sim event crisis` — Crisis económica
```powershell
Invoke-RestMethod -Method Post "http://localhost:8000/api/admin/trigger_event?event_type=economic_crisis"
```

### `sim event migration` — Migración de NPCs
```powershell
Invoke-RestMethod -Method Post "http://localhost:8000/api/admin/trigger_event?event_type=migration"
```

### `sim event storm` — Tormenta
```powershell
Invoke-RestMethod -Method Post "http://localhost:8000/api/admin/trigger_event?event_type=storm"
```

### `sim event miracle` — Curar a todos los enfermos
```powershell
Invoke-RestMethod -Method Post "http://localhost:8000/api/admin/trigger_event?event_type=miracle"
```

### `sim event party` — Aumentar la felicidad global
```powershell
Invoke-RestMethod -Method Post "http://localhost:8000/api/admin/trigger_event?event_type=party"
```

## Eventos extra soportados por el backend
- `drought` — sequía (afecta producción de comida).

## Notas
- Tras disparar un evento, obsérvalo con `sim world stats` o en `/api/events`:
  ```powershell
  Invoke-RestMethod http://localhost:8000/api/events
  ```
- La respuesta `{status: "ok", message: "Evento X disparado"}` confirma el disparo.
- Los tipos válidos están en el diccionario `event_handlers` dentro de `trigger_event` en `main.py`.
