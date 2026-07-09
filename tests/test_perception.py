"""Regresión: los NPCs SIN empleo (migrantes/desempleados) también deben percibir
tiendas y camas, para poder comer y dormir. Antes PerceptionSystem exigía Workplace
y los dejaba sin percibir recursos (necesidades a 0).

Ejecutar:  python -m tests.test_perception   (o  pytest tests/)
"""
from world import World
from components import Needs, Position, ActionState, Shop, Bed
from systems import PerceptionSystem


def _build():
    w = World()
    # NPC desempleado (sin Workplace), inactivo
    npc = w.create_entity()
    w.add_component(npc, Needs(hunger=40, energy=40, social=40))
    w.add_component(npc, Position(100, 80))
    w.add_component(npc, ActionState(action="idle"))
    # Tienda y cama cercanas (dentro del radio de percepción)
    shop = w.create_entity()
    w.add_component(shop, Position(110, 85))
    w.add_component(shop, Shop())
    bed = w.create_entity()
    w.add_component(bed, Position(95, 82))
    w.add_component(bed, Bed())
    return w, npc, shop, bed


def test_unemployed_npc_perceives_resources():
    w, npc, shop, bed = _build()
    PerceptionSystem().run(w)
    act = w.get_component(npc, ActionState)
    assert act.closest_shop == shop, "un NPC sin empleo debe percibir la tienda"
    assert act.closest_bed == bed, "un NPC sin empleo debe percibir la cama"


if __name__ == "__main__":
    test_unemployed_npc_perceives_resources()
    print("test_perception: OK")
