from dataclasses import dataclass, field
from typing import Optional, Dict, List


# ---------- Identidad y posición ----------
@dataclass
class Identity:
    name: str
    age: int
    sex: str
    culture: str
    education: float = 0.0


@dataclass
class Position:
    x: float
    y: float


# ---------- Necesidades ----------
@dataclass
class Needs:
    hunger: float = 100.0
    energy: float = 100.0
    social: float = 100.0
    # El dinero no es una necesidad fisiológica, pero la falta de él genera estrés
    # Lo modelaremos como un factor en las emociones, no en Needs.


# ---------- Personalidad ----------
@dataclass
class Personality:
    extroversion: float = 0.0
    ambition: float = 0.0
    generosity: float = 0.0
    honesty: float = 0.0
    patience: float = 0.0
    aggressiveness: float = 0.0
    empathy: float = 0.0
    curiosity: float = 0.0


# ---------- Emociones ----------
@dataclass
class Emotions:
    happiness: float = 50.0
    sadness: float = 0.0
    fear: float = 0.0
    anger: float = 0.0
    stress: float = 0.0
    motivation: float = 50.0
    loneliness: float = 0.0


# ---------- Memoria ----------
@dataclass
class MemoryEntry:
    tick: int
    event_type: str  # "social_interaction", "purchase", "salary", "achievement"
    subject_id: int  # quien vivió el evento (el dueño de la memoria)
    target_id: Optional[int]  # con quién o con qué entidad
    description: str  # texto en español (respaldo); el cliente localiza desde event_type + meta
    emotional_impact: Dict[str, float] = field(default_factory=dict)  # ej: {"happiness": 5, "anger": 2}
    importance: float = 0.0  # qué tan fuerte es el recuerdo (0-100)
    # Datos estructurados para localización en el cliente (ES/EN):
    # p. ej. {"tone": "kind", "verb": 2, "topic": "weather"} o {"amount": 90}
    meta: Dict = field(default_factory=dict)


@dataclass
class Memory:
    entries: List[MemoryEntry] = field(default_factory=list)


# ---------- Relaciones ----------
@dataclass
class Relationship:
    target_id: int
    friendship: float = 0.0
    trust: float = 0.0
    affection: float = 0.0
    type: str = "acquaintance"


@dataclass
class Relationships:
    relations: Dict[int, Relationship] = field(default_factory=dict)


# ---------- Acción ----------
@dataclass
class ActionState:
    action: str = "idle"
    target_entity: Optional[int] = None
    wander_angle: float = 0.0
    facing: str = "down"  # "up", "down", "left", "right"
    # Conversación en curso: dura varios ticks para que sea visible en el cliente
    talk_ticks: int = 0          # ticks restantes de charla
    talk_started: bool = False   # marca el inicio (lo consume RelationshipSystem)
    # Percepción temporal
    closest_food: Optional[int] = None  # ahora apunta a tiendas (Shop)
    closest_bed: Optional[int] = None
    closest_shop: Optional[int] = None  # tienda más cercana
    closest_workplace: Optional[int] = None
    social_targets: list = field(default_factory=list)


# ---------- Inventario ----------
@dataclass
class Inventory:
    items: Dict[str, int] = field(default_factory=dict)  # "food" -> unidades


# ---------- Economía ----------
@dataclass
class Wallet:
    cash: float = 100.0  # dinero en efectivo
    bank: float = 0.0


@dataclass
class Profession:
    type: str  # "doctor", "teacher", "farmer", "programmer", "unemployed"
    salary: float  # salario por día (cada 100 ticks)
    employer_id: Optional[int] = None
    skill_level: float = 1.0


@dataclass
class Shop:
    item_type: str = "food"  # qué vende
    price_per_unit: float = 10.0  # precio
    stock: int = 100  # stock (se repone periódicamente)


# ---------- Recursos (objetos) ----------
@dataclass
class Food:  # ahora representa comida en el inventario o en el mundo como objeto
    nutritional_value: float = 25.0


@dataclass
class Bed:
    comfort: float = 1.0


@dataclass
class Building:
    building_type: str  # "hospital", "school", "farm", "office", "shop", "house"
    name: str = ""
    capacity: int = 10


@dataclass
class Workplace:
    building_id: int  # entidad del edificio donde trabaja
    profession_type: str  # "doctor", "teacher", "farmer", "programmer", "trader"
    shift_start: int = 8  # hora de inicio (0-23)
    shift_end: int = 18  # hora de fin


@dataclass
class Residence:
    building_id: int  # entidad de la casa donde vive el NPC


@dataclass
class Schedule:
    phase: str = "free"  # "sleep", "work", "free"
    wake_up: int = 7  # hora de despertar
    sleep: int = 23  # hora de dormir


# ---------- Salud (nuevo) ----------
@dataclass
class Health:
    is_sick: bool = False
    sickness_severity: float = 0.0  # 0-100, afecta necesidades
    recovery_rate: float = 0.0  # si está en hospital, acelera

@dataclass
class Disease:
    name: str = "gripe"
    severity: float = 0.3        # 0-1, qué tan grave es
    contagiousness: float = 0.5   # 0-1, probabilidad de contagio
    duration: int = 100           # ticks que dura
    mortality_rate: float = 0.01  # probabilidad de muerte por tick

@dataclass
class Economy:
    inflation: float = 1.0        # multiplicador de precios
    unemployment_rate: float = 0.1
    market_stability: float = 0.7 # 0-1, qué tan estable es

@dataclass
class Innovation:
    name: str
    description: str
    effect: dict = field(default_factory=dict)  # ej: {"food_production": 1.5}
    discovered_by: Optional[int] = None
    tick_discovered: int = 0

@dataclass
class GlobalEvent:
    tick: int
    event_type: str
    description: str  # texto en español (respaldo); el cliente localiza desde event_type + meta
    severity: str = "info"  # "info", "warning", "critical"
    affected_entities: list = field(default_factory=list)
    # Datos estructurados para localización en el cliente:
    # p. ej. {"name": "Alice", "disease": "flu"} o {"count": 3} o {"innovation": "digital_commerce"}
    meta: dict = field(default_factory=dict)
