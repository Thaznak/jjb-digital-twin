import type { ClubConfig } from '../engine/types';

const KEY = 'jjb-digital-twin/config/v1';

/** Local persistence of the user's own data. Stays in this browser only. */
export function loadConfig(): ClubConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ClubConfig) : null;
  } catch {
    return null;
  }
}

export function saveConfig(c: ClubConfig): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
    return true;
  } catch {
    return false;
  }
}

export function clearConfig(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
