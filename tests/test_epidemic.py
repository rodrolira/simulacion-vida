"""Regresión: EpidemicSystem no debe crashear cuando un NPC enfermo muere por
mortalidad y su id sigue en la lista precomputada que recorre el siguiente enfermo.

Ejecutar:  python -m tests.test_epidemic   (o  pytest tests/)
"""
from world import World
from components import Position, Health, Disease, Identity
from systems import EpidemicSystem


def _build_world_with_sick(n=4):
    w = World()
    w.tick = 50  # múltiplo de BASE_MORTALITY_CHECK_INTERVAL -> se evalúa mortalidad
    for i in range(n):
        e = w.create_entity()
        w.add_component(e, Position(10 + i, 10 + i))
        w.add_component(e, Identity(name=f"Sick{i}", age=30, sex="male", culture="urban"))
        w.add_component(e, Health(is_sick=True, sickness_severity=50))
        w.add_component(e, Disease(name="peste", severity=0.9, contagiousness=0.0,
                                   duration=100, mortality_rate=1.0))
    return w


def test_epidemic_no_crash_on_death_midtick():
    w = _build_world_with_sick(4)
    before = w.total_entities
    EpidemicSystem().run(w)  # antes del fix: AttributeError sobre entidad eliminada
    assert w.total_entities < before  # mortalidad 1.0 -> mueren


def test_epidemic_empty_world():
    EpidemicSystem().run(World())  # no debe lanzar con mundo vacío


if __name__ == "__main__":
    test_epidemic_no_crash_on_death_midtick()
    test_epidemic_empty_world()
    print("test_epidemic: OK")
