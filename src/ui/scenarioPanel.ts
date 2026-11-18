import { compareScenario, SHOCK_LABELS, type Comparison, type Shock } from '../engine';
import type { Game } from '../game';
import { lineChart, legend } from './chart';
import { esc, eur, int, monthLabel, MONTHS, signedEur, signedPts, type State, dot, DAYS } from './format';

interface ShockForm {
  on: boolean;
  shock: Shock;
}

/** "What if" mode: baseline vs scenario over 6 or 12 months, with alerts on the map. */
export class ScenarioPanel {
  private forms: ShockForm[];
  private horizon = 6;
  private result: Comparison | null = null;

  constructor(
    private root: HTMLElement,
    private game: Game,
    private showAlerts: (c: Comparison | null) => void,
  ) {
    const coach = game.config.coaches[0]?.id ?? '';
    this.forms = [
      { on: true, shock: { kind: 'creneau-enfants', fromMonth: 1, day: 2, start: 14 } },
      { on: false, shock: { kind: 'hausse-cotisation', fromMonth: 1, pct: 0.1 } },
      { on: false, shock: { kind: 'depart-prof', fromMonth: 2, coachId: coach } },
      { on: false, shock: { kind: 'embauche-prof', fromMonth: 2, hourlyCost: 22, maxHoursWeek: 4 } },
      { on: false, shock: { kind: 'canicule', calendarMonth: 5, extraC: 10 } },
      { on: false, shock: { kind: 'stage', fromMonth: 2, participants: 30, price: 40, cost: 700, extraSignups: 3 } },
      { on: false, shock: { kind: 'hausse-loyer', fromMonth: 1, pct: 0.15 } },
    ];
    root.addEventListener('change', (e) => this.onChange(e));
    root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b?.dataset.act === 'run') this.run();
      if (b?.dataset.act === 'clear') {
        this.result = null;
        this.showAlerts(null);
        this.render();
      }
    });
  }

  private monthOptions(selected: number) {
    const start = this.game.startDate;
    const y = Number(start.slice(0, 4));
    const m = Number(start.slice(5, 7)) - 1;
    return Array.from({ length: 12 }, (_, i) => {
      const mm = (m + i) % 12;
      const yy = y + Math.floor((m + i) / 12);
      return `<option value="${i}" ${i === selected ? 'selected' : ''}>${MONTHS[mm]} ${yy}</option>`;
    }).join('');
  }

  private params(f: ShockForm, i: number): string {
    const s = f.shock;
    const field = (label: string, key: string, value: number, step = 1, scale = 1) => `<label class="field">${label}<input type="number" step="${step}" data-i="${i}" data-k="${key}" data-scale="${scale}" value="${Math.round(value * scale * 100) / 100}"></label>`;
    const from = 'fromMonth' in s ? `<label class="field">À partir de<select data-i="${i}" data-k="fromMonth">${this.monthOptions(s.fromMonth)}</select></label>` : '';
    switch (s.kind) {
      case 'creneau-enfants':
        return `${from}<label class="field">Jour<select data-i="${i}" data-k="day">${DAYS.map((d, k) => `<option value="${k}" ${k === s.day ? 'selected' : ''}>${d}</option>`).join('')}</select></label>${field('Heure', 'start', s.start, 0.5)}`;
      case 'hausse-cotisation':
        return `${from}${field('Hausse (%)', 'pct', s.pct, 1, 100)}`;
      case 'hausse-loyer':
        return `${from}${field('Hausse (%)', 'pct', s.pct, 1, 100)}`;
      case 'depart-prof':
        return `${from}<label class="field">Prof<select data-i="${i}" data-k="coachId" data-str>${this.game.config.coaches.map((c) => `<option value="${esc(c.id)}" ${c.id === s.coachId ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></label>`;
      case 'embauche-prof':
        return `${from}${field('€ / heure', 'hourlyCost', s.hourlyCost)}${field('Max h / sem.', 'maxHoursWeek', s.maxHoursWeek, 0.5)}`;
      case 'canicule':
        return `<label class="field">Mois<select data-i="${i}" data-k="calendarMonth">${MONTHS.map((m, k) => `<option value="${k}" ${k === s.calendarMonth ? 'selected' : ''}>${m}</option>`).join('')}</select></label>${field('Degrés en plus', 'extraC', s.extraC)}`;
      case 'stage':
        return `${from.replace('À partir de', 'Mois du stage')}${field('Participants', 'participants', s.participants)}${field('Prix €', 'price', s.price)}${field('Coût €', 'cost', s.cost)}${field('Inscriptions gagnées', 'extraSignups', s.extraSignups)}`;
    }
  }

  render() {
    const r = this.result;
    this.root.innerHTML = `
      <h2>Scénarios</h2>
      <p>Choisis un ou plusieurs chocs. Le jeu simule deux futurs avec le même hasard, l’un de référence et l’autre avec tes chocs, puis compare.</p>
      ${this.forms
        .map(
          (f, i) => `<div class="shock"><input type="checkbox" id="shock-${i}" data-i="${i}" data-k="on" ${f.on ? 'checked' : ''}><label for="shock-${i}"><b>${SHOCK_LABELS[f.shock.kind]}</b></label>${f.on ? `<div class="params">${this.params(f, i)}</div>` : ''}</div>`,
        )
        .join('')}
      <div class="row">
        <label class="field" style="width:130px">Horizon<select id="horizon"><option value="6" ${this.horizon === 6 ? 'selected' : ''}>6 mois</option><option value="12" ${this.horizon === 12 ? 'selected' : ''}>12 mois</option></select></label>
        <button class="btn gold" data-act="run">Comparer</button>
        ${r ? '<button class="btn ghost small" data-act="clear">Effacer le résultat</button>' : ''}
      </div>
      <div id="scn-result">${r ? this.resultHtml(r) : '<p class="muted">Lance une comparaison pour voir l’écart.</p>'}</div>
    `;
    if (r) this.drawCharts(r);
  }

  private resultHtml(c: Comparison): string {
    const last = (x: typeof c.baseline) => x[x.length - 1];
    const state = (v: number, goodIfPositive = true): State => (Math.abs(v) < 1e-6 ? 'sain' : (v > 0) === goodIfPositive ? 'sain' : 'tension');
    return `
      <h3>Résultat sur ${c.scenario.length} mois</h3>
      <div class="grid2">
        <div class="card"><div class="label">${dot(state(c.delta.cash))}Trésorerie finale</div><div class="value">${signedEur(c.delta.cash)}</div><div class="sub">${eur(last(c.scenario).cash)} contre ${eur(last(c.baseline).cash)}</div></div>
        <div class="card"><div class="label">${dot(state(c.delta.margin))}Marge</div><div class="value">${signedPts(c.delta.margin)}</div><div class="sub">sur toute la période</div></div>
        <div class="card"><div class="label">${dot(state(c.delta.members))}Adhérents</div><div class="value">${c.delta.members >= 0 ? '+' : '−'}${int(Math.abs(c.delta.members))}</div><div class="sub">${int(last(c.scenario).members)} contre ${int(last(c.baseline).members)}</div></div>
        <div class="card"><div class="label">${dot(state(c.delta.coachLoadMax, false))}Charge max des profs</div><div class="value">${signedPts(c.delta.coachLoadMax)}</div><div class="sub">Satisfaction ${signedPts(c.delta.satisfaction)}</div></div>
      </div>
      <h3>Trésorerie comparée</h3>
      <canvas class="chart" id="scn-cash"></canvas>
      ${legend([{ label: 'Référence', color: '#9A9C9F', dashed: true }, { label: 'Scénario', color: '#141414' }])}
      <h3>Adhérents comparés</h3>
      <canvas class="chart" id="scn-members"></canvas>
      <h3>Alertes sur la carte</h3>
      ${
        c.alerts.length
          ? `<ul class="alerts-list">${c.alerts.map((a) => `<li><span class="pill ${a.level}">${a.level}</span> ${esc(a.text)}, dès ${monthLabel(a.month)}</li>`).join('')}</ul><p class="muted">Les fissures dorées du scénario sont affichées sur la carte.</p>`
          : '<p>Aucune fragilité détectée dans ce scénario.</p>'
      }
      <div class="note">Modèle simplifié : les effets (prix, météo, saturation) sont des hypothèses réglables dans « Mes données ». Utilise-le pour comparer des options, pas pour prédire un chiffre exact.</div>
    `;
  }

  private drawCharts(c: Comparison) {
    const labels = c.baseline.map((m) => monthLabel(m.month));
    lineChart(this.root.querySelector('#scn-cash')!, labels, [
      { label: 'Référence', color: '#9A9C9F', values: c.baseline.map((m) => m.cash), dashed: true },
      { label: 'Scénario', color: '#141414', values: c.scenario.map((m) => m.cash) },
    ], (n) => `${Math.round(n / 100) / 10}k€`, { zeroLine: true });
    lineChart(this.root.querySelector('#scn-members')!, labels, [
      { label: 'Référence', color: '#9A9C9F', values: c.baseline.map((m) => m.members), dashed: true },
      { label: 'Scénario', color: '#141414', values: c.scenario.map((m) => m.members) },
    ], (n) => String(Math.round(n)));
  }

  private onChange(e: Event) {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    if (t.id === 'horizon') {
      this.horizon = Number(t.value);
      return;
    }
    const i = Number(t.dataset.i);
    const k = t.dataset.k;
    if (!k || Number.isNaN(i)) return;
    const f = this.forms[i];
    if (k === 'on') {
      f.on = (t as HTMLInputElement).checked;
      return this.render();
    }
    const scale = Number(t.dataset.scale ?? 1);
    const v = t.dataset.str !== undefined ? t.value : Number(t.value) / scale;
    (f.shock as unknown as Record<string, unknown>)[k] = v;
  }

  run() {
    const shocks = this.forms.filter((f) => f.on).map((f) => ({ ...f.shock }));
    if (!shocks.length) {
      this.result = null;
      this.render();
      return;
    }
    this.result = compareScenario(this.game.config, this.game.env, shocks, this.game.startDate, this.horizon);
    this.showAlerts(this.result);
    this.render();
  }
}
