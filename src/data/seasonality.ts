import type { Seasonality } from '../engine/types';
import raw from './seasonality.json';

/** Connector: seasonal coefficients from a JSON file (swappable for any other source). */
export function loadSeasonality(): Seasonality {
  return { attendance: raw.attendance, signups: raw.signups, churn: raw.churn };
}
