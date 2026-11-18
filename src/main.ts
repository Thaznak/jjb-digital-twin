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
import { dateLabel, dot, el, eur, esc, int, pct, type State } from './ui/format';

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="topbar">
    <div class="brand"><span class="belt-mark" aria-hidden="true"></span>Tatami Twin <small id="club-name"></small></div>
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
  ...(['tatami', 'vestiaire', 'accueil', 'parking'] as BuildingType[]).map((t) => [t, BUILDING_SPECS[t].label, `${eur(BUILDING_SPECS[t].capex)} · ${BUILDING_SPECS[t].monthlyCost} €/mois`] as [Tool, string, string]),
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
  const f = r.factors;
  const total = f.reduce((a, x) => a * x.value, 1);
  el(app, '#factors').innerHTML = `
    <h3>Demande du jour</h3>
    <div class="muted">${w.precipMm > 2 ? (w.tempMaxC < 2 ? 'Neige' : 'Pluie') : w.tempMaxC >= 28 ? 'Chaleur' : 'Sec'}, ${Math.round(w.tempMaxC)} °C, ${w.precipMm.toFixed(1)} mm · ${w.source === 'open-meteo' ? 'Open-Meteo (réel)' : 'normales climatiques'}</div>
    ${f
      .map((x) => {
        const d = x.value - 1;
        const width = Math.min(50, Math.abs(d) * 100);
        return `<div class="factor"><span>${x.label}</span><b>×${x.value.toFixed(2)}</b><div class="bar"><i class="${d < 0 ? 'neg' : ''}" style="${d < 0 ? `left:${50 - width}%;width:${width}%` : `width:${width}%`}"></i></div></div>`;
      })
      .join('')}
    <div class="factor"><span><b>Effet total</b></span><b>×${total.toFixed(2)}</b></div>
    <div class="muted">${r.fills.length ? `${r.fills.length} cours aujourd’hui, ${Math.round(r.fills.reduce((a, x) => a + x.attendees, 0))} présents` : 'Pas de cours aujourd’hui'}</div>
  `;
}

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
