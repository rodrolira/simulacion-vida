import React from 'react';
import PropTypes from 'prop-types';

export default function HUD({ timeStr, day, npcCount, fps, speed, running, weather, onSpeedChange, onPause, onResume }) {
    const speeds = [0.5, 1, 2, 5, 10];

    return (
        <div style={{
            position: 'absolute', top: 10, left: 10, zIndex: 10,
            background: 'rgba(0,0,0,0.75)', color: '#fff',
            padding: '10px 16px', borderRadius: 8,
            fontFamily: 'monospace', fontSize: 13, minWidth: 200,
        }}>
            <div style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 16 }}>🕐 Día {day} - {timeStr}</strong>
                {weather && weather !== 'clear' && (
                    <span style={{ marginLeft: 8 }}>
                        {weather === 'rain' && '🌧️'}
                        {weather === 'storm' && '⛈️'}
                        {weather === 'drought' && '☀️'}
                        {' '}{weather}
                    </span>
                )}
            </div>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8 }}>
                <div>👥 NPCs: <span style={{ color: '#fff' }}>{npcCount}</span></div>
                <div>⚡ <span style={{ color: fps < 30 ? '#f44' : '#4f4' }}>{fps}</span> FPS</div>
            </div>
            <div style={{ borderTop: '1px solid #444', paddingTop: 8 }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
                    <button onClick={running ? onPause : onResume}
                        style={{
                            padding: '5px 14px',
                            background: running ? '#aa4444' : '#44aa44',
                            border: 'none', borderRadius: 4, color: '#fff',
                            cursor: 'pointer', fontSize: 12, fontFamily: 'monospace',
                        }}>
                        {running ? '⏸ Pausa' : '▶ Play'}
                    </button>
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                    {speeds.map(s => (
                        <button key={s} onClick={() => onSpeedChange(s)}
                            style={{
                                padding: '3px 8px',
                                background: speed === s ? '#5588cc' : '#333',
                                border: 'none', borderRadius: 3, color: '#fff',
                                cursor: 'pointer', fontSize: 10, fontFamily: 'monospace',
                            }}>
                            {s}x
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

HUD.propTypes = {
    timeStr: PropTypes.string.isRequired,
    day: PropTypes.number.isRequired,
    npcCount: PropTypes.number.isRequired,
    fps: PropTypes.number.isRequired,
    speed: PropTypes.number.isRequired,
    running: PropTypes.bool.isRequired,
    weather: PropTypes.string,
    onSpeedChange: PropTypes.func.isRequired,
    onPause: PropTypes.func.isRequired,
    onResume: PropTypes.func.isRequired,
};
