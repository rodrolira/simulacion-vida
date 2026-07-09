"""Regresión de las conversaciones entre NPCs:

1. RelationshipSystem debe registrar la conversación UNA sola vez (al iniciarse),
   creando relación + recuerdo en ambos NPCs.
2. La charla debe DURAR varios ticks (acción "socializing" persistente), para que
   el cliente pueda mostrarla. Antes se ponía y se limpiaba en el mismo tick.

Ejecutar:  python -m tests.test_conversations   (o  pytest tests/)
"""
from world import World
from components import (
    Identity, Position, Needs, Personality, Emotions,
    ActionState, Relationships, Memory, Schedule,
)
from systems import RelationshipSystem, ActionExecutionSystem


def _npc(w, name, x, y):
    e = w.create_entity()
    w.add_component(e, Identity(name=name, age=30, sex="female", culture="urban"))
    w.add_component(e, Position(x, y))
    w.add_component(e, Needs(hunger=50, energy=50, social=20))
    w.add_component(e, Personality())
    w.add_component(e, Emotions())
    w.add_component(e, ActionState())
    w.add_component(e, Relationships())
    w.add_component(e, Memory())
    w.add_component(e, Schedule(phase="free"))
    return e


def _start_conversation(w, a, b, ticks=5):
    act = w.get_component(a, ActionState)
    act.action = "socializing"
    act.target_entity = b
    act.talk_ticks = ticks
    act.talk_started = True


def test_conversation_registered_once():
    w = World()
    a = _npc(w, "Ana", 10, 10)
    b = _npc(w, "Beto", 11, 10)
    _start_conversation(w, a, b)

    rel_sys = RelationshipSystem()
    rel_sys.run(w)

    # Ambos deben tener relación y un recuerdo de conversación
    assert b in w.get_component(a, Relationships).relations
    assert a in w.get_component(b, Relationships).relations
    convs_a = [m for m in w.get_component(a, Memory).entries if m.event_type == "social_interaction"]
    assert len(convs_a) == 1
    assert "Beto" in convs_a[0].description, "la conversación debe nombrar al interlocutor"

    # Volver a correr no debe duplicar (talk_started ya se consumió)
    rel_sys.run(w)
    convs_a = [m for m in w.get_component(a, Memory).entries if m.event_type == "social_interaction"]
    assert len(convs_a) == 1, "no debe registrarse dos veces la misma conversación"


def test_conversation_lasts_several_ticks():
    w = World()
    a = _npc(w, "Ana", 10, 10)
    b = _npc(w, "Beto", 11, 10)
    _start_conversation(w, a, b, ticks=4)

    act_sys = ActionExecutionSystem()
    act = w.get_component(a, ActionState)

    act_sys.run(w)
    assert act.action == "socializing", "la charla debe seguir activa tras un tick"
    assert act.talk_ticks == 3

    for _ in range(3):
        act_sys.run(w)
    assert act.action == "idle", "la charla debe terminar al agotarse los ticks"
    assert act.talk_ticks == 0


def test_socializing_raises_social_need():
    w = World()
    a = _npc(w, "Ana", 10, 10)
    b = _npc(w, "Beto", 11, 10)
    _start_conversation(w, a, b, ticks=3)
    before = w.get_component(a, Needs).social
    ActionExecutionSystem().run(w)
    assert w.get_component(a, Needs).social > before


if __name__ == "__main__":
    test_conversation_registered_once()
    test_conversation_lasts_several_ticks()
    test_socializing_raises_social_need()
    print("test_conversations: OK")
