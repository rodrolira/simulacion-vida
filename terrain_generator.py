import math
import random

class TerrainGenerator:
    """Genera terreno procedural usando ruido de Perlin simplificado."""

    def __init__(self, width=200, height=150, seed=None):
        self.width = width
        self.height = height
        self.seed = seed if seed is not None else random.randint(0, 100000)
        random.seed(self.seed)

        # Capas de ruido para diferentes características
        self.permutation = list(range(256))
        random.shuffle(self.permutation)
        self.permutation += self.permutation  # duplicar para evitar desbordes

    def generate(self):
        """Genera el mapa completo y devuelve una matriz de tipos de tile."""
        terrain = []
        # Puntos para ríos
        river_points = self._generate_river_path()

        for y in range(self.height):
            row = []
            for x in range(self.width):
                tile = self._get_tile_type(x, y, river_points)
                row.append(tile)
            terrain.append(row)

        return {
            "width": self.width,
            "height": self.height,
            "tiles": terrain,
            "rivers": river_points,
            "seed": self.seed
        }

    def _noise(self, x, y, scale=50.0, octaves=4):
        """Ruido de Perlin simplificado con múltiples octavas."""
        value = 0
        amplitude = 1
        frequency = 1
        max_value = 0

        for _ in range(octaves):
            sample_x = x / scale * frequency
            sample_y = y / scale * frequency
            value += self._smooth_noise(sample_x, sample_y) * amplitude
            max_value += amplitude
            amplitude *= 0.5
            frequency *= 2

        return value / max_value

    def _smooth_noise(self, x, y):
        """Ruido suave interpolado."""
        int_x = int(x)
        int_y = int(y)
        frac_x = x - int_x
        frac_y = y - int_y

        # Esquinas
        v1 = self._random_gradient(int_x, int_y)
        v2 = self._random_gradient(int_x + 1, int_y)
        v3 = self._random_gradient(int_x, int_y + 1)
        v4 = self._random_gradient(int_x + 1, int_y + 1)

        # Interpolación
        i1 = self._lerp(v1, v2, frac_x)
        i2 = self._lerp(v3, v4, frac_x)
        return self._lerp(i1, i2, frac_y)

    def _random_gradient(self, x, y):
        """Valor pseudoaleatorio basado en coordenadas."""
        n = x * 374761393 + y * 668265263 + self.seed
        n = (n ^ (n >> 13)) * 1274126177
        n = n ^ (n >> 16)
        return (n % 1000) / 1000.0

    def _lerp(self, a, b, t):
        """Interpolación lineal."""
        return a + (b - a) * t

    def _generate_river_path(self):
        """Genera un camino para el río principal."""
        points = []
        # Empezar desde un borde superior
        x = random.randint(10, self.width - 10)
        y = 0

        while y < self.height - 1:
            points.append((x, y))
            # Movimiento con tendencia hacia abajo
            dx = random.choice([-1, 0, 0, 0, 0, 1])
            dy = random.choice([1, 1, 1, 1, 0, 2])
            x = max(0, min(self.width - 1, x + dx))
            y += dy

        return points

    def _get_tile_type(self, x, y, river_points):
        """Determina el tipo de tile en una posición."""
        # Verificar río
        for rx, ry in river_points:
            if abs(x - rx) <= 1 and abs(y - ry) <= 1:
                return "water"

        # Altura (ruido de baja frecuencia)
        elevation = self._noise(x, y, scale=60.0, octaves=3)
        # Humedad (ruido diferente)
        moisture = self._noise(x + 1000, y + 1000, scale=40.0, octaves=2)

        if elevation < 0.25:
            return "water"  # lagos
        elif elevation < 0.35:
            return "sand"   # playa
        elif elevation < 0.45 and moisture < 0.3:
            return "sand"   # desierto
        elif elevation > 0.7:
            if moisture > 0.5:
                return "forest_dense"  # bosque denso en altura
            return "mountain"  # montaña
        elif moisture > 0.6:
            return "forest"  # bosque
        elif moisture > 0.4:
            return "grass_lush"  # pradera fértil
        else:
            return "grass"  # pradera normal