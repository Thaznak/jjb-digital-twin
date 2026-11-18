export const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
export const signedEur = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n)).toLocaleString('fr-FR')} €`;
export const pct = (n: number) => `${Math.round(n * 100)} %`;
export const signedPts = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n * 100))} pts`;
export const int = (n: number) => Math.round(n).toLocaleString('fr-FR');
export const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
export const dateLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DAYS[(d.getUTCDay() + 6) % 7].slice(0, 3)}. ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
export const hour = (h: number) => `${Math.floor(h)}h${h % 1 ? String(Math.round((h % 1) * 60)).padStart(2, '0') : ''}`;

export type State = 'sain' | 'tension' | 'crise';
export const dot = (s: State) => `<i class="state-dot ${s}" aria-hidden="true"></i>`;

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function el<T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string): T {
  const e = root.querySelector(sel);
  if (!e) throw new Error(`missing ${sel}`);
  return e as T;
}
