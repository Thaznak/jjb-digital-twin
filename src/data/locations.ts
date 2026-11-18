import type { Location } from '../engine/expansion';
import { NORMALS } from './climate';

/**
 * Candidate locations. Populations are rounded public orders of magnitude;
 * competitors and rents are HYPOTHESES to check on the ground before any decision.
 */
export const LOCATIONS: Location[] = [
  { id: 'roubaix', name: 'Roubaix', lat: 50.69, lon: 3.18, population: 99000, targetShare: 0.42, competitors: 2, rentPerM2Month: 9, distanceKm: 11, ...NORMALS.lille, note: 'Ville jeune, loyers modérés.' },
  { id: 'villeneuve', name: 'Villeneuve-d’Ascq', lat: 50.62, lon: 3.14, population: 62000, targetShare: 0.48, competitors: 1, rentPerM2Month: 12, distanceKm: 6, ...NORMALS.lille, note: 'Campus étudiants, proche du club actuel.' },
  { id: 'arras', name: 'Arras', lat: 50.29, lon: 2.78, population: 41000, targetShare: 0.38, competitors: 0, rentPerM2Month: 8, distanceKm: 45, ...NORMALS.lille, note: 'Pas de club identifié (à vérifier).' },
  { id: 'lens', name: 'Lens', lat: 50.43, lon: 2.83, population: 32000, targetShare: 0.4, competitors: 1, rentPerM2Month: 7, distanceKm: 33, ...NORMALS.lille },
  { id: 'paris11', name: 'Paris 11e', lat: 48.86, lon: 2.38, population: 140000, targetShare: 0.5, competitors: 6, rentPerM2Month: 28, distanceKm: 220, ...NORMALS.paris, note: 'Gros marché, forte concurrence, loyers élevés.' },
  { id: 'montreal', name: 'Montréal, Plateau', lat: 45.52, lon: -73.58, population: 104000, targetShare: 0.52, competitors: 4, rentPerM2Month: 16, distanceKm: 5500, ...NORMALS.montreal, note: 'Montants convertis en euros, hivers rudes.' },
];
