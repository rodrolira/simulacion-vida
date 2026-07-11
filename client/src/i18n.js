import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

/* ============================================================
   Internacionalización (ES / EN)
   El backend envía CÓDIGOS (doctor, working, social_interaction…)
   y datos estructurados (meta); aquí se traduce todo a texto.
   ============================================================ */

export const LANGS = ['es', 'en'];

// Iconos de clima (independientes del idioma)
export const WEATHER_ICON = {
    clear: '☀️', cloudy: '☁️', rain: '🌧️', storm: '⛈️',
    drought: '🌵', fog: '🌫️', snow: '❄️',
};

const L = {
    es: {
        ui: {
            day: 'DÍA', fps: 'fps', pause: '⏸  Pausa', resume: '▶  Reanudar',
            years: 'años', profession: 'Profesión', perDay: '/día', money: 'Dinero',
            livesIn: 'Vive en', action: 'Acción', talkingWith: 'Hablando ahora con',
            secConversations: 'Conversaciones', secNeeds: 'Necesidades', secEmotions: 'Emociones',
            secPersonality: 'Personalidad', secRelationships: 'Relaciones', secOtherMemories: 'Otros recuerdos',
            noConversations: 'Aún no ha hablado con nadie.',
            emptySelection: 'Haz clic en un NPC o edificio\npara asomarte a su vida',
            capacity: 'capacidad', bedComfort: 'Confort de cama', commerce: 'Comercio',
            unitPrice: 'Precio unidad', stock: 'Existencias', residents: 'Residentes', workers: 'Trabajadores',
            nobodyLives: 'Nadie vive aquí.', nobodyWorks: 'Nadie trabaja aquí.',
            events: '⚙  Eventos', triggerEvent: 'Provocar evento', close: 'Cerrar',
            minimapTitle: 'Minimapa — clic para viajar a esa zona',
            renderError: 'Error en el renderizado', retry: 'Reintentar',
            viewNpc: 'Ver ficha del NPC',
            happiness: 'felicidad', anger: 'enfado',
        },
        profession: { doctor: 'médico', teacher: 'maestro', farmer: 'granjero', programmer: 'programador', trader: 'comerciante', unemployed: 'desempleado' },
        action: {
            idle: 'inactivo', wandering: 'deambulando', socializing: 'conversando', buying_food: 'comprando comida',
            eating: 'comiendo', sleeping: 'durmiendo', working: 'trabajando',
            moving_to_work: 'yendo al trabajo', moving_to_shop: 'yendo a la tienda',
            moving_to_sleep: 'yendo a dormir', moving_to_socialize: 'yendo a socializar',
        },
        need: { hunger: 'hambre', energy: 'energía', social: 'socialización' },
        emotion: { happiness: 'felicidad', sadness: 'tristeza', fear: 'miedo', anger: 'enfado', stress: 'estrés', motivation: 'motivación', loneliness: 'soledad' },
        trait: { extroversion: 'extroversión', ambition: 'ambición', generosity: 'generosidad', honesty: 'honestidad', patience: 'paciencia', aggressiveness: 'agresividad', empathy: 'empatía', curiosity: 'curiosidad' },
        relType: { acquaintance: 'conocido', friend: 'amigo', close_friend: 'amigo íntimo', enemy: 'enemigo', rival: 'rival' },
        culture: { urban: 'urbano', rural: 'rural', coastal: 'costero', migrant: 'migrante' },
        weather: { clear: 'Despejado', cloudy: 'Nublado', rain: 'Lluvia', storm: 'Tormenta', drought: 'Sequía', fog: 'Niebla', snow: 'Nieve' },
        buildingType: { hospital: 'Hospital', school: 'Escuela', farm: 'Granja', office: 'Oficina', shop: 'Tienda', house: 'Casa' },
        eventName: { epidemic: 'Epidemia', economic_crisis: 'Crisis económica', migration: 'Migración', storm: 'Tormenta', drought: 'Sequía', miracle: 'Milagro', party: 'Fiesta' },
        memory: {
            work_heal: 'Curó a un paciente', work_produce: 'Produjo comida', work_teach: 'Educó a un estudiante',
            work_code: 'Programó software', work_trade: 'Gestionó el inventario', purchase: 'Compró comida',
            salary: 'Cobró su salario (${amount})',
        },
        convVerb: {
            kind: ['Charló animadamente', 'Rió', 'Conversó a gusto', 'Se sinceró', 'Bromeó'],
            neutral: ['Habló', 'Conversó brevemente', 'Comentó algo', 'Saludó'],
            rude: ['Discutió', 'Tuvo un roce', 'Debatió acaloradamente', 'Se quejó'],
        },
        convTopic: { weather: 'el clima', work: 'el trabajo', family: 'la familia', prices: 'los precios', neighbors: 'los vecinos', plans: 'sus planes', food: 'la comida', town: 'el pueblo', rumors: 'los rumores', old_times: 'los viejos tiempos' },
        convWith: 'con', convAbout: 'sobre',
        event: {
            epidemic_start: '¡Brote de {disease}! {name} es el paciente cero',
            infection: '{name} contrajo {disease}',
            recovery: '{name} se recuperó de {disease}',
            death: '{name} murió por {disease}',
            economic_crisis: '¡Crisis económica! Los precios se disparan',
            economic_recovery: '¡La economía se recupera!',
            migration: 'Llegaron {count} migrante(s)',
            innovation: '¡{name} descubrió: {innovation}!',
            weather_storm: '¡Tormenta! La producción de comida baja',
            weather_drought: '¡Sequía! Los cultivos sufren',
            weather_rain: 'Lluvia suave, los cultivos crecen mejor',
        },
        innovation: { improved_agriculture: 'Agricultura mejorada', advanced_medicine: 'Medicina avanzada', digital_commerce: 'Comercio digital', public_education: 'Educación pública' },
        disease: { gripe: 'gripe' },
    },
    en: {
        ui: {
            day: 'DAY', fps: 'fps', pause: '⏸  Pause', resume: '▶  Resume',
            years: 'yrs', profession: 'Profession', perDay: '/day', money: 'Money',
            livesIn: 'Lives in', action: 'Action', talkingWith: 'Talking now with',
            secConversations: 'Conversations', secNeeds: 'Needs', secEmotions: 'Emotions',
            secPersonality: 'Personality', secRelationships: 'Relationships', secOtherMemories: 'Other memories',
            noConversations: "Hasn't talked to anyone yet.",
            emptySelection: 'Click an NPC or building\nto peek into its life',
            capacity: 'capacity', bedComfort: 'Bed comfort', commerce: 'Commerce',
            unitPrice: 'Unit price', stock: 'Stock', residents: 'Residents', workers: 'Workers',
            nobodyLives: 'Nobody lives here.', nobodyWorks: 'Nobody works here.',
            events: '⚙  Events', triggerEvent: 'Trigger event', close: 'Close',
            minimapTitle: 'Minimap — click to travel there',
            renderError: 'Rendering error', retry: 'Retry',
            viewNpc: 'View NPC details',
            happiness: 'happiness', anger: 'anger',
        },
        profession: { doctor: 'doctor', teacher: 'teacher', farmer: 'farmer', programmer: 'programmer', trader: 'trader', unemployed: 'unemployed' },
        action: {
            idle: 'idle', wandering: 'wandering', socializing: 'chatting', buying_food: 'buying food',
            eating: 'eating', sleeping: 'sleeping', working: 'working',
            moving_to_work: 'heading to work', moving_to_shop: 'heading to the shop',
            moving_to_sleep: 'heading to bed', moving_to_socialize: 'going to socialize',
        },
        need: { hunger: 'hunger', energy: 'energy', social: 'social' },
        emotion: { happiness: 'happiness', sadness: 'sadness', fear: 'fear', anger: 'anger', stress: 'stress', motivation: 'motivation', loneliness: 'loneliness' },
        trait: { extroversion: 'extroversion', ambition: 'ambition', generosity: 'generosity', honesty: 'honesty', patience: 'patience', aggressiveness: 'aggressiveness', empathy: 'empathy', curiosity: 'curiosity' },
        relType: { acquaintance: 'acquaintance', friend: 'friend', close_friend: 'close friend', enemy: 'enemy', rival: 'rival' },
        culture: { urban: 'urban', rural: 'rural', coastal: 'coastal', migrant: 'migrant' },
        weather: { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', storm: 'Storm', drought: 'Drought', fog: 'Fog', snow: 'Snow' },
        buildingType: { hospital: 'Hospital', school: 'School', farm: 'Farm', office: 'Office', shop: 'Shop', house: 'House' },
        eventName: { epidemic: 'Epidemic', economic_crisis: 'Economic crisis', migration: 'Migration', storm: 'Storm', drought: 'Drought', miracle: 'Miracle', party: 'Party' },
        memory: {
            work_heal: 'Healed a patient', work_produce: 'Produced food', work_teach: 'Taught a student',
            work_code: 'Wrote software', work_trade: 'Managed the inventory', purchase: 'Bought food',
            salary: 'Got paid (${amount})',
        },
        convVerb: {
            kind: ['Chatted cheerfully', 'Laughed', 'Talked happily', 'Opened up', 'Joked'],
            neutral: ['Talked', 'Chatted briefly', 'Made small talk', 'Said hi'],
            rude: ['Argued', 'Had a spat', 'Debated heatedly', 'Complained'],
        },
        convTopic: { weather: 'the weather', work: 'work', family: 'family', prices: 'prices', neighbors: 'the neighbors', plans: 'their plans', food: 'food', town: 'the town', rumors: 'rumors', old_times: 'the old days' },
        convWith: 'with', convAbout: 'about',
        event: {
            epidemic_start: '{disease} outbreak! {name} is patient zero',
            infection: '{name} caught {disease}',
            recovery: '{name} recovered from {disease}',
            death: '{name} died of {disease}',
            economic_crisis: 'Economic crisis! Prices soar',
            economic_recovery: 'The economy recovers!',
            migration: '{count} migrant(s) arrived',
            innovation: '{name} discovered: {innovation}!',
            weather_storm: 'Storm! Food production drops',
            weather_drought: 'Drought! Crops suffer',
            weather_rain: 'Gentle rain, crops grow better',
        },
        innovation: { improved_agriculture: 'Improved agriculture', advanced_medicine: 'Advanced medicine', digital_commerce: 'Digital commerce', public_education: 'Public education' },
        disease: { gripe: 'the flu' },
    },
};

function interp(str, params) {
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? params[k] : `{${k}}`));
}

/** Traduce una clave con puntos, p. ej. t('profession.doctor'). Devuelve la clave si no existe. */
export function translate(lang, key, params) {
    const parts = key.split('.');
    let node = L[lang] || L.es;
    for (const p of parts) { node = node?.[p]; if (node == null) break; }
    if (node == null) {
        // respaldo al español, luego a la última parte "humanizada"
        node = parts.reduce((n, p) => n?.[p], L.es);
        if (node == null) return key.split('.').pop().replace(/_/g, ' ');
    }
    return typeof node === 'string' ? interp(node, params) : node;
}

/** Nombre de edificio localizado por tipo (+ número si lo tiene). Evita el "Tech Hub" en inglés. */
export function buildingName(lang, building) {
    const type = building?.Building?.building_type || 'house';
    const raw = building?.Building?.name || '';
    const num = (raw.match(/\d+/) || [])[0];
    const label = translate(lang, `buildingType.${type}`);
    return num ? `${label} ${num}` : label;
}

/** Compone el texto de un recuerdo desde su código + meta (bilingüe). */
export function formatMemory(lang, entry, nameOf) {
    const t = (k, p) => translate(lang, k, p);
    const type = entry.event_type;
    if (type === 'social_interaction') {
        const meta = entry.meta || {};
        const verbs = L[lang].convVerb[meta.tone] || L[lang].convVerb.neutral;
        const verb = verbs[meta.verb] ?? verbs[0];
        const topic = t(`convTopic.${meta.topic}`);
        const name = nameOf ? nameOf(entry.target_id) : `#${entry.target_id}`;
        return `${verb} ${L[lang].convWith} ${name} ${L[lang].convAbout} ${topic}`;
    }
    if (type === 'salary') {
        return t('memory.salary', { amount: entry.meta?.amount ?? 0 });
    }
    const tpl = L[lang].memory[type];
    if (tpl) return tpl;
    return entry.description || type.replace(/_/g, ' ');
}

/** Compone el texto de un evento global desde su tipo + meta (bilingüe). */
export function formatEvent(lang, evt) {
    const t = (k, p) => translate(lang, k, p);
    const meta = evt.meta || {};
    const type = evt.type || evt.event_type;
    const disease = meta.disease ? (L[lang].disease[meta.disease] || meta.disease) : '';
    const innovation = meta.innovation ? t(`innovation.${meta.innovation}`) : '';
    switch (type) {
        case 'epidemic_start':
        case 'infection':
        case 'recovery':
        case 'death':
            return t(`event.${type}`, { name: meta.name, disease });
        case 'migration':
            return t('event.migration', { count: meta.count ?? 0 });
        case 'innovation':
            return t('event.innovation', { name: meta.name, innovation });
        case 'economic_crisis':
        case 'economic_recovery':
            return t(`event.${type}`);
        case 'weather':
            return t(`event.weather_${meta.kind}`) || evt.description;
        default:
            return evt.description || type;
    }
}

/* ---- Contexto de React ---- */
const I18nContext = createContext(null);

export function I18nProvider({ children }) {
    const [lang, setLangState] = useState(() => {
        try { return localStorage.getItem('sim-lang') || 'es'; } catch { return 'es'; }
    });
    const setLang = useCallback((l) => {
        setLangState(l);
        try { localStorage.setItem('sim-lang', l); } catch { /* ignore */ }
    }, []);

    const value = useMemo(() => ({
        lang,
        setLang,
        t: (key, params) => translate(lang, key, params),
        tBuilding: (b) => buildingName(lang, b),
        tMemory: (entry, nameOf) => formatMemory(lang, entry, nameOf),
        tEvent: (evt) => formatEvent(lang, evt),
        tWeather: (code) => ({ icon: WEATHER_ICON[code] || '☀️', label: translate(lang, `weather.${code}`) }),
    }), [lang, setLang]);

    // React.createElement en lugar de JSX: este archivo es .js y no pasa por el loader JSX.
    return React.createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error('useI18n debe usarse dentro de <I18nProvider>');
    return ctx;
}
