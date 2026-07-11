import React from 'react';
import PropTypes from 'prop-types';

const BUILDING_META = {
    hospital: { icon: '🏥', label: 'Hospital' },
    school: { icon: '🏫', label: 'Escuela' },
    farm: { icon: '🌾', label: 'Granja' },
    office: { icon: '🏢', label: 'Oficina' },
    shop: { icon: '🏪', label: 'Tienda' },
    house: { icon: '🏠', label: 'Casa' },
};

const PANEL = {
    width: 312,
    background: 'var(--panel)',
    borderLeft: '1px solid var(--border)',
    padding: 18,
    fontSize: 12,
    color: 'var(--ink-2)',
    overflowY: 'auto',
    height: '100vh',
};

const sexIcon = (s) => (s === 'female' ? '♀' : s === 'male' ? '♂' : '·');
const barColor = (v) => (v > 60 ? 'var(--ok)' : v > 30 ? 'var(--warn)' : 'var(--bad)');

function MetaRow({ label, children }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0', fontSize: 12 }}>
            <span style={{ color: 'var(--ink-3)' }}>{label}</span>
            <span style={{ color: 'var(--ink)', textAlign: 'right' }}>{children}</span>
        </div>
    );
}
MetaRow.propTypes = { label: PropTypes.string, children: PropTypes.node };

/** Barra horizontal 0–100 con etiqueta y valor tabular. */
function StatBar({ label, value }) {
    const v = Math.max(0, Math.min(100, value ?? 0));
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ color: 'var(--ink-2)' }}>{label}</span>
                <span className="tnum" style={{ color: barColor(v), fontWeight: 600 }}>{v.toFixed(0)}%</span>
            </div>
            <div className="bar-track">
                <div className="bar-fill" style={{ width: `${v}%`, background: barColor(v) }} />
            </div>
        </div>
    );
}
StatBar.propTypes = { label: PropTypes.string, value: PropTypes.number };

/** Barra divergente centrada en 0 para rasgos de personalidad (−1..+1). */
function TraitBar({ label, value }) {
    const v = value ?? 0;
    const pct = Math.min(50, Math.abs(v) * 50);
    const pos = v >= 0;
    return (
        <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 11 }}>
                <span style={{ color: 'var(--ink-3)' }}>{label}</span>
                <span className="tnum" style={{ color: pos ? 'var(--ok)' : 'var(--bad)' }}>
                    {pos ? '+' : ''}{v.toFixed(2)}
                </span>
            </div>
            <div className="bar-track" style={{ position: 'relative', height: 4 }}>
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--border-strong)' }} />
                <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: pos ? '50%' : `${50 - pct}%`, width: `${pct}%`,
                    background: pos ? 'var(--ok)' : 'var(--bad)', borderRadius: 999,
                }} />
            </div>
        </div>
    );
}
TraitBar.propTypes = { label: PropTypes.string, value: PropTypes.number };

function BuildingPanel({ building, residents, workers, onSelectNPC }) {
    const meta = BUILDING_META[building.Building?.building_type] || { icon: '🏘️', label: 'Edificio' };
    const shop = building.Shop;
    const bed = building.Bed;

    const npcRow = (n, note) => (
        <div key={n.id} onClick={() => onSelectNPC?.(n.id)} className="row-click" style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 11, marginBottom: 4, padding: '7px 9px',
            background: 'var(--panel-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)',
        }} title="Ver ficha del NPC">
            <span style={{ color: 'var(--ink)' }}>{n.Health?.is_sick ? '🤒 ' : ''}{n.Identity?.name || `#${n.id}`}</span>
            <span style={{ color: 'var(--ink-3)', fontSize: 10 }}>{note}</span>
        </div>
    );

    return (
        <>
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 4 }}>
                <div style={{ fontSize: 28, lineHeight: 1 }}>{meta.icon}</div>
                <h2 style={{ color: 'var(--amber)', margin: '8px 0 2px', fontSize: 18, fontWeight: 700 }}>
                    {building.Building?.name || meta.label}
                </h2>
                <div style={{ color: 'var(--ink-3)', fontSize: 11 }}>
                    {meta.label} · capacidad <span className="tnum">{building.Building?.capacity ?? '—'}</span>
                </div>
            </div>

            {bed && <MetaRow label="Confort de cama">
                <span className="tnum" style={{ color: 'var(--amber)' }}>{bed.comfort?.toFixed(1)}×</span>
            </MetaRow>}

            {shop && (
                <>
                    <div className="section-label">Comercio</div>
                    <MetaRow label="Precio unidad">
                        <span className="tnum" style={{ color: 'var(--amber)' }}>${shop.price_per_unit?.toFixed(1)}</span>
                    </MetaRow>
                    <MetaRow label="Stock">
                        <span className="tnum" style={{ color: shop.stock > 20 ? 'var(--ok)' : 'var(--bad)' }}>{shop.stock}</span>
                    </MetaRow>
                </>
            )}

            <div className="section-label">Residentes ({residents.length})</div>
            {residents.length === 0
                ? <p style={{ color: 'var(--ink-muted)', fontSize: 11 }}>Nadie vive aquí.</p>
                : residents.map(n => npcRow(n, `${n.Identity?.age} años`))}

            <div className="section-label">Trabajadores ({workers.length})</div>
            {workers.length === 0
                ? <p style={{ color: 'var(--ink-muted)', fontSize: 11 }}>Nadie trabaja aquí.</p>
                : workers.map(n => npcRow(n, `${n.Profession?.type} · ${n.Workplace?.shift_start}–${n.Workplace?.shift_end}h`))}
        </>
    );
}
BuildingPanel.propTypes = {
    building: PropTypes.object.isRequired,
    residents: PropTypes.array,
    workers: PropTypes.array,
    onSelectNPC: PropTypes.func,
};

export default function InfoPanel({ npc, building, residents = [], workers = [], nameById = {}, buildingNameById = {}, onSelectNPC }) {
    if (building) {
        return (
            <div className="scroll-warm" style={{ ...PANEL, animation: 'panelIn 200ms cubic-bezier(0.23,1,0.32,1)' }}>
                <BuildingPanel building={building} residents={residents} workers={workers} onSelectNPC={onSelectNPC} />
            </div>
        );
    }

    if (!npc) {
        return (
            <div style={{ ...PANEL, color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <p style={{ fontSize: 12, lineHeight: 1.7 }}>
                    🖱️<br />Haz clic en un NPC o edificio<br />para asomarte a su vida
                </p>
            </div>
        );
    }

    const { Identity, Needs, Emotions, Personality, Profession, Wallet,
        ActionState, Health, Memory, Relationships, Residence } = npc;

    const nameOf = (id) => nameById[id] || (id != null ? `NPC #${id}` : 'alguien');

    const allMemories = Memory?.entries || [];
    const conversations = allMemories.filter(m => m.event_type === 'social_interaction').sort((a, b) => b.tick - a.tick);
    const otherMemories = allMemories.filter(m => m.event_type !== 'social_interaction').sort((a, b) => b.tick - a.tick);

    const talkingTo = ActionState?.action === 'socializing' && ActionState?.target_entity != null
        ? nameOf(ActionState.target_entity) : null;

    return (
        <div className="scroll-warm" style={{ ...PANEL, color: 'var(--ink-2)', animation: 'panelIn 200ms cubic-bezier(0.23,1,0.32,1)' }}>
            {/* Foco: identidad */}
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
                <h2 style={{ color: 'var(--amber)', margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '0.01em' }}>
                    {Identity?.name || 'Desconocido'}
                    {Health?.is_sick && <span title="Enfermo" style={{ fontSize: 14 }}> 🤒</span>}
                </h2>
                <div style={{ color: 'var(--ink-3)', fontSize: 11, margin: '3px 0 10px' }}>
                    <span className="tnum">{Identity?.age}</span> años · {sexIcon(Identity?.sex)} · {Identity?.culture}
                </div>

                <MetaRow label="Profesión">
                    <span style={{ color: 'var(--amber)' }}>{Profession?.type}</span>
                    <span style={{ color: 'var(--ink-3)' }}> · <span className="tnum">${Profession?.salary}</span>/día</span>
                </MetaRow>
                <MetaRow label="Dinero"><span className="tnum" style={{ color: 'var(--ok)' }}>${Wallet?.cash?.toFixed(0)}</span></MetaRow>
                {Residence?.building_id != null && (
                    <MetaRow label="Vive en">
                        🏠 {buildingNameById[Residence.building_id] || `Casa #${Residence.building_id}`}
                    </MetaRow>
                )}
                <MetaRow label="Acción"><span style={{ color: 'var(--ink)' }}>{ActionState?.action}</span></MetaRow>

                {talkingTo && (
                    <div style={{
                        marginTop: 10, padding: '7px 10px', borderRadius: 'var(--r-sm)',
                        background: 'rgba(134,192,122,0.12)', borderLeft: '2px solid var(--ok)', fontSize: 11, color: 'var(--ok)',
                    }}>
                        💬 Hablando ahora con <strong style={{ color: 'var(--ink)' }}>{talkingTo}</strong>
                    </div>
                )}
            </div>

            {/* Conversaciones */}
            <div className="section-label">Conversaciones ({conversations.length})</div>
            {conversations.length === 0 && <p style={{ color: 'var(--ink-muted)', fontSize: 11 }}>Aún no ha hablado con nadie.</p>}
            {conversations.slice(0, 6).map((m, i) => {
                const key = Object.keys(m.emotional_impact || {})[0];
                const val = key ? m.emotional_impact[key] : null;
                const good = key === 'happiness';
                return (
                    <div key={`${m.tick}-${i}`} style={{
                        fontSize: 11, marginBottom: 5, padding: '7px 9px',
                        background: 'var(--panel-2)', borderRadius: 'var(--r-sm)',
                        borderLeft: `2px solid ${good ? 'var(--ok)' : 'var(--bad)'}`,
                    }}>
                        <div style={{ color: 'var(--ink)' }}>{m.description}</div>
                        <div style={{ color: 'var(--ink-muted)', marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
                            <span>t<span className="tnum">{m.tick}</span> · {nameOf(m.target_id)}</span>
                            {key && <span className="tnum" style={{ color: good ? 'var(--ok)' : 'var(--bad)' }}>
                                {good ? '+' : '−'}{Math.abs(val).toFixed(1)} {good ? 'felicidad' : 'enfado'}
                            </span>}
                        </div>
                    </div>
                );
            })}

            {/* Necesidades */}
            <div className="section-label">Necesidades</div>
            {Needs && Object.entries(Needs).map(([k, v]) => <StatBar key={k} label={k} value={v} />)}

            {/* Emociones */}
            <div className="section-label">Emociones</div>
            {Emotions && Object.entries(Emotions).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
                    <span style={{ color: 'var(--ink-3)' }}>{k}</span>
                    <span className="tnum" style={{ color: v > 60 ? 'var(--ok)' : v > 30 ? 'var(--warn)' : 'var(--ink-muted)' }}>{v?.toFixed(0)}%</span>
                </div>
            ))}

            {/* Personalidad */}
            <div className="section-label">Personalidad</div>
            {Personality && Object.entries(Personality).map(([k, v]) => <TraitBar key={k} label={k} value={v} />)}

            {/* Relaciones */}
            <div className="section-label">
                Relaciones ({Relationships?.relations ? Object.keys(Relationships.relations).length : 0})
            </div>
            {Relationships?.relations && Object.values(Relationships.relations)
                .sort((a, b) => Math.abs(b.friendship) - Math.abs(a.friendship))
                .slice(0, 6)
                .map((rel, i) => {
                    const c = rel.friendship > 50 ? 'var(--ok)' : rel.friendship > 20 ? '#a9cf7a'
                        : rel.friendship < -50 ? 'var(--bad)' : rel.friendship < -20 ? 'var(--warn)' : 'var(--ink-3)';
                    return (
                        <div key={i} onClick={() => onSelectNPC?.(rel.target_id)} className="row-click" style={{
                            fontSize: 11, marginBottom: 3, padding: '5px 8px', borderRadius: 'var(--r-sm)',
                            display: 'flex', justifyContent: 'space-between',
                        }} title="Ver ficha del NPC">
                            <span style={{ color: 'var(--ink-2)' }}>{nameOf(rel.target_id)}</span>
                            <span style={{ color: c }}>{rel.type} (<span className="tnum">{rel.friendship > 0 ? '+' : ''}{rel.friendship?.toFixed(0)}</span>)</span>
                        </div>
                    );
                })}

            {/* Otros recuerdos */}
            <div className="section-label">Otros recuerdos ({otherMemories.length})</div>
            {otherMemories.slice(0, 5).map((m, i) => (
                <div key={`${m.tick}-${i}`} style={{
                    fontSize: 10, marginBottom: 4, padding: '6px 8px',
                    background: 'var(--panel-2)', borderRadius: 'var(--r-sm)', borderLeft: '2px solid var(--border-strong)',
                }}>
                    <div style={{ color: 'var(--ink-muted)', marginBottom: 2 }}>t<span className="tnum">{m.tick}</span> · {m.event_type}</div>
                    <div style={{ color: 'var(--ink-3)' }}>{m.description}</div>
                </div>
            ))}
        </div>
    );
}

InfoPanel.propTypes = {
    npc: PropTypes.object,
    building: PropTypes.object,
    residents: PropTypes.array,
    workers: PropTypes.array,
    nameById: PropTypes.object,
    buildingNameById: PropTypes.object,
    onSelectNPC: PropTypes.func,
    onRequestInfo: PropTypes.func,
};
