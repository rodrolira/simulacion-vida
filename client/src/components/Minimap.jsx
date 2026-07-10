import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Minimapa en vivo del mundo.
 * - Terreno pre-renderizado a un canvas oculto (30k tiles se pintan UNA vez, no por tick).
 * - Recuadro de cámara REAL (posición + viewport), alimentado por GameScene.
 * - Niebla sobre el área no explorada (worldBounds).
 * - Clic para centrar la cámara en ese punto (onNavigate).
 */
export default function Minimap({ worldState, camera, terrainData, worldBounds, tick, onNavigate, width = 180, height = 120 }) {
    const canvasRef = useRef(null);
    const terrainCacheRef = useRef(null);

    const worldW = terrainData?.width || 200;
    const worldH = terrainData?.height || 150;
    const scaleX = width / worldW;
    const scaleY = height / worldH;

    // Pre-render del terreno: solo cuando cambia el terreno (no en cada tick).
    useEffect(() => {
        if (!terrainData?.tiles) {
            terrainCacheRef.current = null;
            return;
        }
        const off = document.createElement('canvas');
        off.width = width;
        off.height = height;
        const ctx = off.getContext('2d');
        const colors = {
            'grass': '#4a8c3f', 'grass_lush': '#3d8c2f',
            'forest': '#2a6a1f', 'forest_dense': '#1a4a0f',
            'sand': '#d4c896', 'water': '#3366aa', 'mountain': '#777777',
        };
        for (let y = 0; y < worldH; y++) {
            for (let x = 0; x < worldW; x++) {
                const tile = terrainData.tiles[y]?.[x] || 'grass';
                ctx.fillStyle = colors[tile] || '#333';
                ctx.fillRect(x * scaleX, y * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
            }
        }
        terrainCacheRef.current = off;
    }, [terrainData, width, height, worldW, worldH, scaleX, scaleY]);

    // Redibujo por tick: terreno cacheado + niebla + entidades + cámara real.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);

        if (terrainCacheRef.current) {
            ctx.drawImage(terrainCacheRef.current, 0, 0);
        } else {
            ctx.fillStyle = '#1a3a1a';
            ctx.fillRect(0, 0, width, height);
        }

        // Niebla del área no explorada (espejo de la del mundo)
        if (worldBounds) {
            const x0 = worldBounds.minX * scaleX;
            const x1 = worldBounds.maxX * scaleX;
            const y0 = worldBounds.minY * scaleY;
            const y1 = worldBounds.maxY * scaleY;
            ctx.fillStyle = 'rgba(8, 12, 22, 0.7)';
            ctx.fillRect(0, 0, width, y0);
            ctx.fillRect(0, y1, width, height - y1);
            ctx.fillRect(0, y0, x0, y1 - y0);
            ctx.fillRect(x1, y0, width - x1, y1 - y0);
        }

        // Edificios
        const buildings = worldState?.getBuildings?.() || [];
        buildings.forEach(b => {
            if (b.Position) {
                ctx.fillStyle = '#c9a86a';
                ctx.fillRect(b.Position.x * scaleX - 1, b.Position.y * scaleY - 1, 3, 3);
            }
        });

        // NPCs
        const npcs = worldState?.getNPCs?.() || [];
        npcs.forEach(n => {
            if (n.Position) {
                ctx.fillStyle = n.Health?.is_sick ? '#ff4444' : '#ffffff';
                ctx.fillRect(n.Position.x * scaleX - 1, n.Position.y * scaleY - 1, 2, 2);
            }
        });

        // Recuadro de cámara REAL (posición y viewport vivos desde GameScene)
        if (camera) {
            const vw = (camera.viewW ?? 30) * scaleX;
            const vh = (camera.viewH ?? 20) * scaleY;
            ctx.strokeStyle = '#ffee55';
            ctx.lineWidth = 1;
            ctx.strokeRect(
                camera.x * scaleX - vw / 2,
                camera.y * scaleY - vh / 2,
                vw,
                vh
            );
        }
    }, [worldState, camera, worldBounds, tick, width, height, scaleX, scaleY]);

    // Clic → centrar la cámara del mundo en ese punto
    const handleClick = (e) => {
        if (!onNavigate) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * worldW;
        const y = ((e.clientY - rect.top) / rect.height) * worldH;
        onNavigate(x, y);
    };

    return (
        <canvas ref={canvasRef} width={width} height={height}
            onClick={handleClick}
            style={{
                border: '2px solid rgba(255,255,255,0.3)',
                borderRadius: 4,
                imageRendering: 'pixelated',
                cursor: onNavigate ? 'pointer' : 'default',
            }}
            title="Minimapa — clic para viajar a esa zona"
        />
    );
}

Minimap.propTypes = {
    worldState: PropTypes.object.isRequired,
    camera: PropTypes.shape({
        x: PropTypes.number,
        y: PropTypes.number,
        zoom: PropTypes.number,
        viewW: PropTypes.number,
        viewH: PropTypes.number,
    }),
    terrainData: PropTypes.object,
    worldBounds: PropTypes.object,
    tick: PropTypes.number,
    onNavigate: PropTypes.func,
    width: PropTypes.number,
    height: PropTypes.number,
};
