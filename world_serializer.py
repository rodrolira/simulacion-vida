import pickle
import gzip
import os
from datetime import datetime

class WorldSerializer:
    SAVE_DIR = "saves"
    AUTO_SAVE_INTERVAL = 1000  # ticks

    def __init__(self):
        os.makedirs(self.SAVE_DIR, exist_ok=True)

    def save(self, world, time_system, filename=None):
        """Guarda el estado completo de la simulación."""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"world_d{time_system.day}_t{time_system.total_ticks}_{timestamp}.save"

        filepath = os.path.join(self.SAVE_DIR, filename)

        state = {
            "world": world,
            "time_system": time_system,
            "version": "1.0",
            "saved_at": datetime.now().isoformat()
        }

        with gzip.open(filepath, 'wb') as f:
            pickle.dump(state, f, protocol=pickle.HIGHEST_PROTOCOL)

        print(f"[SAVE] Mundo guardado en {filepath}")
        return filepath

    def load(self, filename):
        """Carga el estado completo de la simulación."""
        filepath = os.path.join(self.SAVE_DIR, filename)

        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Archivo no encontrado: {filepath}")

        with gzip.open(filepath, 'rb') as f:
            state = pickle.load(f)

        print(f"[LOAD] Mundo cargado desde {filepath}")
        return state["world"], state["time_system"]

    def list_saves(self):
        """Lista todos los archivos de guardado disponibles."""
        saves = []
        for f in os.listdir(self.SAVE_DIR):
            if f.endswith('.save'):
                filepath = os.path.join(self.SAVE_DIR, f)
                size = os.path.getsize(filepath)
                saves.append({
                    "filename": f,
                    "size_kb": round(size / 1024, 1),
                    "modified": datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat()
                })
        return sorted(saves, key=lambda x: x["modified"], reverse=True)