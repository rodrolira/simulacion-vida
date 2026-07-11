# main.py
import asyncio
import concurrent.futures
import dataclasses
import importlib
import random
import json
import os

try:
    fastapi = importlib.import_module("fastapi")
    FastAPI = fastapi.FastAPI
    WebSocket = fastapi.WebSocket
    WebSocketDisconnect = fastapi.WebSocketDisconnect
    HTTPException = fastapi.HTTPException
    StaticFiles = importlib.import_module("fastapi.staticfiles").StaticFiles
    responses = importlib.import_module("fastapi.responses")
    FileResponse = responses.FileResponse
    JSONResponse = responses.JSONResponse
except ImportError as e:
    raise ImportError("FastAPI is required to run this application. Install it with 'pip install fastapi[all]'") from e

from world import World
from components import (
    ActionState, Bed, Building, Disease, Emotions,
    Health, Identity, Inventory, Memory, Needs,
    Personality, Position, Profession, Relationships,
    Residence, Schedule, Shop, Wallet, Workplace
)
from systems import (
    TimeSystem, NeedSystem, PerceptionSystem, EmotionSystem,
    UtilityAISystem, MovementSystem, WorkSystem, ActionExecutionSystem,
    RelationshipSystem, SalarySystem, MemoryDecaySystem, ScheduleSystem,
    EpidemicSystem, EconomicEventSystem, MigrationSystem,
    InnovationSystem, WeatherSystem, GlobalEventLogger
)
from world_serializer import WorldSerializer
from terrain_generator import TerrainGenerator
from pathlib import Path


# ------------------------------------------------------------
# Configuración de FastAPI
# ------------------------------------------------------------
app = FastAPI(title="Simulación de Vida Multiagente")

# ------------------------------------------------------------
# Inicialización del mundo y sistemas
# ------------------------------------------------------------
world = World()
serializer = WorldSerializer()

# Generar terreno
terrain_gen = TerrainGenerator(width=200, height=150)
terrain_data = None

# Instanciar todos los sistemas
time_sys = TimeSystem()
need_sys = NeedSystem()
perc_sys = PerceptionSystem()
emot_sys = EmotionSystem()
util_sys = UtilityAISystem()
mov_sys = MovementSystem()
work_sys = WorkSystem()
act_sys = ActionExecutionSystem()
rel_sys = RelationshipSystem()
sal_sys = SalarySystem()
mem_sys = MemoryDecaySystem()
sched_sys = ScheduleSystem()

# Fase 10: Sistemas de eventos emergentes
epidemic_sys = EpidemicSystem()
economic_sys = EconomicEventSystem()
migration_sys = MigrationSystem()
innovation_sys = InnovationSystem()
weather_sys = WeatherSystem()
event_logger = GlobalEventLogger()

# Pasar referencia del mundo al sistema de utilidad
util_sys.world = world

# ------------------------------------------------------------
# Estado para transmisión WebSocket
# ------------------------------------------------------------
clients: list[WebSocket] = []

# Serializa las mutaciones del mundo: el tick corre en un hilo del executor y los
# endpoints corren en el event loop. Sin este lock, mutar el mundo desde un endpoint
# (crear/eliminar NPC, reset, load, eventos) mientras run_tick itera sus diccionarios
# puede provocar "dictionary changed size during iteration" u otras condiciones de carrera.
world_lock = asyncio.Lock()

# Estado de simulación
simulation_running = True
simulation_speed = 1.0  # multiplicador de velocidad (1x, 2x, 10x)
BASE_TICK_INTERVAL = 0.1  # 100ms = 10 TPS

# Estado previo para cambios
prev_state = {}

# ------------------------------------------------------------
# Expansión del mundo: el área explorada crece con la población
# ------------------------------------------------------------
WORLD_W, WORLD_H = 200, 150
WORLD_CX, WORLD_CY = 100, 75
INIT_HALF_W, INIT_HALF_H = 26, 20          # semi-extensión inicial (mundo pequeño)
GROW_W_PER_NPC, GROW_H_PER_NPC = 1.8, 1.35  # cuánto crece por NPC
INITIAL_BUILDINGS = 10
NPCS_PER_NEW_BUILDING = 4                   # 1 edificio nuevo cada N NPCs
MAX_BUILDINGS = 40

# Contadores para nombrar los edificios nuevos (se reinician en init_world)
_building_counter = {"house": 4, "shop": 2, "office": 1, "farm": 1}


def compute_world_bounds(npc_count: int) -> dict:
    """Rectángulo del mundo explorado según la población (crece al haber más NPCs)."""
    hw = min(WORLD_W / 2, INIT_HALF_W + npc_count * GROW_W_PER_NPC)
    hh = min(WORLD_H / 2, INIT_HALF_H + npc_count * GROW_H_PER_NPC)
    return {
        "minX": max(0, round(WORLD_CX - hw)),
        "maxX": min(WORLD_W, round(WORLD_CX + hw)),
        "minY": max(0, round(WORLD_CY - hh)),
        "maxY": min(WORLD_H, round(WORLD_CY + hh)),
    }


# Límites del mundo explorado (se actualizan cada tick según la población)
world_bounds = compute_world_bounds(0)


# ------------------------------------------------------------
# Inicialización del mundo
# ------------------------------------------------------------
def init_world():
    """Crea el mundo inicial con edificios, NPCs y recursos."""
    global terrain_data, world_bounds

    # Generar terreno
    terrain_data = terrain_gen.generate()

    # Reiniciar contadores de nombres y límites (el mundo empieza pequeño y crece)
    _building_counter.update({"house": 4, "shop": 2, "office": 1, "farm": 1})
    world_bounds = compute_world_bounds(0)

    # Edificios iniciales AGRUPADOS en el centro: el asentamiento crece desde aquí.
    b0 = compute_world_bounds(0)
    building_positions = []
    for _ in range(10):
        while True:
            x = random.randint(b0["minX"] + 2, b0["maxX"] - 2)
            y = random.randint(b0["minY"] + 2, b0["maxY"] - 2)
            tile = terrain_data["tiles"][y][x] if y < len(terrain_data["tiles"]) else "grass"
            if tile not in ("water", "mountain"):
                building_positions.append((x, y))
                break

    # --- Edificios ---
    hospital = world.create_entity()
    world.add_component(hospital, Position(building_positions[0][0], building_positions[0][1]))
    world.add_component(hospital, Building("hospital", "Hospital Central", 20))

    school = world.create_entity()
    world.add_component(school, Position(building_positions[1][0], building_positions[1][1]))
    world.add_component(school, Building("school", "Escuela Primaria", 30))

    farm = world.create_entity()
    world.add_component(farm, Position(building_positions[2][0], building_positions[2][1]))
    world.add_component(farm, Building("farm", "Granja El Sol", 10))

    office = world.create_entity()
    world.add_component(office, Position(building_positions[3][0], building_positions[3][1]))
    world.add_component(office, Building("office", "Tech Hub", 15))

    shop1 = world.create_entity()
    world.add_component(shop1, Position(building_positions[4][0], building_positions[4][1]))
    world.add_component(shop1, Building("shop", "Tienda 1", 5))
    world.add_component(shop1, Shop(price_per_unit=8 + random.uniform(0, 5), stock=50))

    shop2 = world.create_entity()
    world.add_component(shop2, Position(building_positions[5][0], building_positions[5][1]))
    world.add_component(shop2, Building("shop", "Tienda 2", 5))
    world.add_component(shop2, Shop(price_per_unit=10 + random.uniform(0, 3), stock=40))

    # Casas con camas
    houses: list[int] = []
    for i in range(6, 10):
        e = world.create_entity()
        world.add_component(e, Position(building_positions[i][0], building_positions[i][1]))
        world.add_component(e, Building("house", f"Casa {i-5}", 4))
        world.add_component(e, Bed(comfort=1.2))
        houses.append(e)

    # --- NPCs ---
    npc_configs = [
        {"name": "Alice", "sex": "female", "age": 28, "profession": "doctor", "workplace": hospital, "shift": (8, 17), "pos": (90, 68)},
        {"name": "Bob", "sex": "male", "age": 35, "profession": "teacher", "workplace": school, "shift": (8, 16), "pos": (110, 66)},
        {"name": "Carlos", "sex": "male", "age": 42, "profession": "farmer", "workplace": farm, "shift": (6, 14), "pos": (100, 84)},
        {"name": "Diana", "sex": "female", "age": 26, "profession": "programmer", "workplace": office, "shift": (9, 18), "pos": (84, 78)},
        {"name": "Elena", "sex": "female", "age": 31, "profession": "trader", "workplace": shop1, "shift": (9, 17), "pos": (116, 80)},
        {"name": "Frank", "sex": "male", "age": 45, "profession": "unemployed", "workplace": None, "shift": (0, 0), "pos": (100, 75)},
        {"name": "Gloria", "sex": "female", "age": 22, "profession": "teacher", "workplace": school, "shift": (9, 17), "pos": (94, 64)},
        {"name": "Hector", "sex": "male", "age": 38, "profession": "farmer", "workplace": farm, "shift": (6, 14), "pos": (108, 86)},
    ]

    salaries = {
        "doctor": 150, "teacher": 90, "farmer": 70,
        "programmer": 200, "trader": 100, "unemployed": 15
    }

    for idx, cfg in enumerate(npc_configs):
        e = world.create_entity()

        # Cada NPC vive en una casa (round-robin entre las 4 iniciales)
        world.add_component(e, Residence(building_id=houses[idx % len(houses)]))

        world.add_component(e, Identity(
            name=cfg["name"], age=cfg["age"], sex=cfg["sex"],
            culture=random.choice(["urban", "rural", "coastal"]),
            education=random.uniform(0.3, 0.9)
        ))

        world.add_component(e, Position(cfg["pos"][0], cfg["pos"][1]))

        world.add_component(e, Needs(
            hunger=random.uniform(40, 90),
            energy=random.uniform(50, 100),
            social=random.uniform(30, 70)
        ))

        world.add_component(e, Personality(
            extroversion=random.uniform(-1, 1),
            ambition=random.uniform(-1, 1),
            generosity=random.uniform(-1, 1),
            honesty=random.uniform(-1, 1),
            patience=random.uniform(-1, 1),
            aggressiveness=random.uniform(-1, 1),
            empathy=random.uniform(-1, 1),
            curiosity=random.uniform(-1, 1)
        ))

        world.add_component(e, Emotions(
            happiness=random.uniform(40, 70),
            motivation=random.uniform(40, 70)
        ))

        world.add_component(e, Relationships())
        world.add_component(e, Memory())
        world.add_component(e, ActionState(facing=random.choice(["down", "up", "left", "right"])))
        world.add_component(e, Inventory())
        world.add_component(e, Wallet(cash=random.uniform(50, 300), bank=random.uniform(0, 500)))

        prof_type = cfg["profession"]
        salary = salaries[prof_type]
        world.add_component(e, Profession(type=prof_type, salary=salary, skill_level=random.uniform(0.5, 1.5)))

        if cfg["workplace"] is not None:
            world.add_component(e, Workplace(
                building_id=cfg["workplace"],
                profession_type=prof_type,
                shift_start=cfg["shift"][0],
                shift_end=cfg["shift"][1]
            ))

        world.add_component(e, Schedule(
            phase="free",
            wake_up=6 + random.randint(0, 2),
            sleep=22 + random.randint(0, 2)
        ))

        is_sick = random.random() < 0.1
        world.add_component(e, Health(
            is_sick=is_sick,
            sickness_severity=random.uniform(10, 40) if is_sick else 0.0
        ))

    print(f"[INIT] Mundo inicializado: {len(npc_configs)} NPCs, 10 edificios")


# ------------------------------------------------------------
# Serialización para WebSocket
# ------------------------------------------------------------
def component_to_dict(comp) -> dict:
    """Serializa un componente (dataclass) a un dict 100% JSON-safe.

    Usa dataclasses.asdict() para convertir recursivamente cualquier dataclass
    anidada (p. ej. MemoryEntry dentro de Memory.entries, o Relationship dentro
    de Relationships.relations). Esto evita el TypeError
    "Object of type X is not JSON serializable" al hacer json.dumps().
    """
    data = dataclasses.asdict(comp)
    if type(comp).__name__ == "ActionState":
        data["moving"] = "moving" in data.get("action", "")
    return data


def serialize_entity(eid):
    """Convierte una entidad a un diccionario con sus componentes."""
    comps = {}
    for comp_type, comp_dict in world._components.items():
        if eid in comp_dict:
            comps[comp_type.__name__] = component_to_dict(comp_dict[eid])
    return {"id": eid, "components": comps}


def get_all_entities():
    """Obtiene todas las entidades serializadas."""
    entities = []
    for eid in world._entity_components:
        serialized = serialize_entity(eid)
        if serialized["components"]:
            entities.append(serialized)
    return entities


def get_changed_entities():
    """Compara con el estado anterior y devuelve solo cambios."""
    global prev_state
    current = {}

    for eid in world._entity_components:
        comps = {}
        for comp_type, comp_dict in world._components.items():
            if eid in comp_dict:
                comps[comp_type.__name__] = component_to_dict(comp_dict[eid])
        if comps:
            current[eid] = comps

    changed = {}
    for eid, comps in current.items():
        if eid not in prev_state or prev_state[eid] != comps:
            changed[eid] = comps

    removed = [eid for eid in prev_state if eid not in current]
    prev_state = current

    # Eventos globales recientes
    recent_events = event_logger.get_recent_events(5)
    events_data = [{
        "tick": e.tick,
        "type": e.event_type,
        "description": e.description,
        "severity": e.severity
    } for e in recent_events]

    return {
        "changed": changed,
        "removed": removed,
        "tick": world.tick,
        "time": f"{time_sys.hour:02d}:{time_sys.minute:02d}",
        "day": time_sys.day,
        "speed": simulation_speed,
        "running": simulation_running,
        "weather": weather_sys.get_weather(),
        "global_events": events_data,
        "world_bounds": world_bounds,
    }


# ------------------------------------------------------------
# Broadcast a clientes WebSocket
# ------------------------------------------------------------
async def broadcast_state():
    """Envía cambios del mundo a todos los clientes conectados."""
    if not clients:
        return

    data = get_changed_entities()
    if not data["changed"] and not data["removed"]:
        return

    payload = json.dumps(data)
    disconnected = []
    for ws in clients:
        try:
            await ws.send_text(payload)
        except Exception:
            disconnected.append(ws)

    for ws in disconnected:
        if ws in clients:
            clients.remove(ws)


# ------------------------------------------------------------
# Recolección de eventos globales
# ------------------------------------------------------------
def collect_global_events():
    """Recolecta eventos globales de todos los sistemas."""
    for sys_obj in [epidemic_sys, economic_sys, migration_sys,
                    innovation_sys, weather_sys]:
        while hasattr(sys_obj, 'global_events') and sys_obj.global_events:
            event = sys_obj.global_events.pop(0)
            event_logger.add_event(event)


# ------------------------------------------------------------
# Expansión del asentamiento (el mundo crece con la población)
# ------------------------------------------------------------
def _spawn_frontier_building(x: int, y: int) -> None:
    """Crea un edificio nuevo del tipo adecuado en la frontera del asentamiento."""
    e = world.create_entity()
    world.add_component(e, Position(x, y))
    r = random.random()
    if r < 0.55:
        _building_counter["house"] += 1
        world.add_component(e, Building("house", f"Casa {_building_counter['house']}", 4))
        world.add_component(e, Bed(comfort=1.2))
    elif r < 0.75:
        _building_counter["shop"] += 1
        world.add_component(e, Building("shop", f"Tienda {_building_counter['shop']}", 5))
        world.add_component(e, Shop(price_per_unit=8 + random.uniform(0, 6), stock=random.randint(30, 60)))
    elif r < 0.88:
        _building_counter["office"] += 1
        world.add_component(e, Building("office", f"Oficina {_building_counter['office']}", 15))
    else:
        _building_counter["farm"] += 1
        world.add_component(e, Building("farm", f"Granja {_building_counter['farm']}", 10))


def _add_frontier_building() -> None:
    """Coloca un edificio en un punto válido dentro del área explorada actual."""
    b = world_bounds
    if b["maxX"] - b["minX"] < 6 or b["maxY"] - b["minY"] < 6:
        return
    tiles = terrain_data["tiles"] if terrain_data else None
    existing = [(world.get_component(e, Position).x, world.get_component(e, Position).y)
                for e in world.entities_with_components(Building, Position)]
    for _ in range(40):
        x = random.randint(b["minX"] + 2, b["maxX"] - 2)
        y = random.randint(b["minY"] + 2, b["maxY"] - 2)
        if tiles and tiles[y][x] in ("water", "mountain"):
            continue
        if any(abs(px - x) < 5 and abs(py - y) < 5 for px, py in existing):
            continue
        _spawn_frontier_building(x, y)
        return


def update_world_expansion() -> None:
    """Actualiza los límites explorados y hace crecer el asentamiento con la población."""
    global world_bounds
    npc_count = len(world.entities_with_components(Identity))
    world_bounds = compute_world_bounds(npc_count)

    target = INITIAL_BUILDINGS + npc_count // NPCS_PER_NEW_BUILDING
    current = world.count_entities_with_component(Building)
    if current < target and current < MAX_BUILDINGS:
        _add_frontier_building()  # como máximo uno por tick


# ------------------------------------------------------------
# Bucle principal de simulación
# ------------------------------------------------------------
def run_tick():
    """Ejecuta un tick completo de la simulación."""
    # 1. Avanzar tiempo
    time_sys.run(world)

    # 2. Asignar fases según horario
    sched_sys.run(world, time_sys)

    # 3. Decaer necesidades
    need_sys.run(world, time_sys)

    # 4. Percepción del entorno
    perc_sys.run(world)

    # 5. Actualizar emociones
    emot_sys.run(world)

    # 6. Toma de decisiones (utilidad AI)
    util_sys.run(world, time_sys)

    # 7. Movimiento hacia objetivos
    mov_sys.run(world)

    # 8. Ejecutar trabajo
    work_sys.run(world)

    # 9. Actualizar relaciones. DEBE ir ANTES de act_sys: ActionExecutionSystem._socialize
    #    resetea la acción a "idle", así que si rel_sys corriera después nunca vería a
    #    nadie socializando y no se crearían relaciones ni recuerdos de conversación.
    rel_sys.run(world)

    # 10. Ejecutar acciones
    act_sys.run(world, time_sys)

    # 11. Pagar salarios
    sal_sys.run(world)

    # 12. Decaimiento de memoria
    mem_sys.run(world)

    # 13. FASE 10: Sistemas de eventos emergentes
    epidemic_sys.run(world)
    economic_sys.run(world)
    migration_sys.run(world)
    innovation_sys.run(world)
    weather_sys.run(world)

    # 14. Recolectar eventos globales
    collect_global_events()

    # 14.5 Expandir el mundo/asentamiento según la población
    update_world_expansion()

    # 15. Autoguardado
    if world.tick % serializer.AUTO_SAVE_INTERVAL == 0 and world.tick > 0:
        try:
            serializer.save(world, time_sys)
        except Exception as e:
            print(f"[ERROR] Autoguardado fallido: {e}")


async def simulation_loop():
    """Bucle asíncrono que ejecuta ticks a velocidad variable."""
    global simulation_running

    loop = asyncio.get_event_loop()
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        while True:
            if simulation_running:
                async with world_lock:
                    await loop.run_in_executor(executor, run_tick)
                await broadcast_state()

            interval = BASE_TICK_INTERVAL / simulation_speed if simulation_speed > 0 else 0.1
            await asyncio.sleep(interval)


# ------------------------------------------------------------
# Endpoints WebSocket y HTTP
# ------------------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """Conexión WebSocket para streaming del estado del mundo."""
    global simulation_running, simulation_speed

    await ws.accept()
    clients.append(ws)

    full_state = {
        "full": True,
        "entities": get_all_entities(),
        "tick": world.tick,
        "time": f"{time_sys.hour:02d}:{time_sys.minute:02d}",
        "day": time_sys.day,
        "speed": simulation_speed,
        "running": simulation_running,
        "world_bounds": world_bounds,
    }
    await ws.send_text(json.dumps(full_state))

    if terrain_data:
        await ws.send_text(json.dumps({"terrain": terrain_data}))

    try:
        while True:
            msg = await ws.receive_text()
            try:
                data = json.loads(msg)
                command = data.get("command")

                if command == "set_speed":
                    simulation_speed = max(0.1, min(20.0, float(data.get("speed", 1.0))))
                    speed_msg = json.dumps({"speed_changed": simulation_speed})
                    for c in clients:
                        try:
                            await c.send_text(speed_msg)
                        except Exception:
                            pass

                elif command == "pause":
                    simulation_running = False
                    pause_msg = json.dumps({"paused": True})
                    for c in clients:
                        try:
                            await c.send_text(pause_msg)
                        except Exception:
                            pass

                elif command == "resume":
                    simulation_running = True
                    resume_msg = json.dumps({"resumed": True})
                    for c in clients:
                        try:
                            await c.send_text(resume_msg)
                        except Exception:
                            pass

                elif command == "get_info":
                    entity_id = data.get("entity_id")
                    if entity_id is not None:
                        comps = {}
                        for comp_type, comp_dict in world._components.items():
                            if entity_id in comp_dict:
                                comps[comp_type.__name__] = component_to_dict(comp_dict[entity_id])
                        await ws.send_text(json.dumps({"entity_info": {"id": entity_id, "components": comps}}))

            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        clients.remove(ws)
    except Exception:
        if ws in clients:
            clients.remove(ws)


# ------------------------------------------------------------
# Endpoints REST
# ------------------------------------------------------------
@app.get("/api/stats")
async def get_stats():
    """Endpoint REST para estadísticas del mundo."""
    npcs = world.entities_with_components(Identity)
    buildings = world.entities_with_components(Building)
    shops = world.entities_with_components(Shop)

    total_money = 0
    avg_happiness = 0
    sick_count = 0

    for e in npcs:
        wallet = world.get_component(e, Wallet)
        emotions = world.get_component(e, Emotions)
        health = world.get_component(e, Health)
        if wallet:
            total_money += wallet.cash + wallet.bank
        if emotions:
            avg_happiness += emotions.happiness
        if health and health.is_sick:
            sick_count += 1

    n = len(npcs) if npcs else 1

    return {
        "tick": world.tick,
        "day": time_sys.day,
        "time": f"{time_sys.hour:02d}:{time_sys.minute:02d}",
        "npcs": n,
        "buildings": len(buildings),
        "shops": len(shops),
        "avg_happiness": round(avg_happiness / n, 1),
        "total_economy": round(total_money, 2),
        "sick_npcs": sick_count,
        "entities_total": world.total_entities
    }


@app.get("/api/saves")
async def list_saves():
    return JSONResponse(serializer.list_saves())


@app.post("/api/save")
async def save_world(filename: str = None):
    filepath = serializer.save(world, time_sys, filename)
    return JSONResponse({"status": "ok", "filepath": filepath})


@app.post("/api/load")
async def load_world(filename: str):
    global world, time_sys, prev_state
    try:
        async with world_lock:
            world, time_sys = serializer.load(filename)
            util_sys.world = world
            prev_state = {}
        return JSONResponse({"status": "ok", "tick": world.tick, "day": time_sys.day})
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")


@app.post("/api/reset")
async def reset_world():
    global world, prev_state
    async with world_lock:
        world = World()
        util_sys.world = world
        prev_state = {}
        init_world()
    return JSONResponse({"status": "ok"})


@app.get("/api/terrain")
async def get_terrain():
    global terrain_data
    if terrain_data is None:
        terrain_data = terrain_gen.generate()
    return JSONResponse(terrain_data)


@app.get("/api/weather")
async def get_weather():
    return {"weather": weather_sys.get_weather()}


@app.get("/api/events")
async def get_events(limit: int = 50, event_type: str = None, severity: str = None):
    events = event_logger.get_recent_events(limit)
    if event_type:
        events = [e for e in events if e.event_type == event_type]
    if severity:
        events = [e for e in events if e.severity == severity]
    return [{
        "tick": e.tick,
        "type": e.event_type,
        "description": e.description,
        "severity": e.severity
    } for e in events]


@app.get("/api/innovations")
async def get_innovations():
    return [{
        "name": i.name,
        "description": i.description,
        "discovered_by": world.get_component(i.discovered_by, Identity).name if i.discovered_by else "Desconocido",
        "tick": i.tick_discovered
    } for i in innovation_sys.innovations]


@app.post("/api/admin/trigger_event")
async def trigger_event(event_type: str, params: dict = None):
    if params is None:
        params = {}

    event_handlers = {
        "epidemic": lambda: epidemic_sys.start_epidemic(
            world, params.get("disease", "gripe"),
            params.get("severity", 0.5),
            params.get("contagiousness", 0.7)
        ),
        "economic_crisis": lambda: economic_sys.trigger_crisis(world),
        "migration": lambda: migration_sys.trigger_migration(world, params.get("count", 3)),
        "storm": lambda: setattr(weather_sys, "current_weather", "storm") or
                          setattr(weather_sys, "weather_duration", 200),
        "drought": lambda: setattr(weather_sys, "current_weather", "drought") or
                           setattr(weather_sys, "weather_duration", 300),
        "miracle": lambda: _miracle_event(),
        "party": lambda: _party_event(),
    }

    handler = event_handlers.get(event_type)
    if handler:
        async with world_lock:
            handler()
        return {"status": "ok", "message": f"Evento {event_type} disparado"}
    return {"status": "error", "message": f"Evento desconocido: {event_type}"}


def _miracle_event():
    for npc in world.entities_with_components(Health):
        health = world.get_component(npc, Health)
        health.is_sick = False
        health.sickness_severity = 0
        if world.has_component(npc, Disease):
            world.remove_component(npc, Disease)


def _party_event():
    for npc in world.entities_with_components(Emotions):
        emot = world.get_component(npc, Emotions)
        emot.happiness = min(100, emot.happiness + 30)
        emot.loneliness = max(0, emot.loneliness - 20)


# ------------------------------------------------------------
# Endpoints REST de NPCs (solo lectura)
# ------------------------------------------------------------
@app.get("/api/npcs")
async def list_npcs():
    """Lista resumida de todos los NPCs (entidades con Identity)."""
    result = []
    for e in world.entities_with_components(Identity):
        ident = world.get_component(e, Identity)
        pos = world.get_component(e, Position)
        prof = world.get_component(e, Profession)
        health = world.get_component(e, Health)
        emot = world.get_component(e, Emotions)
        result.append({
            "id": e,
            "name": ident.name,
            "age": ident.age,
            "sex": ident.sex,
            "profession": prof.type if prof else None,
            "position": {"x": round(pos.x, 1), "y": round(pos.y, 1)} if pos else None,
            "is_sick": health.is_sick if health else False,
            "happiness": round(emot.happiness, 1) if emot else None,
        })
    return result


@app.get("/api/npc/{npc_id}")
async def get_npc(npc_id: int):
    """Información detallada de un NPC (todos sus componentes serializados)."""
    if not world.has_component(npc_id, Identity):
        raise HTTPException(status_code=404, detail=f"NPC {npc_id} no encontrado")
    return serialize_entity(npc_id)


# ------------------------------------------------------------
# Endpoints REST de NPCs (escritura)
# ------------------------------------------------------------
# Salario base por profesión (mismo criterio que init_world).
NPC_SALARIES = {
    "doctor": 150, "teacher": 90, "farmer": 70,
    "programmer": 200, "trader": 100, "unemployed": 15,
}

# Componentes cuyos atributos escalares se pueden modificar de forma segura vía la API.
# Se excluyen a propósito los de estructura anidada (Memory, Relationships, Inventory,
# ActionState) para no corromper listas/dicts con una asignación escalar.
MODIFIABLE_COMPONENTS = {
    "Identity": Identity, "Position": Position, "Needs": Needs,
    "Personality": Personality, "Emotions": Emotions, "Wallet": Wallet,
    "Profession": Profession, "Health": Health, "Schedule": Schedule,
}


@app.post("/api/npc/create")
async def create_npc(payload: dict = None):
    """Crea un NPC nuevo con los componentes mínimos (replica el patrón de init_world).

    Body opcional (JSON): {name, age, sex, profession, culture, x, y}. Cualquier campo
    ausente se rellena con valores razonables/aleatorios.
    """
    payload = payload or {}
    profession = str(payload.get("profession", "unemployed"))
    salary = NPC_SALARIES.get(profession, 15)

    try:
        age = int(payload.get("age", random.randint(18, 60)))
        x = float(payload.get("x", random.uniform(20, 180)))
        y = float(payload.get("y", random.uniform(15, 135)))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="age/x/y deben ser numéricos")

    name = str(payload.get("name") or f"NPC-{random.randint(1000, 9999)}")
    sex = str(payload.get("sex") or random.choice(["male", "female"]))
    culture = str(payload.get("culture") or random.choice(["urban", "rural", "coastal"]))

    async with world_lock:
        e = world.create_entity()
        house_candidates = [b for b in world.entities_with_components(Building, Bed)
                            if world.get_component(b, Building).building_type == "house"]
        if house_candidates:
            world.add_component(e, Residence(building_id=random.choice(house_candidates)))
        world.add_component(e, Identity(name=name, age=age, sex=sex, culture=culture,
                                        education=random.uniform(0.3, 0.9)))
        world.add_component(e, Position(x, y))
        world.add_component(e, Needs(hunger=random.uniform(50, 90),
                                     energy=random.uniform(50, 100),
                                     social=random.uniform(30, 70)))
        world.add_component(e, Personality(*[random.uniform(-1, 1) for _ in range(8)]))
        world.add_component(e, Emotions(happiness=random.uniform(40, 70),
                                        motivation=random.uniform(40, 70)))
        world.add_component(e, Relationships())
        world.add_component(e, Memory())
        world.add_component(e, ActionState(facing=random.choice(["down", "up", "left", "right"])))
        world.add_component(e, Inventory())
        world.add_component(e, Wallet(cash=random.uniform(50, 300), bank=random.uniform(0, 500)))
        world.add_component(e, Profession(type=profession, salary=salary,
                                          skill_level=random.uniform(0.5, 1.5)))
        world.add_component(e, Schedule(phase="free", wake_up=6 + random.randint(0, 2),
                                        sleep=22 + random.randint(0, 2)))
        world.add_component(e, Health())
        snapshot = serialize_entity(e)

    return {"status": "ok", "id": e, "npc": snapshot}


@app.delete("/api/npc/{npc_id}")
async def kill_npc(npc_id: int):
    """Elimina un NPC y limpia las referencias colgantes en las relaciones de los demás."""
    if not world.has_component(npc_id, Identity):
        raise HTTPException(status_code=404, detail=f"NPC {npc_id} no encontrado")

    ident = world.get_component(npc_id, Identity)
    name = ident.name if ident else str(npc_id)

    async with world_lock:
        # Quitar el id del NPC muerto de las relaciones de los demás para no dejar
        # claves colgantes (los sistemas ya toleran targets muertos, pero esto lo deja limpio).
        for other in world.entities_with_components(Relationships):
            rels = world.get_component(other, Relationships)
            rels.relations.pop(npc_id, None)
        world.remove_entity(npc_id)
        # NO tocamos prev_state: así el próximo broadcast lo reporta en "removed"
        # y el frontend elimina el sprite automáticamente.

    return {"status": "ok", "message": f"NPC {name} (id {npc_id}) eliminado"}


@app.patch("/api/npc/{npc_id}")
async def modify_npc(npc_id: int, payload: dict):
    """Modifica un atributo escalar de un NPC.

    Body (JSON): {attr, value, component?}. Si se omite 'component', se busca el atributo
    en los componentes modificables y se usa el primero que lo contenga. El valor se castea
    al tipo del atributo actual; los sistemas reajustan rangos (p. ej. Emotions se clampa 0-100).
    """
    if not world.has_component(npc_id, Identity):
        raise HTTPException(status_code=404, detail=f"NPC {npc_id} no encontrado")

    attr = payload.get("attr")
    if not attr or "value" not in payload:
        raise HTTPException(status_code=400, detail="Se requieren los campos 'attr' y 'value'")
    value = payload.get("value")
    comp_name = payload.get("component")

    # Localizar el componente objetivo
    target_comp = None
    if comp_name:
        cls = MODIFIABLE_COMPONENTS.get(comp_name)
        if cls is None:
            raise HTTPException(status_code=400,
                                detail=f"Componente no modificable: {comp_name}. "
                                       f"Válidos: {', '.join(MODIFIABLE_COMPONENTS)}")
        target_comp = world.get_component(npc_id, cls)
        if target_comp is None:
            raise HTTPException(status_code=404, detail=f"El NPC no tiene el componente {comp_name}")
        if not hasattr(target_comp, attr):
            raise HTTPException(status_code=400, detail=f"{comp_name} no tiene el atributo '{attr}'")
    else:
        for cls in MODIFIABLE_COMPONENTS.values():
            c = world.get_component(npc_id, cls)
            if c is not None and hasattr(c, attr):
                target_comp = c
                break
        if target_comp is None:
            raise HTTPException(status_code=400,
                                detail=f"Atributo '{attr}' no encontrado en ningún componente modificable")

    # Castear el valor al tipo actual del atributo (bool antes que int: bool es subclase de int)
    current = getattr(target_comp, attr)
    try:
        if isinstance(current, bool):
            new_value = bool(value)
        elif isinstance(current, int):
            new_value = int(value)
        elif isinstance(current, float):
            new_value = float(value)
        elif isinstance(current, str):
            new_value = str(value)
        else:
            raise HTTPException(status_code=400,
                                detail=f"Tipo no modificable ({type(current).__name__}); "
                                       f"solo se admiten atributos escalares")
    except (ValueError, TypeError):
        raise HTTPException(status_code=400,
                            detail=f"Valor inválido para '{attr}': se esperaba {type(current).__name__}")

    async with world_lock:
        setattr(target_comp, attr, new_value)

    return {"status": "ok", "id": npc_id,
            "component": type(target_comp).__name__, "attr": attr, "value": new_value}


# ------------------------------------------------------------
# Servir archivos estáticos
# ------------------------------------------------------------
client_path = Path(__file__).parent / "client" / "dist"

if client_path.exists():
    assets_path = client_path / "assets"
    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")

    def _index_response() -> FileResponse:
        # no-cache: el navegador debe revalidar SIEMPRE el index.html. Si lo cachea
        # y referencia un bundle con hash viejo (borrado en el último build), el JS
        # da 404 y la página queda en negro (fondo #111 con el root vacío).
        return FileResponse(
            str(client_path / "index.html"),
            headers={"Cache-Control": "no-cache"},
        )

    @app.get("/")
    async def root():
        return _index_response()

    @app.get("/{full_path:path}")
    async def catch_all(full_path: str):
        file_path = client_path / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return _index_response()
else:
    @app.get("/")
    async def root():
        return {
            "message": "Simulación de Vida Multiagente - API activa",
            "endpoints": {
                "websocket": "ws://localhost:8000/ws",
                "stats": "/api/stats",
                "terrain": "/api/terrain",
                "weather": "/api/weather",
                "events": "/api/events",
                "saves": "/api/saves",
                "save": "POST /api/save",
                "load": "POST /api/load",
                "reset": "POST /api/reset",
                "trigger_event": "POST /api/admin/trigger_event",
            }
        }


# ------------------------------------------------------------
# Eventos de inicio
# ------------------------------------------------------------
@app.on_event("startup")
async def startup():
    print("🌍 Inicializando mundo...")
    init_world()
    print(f"✅ Mundo creado: {len(world.entities_with_components(Identity))} NPCs")
    print(f"⏰ Día {time_sys.day} - {time_sys.hour:02d}:{time_sys.minute:02d}")
    print("🚀 Iniciando bucle de simulación...")
    asyncio.create_task(simulation_loop())
    print("✅ Servidor listo en http://localhost:8000")


@app.on_event("shutdown")
async def shutdown():
    print("🛑 Deteniendo simulación...")
    clients.clear()
    print("👋 Servidor cerrado")


# ------------------------------------------------------------
# Punto de entrada
# ------------------------------------------------------------
if __name__ == "__main__":
    try:
        import uvicorn
    except ImportError:
        print("uvicorn is not installed. Install it with 'pip install uvicorn' to run the server.")
    else:
        uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, log_level="info")
