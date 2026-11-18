import type { ClubConfig, Coach, Slot } from './types';

/** Scenario shocks. fromMonth is counted from the simulation start (0 = first month). */
export type Shock =
  | { kind: 'creneau-enfants'; fromMonth: number; day: number; start: number }
  | { kind: 'hausse-cotisation'; fromMonth: number; pct: number }
  | { kind: 'depart-prof'; fromMonth: number; coachId: string }
  | { kind: 'embauche-prof'; fromMonth: number; hourlyCost: number; maxHoursWeek: number }
  | { kind: 'canicule'; calendarMonth: number; extraC: number }
  | { kind: 'stage'; fromMonth: number; participants: number; price: number; cost: number; extraSignups: number }
  | { kind: 'hausse-loyer'; fromMonth: number; pct: number };

export const SHOCK_LABELS: Record<Shock['kind'], string> = {
  'creneau-enfants': 'Nouveau créneau enfants',
  'hausse-cotisation': 'Hausse de cotisation',
  'depart-prof': 'Départ d’un prof',
  'embauche-prof': 'Embauche d’un prof',
  canicule: 'Canicule',
  stage: 'Stage avec un invité',
  'hausse-loyer': 'Hausse du loyer',
};

export interface Effective {
  config: ClubConfig;
  feeMultiplier: number;
  /** Fee increase vs. the reference, 0.1 = +10 %. Drives churn and sign-ups. */
  feeIncrease: number;
  cancelledSlotIds: string[];
  /** Extra temperature for a given calendar month (0-11). */
  heatExtra: (calendarMonth: number) => number;
  /** One-off cash and sign-ups booked in this month. */
  oneOff: { revenue: number; cost: number; extraSignups: number };
}

export function coachHours(slots: Slot[], coachId: string): number {
  return slots.filter((s) => s.coachId === coachId).reduce((h, s) => h + s.durationH, 0);
}

function leastLoaded(coaches: Coach[], slots: Slot[]): Coach | undefined {
  return [...coaches].sort((a, b) => coachHours(slots, a.id) / a.maxHoursWeek - coachHours(slots, b.id) / b.maxHoursWeek)[0];
}

/** Applies every shock active at monthOffset to a copy of the config. Pure. */
export function applyShocks(base: ClubConfig, shocks: Shock[], monthOffset: number): Effective {
  let coaches = base.coaches.map((c) => ({ ...c }));
  let slots = base.slots.map((s) => ({ ...s }));
  let charges = base.charges.map((c) => ({ ...c }));
  let feeMultiplier = 1;
  const cancelled: string[] = [];
  const oneOff = { revenue: 0, cost: 0, extraSignups: 0 };
  const heat: Record<number, number> = {};

  for (const s of shocks) {
    if (s.kind === 'canicule') {
      heat[s.calendarMonth] = (heat[s.calendarMonth] ?? 0) + s.extraC;
      continue;
    }
    if (s.kind === 'stage') {
      if (s.fromMonth === monthOffset) {
        oneOff.revenue += s.participants * s.price;
        oneOff.cost += s.cost;
        oneOff.extraSignups += s.extraSignups;
      }
      continue;
    }
    if (monthOffset < s.fromMonth) continue;
    switch (s.kind) {
      case 'creneau-enfants': {
        const coach = leastLoaded(coaches, slots);
        slots.push({ id: `scn-enfants-${s.day}-${s.start}`, day: s.day, start: s.start, durationH: 1, audience: 'enfant', label: 'Enfants (nouveau)', coachId: coach?.id ?? '' });
        break;
      }
      case 'hausse-cotisation':
        feeMultiplier *= 1 + s.pct;
        break;
      case 'hausse-loyer': {
        const rent = charges.filter((c) => /loyer/i.test(c.label));
        const targets = rent.length ? rent : [...charges].filter((c) => c.kind === 'fixe').sort((a, b) => b.amount - a.amount).slice(0, 1);
        charges = charges.map((c) => (targets.includes(c) ? { ...c, amount: c.amount * (1 + s.pct) } : c));
        break;
      }
      case 'depart-prof': {
        coaches = coaches.filter((c) => c.id !== s.coachId);
        for (const slot of slots.filter((x) => x.coachId === s.coachId)) {
          const next = leastLoaded(coaches, slots);
          // Remaining coaches absorb the class unless they would exceed 150 % of their max.
          if (next && (coachHours(slots, next.id) + slot.durationH) / next.maxHoursWeek <= 1.5) slot.coachId = next.id;
          else cancelled.push(slot.id);
        }
        break;
      }
      case 'embauche-prof': {
        const hire: Coach = { id: 'scn-embauche', label: 'Nouveau prof', hourlyCost: s.hourlyCost, maxHoursWeek: s.maxHoursWeek };
        coaches.push(hire);
        // Move classes from overloaded coaches to the new one.
        for (const c of coaches) {
          if (c === hire) continue;
          for (const slot of slots.filter((x) => x.coachId === c.id)) {
            if (coachHours(slots, c.id) <= c.maxHoursWeek) break;
            if (coachHours(slots, hire.id) + slot.durationH > hire.maxHoursWeek) break;
            slot.coachId = hire.id;
          }
        }
        break;
      }
    }
  }
  slots = slots.filter((s) => !cancelled.includes(s.id));
  return {
    config: { ...base, coaches, slots, charges },
    feeMultiplier,
    feeIncrease: feeMultiplier - 1,
    cancelledSlotIds: cancelled,
    heatExtra: (m) => heat[m] ?? 0,
    oneOff,
  };
}
