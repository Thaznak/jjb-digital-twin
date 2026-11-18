import type { Fees, MarketParams, MonthlyHistory, Seasonality } from './types';

export interface Calibration {
  market: Partial<MarketParams>;
  revenuePerMember: number | null;
  notes: string[];
}

/**
 * Calibrates the market parameters on real monthly history.
 * With sign-ups and departures, it de-seasonalises them directly.
 * Without them, it infers the net flow from the member count.
 */
export function calibrate(history: MonthlyHistory[], seas: Seasonality, fees: Fees): Calibration {
  const notes: string[] = [];
  const rows = [...history].sort((a, b) => a.month.localeCompare(b.month));
  if (rows.length < 3) return { market: {}, revenuePerMember: null, notes: ['Il faut au moins 3 mois d’historique pour calibrer.'] };
  const mi = (r: MonthlyHistory) => Number(r.month.slice(5, 7)) - 1;
  const market: Partial<MarketParams> = {};

  const withFlows = rows.filter((r) => r.signups !== undefined && r.departures !== undefined && r.members > 0);
  if (withFlows.length >= 3) {
    market.baseSignupsPerMonth = withFlows.reduce((s, r) => s + (r.signups ?? 0) / seas.signups[mi(r)], 0) / withFlows.length;
    market.baseChurnMonthly = withFlows.reduce((s, r) => s + (r.departures ?? 0) / r.members / seas.churn[mi(r)], 0) / withFlows.length;
    notes.push(`Inscriptions et départs calibrés sur ${withFlows.length} mois.`);
  } else {
    // Steady state assumption: average churn of 3 %, sign-ups explain the net change.
    const churn = 0.03;
    let sum = 0;
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const cur = rows[i];
      const leaving = prev.members * churn * seas.churn[mi(cur)];
      sum += Math.max(0, cur.members - prev.members + leaving) / seas.signups[mi(cur)];
    }
    market.baseChurnMonthly = churn;
    market.baseSignupsPerMonth = sum / (rows.length - 1);
    notes.push('Pas de colonnes inscriptions/départs : churn supposé à 3 % par mois, inscriptions déduites de l’évolution des effectifs.');
  }
  const rpm = rows.reduce((s, r) => s + (r.members ? r.revenue / r.members : 0), 0) / rows.length;
  const avgFee = (fees.adultMonthly + fees.kidMonthly) / 2;
  if (Math.abs(rpm - avgFee) / avgFee > 0.25) notes.push(`Le CA par adhérent réel (${rpm.toFixed(0)} €) s’écarte des cotisations saisies : vérifie les tarifs.`);
  return { market, revenuePerMember: rpm, notes };
}
