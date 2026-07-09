import React, { useState } from 'react';
import PropTypes from 'prop-types';

export default function AdminPanel({ onTriggerEvent }) {
    const [open, setOpen] = useState(false);

    const events = [
        { id: 'epidemic', label: '🦠 Epidemia', color: '#cc4444' },
        { id: 'economic_crisis', label: '📉 Crisis Económica', color: '#cc8844' },
        { id: 'migration', label: '👥 Migración', color: '#44aa44' },
        { id: 'storm', label: '⛈️ Tormenta', color: '#4444cc' },
        { id: 'drought', label: '☀️ Sequía', color: '#ccaa44' },
        { id: 'miracle', label: '✨ Milagro', color: '#44ccaa' },
        { id: 'party', label: '🎉 Fiesta', color: '#cc44cc' },
    ];

    if (!open) {
        return (
            <button onClick={() => setOpen(true)}
                style={{
                    position: 'absolute', bottom: 10, left: 10, zIndex: 20,
                    padding: '8px 16px', background: 'rgba(0,0,0,0.8)',
                    color: '#ffa500', border: '1px solid #ffa50044',
                    borderRadius: 6, cursor: 'pointer', fontFamily: 'monospace', fontSize: 12,
                }}>
                ⚙️ Admin
            </button>
        );
    }

    return (
        <div style={{
            position: 'absolute', bottom: 10, left: 10, zIndex: 20,
            background: 'rgba(0,0,0,0.95)', border: '1px solid #555',
            borderRadius: 8, padding: 16, minWidth: 220,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ color: '#ffa500', fontFamily: 'monospace', fontSize: 14 }}>⚙️ Admin</span>
                <button onClick={() => setOpen(false)}
                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}>
                    ✕
                </button>
            </div>
            {events.map(ev => (
                <button key={ev.id} onClick={() => { onTriggerEvent(ev.id); setOpen(false); }}
                    style={{
                        display: 'block', width: '100%', marginBottom: 6,
                        padding: '6px 12px', background: ev.color + '22',
                        color: ev.color, border: `1px solid ${ev.color}44`,
                        borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace', fontSize: 11,
                        textAlign: 'left',
                    }}>
                    {ev.label}
                </button>
            ))}
        </div>
    );
}

AdminPanel.propTypes = {
    onTriggerEvent: PropTypes.func.isRequired,
};
