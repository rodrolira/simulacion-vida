import React from 'react';
import PropTypes from 'prop-types';

export default function InfoPanel({ npc, nameById = {}, onRequestInfo }) {
    if (!npc) {
        return (
            <div style={{
                width: 300,
                background: '#1a1a2e',
                color: '#888',
                padding: 20,
                fontFamily: 'monospace',
                fontSize: 13,
                borderLeft: '1px solid #333',
                overflowY: 'auto',
            }}>
                <p style={{ textAlign: 'center', marginTop: 40 }}>
                    🖱️ Haz clic en un NPC<br />para ver su información
                </p>
            </div>
        );
    }

    const { Identity, Needs, Emotions, Personality, Profession, Wallet,
        Schedule, ActionState, Health, Memory, Relationships } = npc;

    const barColor = (value) => {
        if (value > 60) return '#4caf50';
        if (value > 30) return '#ff9800';
        return '#f44336';
    };

    // Resuelve el id de otro NPC a su nombre (para ver CON QUIÉN interactúa)
    const nameOf = (id) => nameById[id] || (id != null ? `NPC #${id}` : 'alguien');

    // Conversaciones: recuerdos de interacción social, del más reciente al más antiguo
    const allMemories = Memory?.entries || [];
    const conversations = allMemories
        .filter(m => m.event_type === 'social_interaction')
        .sort((a, b) => b.tick - a.tick);
    const otherMemories = allMemories
        .filter(m => m.event_type !== 'social_interaction')
        .sort((a, b) => b.tick - a.tick);

    // ¿Está conversando ahora mismo?
    const talkingTo = ActionState?.action === 'socializing' && ActionState?.target_entity != null
        ? nameOf(ActionState.target_entity)
        : null;

    return (
        <div style={{
            width: 300,
            background: '#1a1a2e',
            color: '#ccc',
            padding: 16,
            fontFamily: 'monospace',
            fontSize: 12,
            borderLeft: '1px solid #333',
            overflowY: 'auto',
            height: '100vh',
        }}>
            <div style={{ borderBottom: '1px solid #333', paddingBottom: 12, marginBottom: 12 }}>
                <h2 style={{ color: '#fff', margin: 0, fontSize: 18 }}>
                    {Identity?.name || 'Desconocido'}
                    {Health?.is_sick && <span style={{ color: '#f44' }}> 🤒</span>}
                </h2>
                <p style={{ margin: '4px 0', color: '#888' }}>
                    {Identity?.age} años • {Identity?.sex === 'female' ? '♀️' : '♂️'} • {Identity?.culture}
                </p>
                <p style={{ margin: '4px 0' }}>
                    <span style={{ color: '#888' }}>Profesión:</span>{' '}
                    <span style={{ color: '#ffa500' }}>{Profession?.type}</span>
                    {' '}(+${Profession?.salary}/día)
                </p>
                <p style={{ margin: '4px 0' }}>
                    <span style={{ color: '#888' }}>Dinero:</span>{' '}
                    <span style={{ color: '#4caf50' }}>${Wallet?.cash?.toFixed(0)}</span>
                </p>
                <p style={{ margin: '4px 0' }}>
                    <span style={{ color: '#888' }}>Acción:</span>{' '}
                    <span style={{ color: '#ccc' }}>{ActionState?.action}</span>
                </p>
                {talkingTo && (
                    <div style={{
                        marginTop: 8, padding: '6px 8px', borderRadius: 4,
                        background: 'rgba(76,175,80,0.15)', border: '1px solid #4caf50',
                        color: '#b6e6b8', fontSize: 11,
                    }}>
                        💬 Hablando ahora con <strong style={{ color: '#fff' }}>{talkingTo}</strong>
                    </div>
                )}
            </div>

            {/* Conversaciones con otros NPCs */}
            <h3 style={{ color: '#aaa', marginTop: 12, marginBottom: 8 }}>
                💬 Conversaciones ({conversations.length})
            </h3>
            {conversations.length === 0 && (
                <p style={{ color: '#666', fontSize: 11, marginBottom: 8 }}>
                    Aún no ha hablado con nadie.
                </p>
            )}
            {conversations.slice(0, 6).map((m, i) => {
                const impactKey = Object.keys(m.emotional_impact || {})[0];
                const impactVal = impactKey ? m.emotional_impact[impactKey] : null;
                const good = impactKey === 'happiness';
                return (
                    <div key={`${m.tick}-${i}`} style={{
                        fontSize: 10, marginBottom: 5, padding: 6,
                        background: '#20202e', borderRadius: 4,
                        borderLeft: `2px solid ${good ? '#4caf50' : '#f44336'}`,
                    }}>
                        <div style={{ color: '#ddd' }}>{m.description}</div>
                        <div style={{
                            color: '#777', marginTop: 3,
                            display: 'flex', justifyContent: 'space-between',
                        }}>
                            <span>Tick {m.tick} • {nameOf(m.target_id)}</span>
                            {impactKey && (
                                <span style={{ color: good ? '#4caf50' : '#f44336' }}>
                                    {good ? '+' : '−'}{Math.abs(impactVal).toFixed(1)}{' '}
                                    {good ? 'felicidad' : 'enfado'}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Necesidades */}
            <h3 style={{ color: '#aaa', marginTop: 16, marginBottom: 8 }}>📊 Necesidades</h3>
            {Needs && Object.entries(Needs).map(([key, value]) => (
                <div key={key} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span>{key}:</span>
                        <span style={{ color: barColor(value) }}>{value?.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 6, background: '#333', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                            width: `${value}%`,
                            height: '100%',
                            background: barColor(value),
                            borderRadius: 3,
                        }} />
                    </div>
                </div>
            ))}

            {/* Emociones */}
            <h3 style={{ color: '#aaa', marginTop: 16, marginBottom: 8 }}>😊 Emociones</h3>
            {Emotions && Object.entries(Emotions).map(([key, value]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span>{key}:</span>
                    <span style={{ color: value > 60 ? '#4caf50' : value > 30 ? '#ff9800' : '#888' }}>
                        {value?.toFixed(0)}%
                    </span>
                </div>
            ))}

            {/* Personalidad */}
            <h3 style={{ color: '#aaa', marginTop: 16, marginBottom: 8 }}>🧠 Personalidad</h3>
            {Personality && Object.entries(Personality).map(([key, value]) => (
                <div key={key} style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
                        <span style={{ fontSize: 11 }}>{key}:</span>
                        <span style={{ fontSize: 11, color: value > 0 ? '#4caf50' : '#f44336' }}>
                            {value > 0 ? '+' : ''}{value?.toFixed(2)}
                        </span>
                    </div>
                    <div style={{ height: 4, background: '#333', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                            width: `${((value + 1) / 2) * 100}%`,
                            height: '100%',
                            background: value > 0 ? '#4caf50' : '#f44336',
                            borderRadius: 2,
                        }} />
                    </div>
                </div>
            ))}

            {/* Relaciones */}
            <h3 style={{ color: '#aaa', marginTop: 16, marginBottom: 8 }}>
                💕 Relaciones ({Relationships?.relations ? Object.keys(Relationships.relations).length : 0})
            </h3>
            {Relationships?.relations && Object.values(Relationships.relations)
                .sort((a, b) => Math.abs(b.friendship) - Math.abs(a.friendship))
                .slice(0, 5)
                .map((rel, i) => {
                    const friendColor = rel.friendship > 50 ? '#4caf50' :
                        rel.friendship > 20 ? '#8bc34a' :
                            rel.friendship < -50 ? '#f44336' :
                                rel.friendship < -20 ? '#ff9800' : '#888';
                    return (
                        <div key={i} style={{ fontSize: 11, marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#ddd' }}>{nameOf(rel.target_id)}</span>
                            <span style={{ color: friendColor }}>
                                {rel.type} ({rel.friendship > 0 ? '+' : ''}{rel.friendship?.toFixed(0)})
                            </span>
                        </div>
                    );
                })}

            {/* Memoria */}
            <h3 style={{ color: '#aaa', marginTop: 16, marginBottom: 8 }}>
                📝 Otros recuerdos ({otherMemories.length})
            </h3>
            {otherMemories.slice(0, 5).map((m, i) => (
                <div key={`${m.tick}-${i}`} style={{
                    fontSize: 10, marginBottom: 4, padding: 6,
                    background: '#222', borderRadius: 4, borderLeft: '2px solid #444',
                }}>
                    <div style={{ color: '#888', marginBottom: 2 }}>Tick {m.tick} • {m.event_type}</div>
                    <div style={{ color: '#aaa' }}>{m.description}</div>
                </div>
            ))}
        </div>
    );
}

InfoPanel.propTypes = {
    npc: PropTypes.object,
    nameById: PropTypes.object,
    onRequestInfo: PropTypes.func,
};
