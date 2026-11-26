/** Clock helpers. A festival day runs past midnight: 25:30 is 01:30 the next morning. */
export function clockLabel(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Parses "18:45" or "01:10". Hours before 08:00 belong to the night after the festival day. */
export function parseClock(text: string): number {
  const m = /^(\d{1,2})[:h](\d{2})$/.exec(text.trim());
  if (!m) throw new Error(`Heure illisible : ${text}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 29 || min > 59) throw new Error(`Heure illisible : ${text}`);
  return (h < 8 ? h + 24 : h) * 60 + min;
}

export function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`;
}
