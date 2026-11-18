// Domain types for the club model. Pure TypeScript, no Phaser, no DOM.

export const BELTS = ['blanche', 'grise', 'jaune', 'orange', 'verte', 'bleue', 'violette', 'marron', 'noire'] as const;
export type Belt = (typeof BELTS)[number];
export type Segment = 'adulte' | 'enfant';
export type SlotAudience = Segment | 'tous';

/** One anonymised member: no name, no e-mail, no phone. */
export interface Member {
  id: string;
  segment: Segment;
  belt: Belt;
  age: number;
  joinDate: string; // YYYY-MM-DD
  sessionsPerWeek: number;
}

/** A weekly class slot. day: 0 = lundi ... 6 = dimanche. */
export interface Slot {
  id: string;
  day: number;
  start: number; // decimal hour, 19.5 = 19h30
  durationH: number;
  audience: SlotAudience;
  label: string;
  coachId: string;
}

export interface Coach {
  id: string;
  label: string;
  hourlyCost: number; // EUR per hour taught
  maxHoursWeek: number;
}

export interface Charge {
  id: string;
  label: string;
  /** fixe: EUR per month. par_adherent: EUR per member per month. */
  kind: 'fixe' | 'par_adherent';
  amount: number;
}

export interface Fees {
  adultMonthly: number;
  kidMonthly: number;
  registrationFee: number;
}

export type BuildingType = 'dojo' | 'tatami' | 'vestiaire' | 'accueil' | 'parking';

export interface Building {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
}

export interface MarketParams {
  /** De-seasonalised sign-ups per month, all segments. */
  baseSignupsPerMonth: number;
  /** Share of sign-ups that are kids, at the reference slot offer. */
  kidSignupShare: number;
  /** De-seasonalised monthly churn rate (0.03 = 3 % of members leave per month). */
  baseChurnMonthly: number;
  /** +10 % fee => +elasticity*10 % churn. */
  feeElasticity: number;
}

export interface MonthlyHistory {
  month: string; // YYYY-MM
  revenue: number;
  members: number;
  signups?: number;
  departures?: number;
}

export interface CityRef {
  name: string;
  lat: number;
  lon: number;
}

export interface ClubConfig {
  name: string;
  city: CityRef;
  startCash: number;
  members: Member[];
  slots: Slot[];
  coaches: Coach[];
  charges: Charge[];
  fees: Fees;
  buildings: Building[];
  market: MarketParams;
  history: MonthlyHistory[];
}

/** Daily weather as seen by the engine. */
export interface DayWeather {
  tempMaxC: number;
  precipMm: number;
  source: 'open-meteo' | 'normales';
}

/** Monthly coefficients, index 0 = janvier. 1 = average month. */
export interface Seasonality {
  attendance: number[];
  signups: number[];
  churn: number[];
}

/** Everything the engine needs from the outside world, injected by /data. */
export interface Environment {
  weather: (isoDate: string) => DayWeather;
  seasonality: Seasonality;
}
