import { evaluateLocation, VERDICT_LABELS, type ExpansionInput, type ExpansionResult, type Location } from '../engine';
import { LOCATIONS } from '../data/locations';
import { nearestNormals } from '../data/climate';
import { geocode } from '../data/weather';
import type { Game } from '../game';
import { lineChart, legend } from './chart';
import { esc, eur, int, pct } from './format';

/** "Should I open a second club there?" Every number is an editable hypothesis. */
export class ExpansionPanel {
  private input: ExpansionInput;
  private custom: Location = { id: 'custom', name: 'Autre lieu', lat: 50.63, lon: 3.06, population: 50000, targetShare: 0.42, competitors: 1, rentPerM2Month: 10, distanceKm: 20, ...nearestNormals(50.63) };

  constructor(
    private root: HTMLElement,
    private game: Game,
  ) {
    const c = game.config;
    const members = c.members.length;
    this.input = {
      location: LOCATIONS[0],
      surfaceM2: 150,
      fitOutCost: 12000,
      adultFee: c.fees.adultMonthly,
      kidFee: c.fees.kidMonthly,
      kidShare: members ? c.members.filter((m) => m.segment === 'enfant').length / members : 0.3,
      coachHoursWeek: 10,
      coachHourly: 25,
      otherFixedMonthly: 300,
      practiceRate: 0.007,
      rampMonths: 18,
      attractiveness: 1,
      horizonMonths: 36,
      currentClubMembers: members,
    };
    root.addEventListener('change', (e) => this.onChange(e));
    root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b?.dataset.act === 'geo') void this.lookup();
      if (b?.dataset.loc) {
        this.input.location = this.locations().find((l) => l.id === b.dataset.loc)!;
        this.render();
      }
    });
  }

  private locations(): Location[] {
    return [...LOCATIONS, this.custom];
  }

  render() {
    this.input.currentClubMembers = Math.round(this.game.sim.state.members.adulte + this.game.sim.state.members.enfant);
    const inp = this.input;
    const loc = inp.location;
    const res = evaluateLocation(inp);
    const isCustom = loc.id === 'custom';
    const n = (key: string, label: string, value: number, step = 1, scale = 1) => `<label class="field">${label}<input type="number" step="${step}" data-k="${key}" data-scale="${scale}" value="${Math.round(value * scale * 1000) / 1000}"></label>`;
    const ranking = this.locations()
      .map((l) => ({ l, r: evaluateLocation({ ...inp, location: l }) }))
      .sort((a, b) => b.r.months[b.r.months.length - 1].cash - a.r.months[a.r.months.length - 1].cash);

    this.root.innerHTML = `
      <h2>Nouveau club</h2>
      <p>Évalue l’ouverture d’un second club dans un autre lieu : marché local, concurrence, loyer, météo, trésorerie et point mort sur ${inp.horizonMonths} mois.</p>
      <label class="field">Lieu<select data-k="location">${this.locations().map((l) => `<option value="${l.id}" ${l.id === loc.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
      ${loc.note ? `<p class="muted">${esc(loc.note)}</p>` : ''}

      <div class="verdict ${res.verdict}" style="margin-top:12px">
        <strong>${VERDICT_LABELS[res.verdict]}</strong>
        <ul>${res.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      </div>

      <div class="grid2" style="margin-top:10px">
        <div class="card"><div class="label">Adhérents visés</div><div class="value">${int(res.target)}</div><div class="sub">Plafond de la salle : ${int(res.capacityCap)}</div></div>
        <div class="card"><div class="label">Investissement</div><div class="value">${eur(res.investment)}</div><div class="sub">Aménagement + 3 mois de dépôt</div></div>
        <div class="card"><div class="label">Point mort mensuel</div><div class="value">${res.breakEvenMonth ? `mois ${res.breakEvenMonth}` : 'jamais'}</div><div class="sub">Recettes ≥ charges</div></div>
        <div class="card"><div class="label">Retour sur investissement</div><div class="value">${res.paybackMonth ? `mois ${res.paybackMonth}` : `> ${inp.horizonMonths} mois`}</div><div class="sub">Marge à terme : ${pct(res.steadyMargin)}</div></div>
      </div>

      <h3>Trésorerie cumulée du nouveau club</h3>
      <canvas class="chart" id="exp-cash"></canvas>
      ${legend([{ label: 'Trésorerie', color: '#141414' }, { label: 'Adhérents (échelle à part)', color: '#E0A526', dashed: true }])}
      <canvas class="chart" id="exp-members" style="height:110px;margin-top:6px"></canvas>

      <h3>Hypothèses du lieu</h3>
      <div class="grid2">
        ${isCustom ? `<label class="field">Nom<input type="text" data-k="loc.name" data-str value="${esc(loc.name)}"></label><div class="field">&nbsp;<button class="btn ghost small" data-act="geo">Chercher la ville</button></div>` : ''}
        ${n('loc.population', 'Population', loc.population, 1000)}
        ${n('loc.targetShare', 'Part 6-45 ans (%)', loc.targetShare, 1, 100)}
        ${n('loc.competitors', 'Clubs concurrents', loc.competitors)}
        ${n('loc.rentPerM2Month', 'Loyer € / m² / mois', loc.rentPerM2Month, 0.5)}
        ${n('loc.distanceKm', 'Distance du club actuel (km)', loc.distanceKm)}
        ${isCustom ? n('loc.lat', 'Latitude (météo)', loc.lat, 0.01) : ''}
      </div>
      <div id="geo-box"></div>
      <h3>Hypothèses du projet</h3>
      <div class="grid2">
        ${n('surfaceM2', 'Surface (m²)', inp.surfaceM2, 10)}
        ${n('fitOutCost', 'Aménagement €', inp.fitOutCost, 500)}
        ${n('adultFee', 'Cotisation adulte €', inp.adultFee)}
        ${n('kidFee', 'Cotisation enfant €', inp.kidFee)}
        ${n('coachHoursWeek', 'Heures de cours / sem.', inp.coachHoursWeek, 0.5)}
        ${n('coachHourly', 'Coût prof € / h', inp.coachHourly)}
        ${n('otherFixedMonthly', 'Autres charges € / mois', inp.otherFixedMonthly, 10)}
        ${n('practiceRate', 'Taux de pratique potentiel (%)', inp.practiceRate, 0.1, 100)}
        ${n('rampMonths', 'Montée en charge (mois)', inp.rampMonths)}
        ${n('attractiveness', 'Attractivité vs concurrent', inp.attractiveness, 0.1)}
      </div>
      <div class="note" style="margin-top:10px">Concurrence, loyers et taux de pratique sont des hypothèses à vérifier sur le terrain (annuaires de clubs, agences, mairie). Les populations sont des ordres de grandeur arrondis.</div>

      <h3>Comparer tous les lieux</h3>
      <div class="scroll-x"><table class="t"><thead><tr><th>Lieu</th><th>Adhérents</th><th>Trésorerie à ${inp.horizonMonths} mois</th><th>Verdict</th></tr></thead><tbody>
        ${ranking.map(({ l, r }) => `<tr><td><button class="btn ghost small" data-loc="${l.id}">${esc(l.name)}</button></td><td class="n">${int(r.target)}</td><td class="n">${eur(r.months[r.months.length - 1].cash)}</td><td><span class="pill ${r.verdict === 'pertinent' ? 'sain' : r.verdict === 'a-creuser' ? 'tension' : 'crise'}">${VERDICT_LABELS[r.verdict]}</span></td></tr>`).join('')}
      </tbody></table></div>
    `;
    this.draw(res);
  }

  private draw(res: ExpansionResult) {
    const labels = res.months.map((m) => `M${m.month}`);
    lineChart(this.root.querySelector('#exp-cash')!, labels, [{ label: 'Trésorerie', color: '#141414', values: res.months.map((m) => m.cash) }], (v) => `${Math.round(v / 100) / 10}k€`, { zeroLine: true });
    lineChart(this.root.querySelector('#exp-members')!, labels, [{ label: 'Adhérents', color: '#E0A526', values: res.months.map((m) => m.members), dashed: true }], (v) => String(Math.round(v)));
  }

  private onChange(e: Event) {
    const t = e.target as HTMLInputElement;
    const k = t.dataset.k;
    if (!k) return;
    if (k === 'location') {
      this.input.location = this.locations().find((l) => l.id === t.value)!;
      return this.render();
    }
    const scale = Number(t.dataset.scale ?? 1);
    const v = t.dataset.str !== undefined ? t.value : Number(t.value) / scale;
    if (typeof v === 'number' && !Number.isFinite(v)) return;
    if (k.startsWith('loc.')) {
      // Editing a preset makes a local copy, so the defaults stay intact.
      const key = k.slice(4) as keyof Location;
      const loc = { ...this.input.location, [key]: v } as Location;
      if (key === 'lat') Object.assign(loc, nearestNormals(Number(v)));
      if (loc.id === 'custom') this.custom = loc;
      this.input.location = loc;
    } else {
      (this.input as unknown as Record<string, unknown>)[k] = v;
    }
    this.render();
  }

  private async lookup() {
    const box = this.root.querySelector('#geo-box')!;
    box.innerHTML = '<p class="muted">Recherche…</p>';
    const res = await geocode(this.custom.name);
    if (!res.length) {
      box.innerHTML = '<p class="muted">Recherche indisponible (réseau bloqué ici). Saisis population et latitude à la main.</p>';
      return;
    }
    const g = res[0];
    this.custom = { ...this.custom, name: g.name, lat: g.lat, lon: g.lon, population: g.population ?? this.custom.population, ...nearestNormals(g.lat) };
    this.input.location = this.custom;
    this.render();
  }
}
