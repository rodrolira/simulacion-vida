import React from 'react';
import PropTypes from 'prop-types';
import { useI18n } from '../i18n';

export default function HUD({ timeStr, day, npcCount, fps, speed, running, weather, onSpeedChange, onPause, onResume }) {
    const { t, tWeather, lang, setLang } = useI18n();
    const speeds = [0.5, 1, 2, 5, 10];
    const wx = tWeather(weather || 'clear');

    return (
        <div className="hud-panel" style={{
            position: 'absolute', top: 12, left: 12, zIndex: 10,
            padding: 14, minWidth: 214, animation: 'panelIn 220ms cubic-bezier(0.23,1,0.32,1)',
        }}>
            {/* Foco: reloj del mundo */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span className="tnum" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.02em' }}>
                    {timeStr}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
                    {t('ui.day')} <span className="tnum" style={{ color: 'var(--amber)', fontWeight: 600 }}>{day}</span>
                </span>
            </div>

            {/* Meta: clima · población · fps */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--ink-3)' }}>
                <span title={wx.label}>{wx.icon} {wx.label}</span>
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 11, color: 'var(--ink-3)' }}>
                <span>👥 <span className="tnum" style={{ color: 'var(--ink-2)' }}>{npcCount}</span></span>
                <span>⚡ <span className="tnum" style={{ color: fps < 30 ? 'var(--bad)' : 'var(--ok)' }}>{fps}</span> {t('ui.fps')}</span>
            </div>

            {/* Controles */}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 10 }}>
                <button
                    className="btn"
                    onClick={running ? onPause : onResume}
                    style={{
                        width: '100%', padding: '7px 0', marginBottom: 8, fontSize: 12, fontWeight: 600,
                        color: running ? 'var(--bad)' : 'var(--ok)',
                        borderColor: running ? 'rgba(224,112,92,0.3)' : 'rgba(134,192,122,0.3)',
                        background: running ? 'rgba(224,112,92,0.10)' : 'rgba(134,192,122,0.10)',
                    }}>
                    {running ? t('ui.pause') : t('ui.resume')}
                </button>
                <div style={{ display: 'flex', gap: 4 }}>
                    {speeds.map(s => (
                        <button
                            key={s}
                            onClick={() => onSpeedChange(s)}
                            className={`btn btn-seg ${speed === s ? 'is-active' : ''}`}
                            style={{ flex: 1, padding: '5px 0', fontSize: 11, fontWeight: 600 }}>
                            {s}×
                        </button>
                    ))}
                </div>
            </div>

            {/* Selector de idioma */}
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                {['es', 'en'].map(l => (
                    <button
                        key={l}
                        onClick={() => setLang(l)}
                        className={`btn btn-seg ${lang === l ? 'is-active' : ''}`}
                        style={{ flex: 1, padding: '4px 0', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em' }}>
                        {l.toUpperCase()}
                    </button>
                ))}
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
