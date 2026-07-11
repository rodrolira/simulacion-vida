import React from 'react';
import PropTypes from 'prop-types';
import { useI18n } from '../i18n';

const BUILDING_ICON = {
    hospital: '🏥', school: '🏫', farm: '🌾', office: '🏢', shop: '🏪', house: '🏠',
    totem: '🗿', temple: '🏛️', market: '🛒', granary: '🌽', monument: '🗼', bathhouse: '♨️',
    church: '⛪', mill: '🌬️', blacksmith: '🔨', tavern: '🍺', watchtower: '🗼', library: '📚',
    factory: '🏭', warehouse: '📦', lab: '🔬', dome: '🛸', greenhouse: '🌱', spire: '🏙️',
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

function StatBar({ label, value }) {
    const v = Math.max(0, Math.min(100, value ?? 0));
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ color: 'var(--ink-2)' }}>{label}</span>
                <span className="tnum" style={{ color: barColor(v), fontWeight: 600 }}>{v.toFixed(0)}%</span>
            </div>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${v}%`, background: barColor(v) }} /></div>
        </div>
    );
}
StatBar.propTypes = { label: PropTypes.string, value: PropTypes.number };

function TraitBar({ label, value }) {
    const v = value ?? 0;
    const pct = Math.min(50, Math.abs(v) * 50);
    const pos = v >= 0;
    return (
        <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 11 }}>
                <span style={{ color: 'var(--ink-3)' }}>{label}</span>
                <span className="tnum" style={{ color: pos ? 'var(--ok)' : 'var(--bad)' }}>{pos ? '+' : ''}{v.toFixed(2)}</span>
            </div>
            <div className="bar-track" style={{ position: 'relative', height: 4 }}>
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--border-strong)' }} />
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: pos ? '50%' : `${50 - pct}%`, width: `${pct}%`, background: pos ? 'var(--ok)' : 'var(--bad)', borderRadius: 999 }} />
            </div>
        </div>
    );
}
TraitBar.propTypes = { label: PropTypes.string, value: PropTypes.number };

function BuildingPanel({ building, residents, workers, onSelectNPC }) {
    const { t, tBuilding } = useI18n();
    const type = building.Building?.building_type || 'house';
    const icon = BUILDING_ICON[type] || '🏘️';
    const shop = building.Shop;
    const bed = building.Bed;

    const npcRow = (n, note) => (
        <div key={n.id} onClick={() => onSelectNPC?.(n.id)} className="row-click" style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 11, marginBottom: 4, padding: '7px 9px',
            background: 'var(--panel-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)',
        }} title={t('ui.viewNpc')}>
            <span style={{ color: 'var(--ink)' }}>{n.Health?.is_sick ? '🤒 ' : ''}{n.Identity?.name || `#${n.id}`}</span>
            <span style={{ color: 'var(--ink-3)', fontSize: 10 }}>{note}</span>
        </div>
    );

    return (
        <>
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 4 }}>
                <div style={{ fontSize: 28, lineHeight: 1 }}>{icon}</div>
                <h2 style={{ color: 'var(--amber)', margin: '8px 0 2px', fontSize: 18, fontWeight: 700 }}>{tBuilding(building)}</h2>
                <div style={{ color: 'var(--ink-3)', fontSize: 11 }}>
                    {t(`buildingType.${type}`)} · {t('ui.capacity')} <span className="tnum">{building.Building?.capacity ?? '—'}</span>
                </div>
            </div>

            {bed && <MetaRow label={t('ui.bedComfort')}><span className="tnum" style={{ color: 'var(--amber)' }}>{bed.comfort?.toFixed(1)}×</span></MetaRow>}

            {shop && (
                <>
                    <div className="section-label">{t('ui.commerce')}</div>
                    <MetaRow label={t('ui.unitPrice')}><span className="tnum" style={{ color: 'var(--amber)' }}>${shop.price_per_unit?.toFixed(1)}</span></MetaRow>
                    <MetaRow label={t('ui.stock')}><span className="tnum" style={{ color: shop.stock > 20 ? 'var(--ok)' : 'var(--bad)' }}>{shop.stock}</span></MetaRow>
                </>
            )}

            <div className="section-label">{t('ui.residents')} ({residents.length})</div>
            {residents.length === 0
                ? <p style={{ color: 'var(--ink-muted)', fontSize: 11 }}>{t('ui.nobodyLives')}</p>
                : residents.map(n => npcRow(n, `${n.Identity?.age} ${t('ui.years')}`))}

            <div className="section-label">{t('ui.workers')} ({workers.length})</div>
            {workers.length === 0
                ? <p style={{ color: 'var(--ink-muted)', fontSize: 11 }}>{t('ui.nobodyWorks')}</p>
                : workers.map(n => npcRow(n, `${t(`profession.${n.Profession?.type}`)} · ${n.Workplace?.shift_start}–${n.Workplace?.shift_end}h`))}
        </>
    );
}
BuildingPanel.propTypes = {
    building: PropTypes.object.isRequired,
    residents: PropTypes.array,
    workers: PropTypes.array,
    onSelectNPC: PropTypes.func,
};

export default function InfoPanel({ npc, building, residents = [], workers = [], nameById = {}, buildingById = {}, onSelectNPC }) {
    const { t, tBuilding, tMemory } = useI18n();

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
                <p style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-line' }}>🖱️{'\n'}{t('ui.emptySelection')}</p>
            </div>
        );
    }

    const { Identity, Needs, Emotions, Personality, Profession, Wallet,
        ActionState, Health, Memory, Relationships, Residence } = npc;

    const nameOf = (id) => nameById[id] || (id != null ? `#${id}` : '—');

    const allMemories = Memory?.entries || [];
    const conversations = allMemories.filter(m => m.event_type === 'social_interaction').sort((a, b) => b.tick - a.tick);
    const otherMemories = allMemories.filter(m => m.event_type !== 'social_interaction').sort((a, b) => b.tick - a.tick);

    const talkingTo = ActionState?.action === 'socializing' && ActionState?.target_entity != null ? nameOf(ActionState.target_entity) : null;

    return (
        <div className="scroll-warm" style={{ ...PANEL, color: 'var(--ink-2)', animation: 'panelIn 200ms cubic-bezier(0.23,1,0.32,1)' }}>
            {/* Foco: identidad */}
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
                <h2 style={{ color: 'var(--amber)', margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '0.01em' }}>
                    {Identity?.name || '—'}
                    {Health?.is_sick && <span style={{ fontSize: 14 }}> 🤒</span>}
                </h2>
                <div style={{ color: 'var(--ink-3)', fontSize: 11, margin: '3px 0 10px' }}>
                    <span className="tnum">{Identity?.age}</span> {t('ui.years')} · {sexIcon(Identity?.sex)} · {t(`culture.${Identity?.culture}`)}
                </div>

                <MetaRow label={t('ui.profession')}>
                    <span style={{ color: 'var(--amber)' }}>{t(`profession.${Profession?.type}`)}</span>
                    <span style={{ color: 'var(--ink-3)' }}> · <span className="tnum">${Profession?.salary}</span>{t('ui.perDay')}</span>
                </MetaRow>
                <MetaRow label={t('ui.money')}><span className="tnum" style={{ color: 'var(--ok)' }}>${Wallet?.cash?.toFixed(0)}</span></MetaRow>
                {Residence?.building_id != null && buildingById[Residence.building_id] && (
                    <MetaRow label={t('ui.livesIn')}>🏠 {tBuilding(buildingById[Residence.building_id])}</MetaRow>
                )}
                <MetaRow label={t('ui.action')}><span style={{ color: 'var(--ink)' }}>{t(`action.${ActionState?.action}`)}</span></MetaRow>

                {talkingTo && (
                    <div style={{ marginTop: 10, padding: '7px 10px', borderRadius: 'var(--r-sm)', background: 'rgba(134,192,122,0.12)', borderLeft: '2px solid var(--ok)', fontSize: 11, color: 'var(--ok)' }}>
                        💬 {t('ui.talkingWith')} <strong style={{ color: 'var(--ink)' }}>{talkingTo}</strong>
                    </div>
                )}
            </div>

            {/* Conversaciones */}
            <div className="section-label">{t('ui.secConversations')} ({conversations.length})</div>
            {conversations.length === 0 && <p style={{ color: 'var(--ink-muted)', fontSize: 11 }}>{t('ui.noConversations')}</p>}
            {conversations.slice(0, 6).map((m, i) => {
                const key = Object.keys(m.emotional_impact || {})[0];
                const val = key ? m.emotional_impact[key] : null;
                const good = key === 'happiness';
                return (
                    <div key={`${m.tick}-${i}`} style={{ fontSize: 11, marginBottom: 5, padding: '7px 9px', background: 'var(--panel-2)', borderRadius: 'var(--r-sm)', borderLeft: `2px solid ${good ? 'var(--ok)' : 'var(--bad)'}` }}>
                        <div style={{ color: 'var(--ink)' }}>{tMemory(m, nameOf)}</div>
                        <div style={{ color: 'var(--ink-muted)', marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
                            <span>t<span className="tnum">{m.tick}</span> · {nameOf(m.target_id)}</span>
                            {key && <span className="tnum" style={{ color: good ? 'var(--ok)' : 'var(--bad)' }}>
                                {good ? '+' : '−'}{Math.abs(val).toFixed(1)} {good ? t('ui.happiness') : t('ui.anger')}
                            </span>}
                        </div>
                    </div>
                );
            })}

            {/* Necesidades */}
            <div className="section-label">{t('ui.secNeeds')}</div>
            {Needs && Object.entries(Needs).map(([k, v]) => <StatBar key={k} label={t(`need.${k}`)} value={v} />)}

            {/* Emociones */}
            <div className="section-label">{t('ui.secEmotions')}</div>
            {Emotions && Object.entries(Emotions).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
                    <span style={{ color: 'var(--ink-3)' }}>{t(`emotion.${k}`)}</span>
                    <span className="tnum" style={{ color: v > 60 ? 'var(--ok)' : v > 30 ? 'var(--warn)' : 'var(--ink-muted)' }}>{v?.toFixed(0)}%</span>
                </div>
            ))}

            {/* Personalidad */}
            <div className="section-label">{t('ui.secPersonality')}</div>
            {Personality && Object.entries(Personality).map(([k, v]) => <TraitBar key={k} label={t(`trait.${k}`)} value={v} />)}

            {/* Relaciones */}
            <div className="section-label">{t('ui.secRelationships')} ({Relationships?.relations ? Object.keys(Relationships.relations).length : 0})</div>
            {Relationships?.relations && Object.values(Relationships.relations)
                .sort((a, b) => Math.abs(b.friendship) - Math.abs(a.friendship))
                .slice(0, 6)
                .map((rel, i) => {
                    const c = rel.friendship > 50 ? 'var(--ok)' : rel.friendship > 20 ? '#a9cf7a' : rel.friendship < -50 ? 'var(--bad)' : rel.friendship < -20 ? 'var(--warn)' : 'var(--ink-3)';
                    return (
                        <div key={i} onClick={() => onSelectNPC?.(rel.target_id)} className="row-click" style={{ fontSize: 11, marginBottom: 3, padding: '5px 8px', borderRadius: 'var(--r-sm)', display: 'flex', justifyContent: 'space-between' }} title={t('ui.viewNpc')}>
                            <span style={{ color: 'var(--ink-2)' }}>{nameOf(rel.target_id)}</span>
                            <span style={{ color: c }}>{t(`relType.${rel.type}`)} (<span className="tnum">{rel.friendship > 0 ? '+' : ''}{rel.friendship?.toFixed(0)}</span>)</span>
                        </div>
                    );
                })}

            {/* Otros recuerdos */}
            <div className="section-label">{t('ui.secOtherMemories')} ({otherMemories.length})</div>
            {otherMemories.slice(0, 5).map((m, i) => (
                <div key={`${m.tick}-${i}`} style={{ fontSize: 11, marginBottom: 4, padding: '6px 8px', background: 'var(--panel-2)', borderRadius: 'var(--r-sm)', borderLeft: '2px solid var(--border-strong)' }}>
                    <div style={{ color: 'var(--ink-muted)', marginBottom: 2, fontSize: 10 }}>t<span className="tnum">{m.tick}</span></div>
                    <div style={{ color: 'var(--ink-3)' }}>{tMemory(m, nameOf)}</div>
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
    buildingById: PropTypes.object,
    onSelectNPC: PropTypes.func,
};
