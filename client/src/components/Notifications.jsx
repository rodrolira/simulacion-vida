import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

export default function Notifications({ events = [], onDismiss, maxNotifications = 8 }) {
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        if (!events?.length) return;
        setNotifications(prev => {
            const newEvents = events.filter(
                e => !prev.some(p => p.tick === e.tick && p.description === e.description)
            );
            if (!newEvents.length) return prev;
            return [...newEvents.map(e => ({ ...e, id: `${e.tick}-${Math.random()}`, shown: true, createdAt: Date.now() })), ...prev]
                .slice(0, maxNotifications);
        });
    }, [events, maxNotifications]);

    useEffect(() => {
        const timer = setInterval(() => {
            setNotifications(prev => prev.filter(n => Date.now() - n.createdAt < 8000));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const severityConfig = {
        info: { color: '#4488cc', icon: 'ℹ️' },
        warning: { color: '#ccaa44', icon: '⚠️' },
        critical: { color: '#cc4444', icon: '🚨' },
    };

    const visible = notifications.filter(n => n.shown);
    if (!visible.length) return null;

    return (
        <div style={{ position: 'absolute', top: 70, right: 10, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 350 }}>
            {visible.map(n => {
                const cfg = severityConfig[n.severity] || severityConfig.info;
                return (
                    <div key={n.id} onClick={() => onDismiss?.(n.tick)}
                        style={{
                            background: 'rgba(0,0,0,0.9)', color: '#fff',
                            padding: '10px 14px', borderRadius: 8,
                            borderLeft: `4px solid ${cfg.color}`,
                            cursor: 'pointer', fontFamily: 'monospace', fontSize: 12,
                        }}>
                        <span>{cfg.icon}</span> {n.description}
                    </div>
                );
            })}
        </div>
    );
}

Notifications.propTypes = {
    events: PropTypes.array,
    onDismiss: PropTypes.func,
    maxNotifications: PropTypes.number,
};
