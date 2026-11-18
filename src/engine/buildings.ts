import type { Building, BuildingType } from './types';

export interface BuildingSpec {
  type: BuildingType;
  label: string;
  w: number; // footprint in tiles along x
  h: number; // footprint in tiles along y
  capex: number; // one-off cost in EUR when placed in game
  monthlyCost: number; // running cost in EUR per month
  description: string;
}

export const BUILDING_SPECS: Record<BuildingType, BuildingSpec> = {
  dojo: { type: 'dojo', label: 'Dojo', w: 6, h: 6, capex: 0, monthlyCost: 0, description: 'La salle. Les tatamis se posent sur son plancher.' },
  tatami: { type: 'tatami', label: 'Tatami', w: 1, h: 1, capex: 140, monthlyCost: 2, description: '+2 places par créneau (une paire).' },
  vestiaire: { type: 'vestiaire', label: 'Vestiaires', w: 2, h: 2, capex: 4500, monthlyCost: 70, description: '+25 personnes en même temps.' },
  accueil: { type: 'accueil', label: 'Accueil', w: 2, h: 1, capex: 1500, monthlyCost: 20, description: '+15 % de conversion des essais (une fois).' },
  boutique: { type: 'boutique', label: 'Boutique', w: 2, h: 2, capex: 3000, monthlyCost: 40, description: '+1,5 € de marge par adhérent et par mois (gi, rashguards).' },
  parking: { type: 'parking', label: 'Parking', w: 2, h: 2, capex: 0, monthlyCost: 120, description: '+6 % d’attractivité (deux au maximum).' },
};

export const PLACES_PER_TATAMI = 2;
export const PEOPLE_PER_LOCKER_ROOM = 25;
/** Gross margin of the shop, EUR per member per month. */
export const SHOP_MARGIN_PER_MEMBER = 1.5;

export function footprint(b: Pick<Building, 'type' | 'x' | 'y'>): { x: number; y: number }[] {
  const s = BUILDING_SPECS[b.type];
  const tiles: { x: number; y: number }[] = [];
  for (let dx = 0; dx < s.w; dx++) for (let dy = 0; dy < s.h; dy++) tiles.push({ x: b.x + dx, y: b.y + dy });
  return tiles;
}

function onDojo(t: { x: number; y: number }, dojos: Building[]): boolean {
  return dojos.some((d) => t.x >= d.x && t.x < d.x + BUILDING_SPECS.dojo.w && t.y >= d.y && t.y < d.y + BUILDING_SPECS.dojo.h);
}

/** Can this building be placed? Tatamis go on a dojo floor; everything else on free ground. */
export function canPlace(buildings: Building[], type: BuildingType, x: number, y: number, mapSize: number): boolean {
  const tiles = footprint({ type, x, y });
  if (tiles.some((t) => t.x < 0 || t.y < 0 || t.x >= mapSize || t.y >= mapSize)) return false;
  const dojos = buildings.filter((b) => b.type === 'dojo');
  if (type === 'tatami') {
    if (!onDojo(tiles[0], dojos)) return false;
    return !buildings.some((b) => b.type === 'tatami' && b.x === x && b.y === y);
  }
  const occupied = new Set(buildings.flatMap((b) => footprint(b).map((t) => `${t.x},${t.y}`)));
  return tiles.every((t) => !occupied.has(`${t.x},${t.y}`));
}

export interface Facilities {
  hasDojo: boolean;
  matPlaces: number;
  lockerPlaces: number;
  /** Places per slot = the tightest bottleneck. */
  slotCapacity: number;
  bottleneck: 'tatamis' | 'vestiaires' | 'aucun dojo';
  conversionBonus: number; // multiplier on sign-ups
  attractiveness: number; // multiplier on sign-ups
  monthlyCost: number;
  /** Extra revenue, EUR per member per month (shop). */
  revenuePerMember: number;
}

export function facilities(buildings: Building[]): Facilities {
  const count = (t: BuildingType) => buildings.filter((b) => b.type === t).length;
  const dojos = buildings.filter((b) => b.type === 'dojo');
  const tatamisOnFloor = buildings.filter((b) => b.type === 'tatami' && onDojo(b, dojos)).length;
  const matPlaces = tatamisOnFloor * PLACES_PER_TATAMI;
  const lockerPlaces = count('vestiaire') * PEOPLE_PER_LOCKER_ROOM;
  const hasDojo = dojos.length > 0;
  const slotCapacity = hasDojo ? Math.min(matPlaces, lockerPlaces) : 0;
  const bottleneck = !hasDojo ? 'aucun dojo' : matPlaces <= lockerPlaces ? 'tatamis' : 'vestiaires';
  const monthlyCost = buildings.reduce((s, b) => s + BUILDING_SPECS[b.type].monthlyCost, 0);
  return {
    hasDojo,
    matPlaces,
    lockerPlaces,
    slotCapacity,
    bottleneck,
    conversionBonus: count('accueil') > 0 ? 1.15 : 1,
    attractiveness: 1 + 0.06 * Math.min(2, count('parking')),
    monthlyCost,
    revenuePerMember: count('boutique') > 0 ? SHOP_MARGIN_PER_MEMBER : 0,
  };
}
