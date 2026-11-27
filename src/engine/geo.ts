import type { Point, Site } from './types';

/**
 * Ties the plan to real GPS coordinates: one anchor point and the rotation of the plan.
 * The default values are rough and must be calibrated on site (see docs).
 */
export interface GeoAnchor {
  lat: number;
  lon: number;
  /** Plan point that sits at (lat, lon). */
  at: Point;
  /** Angle in degrees between geographic east and the plan's u axis, counter-clockwise. */
  rotationDeg: number;
}

const M_PER_DEG_LAT = 111_320;

export function toPlan(site: Site, anchor: GeoAnchor, lat: number, lon: number): Point {
  const east = (lon - anchor.lon) * M_PER_DEG_LAT * Math.cos((anchor.lat * Math.PI) / 180);
  const north = (lat - anchor.lat) * M_PER_DEG_LAT;
  const r = (anchor.rotationDeg * Math.PI) / 180;
  // Rotate the (east, north) vector into the plan frame, then flip north to v (south).
  const x = east * Math.cos(r) + north * Math.sin(r);
  const y = -east * Math.sin(r) + north * Math.cos(r);
  return { u: anchor.at.u + x / site.metresPerUnit, v: anchor.at.v - y / site.metresPerUnit };
}

export function toLatLon(site: Site, anchor: GeoAnchor, p: Point): { lat: number; lon: number } {
  const x = (p.u - anchor.at.u) * site.metresPerUnit;
  const y = -(p.v - anchor.at.v) * site.metresPerUnit;
  const r = (anchor.rotationDeg * Math.PI) / 180;
  const east = x * Math.cos(r) - y * Math.sin(r);
  const north = x * Math.sin(r) + y * Math.cos(r);
  return { lat: anchor.lat + north / M_PER_DEG_LAT, lon: anchor.lon + east / (M_PER_DEG_LAT * Math.cos((anchor.lat * Math.PI) / 180)) };
}

/** Rough bounding box of the festival grounds, in plan units. */
export const SITE_BOUNDS = { uMin: -2, uMax: 58, vMin: 0, vMax: 38 };

export function insideSite(p: Point): boolean {
  return p.u >= SITE_BOUNDS.uMin && p.u <= SITE_BOUNDS.uMax && p.v >= SITE_BOUNDS.vMin && p.v <= SITE_BOUNDS.vMax;
}
