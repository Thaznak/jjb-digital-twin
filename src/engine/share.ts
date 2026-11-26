import type { Person } from './types';

/** A friend's list travels as a short text code (no server, no account). */
const PREFIX = 'HF1.';

function toB64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodePerson(p: Person): string {
  return PREFIX + toB64(JSON.stringify({ i: p.id, n: p.name, c: p.color, f: p.favorites }));
}

export function decodePerson(code: string): Person {
  const raw = code.trim();
  if (!raw.startsWith(PREFIX)) throw new Error('Ce code ne vient pas de l’application.');
  let o: { i?: unknown; n?: unknown; c?: unknown; f?: unknown };
  try {
    o = JSON.parse(fromB64(raw.slice(PREFIX.length)));
  } catch {
    throw new Error('Code abîmé : recopie-le en entier.');
  }
  if (typeof o.i !== 'string' || typeof o.n !== 'string' || !Array.isArray(o.f)) throw new Error('Code incomplet.');
  return {
    id: o.i,
    name: o.n.slice(0, 24),
    color: typeof o.c === 'string' && /^#[0-9a-f]{6}$/i.test(o.c) ? o.c : '#e8e2d4',
    favorites: o.f.filter((x): x is string => typeof x === 'string'),
  };
}

/** Adds or replaces a person by id. Returns a new list. */
export function mergePerson(people: Person[], p: Person): Person[] {
  const i = people.findIndex((x) => x.id === p.id);
  if (i < 0) return [...people, p];
  const next = [...people];
  next[i] = p;
  return next;
}
