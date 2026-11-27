import './style.css';
import { App, type Tab } from './app';
import { CarteScreen } from './ui/carte';
import { Pages } from './ui/pages';
import { icon } from './ui/icons';
import { toast } from './ui/toast';

const TABS: { id: Tab; label: string; ic: string }[] = [
  { id: 'carte', label: 'Carte', ic: 'carte' },
  { id: 'programme', label: 'Programme', ic: 'programme' },
  { id: 'plan', label: 'Mon plan', ic: 'plan' },
  { id: 'equipe', label: 'Équipe', ic: 'equipe' },
  { id: 'meteo', label: 'Météo', ic: 'meteo' },
];

const app = new App();
const root = document.getElementById('app')!;
root.innerHTML = `<div class="shell"><div class="screens"></div><div class="page" hidden></div><nav class="tabbar" aria-label="Navigation"></nav></div>`;
const screens = root.querySelector<HTMLElement>('.screens')!;
const page = root.querySelector<HTMLElement>('.page')!;
const tabbar = root.querySelector<HTMLElement>('.tabbar')!;

const carte = new CarteScreen(app);
screens.append(carte.root);
const pages = new Pages(app);

let lastTab: Tab | null = null;

/** Re-renders a list page while keeping what the person is typing. */
function renderPage() {
  const active = document.activeElement as HTMLInputElement | null;
  const keepId = active && page.contains(active) ? active.id || active.dataset.act : null;
  const values = new Map([...page.querySelectorAll<HTMLInputElement>('input[id]')].map((i) => [i.id, i.value]));
  const scroll = lastTab === app.tab ? page.scrollTop : 0;
  page.innerHTML = `<div class="page-in">${pages.render()}</div>`;
  for (const [id, v] of values) {
    const i = page.querySelector<HTMLInputElement>(`#${id}`);
    if (i) i.value = v;
  }
  if (keepId) page.querySelector<HTMLInputElement>(`#${keepId}, [data-act="${keepId}"]`)?.focus();
  page.scrollTop = scroll;
}

function render() {
  const t = app.tab;
  const onMap = t === 'carte';
  carte.root.hidden = !onMap;
  page.hidden = onMap;
  if (onMap) carte.update();
  else renderPage();
  tabbar.innerHTML = TABS.map((x) => `<button class="${x.id === t || (t === 'horsligne' && x.id === 'carte') ? 'on' : ''}" data-tab="${x.id}" aria-label="${x.label}">${icon(x.ic, 22)}<span>${x.label}</span></button>`).join('');
  lastTab = t;
}

tabbar.addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLElement>('[data-tab]');
  if (b) app.setTab(b.dataset.tab as Tab);
});
page.addEventListener('click', (e) => {
  const t = (e.target as Element).closest<HTMLElement>('[data-act]');
  if (t && !(t instanceof HTMLInputElement && t.type !== 'checkbox')) void pages.act(t, e);
});
page.addEventListener('change', (e) => void pages.change(e.target as HTMLInputElement));
page.addEventListener('keydown', (e) => {
  const t = e.target as HTMLInputElement;
  if (e.key !== 'Enter') return;
  if (t.id === 'import-code') page.querySelector<HTMLElement>('[data-act="import"]')?.click();
  if (t.id === 'new-name') page.querySelector<HTMLElement>('[data-act="add"]')?.click();
  if (t.dataset.act === 'rename') t.blur();
});

app.on(render);
render();

// A friend's link: #ami=CODE
function importFromHash() {
  if (!location.hash.startsWith('#ami=')) return;
  try {
    const name = app.importCode(location.hash);
    toast(`${name} a rejoint ton équipe.`, 4000);
    app.setTab('equipe');
  } catch (err) {
    toast((err as Error).message || 'Lien d’ami illisible.', 4000);
  }
  history.replaceState(null, '', location.pathname + location.search);
}
importFromHash();
window.addEventListener('hashchange', importFromHash);

// Weather, network, live clock.
void app.loadWeather();
window.addEventListener('online', () => {
  app.setOnline(true);
  void app.loadWeather();
});
window.addEventListener('offline', () => app.setOnline(false));
setInterval(() => {
  if (app.live && app.syncLiveClock()) {
    app.refreshGuide();
    app.tick();
  }
}, 30000);

// Offline: service worker caches the app shell.
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !import.meta.env.DEV) {
  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => navigator.serviceWorker.ready.then(() => reg))
    .then(() => {
      app.offlineReady = true;
      app.tick();
    })
    .catch(() => undefined);
}
