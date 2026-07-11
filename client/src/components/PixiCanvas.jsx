import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { GameScene } from '../pixi/GameScene';

export default function PixiCanvas({ worldState, forceRender, onSelectNPC, timeStr, terrainData, weather, worldBounds, onSceneReady, buildingLabel }) {
    const canvasRef = useRef(null);
    const sceneRef = useRef(null);
    const boundsRef = useRef(null);
    boundsRef.current = worldBounds;
    const labelRef = useRef(null);
    labelRef.current = buildingLabel;

    useEffect(() => {
        sceneRef.current = new GameScene(canvasRef, terrainData);
        onSceneReady?.(sceneRef.current);

        const handleResize = () => sceneRef.current?.resize();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            onSceneReady?.(null);
            sceneRef.current?.destroy();
            sceneRef.current = null;
        };
    }, []);

    // El terreno llega por WebSocket después del montaje; recargarlo cuando cambie.
    useEffect(() => {
        if (terrainData) sceneRef.current?.setTerrain(terrainData);
    }, [terrainData]);

    useEffect(() => {
        sceneRef.current?.update(worldState, onSelectNPC, timeStr, weather, boundsRef.current, labelRef.current);
    }, [forceRender]);

    // Re-etiquetar edificios al cambiar de idioma (fuera del ciclo de forceRender)
    useEffect(() => {
        sceneRef.current?.relabelBuildings(buildingLabel);
    }, [buildingLabel]);

    return (
        <canvas ref={canvasRef}
            style={{
                display: 'block',
                width: '100%',
                height: '100%',
                imageRendering: 'pixelated',
            }}
        />
    );
}

PixiCanvas.propTypes = {
    worldState: PropTypes.object.isRequired,
    forceRender: PropTypes.number.isRequired,
    onSelectNPC: PropTypes.func.isRequired,
    timeStr: PropTypes.string.isRequired,
    terrainData: PropTypes.object,
    weather: PropTypes.string,
    worldBounds: PropTypes.object,
    onSceneReady: PropTypes.func,
    buildingLabel: PropTypes.func,
};
