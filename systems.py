# systems.py - COMPLETO
import math
import random
from world import World
from components import (
    Position, Needs, Personality, Emotions, Relationships, Relationship,
    ActionState, Inventory, Wallet, Profession, Shop, Bed,
    Memory, MemoryEntry, Building, Workplace, Residence, Schedule, Health,
    Disease, Innovation, GlobalEvent, Identity
)


# ============================================================
# TIME SYSTEM
# ============================================================
class TimeSystem:
    MINUTES_PER_TICK = 10

    def __init__(self):
        self.hour = 6
        self.minute = 0
        self.day = 1
        self.total_ticks = 0

    def run(self, world: World):
        self.total_ticks += 1
        self.minute += self.MINUTES_PER_TICK
        if self.minute >= 60:
            self.minute -= 60
            self.hour += 1
        if self.hour >= 24:
            self.hour -= 24
            self.day += 1
        world.tick = self.total_ticks

    def get_time_str(self):
        return f"{self.hour:02d}:{self.minute:02d}"


# ============================================================
# SCHEDULE SYSTEM
# ============================================================
class ScheduleSystem:
    def run(self, world: World, time_sys: TimeSystem):
        npcs = world.entities_with_components(Schedule, ActionState, Needs, Personality)
        for npc in npcs:
            sched = world.get_component(npc, Schedule)
            act = world.get_component(npc, ActionState)
            hour = time_sys.hour

            if sched.sleep <= hour or hour < sched.wake_up:
                new_phase = "sleep"
            elif sched.wake_up <= hour < 9:
                new_phase = "free"
            elif 9 <= hour < 17:
                new_phase = "work"
            else:
                new_phase = "free"

            if new_phase != sched.phase:
                if act.action in ("idle", "wandering", "sleeping"):
                    sched.phase = new_phase


# ============================================================
# NEED SYSTEM
# ============================================================
class NeedSystem:
    HUNGER_DECAY = 0.8
    ENERGY_DECAY = 0.5
    SOCIAL_DECAY = 0.4

    def run(self, world: World, _time_sys=None):
        for e in world.entities_with_components(Needs, ActionState):
            needs = world.get_component(e, Needs)
            act = world.get_component(e, ActionState)
            health = world.get_component(e, Health)

            hunger_mod = 1.0
            energy_mod = 1.0

            if health and health.is_sick:
                hunger_mod = 1.3
                energy_mod = 1.5

            if act.action in ("working", "moving_to_work"):
                energy_mod += 0.5

            if act.action == "sleeping":
                energy_mod = -0.5

            needs.hunger = max(0.0, needs.hunger - self.HUNGER_DECAY * hunger_mod)
            needs.energy = max(0.0, needs.energy - self.ENERGY_DECAY * energy_mod)
            needs.social = max(0.0, needs.social - self.SOCIAL_DECAY)


# ============================================================
# PERCEPTION SYSTEM
# ============================================================
class PerceptionSystem:
    RESOURCE_RADIUS = 60.0
    SOCIAL_RADIUS = 30.0

    def run(self, world: World):
        # NO exigir Workplace: si se exige, los NPCs sin empleo (migrantes y
        # desempleados) nunca perciben tiendas/camas y no pueden comer ni dormir,
        # así que sus necesidades caen a 0. El uso de Workplace más abajo es opcional.
        npcs = world.entities_with_components(Needs, Position, ActionState)
        shops = world.entities_with_components(Position, Shop)
        beds = world.entities_with_components(Position, Bed)
        all_npcs = world.entities_with_components(Position, Identity)

        for npc in npcs:
            pos = world.get_component(npc, Position)
            act = world.get_component(npc, ActionState)

            if act.action not in ("idle", "wandering"):
                continue

            act.closest_shop = self._find_closest(world, pos, shops, self.RESOURCE_RADIUS)
            act.closest_bed = self._find_closest(world, pos, beds, self.RESOURCE_RADIUS)
            act.social_targets = [
                o for o in all_npcs if o != npc and
                math.hypot(pos.x - world.get_component(o, Position).x,
                           pos.y - world.get_component(o, Position).y) <= self.SOCIAL_RADIUS
            ]
            workplace = world.get_component(npc, Workplace)
            if workplace:
                act.closest_workplace = workplace.building_id

    def _find_closest(self, world, origin_pos, candidates, radius):
        best, best_dist = None, float('inf')
        for c in candidates:
            cp = world.get_component(c, Position)
            d = math.hypot(origin_pos.x - cp.x, origin_pos.y - cp.y)
            if d < radius and d < best_dist:
                best_dist, best = d, c
        return best


# ============================================================
# EMOTION SYSTEM
# ============================================================
class EmotionSystem:
    def run(self, world: World):
        npcs = world.entities_with_components(Needs, Emotions, ActionState, Wallet)
        for npc in npcs:
            needs = world.get_component(npc, Needs)
            emot = world.get_component(npc, Emotions)
            act = world.get_component(npc, ActionState)
            wallet = world.get_component(npc, Wallet)

            self._apply_homeostasis(emot)
            self._apply_needs_effects(needs, emot, wallet)
            self._apply_action_effects(npc, world, act, emot)
            self._clamp_emotions(emot)

    def _apply_homeostasis(self, emot):
        emot.happiness += (50.0 - emot.happiness) * 0.01
        emot.sadness *= 0.95
        emot.fear *= 0.95
        emot.anger *= 0.95
        emot.stress += (0.0 - emot.stress) * 0.05
        emot.motivation += (50.0 - emot.motivation) * 0.01
        emot.loneliness *= 0.98

    def _apply_needs_effects(self, needs, emot, wallet):
        if needs.hunger < 30:
            emot.stress += 2.0
            emot.happiness -= 1.0
        if needs.energy < 20:
            emot.stress += 1.5
            emot.motivation -= 1.0
        if needs.social < 30:
            emot.loneliness += 2.0
            emot.happiness -= 0.5
        if wallet and wallet.cash < 20:
            emot.stress += 1.5

    def _apply_action_effects(self, npc, world, act, emot):
        if act.action == "eating":
            emot.happiness += 1.0
            emot.stress -= 1.0
        elif act.action == "sleeping":
            emot.stress -= 2.0
        elif act.action == "socializing":
            emot.loneliness -= 2.0
            emot.happiness += 1.5
        elif act.action == "working":
            emot.motivation += 0.5
            emot.stress += 0.5
        elif act.action == "wandering":
            pers = world.get_component(npc, Personality)
            if pers:
                emot.happiness += 0.2 * pers.curiosity
                emot.loneliness += 0.1

    def _clamp_emotions(self, emot):
        for f in emot.__dataclass_fields__:
            setattr(emot, f, max(0.0, min(100.0, getattr(emot, f))))


# ============================================================
# UTILITY AI SYSTEM
# ============================================================
class UtilityAISystem:
    world = None

    def run(self, world: World, _time_sys=None):
        npcs = world.entities_with_components(
            Needs, Personality, Emotions, ActionState, Wallet, Relationships, Memory, Schedule
        )
        for npc in npcs:
            needs = world.get_component(npc, Needs)
            pers = world.get_component(npc, Personality)
            emot = world.get_component(npc, Emotions)
            act = world.get_component(npc, ActionState)
            wallet = world.get_component(npc, Wallet)
            rels = world.get_component(npc, Relationships)
            sched = world.get_component(npc, Schedule)

            if act.action not in ("idle", "wandering"):
                continue

            u, best_target = self._compute_utilities(needs, pers, emot, act, wallet, rels, sched, world, npc)

            best = max(u, key=u.get)
            if u[best] == -float('inf'):
                act.action = "idle"
                continue

            action_map = {
                "work": ("moving_to_work", act.closest_workplace),
                "buy_food": ("moving_to_shop", act.closest_shop),
                "sleep": ("moving_to_sleep", act.closest_bed),
                "socialize": ("moving_to_socialize", best_target),
                "wander": ("wandering", None),
            }

            new_action, target = action_map[best]
            act.action = new_action
            if target is not None:
                act.target_entity = target
            if best == "wander":
                act.wander_angle = random.uniform(0, 2 * math.pi)

    def _compute_utilities(self, needs, pers, emot, act, wallet, rels, sched, world, npc):
        u = {}
        u["work"] = self._eval_work(needs, pers, emot, act) if sched.phase == "work" else -float('inf')
        u["buy_food"] = self._eval_buy_food(needs, wallet, act, pers, emot)
        u["sleep"] = self._eval_sleep(needs, pers, emot) if act.closest_bed else -float('inf')
        if sched.phase == "sleep":
            u["sleep"] = 200.0
        best_social_u, best_target = self._best_social(needs, pers, emot, rels, act.social_targets, world, npc)
        u["socialize"] = best_social_u
        u["wander"] = self._eval_wander(needs, pers, emot)
        return u, best_target

    def _eval_work(self, needs, pers, emot, act):
        if getattr(act, 'closest_workplace', None) is None:
            return -float('inf')
        base = 70.0 + pers.ambition * 30.0 + emot.motivation * 0.2
        if needs.hunger < 20 or needs.energy < 15:
            base -= 40.0
        return base

    def _eval_buy_food(self, needs, wallet, act, pers, emot):
        if act.closest_shop is None:
            return -float('inf')
        hunger_deficit = (100.0 - needs.hunger) / 100.0
        if hunger_deficit < 0.1:
            return 0.0
        if wallet.cash < 10.0:
            return -float('inf')
        return hunger_deficit * 90.0 * (1.0 - pers.patience * 0.3) * (1.0 + emot.stress / 100.0 * 0.5)

    def _eval_sleep(self, needs, pers, emot):
        deficit = (100.0 - needs.energy) / 100.0
        return deficit * 100.0 * (1.0 - pers.ambition * 0.4) * (1.0 - pers.patience * 0.2) * (1.0 + emot.stress / 100.0 * 0.4)

    def _best_social(self, needs, pers, emot, rels, targets, world, npc):
        best_u, best_t = -float('inf'), None
        for t in targets:
            deficit = (100.0 - needs.social) / 100.0
            extro = 1.0 + pers.extroversion * 1.5
            lone = 1.0 + emot.loneliness / 100.0
            rel_factor = 1.0
            if t in rels.relations:
                rel_factor = 1.0 + rels.relations[t].friendship / 200.0
            mem_factor = self._memory_factor(world, npc, t)
            u = deficit * 80.0 * extro * lone * rel_factor * (1.0 + pers.empathy * 0.3) * mem_factor
            if u > best_u:
                best_u, best_t = u, t
        return best_u, best_t

    def _memory_factor(self, world, npc, target):
        mem = world.get_component(npc, Memory)
        if not mem:
            return 1.0
        recent = [m for m in mem.entries if m.target_id == target and m.event_type == "social_interaction"]
        if not recent:
            return 1.0
        total_val = sum(sum(m.emotional_impact.values()) for m in recent)
        return 1.0 + total_val / 50.0

    def _eval_wander(self, needs, pers, emot):
        base = 10.0 * (1.0 + pers.curiosity * 1.5)
        if needs.hunger > 70 and needs.energy > 70 and needs.social > 70:
            base += 15.0
        return base + emot.sadness * 0.1 + emot.loneliness * 0.2


# ============================================================
# MOVEMENT SYSTEM
# ============================================================
class MovementSystem:
    SPEED = 2.0

    def run(self, world: World):
        npcs = world.entities_with_components(Position, ActionState)
        for npc in npcs:
            pos = world.get_component(npc, Position)
            act = world.get_component(npc, ActionState)

            if act.action in ("moving_to_shop", "moving_to_sleep", "moving_to_socialize", "moving_to_work"):
                self._move_towards(world, npc, pos, act)
            elif act.action == "wandering":
                pos.x += math.cos(act.wander_angle) * self.SPEED * 0.5
                pos.y += math.sin(act.wander_angle) * self.SPEED * 0.5
                act.wander_angle += random.uniform(-0.5, 0.5)
                act.facing = self._angle_to_facing(act.wander_angle)

    def _move_towards(self, world, npc, pos, act):
        target = act.target_entity
        if target is None:
            act.action = "idle"
            return
        tpos = world.get_component(target, Position)
        if tpos is None:
            act.action = "idle"
            return

        dx, dy = tpos.x - pos.x, tpos.y - pos.y
        dist = math.hypot(dx, dy)

        if dist > 0.01:
            act.facing = self._angle_to_facing(math.atan2(dy, dx))

        mapping = {
            "moving_to_shop": "buying_food",
            "moving_to_sleep": "sleeping",
            "moving_to_socialize": "socializing",
            "moving_to_work": "working"
        }

        if dist <= self.SPEED:
            pos.x, pos.y = tpos.x, tpos.y
            new_action = mapping.get(act.action, "idle")
            act.action = new_action
            if new_action == "socializing":
                # La charla dura varios ticks: así se ve en el cliente y da tiempo a
                # que RelationshipSystem la registre una sola vez (talk_started).
                act.talk_ticks = random.randint(8, 20)
                act.talk_started = True
        else:
            pos.x += dx / dist * self.SPEED
            pos.y += dy / dist * self.SPEED

    def _angle_to_facing(self, angle):
        if abs(angle) < math.pi / 4:
            return "right"
        elif abs(angle) > 3 * math.pi / 4:
            return "left"
        elif angle > 0:
            return "down"
        else:
            return "up"


# ============================================================
# WORK SYSTEM
# ============================================================
class WorkSystem:
    def run(self, world: World):
        workers = world.entities_with_components(ActionState, Profession, Workplace, Position)
        for npc in workers:
            act = world.get_component(npc, ActionState)
            if act.action != "working":
                continue
            prof = world.get_component(npc, Profession)
            workplace = world.get_component(npc, Workplace)
            building_id = workplace.building_id
            building = world.get_component(building_id, Building) if building_id else None
            if not building:
                act.action = "idle"
                continue

            work_methods = {
                "doctor": self._work_doctor,
                "farmer": self._work_farmer,
                "teacher": self._work_teacher,
                "programmer": self._work_programmer,
                "trader": self._work_trader,
            }
            method = work_methods.get(prof.type)
            if method:
                method(world, npc, building_id)

    def _work_doctor(self, world, npc, _building_id):
        patients = [e for e in world.entities_with_components(Health, Position)
                    if world.get_component(e, Health).is_sick]
        if patients:
            patient = patients[0]
            health = world.get_component(patient, Health)
            health.recovery_rate += 5.0
            if health.recovery_rate >= 100:
                health.is_sick = False
                health.recovery_rate = 0
            self._add_mem(world, npc, "work_heal", patient, "Curó paciente", {"happiness": 5}, 20)

    def _work_farmer(self, world, npc, _building_id):
        shops = world.entities_with_components(Shop)
        if shops:
            shop = world.get_component(shops[0], Shop)
            shop.stock += 5
            self._add_mem(world, npc, "work_produce", shops[0], "Produjo comida", {"happiness": 2}, 10)

    def _work_teacher(self, world, npc, _building_id):
        students = [e for e in world.entities_with_components(Identity)
                    if world.get_component(e, Identity).age < 25]
        if students:
            student = students[0]
            world.get_component(student, Identity).education = min(1.0, world.get_component(student, Identity).education + 0.01)
            self._add_mem(world, npc, "work_teach", student, "Educó estudiante", {"happiness": 3}, 15)

    def _work_programmer(self, world, npc, _building_id):
        wallet = world.get_component(npc, Wallet)
        if wallet:
            wallet.bank += 2
        self._add_mem(world, npc, "work_code", None, "Programó software", {"motivation": 2}, 8)

    def _work_trader(self, world, npc, shop_id):
        shop = world.get_component(shop_id, Shop)
        if shop:
            shop.stock += 2
        self._add_mem(world, npc, "work_trade", shop_id, "Gestionó inventario", {"happiness": 1}, 5)

    def _add_mem(self, world, npc, etype, target, desc, impact, imp):
        mem = world.get_component(npc, Memory)
        if mem:
            mem.entries.append(MemoryEntry(
                tick=world.tick, event_type=etype, subject_id=npc,
                target_id=target, description=desc, emotional_impact=impact, importance=imp
            ))


# ============================================================
# ACTION EXECUTION SYSTEM
# ============================================================
class ActionExecutionSystem:
    def run(self, world: World, _time_sys=None):
        for npc in world.entities_with_components(Needs, ActionState, Position, Schedule):
            act = world.get_component(npc, ActionState)
            sched = world.get_component(npc, Schedule)

            if act.action == "sleeping":
                self._sleep(world, npc, act)
            elif act.action == "socializing":
                self._socialize(world, npc, act)
            elif act.action == "buying_food":
                self._buy_food(world, npc, act)
            elif act.action == "eating":
                self._eat(world, npc, act)
            elif act.action == "working" and sched.phase != "work":
                act.action = "idle"
                act.target_entity = None

    def _sleep(self, world, npc, act):
        needs = world.get_component(npc, Needs)
        bed_e = act.target_entity
        comfort = world.get_component(bed_e, Bed).comfort if bed_e and world.has_component(bed_e, Bed) else 1.0
        needs.energy = min(100.0, needs.energy + 3.0 * comfort)
        if needs.energy >= 95:
            act.action, act.target_entity = "idle", None

    def _socialize(self, world, npc, act):
        my_needs = world.get_component(npc, Needs)
        other_id = act.target_entity
        if other_id is None:
            act.action, act.talk_ticks = "idle", 0
            return

        # Beneficio gradual mientras dura la charla
        other_needs = world.get_component(other_id, Needs)
        if my_needs:
            my_needs.social = min(100.0, my_needs.social + 1.2)
        if other_needs:
            other_needs.social = min(100.0, other_needs.social + 0.8)

        act.talk_ticks -= 1
        if act.talk_ticks > 0 and other_needs is not None:
            return  # la conversación continúa (visible en el cliente)

        # Fin de la conversación
        act.action, act.target_entity, act.talk_started = "idle", None, False
        act.talk_ticks = 0
        if world.has_component(other_id, ActionState):
            oact = world.get_component(other_id, ActionState)
            if oact.action == "socializing" and oact.target_entity == npc:
                oact.action, oact.target_entity = "idle", None
                oact.talk_ticks, oact.talk_started = 0, False

    def _buy_food(self, world, npc, act):
        shop_id = act.target_entity
        if shop_id is None:
            act.action = "idle"; return
        shop = world.get_component(shop_id, Shop)
        wallet = world.get_component(npc, Wallet)
        needs = world.get_component(npc, Needs)
        inv = world.get_component(npc, Inventory)
        if shop is None or wallet is None or needs is None:
            act.action = "idle"; return
        if wallet.cash < shop.price_per_unit or shop.stock <= 0:
            act.action = "idle"; return
        wallet.cash -= shop.price_per_unit
        shop.stock -= 1
        if inv:
            inv.items["food"] = inv.items.get("food", 0) + 1
        needs.hunger = min(100.0, needs.hunger + 25.0)
        self._add_memory(world, npc, "purchase", shop_id, "Compró comida", {"happiness": 2}, 15)
        act.action, act.target_entity = "idle", None

    def _eat(self, world, npc, act):
        needs = world.get_component(npc, Needs)
        inv = world.get_component(npc, Inventory)
        if inv and inv.items.get("food", 0) > 0:
            inv.items["food"] -= 1
            needs.hunger = min(100.0, needs.hunger + 25.0)
        act.action, act.target_entity = "idle", None

    def _add_memory(self, world, entity, event_type, target, desc, impact, importance):
        mem = world.get_component(entity, Memory)
        if mem:
            mem.entries.append(MemoryEntry(
                tick=world.tick, event_type=event_type, subject_id=entity,
                target_id=target, description=desc, emotional_impact=impact, importance=importance
            ))


# ============================================================
# RELATIONSHIP SYSTEM
# ============================================================
class RelationshipSystem:
    def run(self, world: World):
        socializers = world.entities_with_components(ActionState, Relationships)
        processed: set = set()  # pares ya procesados (evita duplicar si ambos socializan)
        for npc in socializers:
            act = world.get_component(npc, ActionState)
            # Solo al INICIAR la charla (talk_started), no en cada tick de su duración:
            # así se registra un único recuerdo y un único cambio de amistad por conversación.
            if act.action != "socializing" or not act.talk_started:
                continue
            act.talk_started = False  # consumir la marca
            target = act.target_entity
            if target is None or not world.has_component(target, Relationships):
                continue
            pair = (min(npc, target), max(npc, target))
            if pair in processed:
                continue
            processed.add(pair)
            self._update_rel(world, npc, target)

    def _update_rel(self, world, a, b):
        rels_a = world.get_component(a, Relationships)
        rels_b = world.get_component(b, Relationships)
        pers_a = world.get_component(a, Personality)
        pers_b = world.get_component(b, Personality)
        emot_a = world.get_component(a, Emotions)
        emot_b = world.get_component(b, Emotions)

        if b not in rels_a.relations:
            rels_a.relations[b] = Relationship(target_id=b)
        if a not in rels_b.relations:
            rels_b.relations[a] = Relationship(target_id=a)
        ra, rb = rels_a.relations[b], rels_b.relations[a]

        tone = self._pick_tone(pers_a, emot_a)
        tone_factor = {"kind": 1.5, "neutral": 1.0, "rude": 0.3}[tone]

        compat = self._calc_compat(pers_a, pers_b)
        mood_factor = self._calc_mood(emot_a, emot_b)

        change = 5.0 * compat * mood_factor * tone_factor
        ra.friendship = max(-100, min(100, ra.friendship + change))
        rb.friendship = max(-100, min(100, rb.friendship + change * (0.8 if tone == "rude" else 1.0)))

        trust_change = 2.0 * compat * (1.0 + pers_a.honesty * 0.5 if pers_a else 1.0)
        ra.trust = max(-100, min(100, ra.trust + trust_change))
        rb.trust = max(-100, min(100, rb.trust + trust_change))

        for r in (ra, rb):
            if r.friendship >= 60: r.type = "close_friend"
            elif r.friendship >= 30: r.type = "friend"
            elif r.friendship <= -50: r.type = "enemy"
            elif r.friendship <= -20: r.type = "rival"
            else: r.type = "acquaintance"

        ident_a = world.get_component(a, Identity)
        ident_b = world.get_component(b, Identity)
        name_a = ident_a.name if ident_a else f"#{a}"
        name_b = ident_b.name if ident_b else f"#{b}"

        # Elegir verbo y tema UNA vez (mismos para ambos participantes). Se guardan
        # como índice/clave en 'meta' para que el cliente los localice a ES/EN.
        tone_key = tone if tone in self._CONV_VERBS else "neutral"
        verb_i = random.randrange(len(self._CONV_VERBS[tone_key]))
        topic_key = random.choice(self._CONV_TOPIC_KEYS)

        for ent, other, other_name in [(a, b, name_b), (b, a, name_a)]:
            mem = world.get_component(ent, Memory)
            if mem:
                impact = {"happiness": change * 0.5} if change > 0 else {"anger": -change * 0.3}
                desc = (f"{self._CONV_VERBS[tone_key][verb_i]} con {other_name} "
                        f"sobre {self._CONV_TOPICS_ES[topic_key]}")
                mem.entries.append(MemoryEntry(
                    tick=world.tick, event_type="social_interaction",
                    subject_id=ent, target_id=other,
                    description=desc,
                    emotional_impact=impact, importance=abs(change) * 2 + 5,
                    meta={"tone": tone_key, "verb": verb_i, "topic": topic_key}
                ))

        if ident_a and ident_b:
            print(f"  [SOCIAL] {ident_a.name}({tone}) ↔ {ident_b.name} → amistad {ra.friendship:.1f}/{rb.friendship:.1f}")

    # Frases de conversación según el tono (para el respaldo en español). El cliente
    # tiene los MISMOS arrays en ES/EN y compone por índice, así que el orden importa.
    _CONV_VERBS = {
        "kind": ["Charló animadamente", "Rió", "Conversó a gusto", "Se sinceró", "Bromeó"],
        "neutral": ["Habló", "Conversó brevemente", "Comentó algo", "Saludó"],
        "rude": ["Discutió", "Tuvo un roce", "Debatió acaloradamente", "Se quejó"],
    }
    _CONV_TOPIC_KEYS = ["weather", "work", "family", "prices", "neighbors",
                        "plans", "food", "town", "rumors", "old_times"]
    _CONV_TOPICS_ES = {
        "weather": "el clima", "work": "el trabajo", "family": "la familia",
        "prices": "los precios", "neighbors": "los vecinos", "plans": "sus planes",
        "food": "la comida", "town": "el pueblo", "rumors": "los rumores",
        "old_times": "los viejos tiempos",
    }

    def _pick_tone(self, pers, emot):
        if not pers: return "neutral"
        score = pers.extroversion * 0.5 + pers.generosity * 0.3 + pers.empathy * 0.3 - pers.aggressiveness * 0.6
        if emot:
            score += (emot.happiness - 50) / 25 - emot.anger / 50
        score += random.random() * 3 - 1.5
        if score > 0.5: return "kind"
        if score < -0.5: return "rude"
        return "neutral"

    def _calc_compat(self, pa, pb):
        if not pa or not pb: return 1.0
        return 1.0 - abs(pa.extroversion - pb.extroversion) * 0.3 + (pa.empathy + pb.empathy) * 0.2 + (pa.generosity + pb.generosity) * 0.1

    def _calc_mood(self, ea, eb):
        if not ea or not eb: return 1.0
        return 1.0 + ((ea.happiness - ea.sadness - ea.anger) / 100.0 + (eb.happiness - eb.sadness - eb.anger) / 100.0) * 0.5


# ============================================================
# SALARY SYSTEM
# ============================================================
class SalarySystem:
    PAY_INTERVAL = 100

    def run(self, world: World):
        if world.tick % self.PAY_INTERVAL != 0:
            return
        for npc in world.entities_with_components(Profession, Wallet):
            prof = world.get_component(npc, Profession)
            wallet = world.get_component(npc, Wallet)
            wallet.bank += prof.salary
            # Retirar del banco si el efectivo está bajo. Sin esto, el salario se
            # acumula en el banco pero la comida se paga con efectivo, así que el
            # efectivo se agota y los NPCs no pueden comer (hambre -> 0).
            if wallet.cash < 30.0 and wallet.bank > 0:
                withdraw = min(wallet.bank, 60.0)
                wallet.bank -= withdraw
                wallet.cash += withdraw
            mem = world.get_component(npc, Memory)
            if mem:
                mem.entries.append(MemoryEntry(
                    tick=world.tick, event_type="salary", subject_id=npc,
                    target_id=None, description=f"Recibió su salario de ${prof.salary:.0f}",
                    emotional_impact={"happiness": 3}, importance=10,
                    meta={"amount": round(prof.salary)}
                ))


# ============================================================
# MEMORY DECAY SYSTEM
# ============================================================
class MemoryDecaySystem:
    MAX_MEMORIES = 30

    def run(self, world: World):
        for npc in world.entities_with_components(Memory):
            mem = world.get_component(npc, Memory)
            if len(mem.entries) > self.MAX_MEMORIES:
                mem.entries.sort(key=lambda m: m.importance, reverse=True)
                mem.entries = mem.entries[:self.MAX_MEMORIES]


# ============================================================
# FASE 10: EPIDEMIC SYSTEM
# ============================================================
class EpidemicSystem:
    CONTAGION_RADIUS = 20.0
    BASE_MORTALITY_CHECK_INTERVAL = 50

    def __init__(self):
        self.global_events = []

    def run(self, world: World):
        all_npcs = world.entities_with_components(Position, Health)
        sick_npcs = [e for e in all_npcs if world.get_component(e, Health).is_sick]

        for sick in sick_npcs:
            self._process_sick_npc(world, sick, all_npcs)

    def _process_sick_npc(self, world, sick, all_npcs):
        sick_health = world.get_component(sick, Health)
        sick_pos = world.get_component(sick, Position)
        disease = world.get_component(sick, Disease)
        # El NPC pudo haber sido eliminado (p. ej. otra muerte en este mismo tick).
        if sick_health is None or sick_pos is None or not disease:
            return

        self._infect_nearby(world, sick, sick_pos, disease, all_npcs)
        self._update_disease_state(world, sick, sick_health, disease)

    def _infect_nearby(self, world, sick, sick_pos, disease, all_npcs):
        for other in all_npcs:
            if other == sick:
                continue
            other_health = world.get_component(other, Health)
            # 'other' pudo eliminarse (muerte por mortalidad) durante este tick:
            # su lista viene precomputada, así que hay que verificar que siga vivo.
            if other_health is None or other_health.is_sick:
                continue
            other_pos = world.get_component(other, Position)
            if other_pos is None:
                continue
            dist = math.hypot(sick_pos.x - other_pos.x, sick_pos.y - other_pos.y)
            if dist < self.CONTAGION_RADIUS and random.random() < disease.contagiousness * 0.1:
                self._infect(world, other, disease)

    def _update_disease_state(self, world, sick, sick_health, disease):
        disease.duration -= 1

        if world.tick % self.BASE_MORTALITY_CHECK_INTERVAL == 0 and random.random() < disease.mortality_rate:
            self._kill_npc(world, sick, disease)
            return

        if disease.duration <= 0:
            sick_health.is_sick = False
            sick_health.sickness_severity = 0
            world.remove_component(sick, Disease)
            ident = world.get_component(sick, Identity)
            if ident:
                self._add_event(world, "recovery", f"{ident.name} se recuperó de {disease.name}",
                                meta={"name": ident.name, "disease": disease.name})

    def start_epidemic(self, world, disease_name="gripe", severity=0.3, contagiousness=0.6, duration=150, mortality=0.02):
        npcs = world.entities_with_components(Identity, Health)
        if not npcs: return
        patient_zero = random.choice(npcs)
        health = world.get_component(patient_zero, Health)
        disease = Disease(name=disease_name, severity=severity, contagiousness=contagiousness,
                          duration=duration, mortality_rate=mortality)
        health.is_sick = True
        health.sickness_severity = severity * 100
        world.add_component(patient_zero, disease)
        ident = world.get_component(patient_zero, Identity)
        self._add_event(world, "epidemic_start",
                        f"¡Brote de {disease_name}! {ident.name} es el paciente cero", "critical",
                        meta={"name": ident.name, "disease": disease_name})
        return patient_zero

    def _infect(self, world, entity, source_disease, _source_entity=None):
        health = world.get_component(entity, Health)
        ident = world.get_component(entity, Identity)
        new_disease = Disease(
            name=source_disease.name,
            severity=source_disease.severity * random.uniform(0.8, 1.2),
            contagiousness=source_disease.contagiousness,
            duration=int(source_disease.duration * random.uniform(0.7, 1.3)),
            mortality_rate=source_disease.mortality_rate
        )
        health.is_sick = True
        health.sickness_severity = new_disease.severity * 100
        world.add_component(entity, new_disease)
        if ident:
            self._add_event(world, "infection", f"{ident.name} contrajo {new_disease.name}", "warning",
                            meta={"name": ident.name, "disease": new_disease.name})

    def _kill_npc(self, world, entity, disease):
        ident = world.get_component(entity, Identity)
        if ident:
            self._add_event(world, "death", f"{ident.name} murió por {disease.name}", "critical",
                            meta={"name": ident.name, "disease": disease.name})
        world.remove_entity(entity)

    def _add_event(self, world, etype, desc, severity="info", meta=None):
        self.global_events.append(GlobalEvent(tick=world.tick, event_type=etype, description=desc,
                                              severity=severity, meta=meta or {}))


# ============================================================
# FASE 10: ECONOMIC EVENT SYSTEM
# ============================================================
class EconomicEventSystem:
    def __init__(self):
        self.crisis_active = False
        self.crisis_duration = 0
        self.global_events = []

    def run(self, world: World):
        if not self.crisis_active and random.random() < 0.001:
            self._start_crisis(world)
        if self.crisis_active:
            self.crisis_duration -= 1
            if random.random() < 0.05:
                self._apply_crisis_effects(world)
            if self.crisis_duration <= 0:
                self._end_crisis(world)

    def _start_crisis(self, world):
        self.crisis_active = True
        self.crisis_duration = random.randint(200, 500)
        for shop_entity in world.entities_with_components(Shop):
            world.get_component(shop_entity, Shop).price_per_unit *= random.uniform(1.5, 3.0)
        self._add_event(world, "economic_crisis", "¡Crisis económica! Los precios se disparan", "critical")

    def _apply_crisis_effects(self, world):
        for npc in world.entities_with_components(Profession, Wallet):
            prof = world.get_component(npc, Profession)
            if prof.type != "unemployed" and random.random() < 0.1:
                prof.salary = max(10, prof.salary * random.uniform(0.5, 0.9))

    def _end_crisis(self, world):
        self.crisis_active = False
        for shop_entity in world.entities_with_components(Shop):
            world.get_component(shop_entity, Shop).price_per_unit = max(5, world.get_component(shop_entity, Shop).price_per_unit * random.uniform(0.3, 0.6))
        self._add_event(world, "economic_recovery", "¡La economía se recupera!", "info")

    def trigger_crisis(self, world):
        if not self.crisis_active:
            self._start_crisis(world)

    def _add_event(self, world, etype, desc, severity="info", meta=None):
        self.global_events.append(GlobalEvent(tick=world.tick, event_type=etype, description=desc,
                                              severity=severity, meta=meta or {}))


# ============================================================
# FASE 10: MIGRATION SYSTEM
# ============================================================
class MigrationSystem:
    MIGRATION_INTERVAL = 500
    MAX_NPCS = 50

    def __init__(self):
        self.last_migration = 0
        self.global_events = []

    def run(self, world: World):
        if len(world.entities_with_components(Identity)) >= self.MAX_NPCS:
            return
        if world.tick - self.last_migration >= self.MIGRATION_INTERVAL:
            self.last_migration = world.tick
            self._spawn_migrants(world)

    def _spawn_migrants(self, world, count=None):
        if count is None:
            count = random.randint(1, 3)
        names = [("Miguel", "male"), ("Sofia", "female"), ("Lucas", "male"),
                 ("Valentina", "female"), ("Mateo", "male"), ("Isabella", "female")]
        # Casas disponibles para alojar a los recién llegados
        houses = [b for b in world.entities_with_components(Building, Bed)
                  if world.get_component(b, Building).building_type == "house"]
        for _ in range(count):
            name, sex = random.choice(names)
            e = world.create_entity()
            if houses:
                world.add_component(e, Residence(building_id=random.choice(houses)))
            world.add_component(e, Identity(name, random.randint(18, 50), sex, "migrant", 0.3))
            # Aparecer en la zona central poblada (cerca de tiendas/camas) para que
            # puedan integrarse: comer, dormir y socializar en vez de morir aislados.
            world.add_component(e, Position(random.uniform(50, 150), random.uniform(40, 110)))
            world.add_component(e, Needs(random.uniform(50, 100), random.uniform(50, 100), 30))
            world.add_component(e, Personality(*[random.uniform(-1, 1) for _ in range(8)]))
            world.add_component(e, Emotions())
            world.add_component(e, Relationships())
            world.add_component(e, Memory())
            world.add_component(e, ActionState())
            world.add_component(e, Inventory())
            world.add_component(e, Wallet(cash=random.uniform(20, 100)))
            world.add_component(e, Profession("unemployed", 15))
            world.add_component(e, Schedule(phase="free", wake_up=7, sleep=23))
            world.add_component(e, Health())
        self._add_event(world, "migration", f"Llegaron {count} nuevo(s) migrante(s)", "info",
                        meta={"count": count})

    def trigger_migration(self, world, count=2):
        self._spawn_migrants(world, count)

    def _add_event(self, world, etype, desc, severity="info", meta=None):
        self.global_events.append(GlobalEvent(tick=world.tick, event_type=etype, description=desc,
                                              severity=severity, meta=meta or {}))


# ============================================================
# FASE 10: INNOVATION SYSTEM
# ============================================================
class InnovationSystem:
    DISCOVERY_CHANCE = 0.0005

    def __init__(self):
        self.innovations = []
        self.global_events = []

    def run(self, world: World):
        educated = [e for e in world.entities_with_components(Identity, Personality)
                    if world.get_component(e, Identity).education > 0.7]
        for npc in educated:
            if random.random() < self.DISCOVERY_CHANCE:
                self._discover(world, npc)

    def _discover(self, world, npc):
        ident = world.get_component(npc, Identity)
        innovations_pool = [
            {"key": "improved_agriculture", "name": "Agricultura mejorada", "desc": "Técnicas de cultivo más eficientes", "effect": {"food_production": 1.3}},
            {"key": "advanced_medicine", "name": "Medicina avanzada", "desc": "Mejores tratamientos médicos", "effect": {"recovery_rate": 1.5}},
            {"key": "digital_commerce", "name": "Comercio digital", "desc": "Sistema de comercio más eficiente", "effect": {"shop_prices": 0.8}},
            {"key": "public_education", "name": "Educación pública", "desc": "Mejora la educación general", "effect": {"education_rate": 1.2}},
        ]
        # Evitar redescubrir lo ya descubierto (antes salía "X descubrió Y" repetido).
        discovered = {i.name for i in self.innovations}
        available = [d for d in innovations_pool if d["name"] not in discovered]
        if not available:
            return
        data = random.choice(available)
        innovation = Innovation(name=data["name"], description=data["desc"], effect=data["effect"],
                                discovered_by=npc, tick_discovered=world.tick)
        self.innovations.append(innovation)
        if "shop_prices" in data["effect"]:
            for shop_entity in world.entities_with_components(Shop):
                world.get_component(shop_entity, Shop).price_per_unit *= data["effect"]["shop_prices"]
        if "education_rate" in data["effect"]:
            for e in world.entities_with_components(Identity):
                world.get_component(e, Identity).education = min(1.0, world.get_component(e, Identity).education * data["effect"]["education_rate"])
        self._add_event(world, "innovation", f"¡{ident.name} descubrió: {data['name']}!", "info",
                        meta={"name": ident.name, "innovation": data["key"]})

    def _add_event(self, world, etype, desc, severity="info", meta=None):
        self.global_events.append(GlobalEvent(tick=world.tick, event_type=etype, description=desc,
                                              severity=severity, meta=meta or {}))


# ============================================================
# FASE 10: WEATHER SYSTEM
# ============================================================
class WeatherSystem:
    def __init__(self):
        self.current_weather = "clear"
        self.weather_duration = 0
        self.global_events = []

    def run(self, world: World):
        self.weather_duration -= 1
        if self.weather_duration <= 0:
            self._change_weather(world)

    def _change_weather(self, world):
        weathers = ["clear", "clear", "clear", "cloudy", "rain", "storm", "drought"]
        weights = [0.4, 0.3, 0.15, 0.05, 0.05, 0.03, 0.02]
        new_weather = random.choices(weathers, weights=weights)[0]
        if new_weather != self.current_weather:
            self.current_weather = new_weather
            self.weather_duration = random.randint(100, 500)
            if new_weather == "storm":
                self._add_event(world, "weather", "¡Tormenta! La producción de comida se reduce", "warning",
                                meta={"kind": "storm"})
                for shop_entity in world.entities_with_components(Shop):
                    world.get_component(shop_entity, Shop).stock = max(0, world.get_component(shop_entity, Shop).stock - 20)
            elif new_weather == "drought":
                self._add_event(world, "weather", "¡Sequía! Los cultivos sufren", "warning",
                                meta={"kind": "drought"})
                for shop_entity in world.entities_with_components(Shop):
                    world.get_component(shop_entity, Shop).price_per_unit *= 1.5
            elif new_weather == "rain":
                self._add_event(world, "weather", "Lluvia suave, los cultivos crecen mejor", "info",
                                meta={"kind": "rain"})

    def get_weather(self):
        return self.current_weather

    def _add_event(self, world, etype, desc, severity="info", meta=None):
        self.global_events.append(GlobalEvent(tick=world.tick, event_type=etype, description=desc,
                                              severity=severity, meta=meta or {}))


# ============================================================
# ERA SYSTEM — progresión histórica de la civilización
# ============================================================
class EraSystem:
    """La aldea avanza por eras reales, desde los primeros humanos hasta el futuro.

    El 'conocimiento' se acumula con el tiempo, la población y los NPCs educados;
    al superar el umbral de la era actual, la civilización avanza a la siguiente y
    se anuncia el avance correspondiente. Las últimas eras son especulación de futuro.
    """
    ERAS = [
        "prehistory", "antiquity", "classical", "medieval", "renaissance",
        "industrial", "information", "ai", "space", "singularity",
    ]

    def __init__(self):
        self.index = 0
        self.knowledge = 0.0
        self.progress = 0.0  # 0..1 dentro de la era actual
        self.global_events = []

    def _threshold(self, i: int) -> float:
        # Cada era cuesta un poco más de conocimiento que la anterior.
        return 260.0 * (i + 1)

    def run(self, world: World):
        npcs = world.entities_with_components(Identity)
        educated = 0
        for e in npcs:
            ident = world.get_component(e, Identity)
            if ident and (ident.education or 0) > 0.6:
                educated += 1
        # El conocimiento crece con el tiempo base, la población y la educación.
        self.knowledge += 0.08 + 0.02 * len(npcs) + 0.06 * educated

        threshold = self._threshold(self.index)
        self.progress = min(1.0, self.knowledge / threshold)

        if self.knowledge >= threshold and self.index < len(self.ERAS) - 1:
            self.index += 1
            self.knowledge = 0.0
            self.progress = 0.0
            self._add_event(world, "era_advance",
                            f"¡La aldea alcanza una nueva era: {self.ERAS[self.index]}!",
                            "info", meta={"era": self.ERAS[self.index]})

    def get_state(self) -> dict:
        return {
            "era": self.ERAS[self.index],
            "index": self.index,
            "total": len(self.ERAS),
            "progress": round(self.progress, 3),
        }

    def _add_event(self, world, etype, desc, severity="info", meta=None):
        self.global_events.append(GlobalEvent(tick=world.tick, event_type=etype, description=desc,
                                              severity=severity, meta=meta or {}))


# ============================================================
# FASE 10: GLOBAL EVENT LOGGER
# ============================================================
class GlobalEventLogger:
    def __init__(self):
        self.events = []
        self.max_events = 100

    def add_event(self, event: GlobalEvent):
        self.events.append(event)
        if len(self.events) > self.max_events:
            self.events = self.events[-self.max_events:]

    def get_recent_events(self, limit=20):
        return self.events[-limit:]

    def get_events_by_type(self, event_type: str):
        return [e for e in self.events if e.event_type == event_type]

    def get_events_by_severity(self, severity: str):
        return [e for e in self.events if e.severity == severity]