import { weatherFactor } from './sim';

/** A candidate location for a new club. Every number is a hypothesis the user can edit. */
export interface Location {
  id: string;
  name: string;
  lat: number;
  lon: number;
  population: number;
  /** Share of the population in the target ages (kids 6-14 and adults 18-45). */
  targetShare: number;
  /** Grappling / BJJ clubs already nearby. */
  competitors: number;
  rentPerM2Month: number;
  /** Distance to the current club, for cannibalisation. */
  distanceKm: number;
  /** Climate normals, index 0 = janvier. */
  tempMax: number[];
  rainMm: number[];
  note?: string;
}

export interface ExpansionInput {
  location: Location;
  surfaceM2: number;
  fitOutCost: number;
  adultFee: number;
  kidFee: number;
  kidShare: number;
  coachHoursWeek: number;
  coachHourly: number;
  otherFixedMonthly: number;
  /** Share of the target population that would practise BJJ/grappling if a club were close. */
  practiceRate: number;
  /** Months to reach ~95 % of the target. */
  rampMonths: number;
  /** 1 = as attractive as a competitor. */
  attractiveness: number;
  horizonMonths: number;
  currentClubMembers: number;
}

export interface ExpansionMonth {
  month: number;
  members: number;
  revenue: number;
  costs: number;
  cash: number;
}

export type Verdict = 'pertinent' | 'a-creuser' | 'pas-pertinent';

export interface ExpansionResult {
  potential: number;
  capacityCap: number;
  target: number;
  climateIndex: number;
  cannibalised: number;
  investment: number;
  months: ExpansionMonth[];
  breakEvenMonth: number | null;
  paybackMonth: number | null;
  steadyMargin: number;
  verdict: Verdict;
  reasons: string[];
}

export const VERDICT_LABELS: Record<Verdict, string> = {
  pertinent: 'Implantation pertinente',
  'a-creuser': 'À creuser',
  'pas-pertinent': 'Pas pertinente en l’état',
};

const M2_PER_PLACE = 3; // a pair needs ~6 m² of mat
const SLOTS_PER_WEEK = 10;
const SESSIONS_PER_MEMBER = 1.8;

export function evaluateLocation(input: ExpansionInput): ExpansionResult {
  const loc = input.location;
  const potential = loc.population * loc.targetShare * input.practiceRate;
  const share = input.attractiveness / (loc.competitors + input.attractiveness);
  const climateIndex = loc.tempMax.reduce((s, t, i) => s + weatherFactor({ tempMaxC: t, precipMm: loc.rainMm[i] / 12, source: 'normales' }), 0) / 12;
  const places = Math.floor((input.surfaceM2 * 0.7) / M2_PER_PLACE);
  const capacityCap = Math.floor((places * SLOTS_PER_WEEK * 0.85) / SESSIONS_PER_MEMBER);
  const target = Math.min(capacityCap, potential * share * (0.6 + 0.4 * climateIndex));
  const cannibalised = loc.distanceKm < 8 ? input.currentClubMembers * 0.15 * (1 - loc.distanceKm / 8) : 0;

  const rent = input.surfaceM2 * loc.rentPerM2Month;
  const coachPay = input.coachHoursWeek * input.coachHourly * (52 / 12);
  const investment = input.fitOutCost + rent * 3; // fit-out + 3 months deposit
  const fee = input.adultFee * (1 - input.kidShare) + input.kidFee * input.kidShare;
  const tau = Math.max(1, input.rampMonths / 3);

  let cash = -investment;
  const months: ExpansionMonth[] = [];
  let breakEvenMonth: number | null = null;
  let paybackMonth: number | null = null;
  for (let t = 1; t <= input.horizonMonths; t++) {
    const members = target * (1 - Math.exp(-t / tau));
    const revenue = members * fee;
    const costs = rent + coachPay + input.otherFixedMonthly + members * 3;
    cash += revenue - costs;
    months.push({ month: t, members, revenue, costs, cash });
    if (breakEvenMonth === null && revenue >= costs) breakEvenMonth = t;
    if (paybackMonth === null && cash >= 0) paybackMonth = t;
  }
  const lastM = months[months.length - 1];
  const steadyMargin = lastM.revenue > 0 ? (lastM.revenue - lastM.costs) / lastM.revenue : -1;

  const reasons: string[] = [];
  reasons.push(`Potentiel local : ${Math.round(potential)} pratiquants possibles, ${loc.competitors} club(s) déjà présents, part captable ${Math.round(share * 100)} %.`);
  if (target >= capacityCap) reasons.push(`La salle limite la croissance : ${capacityCap} adhérents au maximum avec ${input.surfaceM2} m².`);
  reasons.push(breakEvenMonth ? `Point mort mensuel atteint au mois ${breakEvenMonth}.` : `Point mort jamais atteint sur ${input.horizonMonths} mois.`);
  reasons.push(paybackMonth ? `Investissement de ${Math.round(investment)} € remboursé au mois ${paybackMonth}.` : `Investissement de ${Math.round(investment)} € non remboursé sur ${input.horizonMonths} mois.`);
  if (cannibalised >= 1) reasons.push(`Risque de cannibalisation : environ ${Math.round(cannibalised)} adhérents actuels pourraient changer de club (${loc.distanceKm} km).`);
  if (climateIndex < 0.93) reasons.push(`Climat défavorable à l’assiduité (indice ${climateIndex.toFixed(2)}).`);

  let verdict: Verdict;
  if (paybackMonth !== null && paybackMonth <= 24 && steadyMargin >= 0.15 && cannibalised < 10) verdict = 'pertinent';
  else if (paybackMonth !== null || (breakEvenMonth !== null && breakEvenMonth <= 12 && steadyMargin > 0.05)) verdict = 'a-creuser';
  else verdict = 'pas-pertinent';

  return { potential, capacityCap, target, climateIndex, cannibalised, investment, months, breakEvenMonth, paybackMonth, steadyMargin, verdict, reasons };
}
