import Phaser from 'phaser';
import './style.css';
import { BUILDING_SPECS, type Alert, type Building, type BuildingType, type Comparison } from './engine';
import { sampleClub } from './data/sampleData';
import { loadConfig } from './data/storage';
import { Game, type Speed } from './game';
import { ClubScene, type Tool } from './render/ClubScene';
import { renderDashboard } from './ui/dashboard';
import { DataPanel } from './ui/dataPanel';
import { ScenarioPanel } from './ui/scenarioPanel';
import { ExpansionPanel } from './ui/expansionPanel';
import { dateLabel, dot, el, eur, esc, hour, int, pct, type State } from './ui/format';

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="masthead">
    <h1>Tatami Twin</h1>
    <span class="sep" aria-hidden="true"></span>
    <div class="kicker">Simulation de club<br>Jiu-jitsu brésilien · <span id="club-name"></span></div>
    <div class="stripes" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="tagline">Encadrer · Enseigner · Développer<br>votre communauté</div>
  </header>
  <header class="topbar">
    <div class="clock"><span id="date"></span>
      <div class="speed" role="group" aria-label="Vitesse">
        <button data-speed="0" aria-pressed="false" title="Pause">II</button>
        <button data-speed="1" aria-pressed="true" title="1 jour par seconde">x1</button>
        <button data-speed="5" aria-pressed="false">x5</button>
        <button data-speed="30" aria-pressed="false">x30</button>
      </div>
    </div>
    <div class="kpis" id="kpis"></div>
  </header>
  <main class="stage">
    <div id="game"></div>
    <aside class="factors" id="factors" aria-live="polite"></aside>
    <div class="toasts" id="toasts"></div>
    <div class="hover-info" id="hover"></div>
  </main>
  <nav class="toolbar" id="toolbar" aria-label="Construire"></nav>
  <section class="drawer">
    <div class="tabs" role="tablist">
      <button role="tab" data-tab="dash" aria-selected="true">Tableau de bord</button>
      <button role="tab" data-tab="data" aria-selected="false">Mes données</button>
      <button role="tab" data-tab="scn" aria-selected="false">Scénarios</button>
      <button role="tab" data-tab="exp" aria-selected="false">Nouveau club</button>
    </div>
    <div class="panel" id="panel-dash"></div>
    <div class="panel" id="panel-data" hidden></div>
    <div class="panel" id="panel-scn" hidden></div>
    <div class="panel" id="panel-exp" hidden></div>
  </section>
`;

const game = new Game(loadConfig() ?? sampleClub());

// ---------- toasts ----------
const toasts = el(app, '#toasts');
function toast(text: string, state: State = 'sain') {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `${dot(state)}<span>${esc(text)}</span>`;
  toasts.prepend(t);
  while (toasts.children.length > 4) toasts.lastElementChild?.remove();
  setTimeout(() => t.remove(), 5000);
}

// ---------- Phaser ----------
let scenarioAlerts: Alert[] | null = null;
const scene = new ClubScene();
const phaser = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1F2A3D',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  scene: [],
  render: { antialias: true },
});
phaser.scene.add('club', scene, true, {
  hooks: {
    onPlace: (type: BuildingType, x: number, y: number) => {
      const r = game.place(type, x, y);
      toast(r.message, r.ok ? 'sain' : 'tension');
      if (r.ok) {
        scene.setBuildings(game.config.buildings);
        dataPanel.sync();
        refreshAll();
      }
    },
    onRemove: (b: Building) => {
      game.remove(b);
      scene.setBuildings(game.config.buildings);
      dataPanel.sync();
      refreshAll();
    },
    onHoverInfo: (text: string | null) => (el(app, '#hover').textContent = text ?? ''),
  },
});
phaser.events.on('step', (_t: number, dt: number) => game.tick(dt));

// ---------- toolbar ----------
const toolbar = el(app, '#toolbar');
const tools: [Tool, string, string][] = [
  [null, 'Observer', 'glisser, molette'],
  ...(['tatami', 'vestiaire', 'accueil', 'boutique', 'parking'] as BuildingType[]).map((t) => [t, BUILDING_SPECS[t].label, `${eur(BUILDING_SPECS[t].capex)} · ${BUILDING_SPECS[t].monthlyCost} €/mois`] as [Tool, string, string]),
  ['supprimer', 'Retirer', 'sans remboursement'],
];
toolbar.innerHTML = tools.map(([t, l, s]) => `<button class="tool" data-tool="${t ?? ''}" aria-pressed="${t === null}"><b>${l}</b><span>${s}</span></button>`).join('') + '<span class="hint">Les tatamis se posent sur le plancher du dojo.</span>';
toolbar.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tool]');
  if (!b) return;
  toolbar.querySelectorAll('[data-tool]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  scene.setTool((b.dataset.tool || null) as Tool);
});

// ---------- speed ----------
el(app, '.speed').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-speed]');
  if (!b) return;
  game.speed = Number(b.dataset.speed) as Speed;
  el(app, '.speed').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
});

// ---------- drawer tabs ----------
let tab = 'dash';
const panels = { dash: el(app, '#panel-dash'), data: el(app, '#panel-data'), scn: el(app, '#panel-scn'), exp: el(app, '#panel-exp') };
const dataPanel = new DataPanel(panels.data, game, (t) => toast(t));
const scenarioPanel = new ScenarioPanel(panels.scn, game, (c: Comparison | null) => {
  scenarioAlerts = c ? c.alerts.map((a) => ({ ...a, text: `Scénario : ${a.text}` })) : null;
  scene.setAlerts(scenarioAlerts ?? game.liveAlerts());
  if (c) toast(c.alerts.length ? `${c.alerts.length} fragilité(s) révélée(s) par le scénario.` : 'Scénario sans fragilité détectée.', c.alerts.length ? 'tension' : 'sain');
});
const expansionPanel = new ExpansionPanel(panels.exp, game);
el(app, '.tabs').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tab]');
  if (!b) return;
  tab = b.dataset.tab!;
  el(app, '.tabs').querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  for (const [k, p] of Object.entries(panels)) p.hidden = k !== tab;
  renderTab(true);
});
function renderTab(force = false) {
  if (tab === 'dash') renderDashboard(panels.dash, game);
  else if (!force) return;
  else if (tab === 'data') dataPanel.render();
  else if (tab === 'scn') scenarioPanel.render();
  else if (tab === 'exp') expansionPanel.render();
}

// ---------- HUD ----------
let lastAlertKey = '';
function refreshHud() {
  const r = game.last;
  if (!r) return;
  el(app, '#club-name').textContent = game.config.name;
  el(app, '#date').textContent = dateLabel(r.date);
  const members = r.members.adulte + r.members.enfant;
  const peak = r.fills.reduce((m, f) => (f.capacity ? Math.max(m, f.demand / f.capacity) : m), 0);
  const cashS: State = r.cash < 0 ? 'crise' : r.cash < 2000 ? 'tension' : 'sain';
  const satS: State = r.satisfaction < 0.55 ? 'crise' : r.satisfaction < 0.7 ? 'tension' : 'sain';
  el(app, '#kpis').innerHTML = [
    ['Trésorerie', eur(r.cash), cashS],
    ['Adhérents', int(members), 'sain'],
    ['Satisfaction', pct(r.satisfaction), satS],
    ['Pic du jour', r.fills.length ? pct(peak) : 'repos', peak > 1.15 ? 'crise' : peak > 0.95 ? 'tension' : 'sain'],
  ]
    .map(([l, v, s]) => `<div class="kpi" data-state="${s}"><span>${dot(s as State)}${l}</span><b>${v}</b></div>`)
    .join('');
  const w = r.weather;
  const total = r.factors.reduce((acc, x) => acc * x.value, 1);
  const sorted = [...r.fills].sort((x, y) => y.slot.start - x.slot.start);
  const evening = sorted[0];
  const cap = evening?.capacity ?? 0;
  const present = evening ? Math.round(evening.attendees) : 0;
  const ratio = evening && cap ? evening.demand / cap : 0;
  const level: State = ratio > 1.15 ? 'crise' : ratio > 0.95 ? 'tension' : 'sain';
  const waiting = Math.round(r.fills.reduce((acc, f) => acc + Math.max(0, f.demand - f.capacity), 0));
  const on = cap ? Math.round((present / cap) * 20) : 0;
  const ico = (path: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="#141414" stroke-width="2" aria-hidden="true">${path}</svg>`;
  const meteo = w.precipMm > 2 ? (w.tempMaxC < 2 ? 'Neige' : 'Pluie') : w.tempMaxC >= 28 ? 'Chaleur' : 'Sec';
  el(app, '#factors').innerHTML = `
    <div class="row-i">${ico('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>')}
      <div class="title">${evening ? 'Cours du soir' : 'Pas de cours'}<small>${evening ? `${hour(evening.slot.start)} · ${esc(evening.slot.label)}` : 'Le dojo se repose aujourd’hui'}</small></div><span aria-hidden="true">›</span></div>
    <div class="row-i">${ico('<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c0-3 3-5 6-5s6 2 6 5M12 20c0-3 2-5 4-5s6 2 6 5"/>')}
      <div class="title">Capacité</div><div class="big">${present} / ${cap}</div>
      <div class="segbar ${level}">${Array.from({ length: 20 }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</div></div>
    <div class="row-i">${ico('<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c0-3 3-5 6-5s6 2 6 5M12 20c0-3 2-5 4-5s6 2 6 5"/>')}
      <div class="title">Accueil</div><span class="wait ${waiting ? '' : 'none'}">${waiting ? `${waiting} en attente` : 'Personne en attente'}</span></div>
    <div class="meteo">${meteo}, ${Math.round(w.tempMaxC)} °C, ${w.precipMm.toFixed(1)} mm · ${w.source === 'open-meteo' ? 'Open-Meteo (réel)' : 'normales climatiques'}</div>
    <div class="facts">${r.factors.map((x) => `<div><span>${x.label}</span><b>×${x.value.toFixed(2)}</b></div>`).join('')}</div>
    <div class="facts" style="grid-template-columns:1fr auto"><span>Effet total sur la demande</span><b>×${total.toFixed(2)}</b></div>
    ${LEGEND.map((l) => `<div class="legend-s" data-active="${l.state === level && !!evening}">${dot(l.state)}${l.icon}<div><b>${l.title}</b><span>${l.text}</span></div></div>`).join('')}
  `;
}

const fig = (d: string) => `<svg viewBox="0 0 34 24" width="34" height="24" fill="#141414" aria-hidden="true">${d}</svg>`;
const LEGEND: { state: State; title: string; text: string; icon: string }[] = [
  { state: 'sain', title: 'Sain', text: 'Entraînement fluide, ambiance constructive.', icon: fig('<circle cx="8" cy="5" r="3"/><circle cx="26" cy="5" r="3"/><path d="M3 22l2-12h6l3 6-3 6zM31 22l-2-12h-6l-3 6 3 6z"/>') },
  { state: 'tension', title: 'Tension', text: 'Créneau plein, fatigue ou charge à surveiller.', icon: fig('<circle cx="7" cy="7" r="3"/><circle cx="27" cy="7" r="3"/><path d="M2 22l4-11 7 3 4-2-3 10zM32 22l-4-11-7 3-4-2 3 10z"/>') },
  { state: 'crise', title: 'Crise', text: 'Saturation, départs ou trésorerie négative. Agir.', icon: fig('<circle cx="10" cy="6" r="3"/><circle cx="24" cy="13" r="3"/><path d="M4 22l5-12 12 2-4 4 13 6zM14 22l6-5 10 5z"/>') },
];

function refreshAll() {
  refreshHud();
  renderTab();
}

// People, weather, cracks follow the simulated days.
let uiClock = 0;
game.onDay((r) => {
  const peakFill = r.fills.reduce((m, f) => Math.max(m, f.attendees), 0);
  const belts = game.config.members.map((m) => ({ belt: m.belt, kid: m.segment === 'enfant' }));
  scene.setPeople(peakFill, belts);
  scene.setWeather(r.weather, Number(r.date.slice(5, 7)) - 1);
  if (!scenarioAlerts) {
    const alerts = game.liveAlerts();
    const key = alerts.map((a) => a.text.replace(/\(.*\)/, '')).join('|');
    if (key !== lastAlertKey) {
      alerts.filter((a) => !lastAlertKey.includes(a.text.replace(/\(.*\)/, ''))).forEach((a) => toast(a.text, a.level));
      lastAlertKey = key;
      scene.setAlerts(alerts);
    }
  }
  const now = performance.now();
  if (now - uiClock > 250) {
    uiClock = now;
    refreshAll();
  }
});
game.onReset(() => {
  scene.setBuildings(game.config.buildings);
  lastAlertKey = '';
  scenarioAlerts = null;
  scene.setAlerts([]);
});

scene.setBuildings(game.config.buildings);
refreshAll();
void game.connectWeather().then(() => {
  toast(game.weather.isLive ? `Météo réelle connectée : ${game.config.city.name}.` : 'Météo réelle indisponible ici, normales climatiques utilisées.', game.weather.isLive ? 'sain' : 'tension');
  refreshAll();
});
