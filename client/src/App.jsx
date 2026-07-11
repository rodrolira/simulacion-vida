import React, { useState, useCallback, useRef, useEffect } from 'react';
import PixiCanvas from './components/PixiCanvas';
import InfoPanel from './components/InfoPanel';
import HUD from './components/HUD';
import Minimap from './components/Minimap';
import Notifications from './components/Notifications';
import AdminPanel from './components/AdminPanel';
import ErrorBoundary from './components/ErrorBoundary';
import { useWebSocket } from './hooks/useWebSocket';
import { worldState } from './store/WorldState';
import { useI18n } from './i18n';

export default function App() {
    const { tBuilding } = useI18n();
    const [selected, setSelected] = useState(null); // {kind:'npc'|'building', id} | null
    const [forceRender, setForceRender] = useState(0);
    const [timeStr, setTimeStr] = useState('06:00');
    const [day, setDay] = useState(1);
    const [speed, setSpeed] = useState(1);
    const [running, setRunning] = useState(true);
    const [terrainData, setTerrainData] = useState(null);
    const [weather, setWeather] = useState('clear');
    const [worldBounds, setWorldBounds] = useState(null);
    const [scene, setScene] = useState(null);
    const [minimapCam, setMinimapCam] = useState(null);

    // Suscribirse a la cámara en vivo de la escena (posición, zoom, viewport):
    // así el minimapa muestra el recuadro REAL y se mueve al arrastrar/zoomear.
    useEffect(() => {
        if (!scene) return;
        scene.setCameraListener(setMinimapCam);
        return () => scene.setCameraListener(null);
    }, [scene]);
    const [globalEvents, setGlobalEvents] = useState([]);
    const fpsRef = useRef({ frames: 0, lastTime: performance.now(), fps: 0 });
    const eventsBufferRef = useRef([]);

    const { send } = useWebSocket('/ws', useCallback((data) => {
        // Procesar datos del terreno (solo una vez)
        if (data.terrain) {
            setTerrainData(data.terrain);
            return;
        }

        // Procesar cambios de velocidad
        if (data.speed_changed) {
            setSpeed(data.speed_changed);
            return;
        }

        // Procesar pausa
        if (data.paused) {
            setRunning(false);
            return;
        }

        // Procesar reanudación
        if (data.resumed) {
            setRunning(true);
            return;
        }

        // Procesar eventos globales (Fase 10). El backend reenvía los últimos 5
        // eventos en CADA tick, así que hay que deduplicar (por tick+tipo+descripción)
        // para no llenar el buffer de copias del mismo evento.
        if (data.global_events && data.global_events.length > 0) {
            const keyOf = e => `${e.tick}|${e.type}|${e.description}`;
            const seen = new Set(eventsBufferRef.current.map(keyOf));
            const fresh = data.global_events.filter(e => !seen.has(keyOf(e)));
            if (fresh.length > 0) {
                eventsBufferRef.current = [...fresh, ...eventsBufferRef.current].slice(0, 50);
                requestAnimationFrame(() => {
                    setGlobalEvents([...eventsBufferRef.current]);
                });
            }
        }

        // Actualizar el estado del mundo
        worldState.update(data);

        // Actualizar tiempo
        if (data.time) setTimeStr(data.time);
        if (data.day) setDay(data.day);
        if (data.speed !== undefined) setSpeed(data.speed);
        if (data.running !== undefined) setRunning(data.running);
        if (data.weather) setWeather(data.weather);
        if (data.world_bounds) setWorldBounds(data.world_bounds);

        // Forzar re-render del canvas
        setForceRender(prev => prev + 1);

        // Calcular FPS
        const now = performance.now();
        fpsRef.current.frames++;
        if (now - fpsRef.current.lastTime >= 1000) {
            fpsRef.current.fps = fpsRef.current.frames;
            fpsRef.current.frames = 0;
            fpsRef.current.lastTime = now;
        }
    }, []));

    // Handlers para control de velocidad
    const handleSpeedChange = (newSpeed) => {
        send({ command: 'set_speed', speed: newSpeed });
    };

    const handlePause = () => {
        send({ command: 'pause' });
    };

    const handleResume = () => {
        send({ command: 'resume' });
    };

    // Handler para disparar eventos desde el panel de administración
    const handleTriggerEvent = (eventType) => {
        fetch(`/api/admin/trigger_event?event_type=${eventType}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
            .then(r => r.json())
            .then(data => {
                console.log('[ADMIN] Evento disparado:', data);
                // Mostrar feedback visual (opcional)
                if (data.status === 'ok') {
                    // Podríamos añadir una notificación local
                }
            })
            .catch(err => {
                console.error('[ADMIN] Error al disparar evento:', err);
            });
    };

    // Función para solicitar información detallada de una entidad
    const handleRequestEntityInfo = (entityId) => {
        send({ command: 'get_info', entity_id: entityId });
    };

    // Listas vivas (se recalculan con cada mensaje del WebSocket)
    const npcs = worldState.getNPCs();
    const buildings = worldState.getBuildings();

    // Mapa id -> nombre, para mostrar CON QUIÉN interactúa cada NPC
    const nameById = {};
    npcs.forEach(n => { if (n.Identity?.name) nameById[n.id] = n.Identity.name; });
    const buildingById = {};
    buildings.forEach(b => { buildingById[b.id] = b; });

    // Selección re-derivada del estado del mundo en cada frame → datos EN VIVO.
    const selectedNPC = selected?.kind === 'npc'
        ? (npcs.find(n => n.id === selected.id) || null)
        : null;
    const selectedBuilding = selected?.kind === 'building'
        ? (buildings.find(b => b.id === selected.id) || null)
        : null;

    // Ocupantes del edificio seleccionado: quién vive y quién trabaja aquí
    const residents = selectedBuilding
        ? npcs.filter(n => n.Residence?.building_id === selectedBuilding.id)
        : [];
    const workers = selectedBuilding
        ? npcs.filter(n => n.Workplace?.building_id === selectedBuilding.id)
        : [];

    // Limpiar eventos antiguos periódicamente
    const handleDismissNotification = (eventId) => {
        setGlobalEvents(prev => prev.filter(e => e.tick !== eventId));
    };

    return (
        <div style={{ display: 'flex', height: '100vh', position: 'relative', overflow: 'hidden' }}>
            {/* Panel principal con el canvas */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <ErrorBoundary>
                    <PixiCanvas
                        worldState={worldState}
                        forceRender={forceRender}
                        onSelectNPC={setSelected}
                        timeStr={timeStr}
                        terrainData={terrainData}
                        weather={weather}
                        worldBounds={worldBounds}
                        onSceneReady={setScene}
                        buildingLabel={tBuilding}
                    />
                </ErrorBoundary>

                {/* HUD con información de simulación */}
                <HUD
                    timeStr={timeStr}
                    day={day}
                    npcCount={npcs.length}
                    fps={fpsRef.current.fps}
                    speed={speed}
                    running={running}
                    weather={weather}
                    onSpeedChange={handleSpeedChange}
                    onPause={handlePause}
                    onResume={handleResume}
                />

                {/* Sistema de notificaciones de eventos globales */}
                <Notifications
                    events={globalEvents}
                    onDismiss={handleDismissNotification}
                />

                {/* Panel de administración */}
                <AdminPanel onTriggerEvent={handleTriggerEvent} />

                {/* Minimapa */}
                <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 10, pointerEvents: 'auto' }}>
                    <Minimap
                        worldState={worldState}
                        camera={minimapCam}
                        terrainData={terrainData}
                        worldBounds={worldBounds}
                        tick={forceRender}
                        onNavigate={(x, y) => scene?.centerOn(x, y)}
                    />
                </div>
            </div>

            {/* Panel lateral de información del NPC seleccionado */}
            <InfoPanel
                npc={selectedNPC}
                building={selectedBuilding}
                residents={residents}
                workers={workers}
                nameById={nameById}
                buildingById={buildingById}
                onSelectNPC={(id) => setSelected({ kind: 'npc', id })}
            />
        </div>
    );
}
