from typing import Any, Type, TypeVar, Dict, Set, List

T = TypeVar('T')


class World:
    """
    Núcleo del sistema ECS (Entity-Component-System).

    Gestiona entidades (identificadas por IDs numéricos) y sus componentes.
    Cada componente se almacena en un diccionario separado por tipo para
    permitir consultas rápidas por arquetipo.

    Attributes:
        tick: Contador global de ticks de simulación.
    """

    def __init__(self):
        # Mapa: tipo de componente -> { entity_id: instancia del componente }
        self._components: Dict[Type[Any], Dict[int, Any]] = {}
        self._next_entity_id: int = 1
        self.tick: int = 0

        # Para consultas rápidas: qué tipos de componente tiene cada entidad
        self._entity_components: Dict[int, Set[Type[Any]]] = {}

        # Estadísticas
        self._total_entities_created: int = 0
        self._total_entities_removed: int = 0

    # ------------------------------------------------------------
    # Gestión de entidades
    # ------------------------------------------------------------

    def create_entity(self) -> int:
        """
        Crea una nueva entidad y devuelve su ID único.

        Returns:
            int: ID de la nueva entidad.
        """
        eid = self._next_entity_id
        self._next_entity_id += 1
        self._entity_components[eid] = set()
        self._total_entities_created += 1
        return eid

    def remove_entity(self, entity: int) -> bool:
        """
        Elimina una entidad y todos sus componentes.

        Args:
            entity: ID de la entidad a eliminar.

        Returns:
            bool: True si la entidad existía y fue eliminada, False en caso contrario.
        """
        if entity not in self._entity_components:
            return False

        # Eliminar todos los componentes
        comp_types = self._entity_components[entity].copy()
        for comp_type in comp_types:
            self.remove_component(entity, comp_type)

        # Eliminar registro de entidad
        del self._entity_components[entity]
        self._total_entities_removed += 1

        return True

    def entity_exists(self, entity: int) -> bool:
        """
        Verifica si una entidad existe.

        Args:
            entity: ID de la entidad.

        Returns:
            bool: True si la entidad existe.
        """
        return entity in self._entity_components

    # ------------------------------------------------------------
    # Gestión de componentes
    # ------------------------------------------------------------

    def add_component(self, entity: int, component: Any):
        """
        Añade un componente a una entidad.

        Si la entidad no existe, la crea automáticamente.

        Args:
            entity: ID de la entidad.
            component: Instancia del componente a añadir.
        """
        comp_type = type(component)

        # Crear almacén para este tipo de componente si no existe
        if comp_type not in self._components:
            self._components[comp_type] = {}

        self._components[comp_type][entity] = component

        # Registrar en la entidad
        if entity not in self._entity_components:
            self._entity_components[entity] = set()
        self._entity_components[entity].add(comp_type)

    def remove_component(self, entity: int, comp_type: Type[Any]) -> bool:
        """
        Elimina un tipo de componente de una entidad.

        Args:
            entity: ID de la entidad.
            comp_type: Tipo de componente a eliminar.

        Returns:
            bool: True si el componente existía y fue eliminado.
        """
        if comp_type in self._components and entity in self._components[comp_type]:
            del self._components[comp_type][entity]

            # Limpiar almacén vacío
            if not self._components[comp_type]:
                del self._components[comp_type]

        if entity in self._entity_components:
            self._entity_components[entity].discard(comp_type)
            return True

        return False

    def get_component(self, entity: int, comp_type: Type[T]) -> T | None:
        """
        Obtiene un componente específico de una entidad.

        Args:
            entity: ID de la entidad.
            comp_type: Tipo de componente a obtener.

        Returns:
            El componente si existe, None en caso contrario.
        """
        if comp_type in self._components:
            return self._components[comp_type].get(entity)
        return None

    def has_component(self, entity: int, comp_type: Type[Any]) -> bool:
        """
        Verifica si una entidad tiene un tipo de componente.

        Args:
            entity: ID de la entidad.
            comp_type: Tipo de componente a verificar.

        Returns:
            bool: True si la entidad tiene el componente.
        """
        return comp_type in self._entity_components.get(entity, set())

    def get_components(self, entity: int) -> Dict[Type[Any], Any]:
        """
        Obtiene todos los componentes de una entidad.

        Args:
            entity: ID de la entidad.

        Returns:
            Dict: Mapa de tipo de componente -> instancia.
        """
        result = {}
        for comp_type in self._entity_components.get(entity, set()):
            if comp_type in self._components and entity in self._components[comp_type]:
                result[comp_type] = self._components[comp_type][entity]
        return result

    # ------------------------------------------------------------
    # Consultas de entidades (arquetipos)
    # ------------------------------------------------------------

    def entities_with_components(self, *comp_types: Type[Any]) -> List[int]:
        """
        Devuelve todas las entidades que poseen TODOS los tipos de componentes
        especificados (consulta por arquetipo).

        Args:
            *comp_types: Tipos de componentes requeridos.

        Returns:
            List[int]: Lista de IDs de entidades que coinciden.
        """
        if not comp_types:
            return []

        # Empezar con las entidades del primer tipo de componente
        first = comp_types[0]
        if first not in self._components:
            return []

        # Usar el conjunto más pequeño como base para la intersección
        candidate_set = set(self._components[first].keys())

        # Intersectar con los demás tipos
        for ct in comp_types[1:]:
            if ct not in self._components:
                return []
            candidate_set.intersection_update(self._components[ct].keys())
            if not candidate_set:
                break

        return list(candidate_set)

    def entities_with_any_component(self, *comp_types: Type[Any]) -> List[int]:
        """
        Devuelve todas las entidades que poseen AL MENOS UNO de los tipos
        de componentes especificados.

        Args:
            *comp_types: Tipos de componentes a buscar.

        Returns:
            List[int]: Lista de IDs de entidades que coinciden.
        """
        result_set = set()
        for ct in comp_types:
            if ct in self._components:
                result_set.update(self._components[ct].keys())
        return list(result_set)

    # ------------------------------------------------------------
    # Consultas de componentes
    # ------------------------------------------------------------

    def get_all_components_of_type(self, comp_type: Type[T]) -> Dict[int, T]:
        """
        Obtiene todas las instancias de un tipo de componente.

        Args:
            comp_type: Tipo de componente.

        Returns:
            Dict[int, T]: Mapa de entity_id -> componente.
        """
        return self._components.get(comp_type, {}).copy()

    def count_entities_with_component(self, comp_type: Type[Any]) -> int:
        """
        Cuenta cuántas entidades tienen un tipo de componente.

        Args:
            comp_type: Tipo de componente.

        Returns:
            int: Número de entidades.
        """
        if comp_type in self._components:
            return len(self._components[comp_type])
        return 0

    # ------------------------------------------------------------
    # Utilidades y estadísticas
    # ------------------------------------------------------------

    def clear(self):
        """
        Elimina todas las entidades y componentes.
        Útil para reiniciar el mundo.
        """
        self._components.clear()
        self._entity_components.clear()
        self._next_entity_id = 1
        self.tick = 0
        self._total_entities_created = 0
        self._total_entities_removed = 0

    @property
    def total_entities(self) -> int:
        """
        Número total de entidades vivas actualmente.

        Returns:
            int: Cantidad de entidades.
        """
        return len(self._entity_components)

    @property
    def total_entities_created(self) -> int:
        """
        Número total de entidades creadas desde el inicio.

        Returns:
            int: Cantidad acumulada.
        """
        return self._total_entities_created

    @property
    def total_entities_removed(self) -> int:
        """
        Número total de entidades eliminadas desde el inicio.

        Returns:
            int: Cantidad acumulada.
        """
        return self._total_entities_removed

    @property
    def component_types(self) -> List[Type[Any]]:
        """
        Lista de todos los tipos de componentes registrados.

        Returns:
            List[Type]: Tipos de componentes.
        """
        return list(self._components.keys())

    def get_stats(self) -> Dict[str, int]:
        """
        Obtiene estadísticas del mundo.

        Returns:
            Dict: Estadísticas (entidades, componentes, tick).
        """
        total_components = sum(len(comp_dict) for comp_dict in self._components.values())

        return {
            "tick": self.tick,
            "total_entities": self.total_entities,
            "total_components": total_components,
            "component_types": len(self._components),
            "entities_created": self._total_entities_created,
            "entities_removed": self._total_entities_removed,
        }

    def __repr__(self) -> str:
        return (f"World(tick={self.tick}, entities={self.total_entities}, "
                f"component_types={len(self._components)})")

    def __len__(self) -> int:
        return self.total_entities
