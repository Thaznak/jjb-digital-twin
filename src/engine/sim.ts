import { facilities } from './buildings';
import { createRng, noise } from './rng';
import { applyShocks, coachHours, type Effective, type Shock } from './shocks';
import type { ClubConfig, DayWeather, Environment, Segment, Slot } from './types';

// ---------- date helpers (UTC, ISO YYYY-MM-DD) ----------
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** 0 = lundi ... 6 = dimanche */
export function weekday(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}
export function monthIndex(iso: string): number {
  return Number(iso.slice(5, 7)) - 1;
}
export function daysInMonth(iso: string): number {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function monthsBetween(a: string, b: string): number {
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
}

// ---------- reports ----------
export interface SlotFill {
  slot: Slot;
  demand: number;
  attendees: number;
  capacity: number;
}
export interface DemandFactor {
  key: 'meteo' | 'saison' | 'satisfaction';
  label: string;
  value: number; // multiplier, 1 = neutral
}
export interface CoachLoad {
  coachId: string;
  label: string;
  hours: number;
  load: number; // hours / max
}
export interface DayReport {
  date: string;
  weather: DayWeather;
  factors: DemandFactor[];
  fills: SlotFill[];
  members: Record<Segment, number>;
  cash: number;
  satisfaction: number;
  revenue: number;
  costs: number;
  coachLoads: CoachLoad[];
  cancelledSlots: number;
}
export interface MonthReport {
  month: string; // YYYY-MM
  revenue: number;
  costs: number;
  margin: number;
  cash: number;
  members: number;
  kids: number;
  signups: number;
  departures: number;
  satisfaction: number;
  avgFill: number;
  peakFill: number;
  overflowSlotDays: number;
  coachLoadMax: number;
}

export interface SimState {
  date: string;
  dayCount: number;
  cash: number;
  members: Record<Segment, number>;
  satisfaction: number;
  overflowEma: number;
}

export interface SimOptions {
  startDate: string;
  seed?: number;
  shocks?: Shock[];
}

/** Demand multiplier from the day's weather. Rain and cold keep people home; heat on the mats too. */
export function weatherFactor(w: DayWeather): number {
  let f = 1;
  if (w.precipMm > 8) f *= 0.82;
  else if (w.precipMm > 2) f *= 0.92;
  if (w.tempMaxC < 2) f *= 0.9;
  if (w.tempMaxC >= 32) f *= 0.75;
  else if (w.tempMaxC >= 28) f *= 0.88;
  return f;
}

function avgSessions(config: ClubConfig, seg: Segment): number {
  const list = config.members.filter((m) => m.segment === seg);
  if (!list.length) return seg === 'adulte' ? 2 : 1.5;
  return list.reduce((s, m) => s + m.sessionsPerWeek, 0) / list.length;
}

function weeklySlots(slots: Slot[], seg: Segment): number {
  return slots.filter((s) => s.audience === seg || s.audience === 'tous').length;
}

export class ClubSim {
  readonly config: ClubConfig;
  readonly env: Environment;
  readonly shocks: Shock[];
  readonly startDate: string;
  state: SimState;
  months: MonthReport[] = [];
  days: DayReport[] = [];
  private rng: () => number;
  private refSlots: Record<Segment, number>;
  private sessions: Record<Segment, number>;
  private acc = this.emptyAcc();

  constructor(config: ClubConfig, env: Environment, opts: SimOptions) {
    this.config = config;
    this.env = env;
    this.shocks = opts.shocks ?? [];
    this.startDate = opts.startDate;
    this.rng = createRng(opts.seed ?? 42);
    this.refSlots = { adulte: Math.max(1, weeklySlots(config.slots, 'adulte')), enfant: Math.max(1, weeklySlots(config.slots, 'enfant')) };
    this.sessions = { adulte: avgSessions(config, 'adulte'), enfant: avgSessions(config, 'enfant') };
    this.state = {
      date: opts.startDate,
      dayCount: 0,
      cash: config.startCash,
      members: {
        adulte: config.members.filter((m) => m.segment === 'adulte').length,
        enfant: config.members.filter((m) => m.segment === 'enfant').length,
      },
      satisfaction: 0.8,
      overflowEma: 0,
    };
  }

  private emptyAcc() {
    return { revenue: 0, costs: 0, signups: 0, departures: 0, sat: 0, days: 0, fillSum: 0, fillN: 0, peak: 0, overflow: 0, coachMax: 0 };
  }

  effective(date = this.state.date): Effective {
    return applyShocks(this.config, this.shocks, monthsBetween(this.startDate, date));
  }

  /** Simulates one day and returns its report. */
  step(): DayReport {
    const s = this.state;
    const date = s.date;
    const m = monthIndex(date);
    const dim = daysInMonth(date);
    const eff = this.effective(date);
    const cfg = eff.config;
    const fac = facilities(cfg.buildings);
    const seas = this.env.seasonality;

    // Weather, with the scenario's heat if any.
    const raw = this.env.weather(date);
    const weather: DayWeather = { ...raw, tempMaxC: raw.tempMaxC + eff.heatExtra(m) };
    const wf = weatherFactor(weather);
    const sf = seas.attendance[m];
    const satf = 0.85 + 0.25 * s.satisfaction; // 0.8 -> 1.05
    const factors: DemandFactor[] = [
      { key: 'meteo', label: 'Météo', value: wf },
      { key: 'saison', label: 'Saison', value: sf },
      { key: 'satisfaction', label: 'Motivation', value: satf },
    ];

    // Attendance per class today.
    const wd = weekday(date);
    const slotsPerSeg = { adulte: Math.max(1, weeklySlots(cfg.slots, 'adulte')), enfant: Math.max(1, weeklySlots(cfg.slots, 'enfant')) };
    const fills: SlotFill[] = cfg.slots
      .filter((sl) => sl.day === wd)
      .map((slot) => {
        const segs: Segment[] = slot.audience === 'tous' ? ['adulte', 'enfant'] : [slot.audience];
        // A mixed slot (open mat) only draws part of each segment.
        const mix = segs.length > 1 ? 0.6 : 1;
        const base = segs.reduce((d, seg) => d + (mix * s.members[seg] * this.sessions[seg]) / slotsPerSeg[seg], 0);
        const demand = base * wf * sf * satf * noise(this.rng, 0.12);
        const capacity = fac.slotCapacity;
        return { slot, demand, attendees: Math.min(demand, capacity), capacity };
      });

    // Coaches.
    const coachLoads: CoachLoad[] = cfg.coaches.map((c) => {
      const hours = coachHours(cfg.slots, c.id);
      return { coachId: c.id, label: c.label, hours, load: hours / c.maxHoursWeek };
    });
    const maxLoad = coachLoads.reduce((mx, c) => Math.max(mx, c.load), 0);

    // Satisfaction drifts toward a target set by crowding, coach fatigue and price.
    if (fills.length) {
      const totalDemand = fills.reduce((a, f) => a + f.demand, 0);
      const overflow = fills.reduce((a, f) => a + Math.max(0, f.demand - f.capacity), 0);
      const ratio = totalDemand > 0 ? overflow / totalDemand : 0;
      s.overflowEma += (ratio - s.overflowEma) * 0.1;
      const target = 0.88 - 1.2 * ratio - 0.4 * Math.max(0, maxLoad - 1) - 0.3 * Math.max(0, eff.feeIncrease) - 0.05 * eff.cancelledSlotIds.length;
      s.satisfaction += (Math.min(0.95, Math.max(0.2, target)) - s.satisfaction) * 0.04;
    }

    // Members flow, booked daily so curves stay smooth.
    const mk = cfg.market;
    const satSignup = 0.5 + 0.625 * s.satisfaction;
    const feeSignup = Math.max(0.3, 1 - 0.8 * Math.max(0, eff.feeIncrease));
    const crowding = 1 - Math.min(0.5, s.overflowEma * 2);
    const monthlySignups = mk.baseSignupsPerMonth * seas.signups[m] * fac.attractiveness * fac.conversionBonus * satSignup * feeSignup * crowding;
    const segFactor = (seg: Segment) => Math.min(1.6, Math.max(0.3, weeklySlots(cfg.slots, seg) / this.refSlots[seg]));
    const kidShare = mk.kidSignupShare;
    const signupsToday = {
      adulte: (monthlySignups * (1 - kidShare) * segFactor('adulte')) / dim,
      enfant: (monthlySignups * kidShare * segFactor('enfant')) / dim,
    };
    if (Number(date.slice(8, 10)) === 15 && eff.oneOff.extraSignups) signupsToday.adulte += eff.oneOff.extraSignups;
    const churnRate = mk.baseChurnMonthly * seas.churn[m] * (1 + Math.max(0, 0.8 - s.satisfaction) * 3) * (1 + mk.feeElasticity * Math.max(0, eff.feeIncrease));
    const departures = { adulte: (s.members.adulte * churnRate) / dim, enfant: (s.members.enfant * churnRate) / dim };
    for (const seg of ['adulte', 'enfant'] as Segment[]) {
      if (!fac.hasDojo) departures[seg] = s.members[seg] * 0.02; // no room, people leave fast
      s.members[seg] = Math.max(0, s.members[seg] + signupsToday[seg] - departures[seg]);
    }
    const totalMembers = s.members.adulte + s.members.enfant;
    const newcomers = signupsToday.adulte + signupsToday.enfant;

    // Money.
    const fees = cfg.fees;
    let revenue = ((s.members.adulte * fees.adultMonthly + s.members.enfant * fees.kidMonthly) * eff.feeMultiplier) / dim + newcomers * fees.registrationFee + (totalMembers * fac.revenuePerMember) / dim;
    const fixed = cfg.charges.filter((c) => c.kind === 'fixe').reduce((a, c) => a + c.amount, 0);
    const perMember = cfg.charges.filter((c) => c.kind === 'par_adherent').reduce((a, c) => a + c.amount, 0) * totalMembers;
    const coachPay = cfg.slots.reduce((a, sl) => a + sl.durationH * (cfg.coaches.find((c) => c.id === sl.coachId)?.hourlyCost ?? 0), 0) * (52 / 12);
    let costs = (fixed + perMember + coachPay + fac.monthlyCost) / dim;
    if (Number(date.slice(8, 10)) === 15) {
      revenue += eff.oneOff.revenue;
      costs += eff.oneOff.cost;
    }
    s.cash += revenue - costs;

    const report: DayReport = {
      date,
      weather,
      factors,
      fills,
      members: { ...s.members },
      cash: s.cash,
      satisfaction: s.satisfaction,
      revenue,
      costs,
      coachLoads,
      cancelledSlots: eff.cancelledSlotIds.length,
    };

    // Month accumulator.
    const a = this.acc;
    a.revenue += revenue;
    a.costs += costs;
    a.signups += newcomers;
    a.departures += departures.adulte + departures.enfant;
    a.sat += s.satisfaction;
    a.days += 1;
    for (const f of fills) {
      if (f.capacity > 0) {
        a.fillSum += f.attendees / f.capacity;
        a.fillN += 1;
        a.peak = Math.max(a.peak, f.demand / f.capacity);
      }
      if (f.demand > f.capacity) a.overflow += 1;
    }
    a.coachMax = Math.max(a.coachMax, maxLoad);

    this.days.push(report);
    if (this.days.length > 400) this.days.shift();
    const next = addDays(date, 1);
    if (next.slice(0, 7) !== date.slice(0, 7)) this.closeMonth(date.slice(0, 7));
    s.date = next;
    s.dayCount += 1;
    return report;
  }

  private closeMonth(month: string) {
    const a = this.acc;
    const s = this.state;
    this.months.push({
      month,
      revenue: a.revenue,
      costs: a.costs,
      margin: a.revenue > 0 ? (a.revenue - a.costs) / a.revenue : 0,
      cash: s.cash,
      members: s.members.adulte + s.members.enfant,
      kids: s.members.enfant,
      signups: a.signups,
      departures: a.departures,
      satisfaction: a.days ? a.sat / a.days : s.satisfaction,
      avgFill: a.fillN ? a.fillSum / a.fillN : 0,
      peakFill: a.peak,
      overflowSlotDays: a.overflow,
      coachLoadMax: a.coachMax,
    });
    this.acc = this.emptyAcc();
  }

  run(days: number): DayReport[] {
    const out: DayReport[] = [];
    for (let i = 0; i < days; i++) out.push(this.step());
    return out;
  }

  /** Runs until n full calendar months are closed. */
  runMonths(n: number): MonthReport[] {
    const target = this.months.length + n;
    while (this.months.length < target) this.step();
    return this.months.slice(-n);
  }
}
