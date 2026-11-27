/** Line icons drawn for the app (24 px grid, stroke = currentColor). */
const P: Record<string, string> = {
  carte: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  programme: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M7 14h2M11 14h2M15 14h2M7 17h2M11 17h2"/>',
  plan: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  equipe: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.9.3 5 2.7 5 5.8"/>',
  meteo: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  recherche: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  calques: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5"/><path d="M3 16.5l9 5 9-5"/>',
  eau: '<path d="M12 3c3.5 4.4 6 7.7 6 10.7A6 6 0 0 1 6 13.7C6 10.7 8.5 7.4 12 3z"/>',
  naviguer: '<path d="M12 3l7 18-7-4-7 4z"/>',
  localiser: '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  site: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  check: '<path d="M4 12.5l5 5L20 6"/>',
  horsligne: '<path d="M3 3l18 18"/><path d="M8.5 8.6A5 5 0 0 0 7 18h10c.7 0 1.3-.1 1.9-.4M20.6 15.3A4 4 0 0 0 17 10h-.5a5.5 5.5 0 0 0-6.6-4.2"/>',
  telecharger: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  son: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  muet: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  droite: '<path d="M6 21V12a4 4 0 0 1 4-4h9"/><path d="M15 4l4 4-4 4"/>',
  gauche: '<path d="M18 21V12a4 4 0 0 0-4-4H5"/><path d="M9 4L5 8l4 4"/>',
  toutdroit: '<path d="M12 21V4M6 10l6-6 6 6"/>',
  arrivee: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  depart: '<circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  etoile: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  partager: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
  retour: '<path d="M15 4l-8 8 8 8"/>',
  horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pied: '<circle cx="13" cy="4" r="2"/><path d="M10 21l2-6 3 3v3M9 12l2-4 4 1 2 3M8 8.5L6 12"/>',
  wc: '<path d="M4 6h16v12H4z"/><path d="M7 9l1 6 1.2-4 1.2 4 1-6M15.5 15c-1.4 0-2-1-2-3s.6-3 2-3c.8 0 1.4.3 1.7.8"/>',
  secours: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  bar: '<path d="M5 7h10v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><path d="M15 10h2a2 2 0 0 1 0 4h-2M7 4h6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  scenes: '<path d="M4 20V11a8 8 0 0 1 16 0v9z"/><path d="M8 20v-6h8v6"/>',
};

export function icon(name: string, size = 22, extra = ''): string {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[name] ?? ''}</svg>`;
}

/** Raw path data, for drawing icons inside the map SVG. */
export function iconPaths(name: string): string {
  return P[name] ?? '';
}
