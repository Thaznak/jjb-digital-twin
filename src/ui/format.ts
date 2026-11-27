import { clockLabel, type Person } from '../engine';

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

export function avatar(p: Person, size = 30): string {
  return `<span class="av" style="--c:${p.color};--s:${size}px" title="${esc(p.name)}">${esc(initials(p.name))}</span>`;
}

export function avatars(ps: Person[], size = 30): string {
  return `<span class="avs">${ps.map((p) => avatar(p, size)).join('')}</span>`;
}

export const hhmm = clockLabel;

export function names(list: string[]): string {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} et ${list[list.length - 1]}`;
}

export function $(root: ParentNode, sel: string): HTMLElement {
  const el = root.querySelector(sel);
  if (!el) throw new Error(`Élément manquant : ${sel}`);
  return el as HTMLElement;
}
