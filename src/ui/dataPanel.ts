import { BELTS, calibrate, type ClubConfig } from '../engine';
import { HISTORY_CSV_EXAMPLE, membersToCsv, parseHistoryCsv, parseMembersCsv } from '../data/csv';
import { geocode } from '../data/weather';
import { loadSeasonality } from '../data/seasonality';
import { sampleClub } from '../data/sampleData';
import { clearConfig } from '../data/storage';
import type { Game } from '../game';
import { DAYS, esc, eur, int } from './format';

type Sub = 'adherents' | 'creneaux' | 'profs' | 'charges' | 'historique' | 'club';
const SUBS: [Sub, string][] = [
  ['adherents', 'Adhérents'],
  ['creneaux', 'Créneaux'],
  ['profs', 'Profs'],
  ['charges', 'Charges et tarifs'],
  ['historique', 'Historique CSV'],
  ['club', 'Club et météo'],
];

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Manual data entry. The user edits a draft, then applies it to restart the simulation. */
export class DataPanel {
  private draft: ClubConfig;
  private sub: Sub = 'adherents';
  private dirty = false;
  private message = '';

  constructor(
    private root: HTMLElement,
    private game: Game,
    private toast: (text: string) => void,
  ) {
    this.draft = clone(game.config);
    root.addEventListener('input', (e) => this.onInput(e));
    root.addEventListener('change', (e) => this.onInput(e));
    root.addEventListener('click', (e) => this.onClick(e));
  }

  /** Called when the game config changes from outside (buildings placed). */
  sync() {
    if (!this.dirty) this.draft = clone(this.game.config);
  }

  render() {
    const d = this.draft;
    this.root.innerHTML = `
      <h2>Mes données</h2>
      <p>Saisis ou importe les données du club. Rien ne quitte ton navigateur. Clique sur « Appliquer » pour relancer la simulation avec ces chiffres.</p>
      <div class="row">
        <button class="btn" data-act="apply" ${this.dirty ? '' : 'disabled'}>Appliquer et relancer</button>
        <button class="btn ghost" data-act="cancel" ${this.dirty ? '' : 'disabled'}>Annuler</button>
        <button class="btn ghost small" data-act="reset-sample">Revenir aux données fictives</button>
      </div>
      ${this.dirty ? '<div class="note">Modifications non appliquées.</div>' : ''}
      ${this.message ? `<div class="note">${this.message}</div>` : ''}
      <div class="subtabs" role="tablist">${SUBS.map(([k, l]) => `<button role="tab" aria-selected="${k === this.sub}" data-sub="${k}">${l}</button>`).join('')}</div>
      <div id="sub-body">${this.body(d)}</div>
    `;
  }

  private body(d: ClubConfig): string {
    const num = (path: string, v: number, step = 1) => `<input type="number" step="${step}" data-path="${path}" data-num value="${v}">`;
    const txt = (path: string, v: string) => `<input type="text" data-path="${path}" value="${esc(v)}">`;
    const sel = (path: string, v: string, opts: [string, string][]) => `<select data-path="${path}">${opts.map(([k, l]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const del = (list: string, i: number) => `<button class="btn ghost small" data-del="${list}" data-i="${i}" aria-label="Supprimer">✕</button>`;
    switch (this.sub) {
      case 'adherents': {
        const byBelt = BELTS.map((b) => [b, d.members.filter((m) => m.belt === b).length] as const).filter(([, n]) => n);
        return `
          <p><b>${d.members.length}</b> adhérents : ${d.members.filter((m) => m.segment === 'adulte').length} adultes, ${d.members.filter((m) => m.segment === 'enfant').length} enfants. ${byBelt.map(([b, n]) => `${n} ${b}`).join(', ')}.</p>
          <div class="note">Pas de nom, d’e-mail ni de téléphone : un identifiant suffit. À l’import, ces colonnes sont supprimées automatiquement.</div>
          <div class="row"><button class="btn small" data-add="members">Ajouter un adhérent</button></div>
          <div class="scroll-x"><table class="t"><thead><tr><th>Id</th><th>Public</th><th>Ceinture</th><th>Âge</th><th>Inscrit le</th><th>Séances/sem.</th><th></th></tr></thead><tbody>
          ${d.members
            .map(
              (m, i) => `<tr><td>${txt(`members.${i}.id`, m.id)}</td><td>${sel(`members.${i}.segment`, m.segment, [['adulte', 'Adulte'], ['enfant', 'Enfant']])}</td><td>${sel(`members.${i}.belt`, m.belt, BELTS.map((b) => [b, b]))}</td><td>${num(`members.${i}.age`, m.age)}</td><td><input type="date" data-path="members.${i}.joinDate" value="${m.joinDate}"></td><td>${num(`members.${i}.sessionsPerWeek`, m.sessionsPerWeek, 0.5)}</td><td>${del('members', i)}</td></tr>`,
            )
            .join('')}
          </tbody></table></div>
          <h3>Importer une liste (CSV)</h3>
          <p>Colonnes : <code>id, segment, ceinture, age, date_inscription, seances_semaine</code>. Virgule ou point-virgule.</p>
          <div class="row"><input type="file" accept=".csv,text/csv" id="members-file"></div>
          <textarea class="csv" id="members-csv" placeholder="Ou colle ton CSV ici"></textarea>
          <div class="row"><button class="btn small" data-act="import-members">Remplacer la liste par ce CSV</button><button class="btn ghost small" data-act="export-members">Afficher la liste en CSV</button></div>`;
      }
      case 'creneaux':
        return `
          <p>${d.slots.length} créneaux par semaine, ${d.slots.reduce((h, s) => h + s.durationH, 0)} h de cours.</p>
          <div class="row"><button class="btn small" data-add="slots">Ajouter un créneau</button></div>
          <div class="scroll-x"><table class="t"><thead><tr><th>Jour</th><th>Début</th><th>Durée (h)</th><th>Public</th><th>Intitulé</th><th>Prof</th><th></th></tr></thead><tbody>
          ${d.slots
            .map(
              (s, i) => `<tr><td>${sel(`slots.${i}.day`, String(s.day), DAYS.map((l, k) => [String(k), l]))}</td><td>${num(`slots.${i}.start`, s.start, 0.25)}</td><td>${num(`slots.${i}.durationH`, s.durationH, 0.25)}</td><td>${sel(`slots.${i}.audience`, s.audience, [['adulte', 'Adultes'], ['enfant', 'Enfants'], ['tous', 'Tous']])}</td><td>${txt(`slots.${i}.label`, s.label)}</td><td>${sel(`slots.${i}.coachId`, s.coachId, d.coaches.map((c) => [c.id, c.label]))}</td><td>${del('slots', i)}</td></tr>`,
            )
            .join('')}
          </tbody></table></div>`;
      case 'profs':
        return `
          <p>Le coût horaire inclut les charges. Mets 0 pour un bénévole.</p>
          <div class="row"><button class="btn small" data-add="coaches">Ajouter un prof</button></div>
          <div class="scroll-x"><table class="t"><thead><tr><th>Nom ou rôle</th><th>€ / heure</th><th>Max h / sem.</th><th></th></tr></thead><tbody>
          ${d.coaches.map((c, i) => `<tr><td>${txt(`coaches.${i}.label`, c.label)}</td><td>${num(`coaches.${i}.hourlyCost`, c.hourlyCost)}</td><td>${num(`coaches.${i}.maxHoursWeek`, c.maxHoursWeek, 0.5)}</td><td>${d.coaches.length > 1 ? del('coaches', i) : ''}</td></tr>`).join('')}
          </tbody></table></div>`;
      case 'charges': {
        const fixed = d.charges.filter((c) => c.kind === 'fixe').reduce((a, c) => a + c.amount, 0);
        return `
          <h3>Cotisations</h3>
          <div class="grid2">
            <label class="field">Adulte, € / mois${num('fees.adultMonthly', d.fees.adultMonthly)}</label>
            <label class="field">Enfant, € / mois${num('fees.kidMonthly', d.fees.kidMonthly)}</label>
            <label class="field">Frais d’inscription, €${num('fees.registrationFee', d.fees.registrationFee)}</label>
            <label class="field">Trésorerie de départ, €${num('startCash', d.startCash, 100)}</label>
          </div>
          <h3>Charges et dépenses</h3>
          <p>Charges fixes : ${eur(fixed)} par mois.</p>
          <div class="row"><button class="btn small" data-add="charges">Ajouter une charge</button></div>
          <div class="scroll-x"><table class="t"><thead><tr><th>Intitulé</th><th>Type</th><th>Montant €</th><th></th></tr></thead><tbody>
          ${d.charges.map((c, i) => `<tr><td>${txt(`charges.${i}.label`, c.label)}</td><td>${sel(`charges.${i}.kind`, c.kind, [['fixe', 'Fixe / mois'], ['par_adherent', 'Par adhérent / mois']])}</td><td>${num(`charges.${i}.amount`, c.amount, 1)}</td><td>${del('charges', i)}</td></tr>`).join('')}
          </tbody></table></div>
          <h3>Comportement des adhérents</h3>
          <div class="grid2">
            <label class="field">Inscriptions / mois (moyenne)${num('market.baseSignupsPerMonth', round(d.market.baseSignupsPerMonth), 0.1)}</label>
            <label class="field">Départs / mois (% des adhérents)${num('market.baseChurnMonthly', round(d.market.baseChurnMonthly * 100), 0.1)}</label>
            <label class="field">Part d’enfants dans les inscriptions (%)${num('market.kidSignupShare', round(d.market.kidSignupShare * 100), 1)}</label>
            <label class="field">Sensibilité au prix (élasticité)${num('market.feeElasticity', d.market.feeElasticity, 0.1)}</label>
          </div>`;
      }
      case 'historique':
        return `
          <p>Colle ton historique mensuel pour caler le modèle sur tes vrais chiffres. Colonnes : <code>mois, ca, adherents</code>, et si tu les as <code>inscriptions, departs</code>.</p>
          <textarea class="csv" id="history-csv">${esc(d.history.length ? ['mois,ca,adherents,inscriptions,departs', ...d.history.map((h) => [h.month, h.revenue, h.members, h.signups ?? '', h.departures ?? ''].join(','))].join('\n') : HISTORY_CSV_EXAMPLE)}</textarea>
          <div class="row"><input type="file" accept=".csv,text/csv" id="history-file"><button class="btn small" data-act="calibrate">Calibrer le modèle</button></div>
          <div class="note">L’exemple pré-rempli est fictif. La saisonnalité (rentrée, vacances) vient d’un fichier de coefficients mensuels ; le calibrage la retire avant de calculer tes moyennes.</div>`;
      case 'club':
        return `
          <div class="grid2">
            <label class="field">Nom du club${txt('name', d.name)}</label>
            <label class="field">Ville${txt('city.name', d.city.name)}</label>
            <label class="field">Latitude${num('city.lat', d.city.lat, 0.01)}</label>
            <label class="field">Longitude${num('city.lon', d.city.lon, 0.01)}</label>
          </div>
          <div class="row"><button class="btn small" data-act="geocode">Trouver les coordonnées de la ville</button></div>
          <div id="geo-results"></div>
          <h3>Météo</h3>
          <p>Source actuelle : <b>${esc(this.game.weather.label)}</b>.</p>
          <div class="note">La météo réelle vient d’Open-Meteo (gratuit, sans clé) sur les 3 derniers mois et les 16 prochains jours. Au-delà, ou si le réseau bloque l’appel, le jeu utilise des normales climatiques.</div>
          <div class="row"><button class="btn ghost small" data-act="reconnect">Réessayer la météo réelle</button></div>`;
    }
  }

  private onInput(e: Event) {
    const t = e.target as HTMLInputElement;
    if (t.id === 'members-file' || t.id === 'history-file') {
      if (e.type !== 'change' || !t.files?.[0]) return;
      void t.files[0].text().then((text) => {
        const area = this.root.querySelector<HTMLTextAreaElement>(t.id === 'members-file' ? '#members-csv' : '#history-csv');
        if (area) area.value = text;
      });
      return;
    }
    const path = t.dataset.path;
    if (!path) return;
    let v: unknown = t.value;
    if (t.dataset.num !== undefined) {
      const n = Number(t.value);
      if (!Number.isFinite(n)) return;
      v = /market\.(baseChurnMonthly|kidSignupShare)$/.test(path) ? n / 100 : n;
    }
    if (/slots\.\d+\.day$/.test(path)) v = Number(v);
    setPath(this.draft, path, v);
    if (!this.dirty) {
      this.dirty = true;
      if (e.type === 'change') this.render();
      else this.root.querySelectorAll<HTMLButtonElement>('[data-act="apply"],[data-act="cancel"]').forEach((b) => (b.disabled = false));
    }
  }

  private onClick(e: Event) {
    const t = (e.target as HTMLElement).closest('button');
    if (!t) return;
    const d = this.draft;
    if (t.dataset.sub) {
      this.sub = t.dataset.sub as Sub;
      this.message = '';
      return this.render();
    }
    if (t.dataset.add) {
      const n = Date.now().toString(36);
      if (t.dataset.add === 'members') d.members.unshift({ id: `N${n.slice(-4).toUpperCase()}`, segment: 'adulte', belt: 'blanche', age: 25, joinDate: new Date().toISOString().slice(0, 10), sessionsPerWeek: 2 });
      if (t.dataset.add === 'slots') d.slots.push({ id: `s-${n}`, day: 2, start: 18, durationH: 1, audience: 'adulte', label: 'Nouveau créneau', coachId: d.coaches[0]?.id ?? '' });
      if (t.dataset.add === 'coaches') d.coaches.push({ id: `c-${n}`, label: 'Nouveau prof', hourlyCost: 25, maxHoursWeek: 4 });
      if (t.dataset.add === 'charges') d.charges.push({ id: `ch-${n}`, label: 'Nouvelle charge', kind: 'fixe', amount: 50 });
      this.dirty = true;
      return this.render();
    }
    if (t.dataset.del) {
      const list = (d as unknown as Record<string, unknown[]>)[t.dataset.del];
      const removed = list.splice(Number(t.dataset.i), 1)[0] as { id: string };
      if (t.dataset.del === 'coaches') d.slots.forEach((s) => s.coachId === removed.id && (s.coachId = d.coaches[0].id));
      this.dirty = true;
      return this.render();
    }
    switch (t.dataset.act) {
      case 'apply':
        this.game.setConfig(clone(d));
        this.dirty = false;
        this.message = 'Simulation relancée avec tes données.';
        this.toast('Données appliquées, simulation relancée.');
        return this.render();
      case 'cancel':
        this.draft = clone(this.game.config);
        this.dirty = false;
        return this.render();
      case 'reset-sample':
        clearConfig();
        this.draft = sampleClub();
        this.game.setConfig(clone(this.draft));
        this.dirty = false;
        this.message = 'Données fictives restaurées.';
        return this.render();
      case 'import-members': {
        const text = this.root.querySelector<HTMLTextAreaElement>('#members-csv')?.value ?? '';
        const r = parseMembersCsv(text);
        if (!r.rows.length) {
          this.message = 'Aucune ligne lue. Vérifie l’en-tête du CSV.';
          return this.render();
        }
        d.members = r.rows;
        this.dirty = true;
        this.message = `${int(r.rows.length)} adhérents importés.${r.droppedColumns.length ? ` Colonnes personnelles supprimées : ${r.droppedColumns.join(', ')}.` : ''}${r.errors.length ? ` ${r.errors.slice(0, 3).join(' ')}` : ''}`;
        return this.render();
      }
      case 'export-members': {
        const area = this.root.querySelector<HTMLTextAreaElement>('#members-csv');
        if (area) area.value = membersToCsv(d.members);
        return;
      }
      case 'calibrate': {
        const text = this.root.querySelector<HTMLTextAreaElement>('#history-csv')?.value ?? '';
        const { rows, errors } = parseHistoryCsv(text);
        const cal = calibrate(rows, loadSeasonality(), d.fees);
        d.history = rows;
        Object.assign(d.market, cal.market);
        this.dirty = true;
        this.message = [...cal.notes, ...errors.slice(0, 3), cal.market.baseSignupsPerMonth ? `Résultat : ${round(cal.market.baseSignupsPerMonth)} inscriptions par mois et ${round((cal.market.baseChurnMonthly ?? 0) * 100)} % de départs par mois (hors saisonnalité).` : ''].filter(Boolean).join(' ');
        return this.render();
      }
      case 'geocode': {
        const box = this.root.querySelector('#geo-results')!;
        box.innerHTML = '<p class="muted">Recherche…</p>';
        void geocode(d.city.name).then((res) => {
          box.innerHTML = res.length
            ? res.map((g, i) => `<button class="btn ghost small" data-geo="${i}">${esc(g.name)}, ${esc(g.country)} (${g.lat.toFixed(2)}, ${g.lon.toFixed(2)})</button>`).join(' ')
            : '<p class="muted">Recherche indisponible (réseau bloqué ici). Saisis la latitude et la longitude à la main.</p>';
          box.querySelectorAll<HTMLButtonElement>('[data-geo]').forEach((b) =>
            b.addEventListener('click', () => {
              const g = res[Number(b.dataset.geo)];
              d.city = { name: g.name, lat: g.lat, lon: g.lon };
              this.dirty = true;
              this.render();
            }),
          );
        });
        return;
      }
      case 'reconnect':
        void this.game.connectWeather().then(() => {
          this.toast(`Météo : ${this.game.weather.label}`);
          this.render();
        });
        return;
    }
  }
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}

function setPath(obj: unknown, path: string, value: unknown) {
  const keys = path.split('.');
  let cur = obj as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  cur[keys[keys.length - 1]] = value;
}
