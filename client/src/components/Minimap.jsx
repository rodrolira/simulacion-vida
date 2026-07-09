import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

export default function Minimap({ worldState, camera, terrainData, width = 180, height = 120 }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const scaleX = width / 320;
        const scaleY = height / 240;

        ctx.clearRect(0, 0, width, height);

        // Fondo o terreno
        if (terrainData?.tiles) {
            const colors = {
                'grass': '#4a8c3f', 'grass_lush': '#3d8c2f',
                'forest': '#2a6a1f', 'forest_dense': '#1a4a0f',
                'sand': '#d4c896', 'water': '#3366aa', 'mountain': '#777777',
            };
            for (let y = 0; y < Math.min(terrainData.height, 240); y++) {
                for (let x = 0; x < Math.min(terrainData.width, 320); x++) {
                    const tile = terrainData.tiles[y]?.[x] || 'grass';
                    ctx.fillStyle = colors[tile] || '#333';
                    ctx.fillRect(x * scaleX, y * scaleY, Math.ceil(scaleX) + 1, Math.ceil(scaleY) + 1);
                }
            }
        } else {
            ctx.fillStyle = '#1a3a1a';
            ctx.fillRect(0, 0, width, height);
        }

        // Edificios
        const buildings = worldState?.getBuildings?.() || [];
        buildings.forEach(b => {
            if (b.Position) {
                ctx.fillStyle = '#888';
                ctx.fillRect(b.Position.x * scaleX, b.Position.y * scaleY, 3, 3);
            }
        });

        // NPCs
        const npcs = worldState?.getNPCs?.() || [];
        npcs.forEach(n => {
            if (n.Position) {
                ctx.fillStyle = n.Health?.is_sick ? '#ff4444' : '#fff';
                ctx.fillRect(n.Position.x * scaleX, n.Position.y * scaleY, 2, 2);
            }
        });

        // Cámara
        if (camera) {
            const viewW = width / (camera.zoom || 2);
            const viewH = height / (camera.zoom || 2);
            ctx.strokeStyle = '#ff0';
            ctx.lineWidth = 1;
            ctx.strokeRect(
                ((camera.x || 100) - viewW / 2) * scaleX,
                ((camera.y || 80) - viewH / 2) * scaleY,
                viewW * scaleX,
                viewH * scaleY
            );
        }
    }, [worldState, camera, terrainData, width, height]);

    return (
        <canvas ref={canvasRef} width={width} height={height}
            style={{
                border: '2px solid rgba(255,255,255,0.3)',
                borderRadius: 4,
                imageRendering: 'pixelated',
            }}
            title="Minimapa del mundo"
        />
    );
}

Minimap.propTypes = {
    worldState: PropTypes.object.isRequired,
    camera: PropTypes.shape({
        x: PropTypes.number,
        y: PropTypes.number,
        zoom: PropTypes.number,
    }),
    terrainData: PropTypes.object,
    width: PropTypes.number,
    height: PropTypes.number,
};
