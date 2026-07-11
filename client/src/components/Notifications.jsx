import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const SEVERITY = {
    info: { color: 'var(--info)', icon: 'ℹ️' },
    warning: { color: 'var(--warn)', icon: '⚠️' },
    critical: { color: 'var(--bad)', icon: '🚨' },
};

export default function Notifications({ events = [], onDismiss, maxNotifications = 6 }) {
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

    const visible = notifications.filter(n => n.shown);
    if (!visible.length) return null;

    return (
        <div style={{
            position: 'absolute', top: 12, right: 12, zIndex: 20,
            display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 340, alignItems: 'stretch',
        }}>
            {visible.map(n => {
                const cfg = SEVERITY[n.severity] || SEVERITY.info;
                return (
                    <div
                        key={n.id}
                        onClick={() => onDismiss?.(n.tick)}
                        className="hud-panel"
                        style={{
                            display: 'flex', alignItems: 'flex-start', gap: 9,
                            padding: '9px 12px', cursor: 'pointer', fontSize: 12,
                            color: 'var(--ink-2)', lineHeight: 1.4,
                            borderLeft: `3px solid ${cfg.color}`,
                            animation: 'slideIn 220ms cubic-bezier(0.23,1,0.32,1)',
                        }}>
                        <span style={{ fontSize: 13, marginTop: 1 }}>{cfg.icon}</span>
                        <span>{n.description}</span>
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
