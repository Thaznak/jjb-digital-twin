import { guide, nearestNode, POI_LABELS, progress, SITE, stepText, type Point, type Poi, type Step } from '../engine';
import { DAYS } from '../data/lineup';
import type { App, Filter } from '../app';
import { MapView } from '../render/MapView';
import type { Level } from '../render/mapArt';
import { avatar, avatars, esc, hhmm, initials } from './format';
import { icon } from './icons';
import { toast } from './toast';

/** Map screen: "Explorer" mode, and "À pied" guidance mode once a route is running. */

const CHIPS: { f: Filter; label: string; ic: string }[] = [
  { f: 'scenes', label: 'Scènes', ic: 'scenes' },
  { f: 'eau', label: 'Eau', ic: 'eau' },
  { f: 'wc', label: 'WC', ic: 'wc' },
  { f: 'secours', label: 'Secours', ic: 'secours' },
  { f: 'bar', label: 'Bars', ic: 'bar' },
];

const LEVEL_NAMES: Record<Level, string> = { site: 'Site', abords: 'Camping et parkings', clisson: 'Clisson' };
const NEXT_LEVEL: Record<Level, Level> = { site: 'abords', abords: 'clisson', clisson: 'site' };

const STEP_ICON: Record<Step['kind'], string> = { depart: 'depart', gauche: 'gauche', droite: 'droite', 'tout-droit': 'toutdroit', arrivee: 'arrivee' };

function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export class CarteScreen {
  readonly root: HTMLElement;
  private map: MapView;
  private pendingTo: { id: string; name: string } | null = null;
  private stepsOpen = false;
  private pickerOpen = false;
  private lastSpoken = '';
  private lastFitted = '';

  constructor(private app: App) {
    this.root = document.createElement('section');
    this.root.className = 'carte';
    this.root.innerHTML = `
      <div class="map-slot"></div>
      <div class="top">
        <label class="search">${icon('recherche', 20)}<input type="search" placeholder="Scène, eau, toilettes…" aria-label="Rechercher" enterkeyhint="search" /><button class="me-av" data-act="equipe" aria-label="Changer de personne"></button></label>
        <div class="results" hidden></div>
        <div class="pills"></div>
        <div class="chips"></div>
      </div>
      <div class="gcard" hidden></div>
      <div class="fabs"></div>
      <button class="all" data-act="all">${icon('site', 18)}<span>Tout le site</span></button>
      <div class="sheet"></div>
      <div class="picker" hidden></div>
      <div class="banner" hidden></div>`;
    this.map = new MapView(this.root.querySelector('.map-slot')!, {
      onStage: (id) => this.app.select({ kind: 'stage', id }),
      onPoi: (id) => this.app.select({ kind: 'poi', id }),
      onTapGround: (p) => this.tapGround(p),
      onLevel: (l) => this.app.setLevel(l),
    });
    this.root.addEventListener('click', (e) => this.click(e));
    const input = this.root.querySelector('input')!;
    input.addEventListener('input', () => this.search(input.value));
    input.addEventListener('focus', () => this.search(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') (this.root.querySelector('.results button') as HTMLButtonElement | null)?.click();
      if (e.key === 'Escape') this.closeSearch();
    });
    this.root.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.name === 'clock') {
        this.app.setMoment(this.app.day, Number(t.value));
      }
    });
  }

  // ---------- actions ----------
  private click(e: Event) {
    const t = (e.target as Element).closest<HTMLElement>('[data-act]');
    if (!t) return;
    const a = this.app;
    const id = t.dataset.id ?? '';
    switch (t.dataset.act) {
      case 'equipe':
        e.preventDefault();
        a.setTab('equipe');
        break;
      case 'filter':
        a.toggleFilter(id as Filter);
        break;
      case 'all':
        if (a.guiding) this.map.fit(a.guiding.guide.points);
        else if (a.level !== 'site') a.setLevel('site');
        else this.map.showAll();
        break;
      case 'layers':
        a.setLevel(NEXT_LEVEL[a.level]);
        toast(`Vue : ${LEVEL_NAMES[a.level]}`);
        break;
      case 'water':
        this.nearestWater();
        break;
      case 'nav':
        this.goNext();
        break;
      case 'locate':
        this.locate();
        break;
      case 'close':
        a.select(null);
        break;
      case 'go':
        this.walkTo(id, t.dataset.name ?? id);
        break;
      case 'save': {
        a.toggleFavorite(id);
        const s = a.slot(id);
        if (s) toast(a.active.favorites.includes(id) ? `${s.band} ajouté à ton plan.` : `${s.band} retiré de ton plan.`);
        break;
      }
      case 'select':
        this.closeSearch();
        if (t.dataset.kind === 'band') {
          a.setTab('programme');
          break;
        }
        a.select({ kind: t.dataset.kind as 'stage' | 'poi', id });
        this.focusSelected();
        break;
      case 'moment':
        this.pickerOpen = !this.pickerOpen;
        this.update();
        break;
      case 'day':
        a.setMoment(Number(id), a.clock);
        break;
      case 'live':
        if (!a.goLive()) toast('Le festival n’a pas commencé : choisis un moment.');
        this.pickerOpen = false;
        this.update();
        break;
      case 'pick':
        a.picking = true;
        a.tick();
        break;
      case 'cancel-pick':
        a.picking = false;
        this.pendingTo = null;
        a.tick();
        break;
      case 'voice':
        a.voice = !a.voice;
        if (!a.voice && 'speechSynthesis' in window) speechSynthesis.cancel();
        this.lastSpoken = '';
        a.tick();
        break;
      case 'steps':
        this.stepsOpen = !this.stepsOpen;
        this.update();
        break;
      case 'quit':
        this.stepsOpen = false;
        this.lastFitted = '';
        a.stopGuide();
        break;
      case 'offline':
        a.setTab('horsligne');
        break;
      case 'tab':
        a.setTab(id as 'programme');
        break;
    }
  }

  private tapGround(p: Point) {
    if (this.app.picking) {
      this.app.chooseStart(p);
      toast('Point de départ choisi.');
      return;
    }
    if (this.app.selected) this.app.select(null);
  }

  private closeSearch() {
    const r = this.root.querySelector<HTMLElement>('.results')!;
    r.hidden = true;
    const input = this.root.querySelector('input')!;
    input.value = '';
    input.blur();
  }

  private search(q: string) {
    const r = this.root.querySelector<HTMLElement>('.results')!;
    const s = q.trim().toLowerCase();
    if (!s) {
      r.hidden = true;
      return;
    }
    const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const n = norm(s);
    const stages = SITE.stages.filter((x) => norm(x.name).includes(n) || norm(x.genre).includes(n));
    const kinds = Object.entries(POI_LABELS).filter(([, l]) => norm(l).includes(n) || (n.startsWith('toil') && l === 'WC')).map(([k]) => k);
    const pois = SITE.pois.filter((p) => kinds.includes(p.kind) || norm(p.name).includes(n));
    const bands = this.app.lineup.slots.filter((x) => x.day === this.app.day && norm(x.band).includes(n)).slice(0, 4);
    const rows = [
      ...stages.map((x) => `<button data-act="select" data-kind="stage" data-id="${x.id}">${icon('scenes', 18)}<span><b>${esc(x.name)}</b><small>${esc(x.genre)}</small></span></button>`),
      ...this.sortByDistance(pois).slice(0, 5).map((p) => `<button data-act="select" data-kind="poi" data-id="${p.id}">${icon(p.kind, 18)}<span><b>${esc(p.name)}</b><small>${this.walkLabel(p) ?? POI_LABELS[p.kind]}</small></span></button>`),
      ...bands.map((b) => `<button data-act="select" data-kind="band" data-id="${b.id}">${icon('programme', 18)}<span><b>${esc(b.band)}</b><small>${esc(SITE.stages.find((x) => x.id === b.stageId)?.name ?? '')} · ${hhmm(b.start)}</small></span></button>`),
    ];
    r.innerHTML = rows.length ? rows.join('') : '<p class="empty">Aucun résultat.</p>';
    r.hidden = false;
  }

  private sortByDistance(pois: Poi[]) {
    const me = this.app.me;
    if (!me) return pois;
    return [...pois].sort((a, b) => Math.hypot(a.u - me.u, a.v - me.v) - Math.hypot(b.u - me.u, b.v - me.v));
  }

  private walkLabel(to: Point & { id: string }): string | null {
    const a = this.app;
    if (!a.me) return null;
    const id = 'kind' in to && SITE.pois.some((p) => p.id === to.id) ? nearestNode(SITE, to) : to.id;
    const g = guide(SITE, a.me, id, { clock: a.clock, precipMm: a.rain(a.day, a.clock) });
    return `${g.minutes} min à pied · ${g.metres} m`;
  }

  private focusSelected() {
    const s = this.app.selected;
    if (!s) return;
    const p = s.kind === 'stage' ? SITE.stages.find((x) => x.id === s.id) : SITE.pois.find((x) => x.id === s.id);
    if (p) this.map.focus(p, true);
  }

  private nearestWater() {
    const a = this.app;
    if (!a.filters.has('eau')) a.filters.add('eau');
    const list = this.sortByDistance(SITE.pois.filter((p) => p.kind === 'eau'));
    const sel = a.me ? list[0] : null;
    if (sel) {
      a.select({ kind: 'poi', id: sel.id });
      this.focusSelected();
    } else {
      a.tick();
      toast('Points d’eau affichés. Localise-toi pour voir le plus proche.');
    }
  }

  private goNext() {
    const a = this.app;
    const next = a.plan(a.active).sets.find((s) => s.slot.end > a.clock);
    if (!next) {
      toast('Plus rien dans ton plan aujourd’hui.');
      return;
    }
    const st = SITE.stages.find((x) => x.id === next.slot.stageId)!;
    this.walkTo(st.id, st.name);
  }

  private locate() {
    const a = this.app;
    if (a.me) this.map.focus(a.me, true);
    if (a.meSource !== 'gps') {
      a.startGps((msg) => {
        toast(msg, 4000);
        a.picking = true;
        a.tick();
      });
      toast('Recherche de ta position…');
    }
  }

  /** Starts walking guidance, asking for a start point first if needed. */
  private walkTo(id: string, name: string) {
    const a = this.app;
    const poi = SITE.pois.find((p) => p.id === id);
    const target = poi ? nearestNode(SITE, poi) : id;
    const label = poi ? poi.name : name;
    if (a.me) {
      a.guideTo(target, label);
      return;
    }
    this.pendingTo = { id: target, name: label };
    a.picking = true;
    a.startGps(() => undefined);
    a.select(null);
  }

  // ---------- render ----------
  update() {
    const a = this.app;
    if (this.pendingTo && a.me) {
      const p = this.pendingTo;
      this.pendingTo = null;
      a.picking = false;
      a.guideTo(p.id, p.name);
      return;
    }
    if (this.map.currentLevel !== a.level) this.map.setLevel(a.level);
    this.map.picking = a.picking;
    const guiding = a.guiding;
    this.root.classList.toggle('is-guiding', !!guiding);
    this.renderTop();
    this.renderFabs();
    this.renderGuideCard();
    this.renderSheet();
    this.renderPicker();
    this.renderBanner();
    this.renderOverlay();
    if (guiding) {
      const key = guiding.toId + (a.me ? `${a.me.u.toFixed(1)}` : '');
      if (!this.lastFitted.startsWith(guiding.toId)) this.map.fit(guiding.guide.points);
      this.lastFitted = key;
    }
  }

  private renderTop() {
    const a = this.app;
    const me = a.active;
    const av = this.root.querySelector<HTMLElement>('.me-av')!;
    av.innerHTML = avatar(me, 32);
    const day = DAYS[a.day]?.label ?? '';
    const net = !a.online ? `<button class="pill dark" data-act="offline">${icon('horsligne', 15)}Plan enregistré · hors ligne</button>` : a.offlineReady ? `<button class="pill" data-act="offline">${icon('check', 15)}Plan enregistré</button>` : '';
    this.root.querySelector('.pills')!.innerHTML = `<button class="pill" data-act="moment">${icon('horloge', 15)}${day} · ${hhmm(a.clock)}${a.live ? ' · en direct' : ''}</button>${net}`;
    this.root.querySelector('.chips')!.innerHTML = a.level === 'site' ? CHIPS.map((c) => `<button class="chip${a.filters.has(c.f) ? ' on' : ''}" data-act="filter" data-id="${c.f}" aria-pressed="${a.filters.has(c.f)}">${icon(c.ic, 16)}${c.label}</button>`).join('') : `<span class="chip on">${LEVEL_NAMES[a.level]}</span>`;
  }

  private renderFabs() {
    const a = this.app;
    const f = this.root.querySelector('.fabs')!;
    if (a.guiding) {
      f.innerHTML = `<button class="fab" data-act="voice" aria-label="${a.voice ? 'Couper la voix' : 'Guidage vocal'}">${icon(a.voice ? 'son' : 'muet')}</button><button class="fab" data-act="locate" aria-label="Me localiser">${icon('localiser')}</button>`;
      return;
    }
    f.innerHTML = `
      <button class="fab" data-act="layers" aria-label="Changer de vue : site, abords, Clisson">${icon('calques')}</button>
      <button class="fab" data-act="water" aria-label="Point d’eau le plus proche">${icon('eau')}</button>
      <button class="fab" data-act="nav" aria-label="Aller à mon prochain concert">${icon('naviguer')}</button>
      <button class="fab${a.meSource === 'gps' ? ' on' : ''}" data-act="locate" aria-label="Me localiser">${icon('localiser')}</button>`;
    const all = this.root.querySelector('.all span')!;
    all.textContent = a.level === 'site' ? 'Tout le site' : 'Retour au site';
  }

  private guideState() {
    const a = this.app;
    const g = a.guiding;
    if (!g) return null;
    const pr = a.me ? progress(SITE, g.guide, a.me) : null;
    const steps = g.guide.steps;
    const next = pr ? steps[pr.next] : steps[1] ?? steps[0];
    const after = pr ? steps[pr.next + 1] : steps[2];
    const remaining = pr ? pr.remaining : g.guide.metres;
    const minutes = Math.max(1, Math.round((g.guide.minutes * remaining) / Math.max(1, g.guide.metres)));
    return { g, pr, next, after, remaining, minutes };
  }

  private renderGuideCard() {
    const el = this.root.querySelector<HTMLElement>('.gcard')!;
    const s = this.guideState();
    if (!s) {
      el.hidden = true;
      this.all(true);
      return;
    }
    const a = this.app;
    const off = s.pr && s.pr.offRoute > 30;
    const dist = s.pr ? s.pr.toNext : s.next.metres;
    const main = off ? 'Revenez sur l’itinéraire' : stepText(s.next);
    const then = s.after ? `puis ${lowerFirst(stepText(s.after))}` : `puis suivez les panneaux ${s.g.toName}`;
    const src = a.meSource === 'gps' ? (a.online ? 'GPS actif' : 'Hors ligne · GPS actif') : 'Départ choisi';
    el.hidden = false;
    el.innerHTML = `
      <div class="gnext"><span class="gic">${icon(STEP_ICON[s.next.kind], 34)}</span><div><small>${s.next.kind === 'arrivee' ? 'Arrivée dans' : 'Dans'} ${dist} m</small><b>${esc(main)}</b><span>${esc(then)}</span></div></div>
      <span class="pill dark gsrc">${icon(a.meSource === 'gps' ? 'localiser' : 'depart', 15)}${src}</span>`;
    this.all(true, 'Vue d’ensemble');
    this.speak(`${s.next.kind === 'arrivee' ? 'Arrivée dans' : 'Dans'} ${Math.round(dist / 10) * 10} mètres, ${main}`, `${s.g.toId}:${s.pr?.next ?? 0}`);
  }

  private all(show: boolean, label?: string) {
    const b = this.root.querySelector<HTMLElement>('.all')!;
    b.hidden = !show;
    if (label) b.querySelector('span')!.textContent = label;
  }

  private speak(text: string, key: string) {
    if (!this.app.voice || key === this.lastSpoken || !('speechSynthesis' in window)) return;
    this.lastSpoken = key;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  private renderSheet() {
    const a = this.app;
    const el = this.root.querySelector<HTMLElement>('.sheet')!;
    const s = this.guideState();
    if (s) {
      const arrival = hhmm(a.clock + s.minutes);
      el.className = 'sheet guide';
      el.innerHTML = `
        <div class="gsum"><b class="big">${s.minutes} min</b><div><span>${s.remaining} m · arrivée ${arrival}</span><small>Vers ${esc(s.g.toName)} · itinéraire enregistré</small></div></div>
        ${this.stepsOpen ? `<ol class="steps">${s.g.guide.steps.map((st, i) => `<li class="${s.pr && i < s.pr.next ? 'done' : ''}">${icon(STEP_ICON[st.kind], 18)}<span>${esc(stepText(st))}${st.towards && st.kind !== 'arrivee' && st.kind !== 'depart' ? ` · vers ${esc(st.towards)}` : ''}</span><small>${st.metres ? st.metres + ' m' : ''}</small></li>`).join('')}</ol>` : ''}
        <div class="row2"><button class="btn ghost" data-act="steps">${this.stepsOpen ? 'Masquer les étapes' : 'Étapes du trajet'}</button><button class="btn dark" data-act="quit">Quitter le guidage</button></div>
        <button class="link" data-act="pick">Pas de GPS ? Choisir mon départ</button>`;
      return;
    }
    el.className = 'sheet';
    const sel = a.selected;
    if (a.level !== 'site') {
      el.innerHTML = `<div class="hint"><b>${LEVEL_NAMES[a.level]}</b><span>Pincez pour revenir au site, ou touchez « Retour au site ».</span></div>`;
      return;
    }
    if (sel?.kind === 'stage') {
      el.innerHTML = this.stageSheet(sel.id);
      return;
    }
    if (sel?.kind === 'poi') {
      const p = SITE.pois.find((x) => x.id === sel.id);
      if (p) {
        el.innerHTML = `
          <button class="x" data-act="close" aria-label="Fermer">${icon('fermer', 18)}</button>
          <small class="kick">${POI_LABELS[p.kind]}</small><h2>${esc(p.name)}</h2>
          <p class="muted">${this.walkLabel(p) ?? 'Localise-toi pour voir le temps de marche.'}</p>
          <div class="row2"><button class="btn primary" data-act="go" data-id="${p.id}" data-name="${esc(p.name)}">${icon('pied', 18)}Itinéraire à pied</button></div>`;
        return;
      }
    }
    el.innerHTML = this.nextSheet();
  }

  private stageSheet(id: string) {
    const a = this.app;
    const st = SITE.stages.find((x) => x.id === id)!;
    const now = a.nowPlaying(id);
    const next = a.nextOn(id);
    const slot = now ?? next;
    const gather = a.gatherings().find((g) => g.stageId === id);
    const fans = slot ? a.people.filter((p) => p.favorites.includes(slot.id)) : [];
    const saved = slot ? a.active.favorites.includes(slot.id) : false;
    const playing = now ? `<b>${esc(now.band)}</b><span>${hhmm(now.start)} – ${hhmm(now.end)}</span>` : next ? `<b>${esc(next.band)}</b><span>à ${hhmm(next.start)}</span>` : '<b>Plus rien ce soir</b>';
    const together = gather && gather.people.length > 1 ? `<span class="tog">${avatars(gather.people, 26)}<b>${gather.people.length} ensemble jusqu’à ${hhmm(gather.slot.end)}</b></span>` : fans.length ? `<span class="tog">${avatars(fans, 26)}<span>${fans.length === 1 ? '1 personne l’a choisi' : `${fans.length} personnes l’ont choisi`}</span></span>` : '<span class="tog muted">Personne de l’équipe pour l’instant.</span>';
    const walk = this.walkLabel(st);
    return `
      <button class="x" data-act="close" aria-label="Fermer">${icon('fermer', 18)}</button>
      <small class="kick">${now ? 'En ce moment' : next ? 'Ensuite' : esc(st.genre)}${st.provisional ? ' · <i class="dash">position 2027 estimée</i>' : ''}</small>
      <h2>${esc(st.name)}</h2>
      <p class="now">${playing}</p>
      ${together}
      ${walk ? `<p class="muted">${icon('pied', 15)} ${walk}</p>` : ''}
      <div class="row2"><button class="btn primary" data-act="go" data-id="${st.id}" data-name="${esc(st.name)}">${icon('pied', 18)}Itinéraire à pied</button>${slot ? `<button class="btn ghost${saved ? ' on' : ''}" data-act="save" data-id="${slot.id}">${icon(saved ? 'check' : 'etoile', 18)}${saved ? 'Enregistré' : 'Enregistrer'}</button>` : ''}</div>`;
  }

  private nextSheet() {
    const a = this.app;
    const plan = a.plan(a.active);
    const next = plan.sets.find((s) => s.slot.end > a.clock);
    if (!next) return `<div class="hint"><b>Plus rien de prévu aujourd’hui</b><span>Ajoute des concerts depuis le programme.</span></div><div class="row2"><button class="btn ghost" data-act="tab" data-id="programme">Voir le programme</button></div>`;
    const st = SITE.stages.find((x) => x.id === next.slot.stageId)!;
    const friends = a.people.filter((p) => next.friends.includes(p.name));
    const playingNow = next.slot.start <= a.clock;
    return `
      <small class="kick">${playingNow ? 'Ton concert en cours' : `Ton prochain concert · ${hhmm(next.slot.start)}`}</small>
      <h2>${esc(next.slot.band)}</h2>
      <p class="muted">${esc(st.name)} · ${hhmm(next.slot.start)} – ${hhmm(next.slot.end)}</p>
      ${friends.length ? `<span class="tog">${avatars(friends, 26)}<span>avec ${esc(friends.map((f) => f.name).join(', '))}</span></span>` : ''}
      <div class="row2"><button class="btn primary" data-act="go" data-id="${st.id}" data-name="${esc(st.name)}">${icon('pied', 18)}Y aller</button><button class="btn ghost" data-act="select" data-kind="stage" data-id="${st.id}">Voir la scène</button></div>`;
  }

  private renderPicker() {
    const a = this.app;
    const el = this.root.querySelector<HTMLElement>('.picker')!;
    el.hidden = !this.pickerOpen;
    if (!this.pickerOpen) return;
    el.innerHTML = `
      <div class="days">${DAYS.map((d) => `<button class="daychip${d.index === a.day ? ' on' : ''}" data-act="day" data-id="${d.index}">${d.label.split(' ')[0].slice(0, 3)}<b>${d.label.split(' ')[1]}</b></button>`).join('')}</div>
      <label class="clock"><span>${hhmm(a.clock)}</span><input type="range" name="clock" min="840" max="1560" step="5" value="${Math.min(1560, Math.max(840, a.clock))}" aria-label="Heure" /></label>
      <div class="row2"><button class="btn ghost" data-act="live">Maintenant</button><button class="btn dark" data-act="moment">OK</button></div>`;
  }

  private renderBanner() {
    const a = this.app;
    const el = this.root.querySelector<HTMLElement>('.banner')!;
    el.hidden = !a.picking;
    if (a.picking) el.innerHTML = `<span>${icon('depart', 18)}Touchez la carte à l’endroit où vous êtes.</span><button data-act="cancel-pick" aria-label="Annuler">${icon('fermer', 18)}</button>`;
  }

  private renderOverlay() {
    const a = this.app;
    const sel = a.selected;
    const gathers = a.gatherings();
    this.map.setOverlay({
      stages: SITE.stages.map((stage) => ({ stage, selected: sel?.kind === 'stage' && sel.id === stage.id, now: a.nowPlaying(stage.id)?.band ?? null })),
      showStageLabels: a.filters.has('scenes') || !!a.guiding,
      pois: SITE.pois.filter((p) => a.filters.has(p.kind) || (sel?.kind === 'poi' && sel.id === p.id)).map((poi) => ({ poi, selected: sel?.kind === 'poi' && sel.id === poi.id })),
      people: a.guiding ? [] : a.pins().map((p) => ({ id: p.person.id, initials: initials(p.person.name), color: p.person.color, at: p.at, stageId: p.stageId, walking: p.walking, active: p.person.id === a.activeId })),
      groups: a.guiding ? [] : gathers.map((g) => ({ stageId: g.stageId, count: g.people.length })),
      route: a.guiding ? (a.me ? [a.me, ...a.guiding.guide.points.slice(1)] : a.guiding.guide.points) : null,
      me: a.me,
      meLabel: 'Vous',
    });
  }
}
