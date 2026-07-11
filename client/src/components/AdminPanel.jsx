import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useI18n } from '../i18n';

const EVENTS = [
    { id: 'epidemic', key: 'epidemic', icon: '🦠', tone: 'var(--bad)' },
    { id: 'economic_crisis', key: 'economic_crisis', icon: '📉', tone: 'var(--warn)' },
    { id: 'migration', key: 'migration', icon: '👥', tone: 'var(--ok)' },
    { id: 'storm', key: 'storm', icon: '⛈️', tone: 'var(--info)' },
    { id: 'drought', key: 'drought', icon: '🌵', tone: 'var(--warn)' },
    { id: 'miracle', key: 'miracle', icon: '✨', tone: 'var(--amber)' },
    { id: 'party', key: 'party', icon: '🎉', tone: 'var(--amber)' },
];

export default function AdminPanel({ onTriggerEvent }) {
    const [open, setOpen] = useState(false);
    const { t } = useI18n();

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
                {t('ui.events')}
            </button>
        );
    }

    return (
        <div className="hud-panel" style={{
            position: 'absolute', bottom: 12, left: 12, zIndex: 20,
            padding: 14, width: 226, animation: 'panelIn 200ms cubic-bezier(0.23,1,0.32,1)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="section-label" style={{ margin: 0 }}>{t('ui.triggerEvent')}</span>
                <button
                    onClick={() => setOpen(false)}
                    className="btn"
                    style={{ width: 24, height: 24, padding: 0, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1 }}
                    aria-label={t('ui.close')}>
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
                        {t(`eventName.${ev.key}`)}
                    </button>
                ))}
            </div>
        </div>
    );
}

AdminPanel.propTypes = {
    onTriggerEvent: PropTypes.func.isRequired,
};
