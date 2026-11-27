import { advice, codeLabel, durationLabel, fansOf, slotsOfDay, suggestions, SITE, type Slot } from '../engine';
import { DAYS, parseLineupCsv } from '../data/lineup';
import { festivalDay, nextDays } from '../data/weather';
import type { App } from '../app';
import { avatar, avatars, esc, hhmm, names } from './format';
import { icon } from './icons';
import { copy, toast } from './toast';

/** List screens: Programme, Mon plan, Équipe, Météo, Hors connexion. Rendered as HTML, actions by delegation. */

const stageName = (id: string) => SITE.stages.find((s) => s.id === id)?.name ?? id;

function dayChips(app: App) {
  return `<div class="days">${DAYS.map((d) => `<button class="daychip${d.index === app.day ? ' on' : ''}" data-act="day" data-id="${d.index}">${d.label.split(' ')[0].slice(0, 3)}<b>${d.label.split(' ')[1]}</b></button>`).join('')}</div>`;
}

function head(title: string, sub = '', back = false) {
  return `<header class="phead">${back ? `<button class="back" data-act="tab" data-id="carte" aria-label="Retour">${icon('retour')}</button>` : ''}<div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div></header>`;
}

function sampleNote(app: App) {
  return app.lineup.sample ? `<p class="note">${icon('info', 16)}<span>Programmation d’exemple, noms inventés. Importe la vraie dès sa sortie (CSV, en bas).</span></p>` : '';
}

export class Pages {
  stageFilter = 'toutes';
  onlyFavs = false;

  constructor(private app: App) {}

  render(): string {
    switch (this.app.tab) {
      case 'programme':
        return this.programme();
      case 'plan':
        return this.plan();
      case 'equipe':
        return this.equipe();
      case 'meteo':
        return this.meteo();
      case 'horsligne':
        return this.horsligne();
      default:
        return '';
    }
  }

  // ---------- Programme ----------
  private slotCard(s: Slot) {
    const a = this.app;
    const fav = a.active.favorites.includes(s.id);
    const fans = fansOf(a.people, s.id).filter((p) => p.id !== a.activeId);
    const live = s.day === a.day && s.start <= a.clock && a.clock < s.end;
    const st = SITE.stages.find((x) => x.id === s.stageId);
    return `<article class="slot${fav ? ' fav' : ''}${live ? ' live' : ''}">
      <div class="when"><b>${hhmm(s.start)}</b><small>${hhmm(s.end)}</small></div>
      <div class="what"><b>${esc(s.band)}</b><small>${esc(stageName(s.stageId))}${st?.provisional ? ' · 2027' : ''}${live ? ' · <em>en cours</em>' : ''}</small>${fans.length ? `<span class="tog">${avatars(fans, 22)}</span>` : ''}</div>
      <button class="star${fav ? ' on' : ''}" data-act="fav" data-id="${s.id}" aria-pressed="${fav}" aria-label="${fav ? 'Retirer de mon plan' : 'Ajouter à mon plan'}">${icon(fav ? 'check' : 'etoile', 20)}</button>
    </article>`;
  }

  private programme() {
    const a = this.app;
    const plan = a.plan(a.active);
    let slots = slotsOfDay(a.lineup, a.day);
    if (this.stageFilter !== 'toutes') slots = slots.filter((s) => s.stageId === this.stageFilter);
    if (this.onlyFavs) slots = slots.filter((s) => a.active.favorites.includes(s.id));
    const conflicts = plan.conflicts;
    const filters = [{ id: 'toutes', name: 'Toutes' }, ...SITE.stages].map((s) => `<button class="chip${this.stageFilter === s.id ? ' on' : ''}" data-act="stage" data-id="${s.id}">${esc(s.name)}</button>`).join('');
    return `${head('Programme', `${esc(a.lineup.edition)} · ${a.active.favorites.length} favoris pour ${esc(a.active.name)}`)}
      ${dayChips(a)}
      ${sampleNote(a)}
      ${conflicts.length ? `<div class="warn">${icon('horloge', 18)}<span><b>${conflicts.length} conflit${conflicts.length > 1 ? 's' : ''}</b> ${conflicts.slice(0, 2).map((c) => `${esc(c.a.band)} et ${esc(c.b.band)} ${c.kind === 'overlap' ? 'jouent en même temps' : `: ${c.walk} min de marche`}`).join(' · ')}. Mon plan choisit pour toi.</span></div>` : ''}
      <div class="chips scroll">${filters}</div>
      <label class="toggle"><input type="checkbox" data-act="onlyfavs" ${this.onlyFavs ? 'checked' : ''}/> Mes favoris seulement</label>
      <div class="list">${slots.map((s) => this.slotCard(s)).join('') || '<p class="empty">Aucun concert.</p>'}</div>
      <section class="card light">
        <h3>Importer la vraie programmation</h3>
        <p class="muted">Fichier CSV avec les colonnes jour, scene, debut, fin, groupe.</p>
        <label class="btn ghost file">${icon('telecharger', 18)}Choisir un fichier CSV<input type="file" accept=".csv,text/csv" data-act="csv" hidden /></label>
      </section>`;
  }

  // ---------- Mon plan ----------
  private plan() {
    const a = this.app;
    const p = a.plan(a.active);
    const rows: string[] = [];
    p.sets.forEach((s, i) => {
      if (i > 0 && s.walk > 0) {
        const prev = p.sets[i - 1];
        rows.push(`<li class="walk">${icon('pied', 16)}<span>${s.walk} min de ${esc(stageName(prev.slot.stageId))} à ${esc(stageName(s.slot.stageId))}</span></li>`);
      }
      const friends = a.people.filter((x) => s.friends.includes(x.name));
      rows.push(`<li class="set${s.slot.start <= a.clock && a.clock < s.slot.end ? ' live' : ''}">
        <div class="when"><b>${hhmm(s.slot.start)}</b><small>${hhmm(s.slot.end)}</small></div>
        <div class="what"><b>${esc(s.slot.band)}</b><small>${esc(stageName(s.slot.stageId))}${s.lateBy > 0 ? ` · <em>arrivée ${hhmm(s.arrival)}, ${s.lateBy} min de retard</em>` : ''}</small>
        ${friends.length ? `<span class="tog">${avatars(friends, 22)}<span>avec ${esc(names(friends.map((f) => f.name)))}</span></span>` : ''}</div>
        <button class="go" data-act="goto" data-id="${s.slot.stageId}" aria-label="Voir sur la carte">${icon('carte', 18)}</button>
      </li>`);
    });
    return `${head('Mon plan', `Planning optimisé de ${esc(a.active.name)}, marche comprise`)}
      ${dayChips(a)}
      <div class="kpis">
        <div><b>${p.sets.length}</b><small>concerts</small></div>
        <div><b>${durationLabel(p.minutesTogether)}</b><small>ensemble</small></div>
        <div><b>${p.walkMinutes} min</b><small>de marche</small></div>
      </div>
      ${p.sets.length ? `<ol class="timeline">${rows.join('')}</ol>` : '<p class="empty">Aucun favori ce jour-là. Ajoute des concerts depuis le programme.</p>'}
      ${p.dropped.length ? `<section class="card light"><h3>Laissés de côté</h3><p class="muted">Ils chevauchent un concert plus important pour toi ou ton équipe.</p><ul class="plain">${p.dropped.map((s) => `<li><b>${esc(s.band)}</b> · ${esc(stageName(s.stageId))} · ${hhmm(s.start)}</li>`).join('')}</ul></section>` : ''}
      <p class="muted small">Un concert vu à plusieurs compte une fois et demie plus. Temps de marche selon la foule et la pluie prévue.</p>`;
  }

  // ---------- Équipe ----------
  private equipe() {
    const a = this.app;
    const gathers = a.gatherings();
    const sugg = suggestions(SITE, a.lineup, a.people, a.active, a.plan(a.active), a.rain).slice(0, 4);
    const sync = a.lastSync ? new Date(a.lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
    return `${head('Équipe', `${a.people.length} personnes · dernière mise à jour ${sync}`)}
      <section class="card dark">
        <small class="kick">C’est moi</small>
        <div class="me-row">${avatar(a.active, 44)}<input class="name" data-act="rename" value="${esc(a.active.name)}" aria-label="Mon prénom" maxlength="24" /></div>
        <div class="row2"><button class="btn primary" data-act="share">${icon('partager', 18)}Partager mes favoris</button></div>
        <p class="muted small">Le lien contient ton prénom et tes favoris, rien d’autre.</p>
      </section>
      <section class="card light">
        <h3>Ajouter un ami</h3>
        <div class="field"><input id="import-code" placeholder="Colle son lien ou son code" autocomplete="off" /><button class="btn dark" data-act="import">Ajouter</button></div>
        <div class="field"><input id="new-name" placeholder="Ou crée un profil : prénom" maxlength="24" autocomplete="off" /><button class="btn ghost" data-act="add">${icon('plus', 18)}</button></div>
      </section>
      <h3 class="sec">Qui est où à ${hhmm(a.clock)}</h3>
      <div class="list">${gathers.length ? gathers.map((g) => `<button class="grp" data-act="goto" data-id="${g.stageId}">${avatars(g.people, 28)}<span><b>${esc(stageName(g.stageId))}</b><small>${esc(g.slot.band)} · jusqu’à ${hhmm(g.slot.end)}</small></span>${g.people.length > 1 ? `<em>${g.people.length} ensemble</em>` : ''}</button>`).join('') : '<p class="empty">Personne devant une scène à cette heure.</p>'}</div>
      ${sugg.length ? `<h3 class="sec">À voir avec tes amis</h3><div class="list">${sugg.map((s) => `<article class="slot"><div class="when"><b>${hhmm(s.slot.start)}</b></div><div class="what"><b>${esc(s.slot.band)}</b><small>${esc(stageName(s.slot.stageId))} · ${esc(names(s.friends))}</small></div><button class="star" data-act="fav" data-id="${s.slot.id}" aria-label="Ajouter à mon plan">${icon('plus', 20)}</button></article>`).join('')}</div>` : ''}
      <h3 class="sec">Membres</h3>
      <div class="list">${a.people.map((p) => `<div class="member${p.id === a.activeId ? ' on' : ''}">${avatar(p, 34)}<span><b>${esc(p.name)}</b><small>${p.favorites.length} favoris${p.id.startsWith('exemple-') ? ' · exemple' : ''}</small></span>${p.id === a.activeId ? '<em>moi</em>' : `<button class="btn ghost sm" data-act="as" data-id="${p.id}">Voir comme</button><button class="icon-btn" data-act="remove" data-id="${p.id}" aria-label="Retirer ${esc(p.name)}">${icon('fermer', 16)}</button>`}</div>`).join('')}</div>
      ${a.hasDemo ? `<button class="link" data-act="clear-demo">Effacer l’équipe d’exemple</button>` : ''}`;
  }

  // ---------- Météo ----------
  private meteo() {
    const a = this.app;
    const w = a.weather;
    const days = DAYS.map((d) => ({ d, f: festivalDay(d.date, w) }));
    const week = nextDays(w, 7);
    return `${head('Météo', `Clisson · ${w.live ? 'prévisions Open-Meteo' : 'hors ligne, normales de juin'}`)}
      <h3 class="sec">Pendant le festival</h3>
      <div class="list">${days.map(({ d, f }) => `<article class="wday${d.index === a.day ? ' on' : ''}">
        <div class="wd"><b>${d.label}</b><small>${f.source === 'forecast' ? 'Prévision' : 'Normale de saison'}</small></div>
        <div class="wt"><b>${Math.round(f.tMax)}°</b><small>${Math.round(f.tMin)}°</small></div>
        <div class="wr">${icon('eau', 16)}<span>${f.rainProb} %</span><small>${f.precipMm} mm</small></div>
        <p>${esc(advice(f))}</p></article>`).join('')}</div>
      ${days.some((x) => x.f.source === 'normals') ? '<p class="muted small">Les prévisions détaillées arrivent 16 jours avant. D’ici là, ce sont des moyennes de juin à Clisson.</p>' : ''}
      ${week.length ? `<h3 class="sec">Clisson cette semaine</h3><div class="week">${week.map((x) => `<div><small>${new Date(x.date + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short' })}</small><b>${Math.round(x.f.tMax)}°</b><span>${esc(codeLabel(x.code))}</span><small>${x.f.rainProb} %</small></div>`).join('')}</div>` : ''}
      <p class="muted small">La pluie prévue ralentit les trajets dans Mon plan (boue).</p>`;
  }

  // ---------- Hors connexion ----------
  private horsligne() {
    const a = this.app;
    const sync = a.lastSync ? new Date(a.lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
    const gathers = a.gatherings().filter((g) => g.people.length > 0).slice(0, 3);
    return `${head(a.online ? 'Mode hors connexion' : 'Hors connexion', 'Vos repères restent disponibles.', true)}
      <section class="card dark">
        <div class="pack">${icon('telecharger', 22)}<div><b>Pack festival ${a.offlineReady ? 'enregistré' : 'en cours d’enregistrement'}</b><small>Carte, lieux, itinéraires et mon plan, sur cet appareil.</small>${a.offlineReady ? `<small>Prêt hors ligne.</small>` : ''}</div></div>
      </section>
      <div class="info-row">${icon('localiser', 20)}<div><b>Le guidage reste disponible</b><small>Le GPS n’a pas besoin de données mobiles.</small></div></div>
      <div class="info-row">${icon('equipe', 20)}<div><b>L’équipe n’est plus actualisée</b><small>Dernière synchronisation : ${sync}</small></div></div>
      <section class="card dark">
        <small class="kick">Derniers repères · ${hhmm(a.clock)}</small>
        <div class="list">${gathers.length ? gathers.map((g) => `<div class="grp">${avatars(g.people, 26)}<span><b>${esc(stageName(g.stageId))}</b><small>${esc(names(g.people.map((p) => p.name)))}</small></span></div>`).join('') : '<p class="muted">Aucun repère à cette heure.</p>'}</div>
        <p class="muted small">Repères calculés depuis les plans de chacun, pas un suivi en direct.</p>
      </section>
      <button class="btn primary wide" data-act="pick-start">${icon('depart', 18)}Choisir mon point de départ</button>
      <p class="muted small center">${a.online ? 'Connexion active.' : 'Actualisation au retour du réseau.'}</p>`;
  }

  // ---------- actions ----------
  async act(t: HTMLElement, e: Event) {
    const a = this.app;
    const id = t.dataset.id ?? '';
    const root = t.closest('.page') ?? document;
    switch (t.dataset.act) {
      case 'day':
        a.setMoment(Number(id), a.clock);
        break;
      case 'fav':
        a.toggleFavorite(id);
        break;
      case 'stage':
        this.stageFilter = id;
        a.tick();
        break;
      case 'onlyfavs':
        this.onlyFavs = (t as HTMLInputElement).checked;
        a.tick();
        break;
      case 'goto':
        a.select({ kind: 'stage', id });
        a.setTab('carte');
        break;
      case 'tab':
        a.setTab(id as 'carte');
        break;
      case 'share': {
        const link = a.shareLink();
        const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
        if (nav.share) {
          try {
            await nav.share({ title: 'Mes favoris Hellfest', text: `Les concerts de ${a.active.name}`, url: link });
            break;
          } catch {
            /* cancelled: fall back to copy */
          }
        }
        toast((await copy(link)) ? 'Lien copié. Envoie-le à ton équipe.' : link, 5000);
        break;
      }
      case 'import': {
        const input = root.querySelector<HTMLInputElement>('#import-code')!;
        try {
          const name = a.importCode(input.value);
          input.value = '';
          toast(`${name} a rejoint l’équipe.`);
        } catch (err) {
          toast((err as Error).message || 'Code illisible.');
        }
        break;
      }
      case 'add': {
        const input = root.querySelector<HTMLInputElement>('#new-name')!;
        if (!input.value.trim()) {
          toast('Écris un prénom.');
          break;
        }
        const p = a.addPerson(input.value);
        input.value = '';
        toast(`${p.name} ajouté. Choisis « Voir comme » pour remplir ses favoris.`, 4000);
        break;
      }
      case 'as':
        a.setActive(id);
        toast(`Tu vois l’app comme ${a.active.name}.`);
        break;
      case 'remove':
        a.removePerson(id);
        break;
      case 'clear-demo':
        a.clearDemo();
        toast('Équipe d’exemple effacée.');
        break;
      case 'pick-start':
        a.picking = true;
        a.setTab('carte');
        break;
      default:
        void e;
    }
  }

  async change(t: HTMLInputElement) {
    const a = this.app;
    if (t.dataset.act === 'rename') a.renameActive(t.value);
    if (t.dataset.act === 'onlyfavs') {
      this.onlyFavs = t.checked;
      a.tick();
    }
    if (t.dataset.act === 'csv' && t.files?.[0]) {
      try {
        const l = parseLineupCsv(await t.files[0].text());
        a.setLineup(l);
        toast(`${l.slots.length} concerts importés.`);
      } catch (err) {
        toast((err as Error).message, 5000);
      }
    }
  }
}
