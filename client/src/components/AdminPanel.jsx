import React, { useState } from 'react';
import PropTypes from 'prop-types';

const EVENTS = [
    { id: 'epidemic', label: 'Epidemia', icon: '🦠', tone: 'var(--bad)' },
    { id: 'economic_crisis', label: 'Crisis económica', icon: '📉', tone: 'var(--warn)' },
    { id: 'migration', label: 'Migración', icon: '👥', tone: 'var(--ok)' },
    { id: 'storm', label: 'Tormenta', icon: '⛈️', tone: 'var(--info)' },
    { id: 'drought', label: 'Sequía', icon: '🌵', tone: 'var(--warn)' },
    { id: 'miracle', label: 'Milagro', icon: '✨', tone: 'var(--amber)' },
    { id: 'party', label: 'Fiesta', icon: '🎉', tone: 'var(--amber)' },
];

export default function AdminPanel({ onTriggerEvent }) {
    const [open, setOpen] = useState(false);

    if (!open) {
        return (
            <button
                className="btn"
                onClick={() => setOpen(true)}
                style={{
                    position: 'absolute', bottom: 12, left: 12, zIndex: 20,
                    padding: '8px 15px', fontSize: 12, fontWeight: 600,
                    color: 'var(--amber)', borderColor: 'var(--amber-line)',
                    background: 'var(--amber-soft)', backdropFilter: 'blur(6px)',
                }}>
                ⚙  Eventos
            </button>
        );
    }

    return (
        <div className="hud-panel" style={{
            position: 'absolute', bottom: 12, left: 12, zIndex: 20,
            padding: 14, width: 226, animation: 'panelIn 200ms cubic-bezier(0.23,1,0.32,1)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="section-label" style={{ margin: 0 }}>Provocar evento</span>
                <button
                    onClick={() => setOpen(false)}
                    className="btn"
                    style={{ width: 24, height: 24, padding: 0, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1 }}
                    aria-label="Cerrar">
                    ✕
                </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {EVENTS.map(ev => (
                    <button
                        key={ev.id}
                        onClick={() => { onTriggerEvent(ev.id); setOpen(false); }}
                        className="btn row-click"
                        style={{
                            display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                            padding: '8px 10px', fontSize: 12, textAlign: 'left', color: 'var(--ink-2)',
                            borderLeft: `2px solid ${ev.tone}`,
                        }}>
                        <span style={{ fontSize: 14 }}>{ev.icon}</span>
                        {ev.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

AdminPanel.propTypes = {
    onTriggerEvent: PropTypes.func.isRequired,
};
