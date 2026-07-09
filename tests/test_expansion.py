"""Verifica que el área explorada del mundo crece con la población y se topa en
el tamaño completo del mundo.

Ejecutar:  python -m tests.test_expansion   (o  pytest tests/)
"""
import main


def _size(pop):
    b = main.compute_world_bounds(pop)
    return b["maxX"] - b["minX"], b["maxY"] - b["minY"]


def test_bounds_grow_with_population():
    w0, h0 = _size(0)
    w10, h10 = _size(10)
    w40, h40 = _size(40)
    assert w10 > w0 and h10 > h0, "el mundo debe crecer con la población"
    assert w40 > w10 and h40 > h10


def test_bounds_capped_at_world_size():
    w, h = _size(500)  # población enorme
    assert w == main.WORLD_W and h == main.WORLD_H, "no debe exceder el tamaño del mundo"


def test_bounds_centered():
    b = main.compute_world_bounds(0)
    cx = (b["minX"] + b["maxX"]) / 2
    cy = (b["minY"] + b["maxY"]) / 2
    assert abs(cx - main.WORLD_CX) <= 1 and abs(cy - main.WORLD_CY) <= 1


if __name__ == "__main__":
    test_bounds_grow_with_population()
    test_bounds_capped_at_world_size()
    test_bounds_centered()
    print("test_expansion: OK")
