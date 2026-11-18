import { facilities } from './buildings';
import { ClubSim, type MonthReport } from './sim';
import type { Shock } from './shocks';
import type { ClubConfig, Environment } from './types';

export interface Alert {
  level: 'tension' | 'crise';
  target: 'tatami' | 'vestiaire' | 'accueil' | 'dojo';
  month: string;
  text: string;
}

export interface Comparison {
  baseline: MonthReport[];
  scenario: MonthReport[];
  delta: { cash: number; margin: number; members: number; satisfaction: number; coachLoadMax: number };
  alerts: Alert[];
}

/** Detects the fragile points of a run, used for map alerts (kintsugi cracks). */
export function detectAlerts(months: MonthReport[], bottleneck: 'tatamis' | 'vestiaires' | 'aucun dojo'): Alert[] {
  const alerts: Alert[] = [];
  const first = (pred: (m: MonthReport) => boolean) => months.find(pred);
  const crowd = first((m) => m.peakFill > 1.05);
  if (crowd) {
    const target = bottleneck === 'vestiaires' ? 'vestiaire' : 'tatami';
    alerts.push({ level: crowd.peakFill > 1.25 ? 'crise' : 'tension', target, month: crowd.month, text: `${target === 'vestiaire' ? 'Vestiaires saturés' : 'Tatamis saturés'} (${Math.round(crowd.peakFill * 100)} % au pic)` });
  }
  const tired = first((m) => m.coachLoadMax > 1);
  if (tired) alerts.push({ level: tired.coachLoadMax > 1.3 ? 'crise' : 'tension', target: 'dojo', month: tired.month, text: `Profs surchargés (${Math.round(tired.coachLoadMax * 100)} % de leur maximum)` });
  const broke = first((m) => m.cash < 0);
  if (broke) alerts.push({ level: 'crise', target: 'accueil', month: broke.month, text: 'Trésorerie négative' });
  const unhappy = first((m) => m.satisfaction < 0.6);
  if (unhappy) alerts.push({ level: unhappy.satisfaction < 0.45 ? 'crise' : 'tension', target: 'accueil', month: unhappy.month, text: `Satisfaction en baisse (${Math.round(unhappy.satisfaction * 100)} %)` });
  return alerts;
}

/** Runs a baseline and a scenario with the same seed over n months. */
export function compareScenario(config: ClubConfig, env: Environment, shocks: Shock[], startDate: string, months = 6, seed = 7): Comparison {
  const base = new ClubSim(config, env, { startDate, seed });
  const scn = new ClubSim(config, env, { startDate, seed, shocks });
  const baseline = base.runMonths(months);
  const scenario = scn.runMonths(months);
  const last = (r: MonthReport[]) => r[r.length - 1];
  const sum = (r: MonthReport[], k: 'revenue' | 'costs') => r.reduce((a, m) => a + m[k], 0);
  const margin = (r: MonthReport[]) => {
    const rev = sum(r, 'revenue');
    return rev > 0 ? (rev - sum(r, 'costs')) / rev : 0;
  };
  const bottleneck = facilities(config.buildings).bottleneck;
  return {
    baseline,
    scenario,
    delta: {
      cash: last(scenario).cash - last(baseline).cash,
      margin: margin(scenario) - margin(baseline),
      members: last(scenario).members - last(baseline).members,
      satisfaction: last(scenario).satisfaction - last(baseline).satisfaction,
      coachLoadMax: Math.max(...scenario.map((m) => m.coachLoadMax)) - Math.max(...baseline.map((m) => m.coachLoadMax)),
    },
    alerts: detectAlerts(scenario, bottleneck),
  };
}
