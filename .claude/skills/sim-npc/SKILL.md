---
name: sim-npc
description: Inspecciona y modifica NPCs de la simulación (listar, ver detalle, crear, eliminar, modificar atributos). Úsala cuando el usuario quiera ver, crear, eliminar o editar NPCs. Requiere el servidor corriendo.
---

# sim-npc — Inspección y modificación de NPCs

Usa los endpoints REST del servidor (puerto **8000**), que debe estar corriendo (`sim start`).

## Lectura

### `sim npc list` — Listar todos los NPCs
```powershell
Invoke-RestMethod http://localhost:8000/api/npcs | Format-Table id, name, age, profession, is_sick, happiness
```
Devuelve id, nombre, edad, sexo, profesión, posición, si está enfermo y felicidad.

### `sim npc info <id>` — Detalle completo de un NPC
```powershell
Invoke-RestMethod http://localhost:8000/api/npc/<id> | ConvertTo-Json -Depth 6
```
Devuelve todos los componentes del NPC (Identity, Position, Needs, Personality, Emotions,
Memory, Relationships, Wallet, Profession, Health, ...).

## Escritura

### `sim npc create` — Crear un NPC nuevo
Todos los campos del body son opcionales (se rellenan con valores razonables/aleatorios):
`name, age, sex, profession, culture, x, y`.
```powershell
$body = @{ name="Nadia"; age=29; profession="programmer"; x=100; y=75 } | ConvertTo-Json
Invoke-RestMethod -Method Post http://localhost:8000/api/npc/create -Body $body -ContentType "application/json"
```
Profesiones con salario definido: `doctor, teacher, farmer, programmer, trader, unemployed`.
Devuelve `{status, id, npc}` con el NPC recién creado serializado.

### `sim npc kill <id>` — Eliminar un NPC
```powershell
Invoke-RestMethod -Method Delete http://localhost:8000/api/npc/<id>
```
Elimina la entidad y limpia las referencias colgantes en las relaciones de los demás.
El frontend retira el sprite automáticamente (se reporta en el `removed` del siguiente delta).

### `sim npc modify <id> <attr> <value>` — Modificar un atributo escalar
```powershell
# sin componente: busca el atributo en los componentes modificables
$body = @{ attr="happiness"; value=90 } | ConvertTo-Json
Invoke-RestMethod -Method Patch http://localhost:8000/api/npc/<id> -Body $body -ContentType "application/json"

# con componente explícito (recomendado si el atributo existe en varios)
$body = @{ component="Health"; attr="is_sick"; value=$true } | ConvertTo-Json
Invoke-RestMethod -Method Patch http://localhost:8000/api/npc/<id> -Body $body -ContentType "application/json"
```
Componentes modificables: `Identity, Position, Needs, Personality, Emotions, Wallet,
Profession, Health, Schedule`. Solo atributos **escalares** (no se pueden editar Memory,
Relationships, Inventory ni ActionState por su estructura anidada). El valor se castea al
tipo actual del atributo; los sistemas reajustan rangos (p. ej. `Emotions` se clampa a 0-100).

## Notas
- Todas las operaciones de escritura están serializadas con un lock para no chocar con el
  bucle de simulación.
- Errores: `404` si el NPC no existe, `400` si el atributo/valor es inválido.
