"""Regresión del fix de WebSocket: los componentes con dataclasses anidadas
(Memory -> MemoryEntry, Relationships -> Relationship) deben serializarse a JSON
sin lanzar 'Object of type X is not JSON serializable'.

Ejecutar:  python -m tests.test_serialization   (o  pytest tests/)
"""
import json
import dataclasses

from components import Memory, MemoryEntry, Relationships, Relationship, Emotions, ActionState


def _component_to_dict(comp):
    """Réplica de main.component_to_dict (evita levantar el servidor en el test)."""
    data = dataclasses.asdict(comp)
    if type(comp).__name__ == "ActionState":
        data["moving"] = "moving" in data.get("action", "")
    return data


def test_memory_is_json_serializable():
    mem = Memory(entries=[
        MemoryEntry(tick=1, event_type="social_interaction", subject_id=1,
                    target_id=2, description="hola", emotional_impact={"happiness": 5}, importance=10)
    ])
    payload = json.dumps(_component_to_dict(mem))  # no debe lanzar
    assert "social_interaction" in payload


def test_relationships_is_json_serializable():
    rels = Relationships(relations={2: Relationship(target_id=2, friendship=30.0, type="friend")})
    payload = json.dumps(_component_to_dict(rels))
    assert "friend" in payload


def test_actionstate_moving_flag():
    d = _component_to_dict(ActionState(action="moving_to_work"))
    assert d["moving"] is True
    d2 = _component_to_dict(ActionState(action="idle"))
    assert d2["moving"] is False


def test_emotions_plain():
    d = _component_to_dict(Emotions(happiness=42.0))
    assert d["happiness"] == 42.0


if __name__ == "__main__":
    test_memory_is_json_serializable()
    test_relationships_is_json_serializable()
    test_actionstate_moving_flag()
    test_emotions_plain()
    print("test_serialization: OK")
