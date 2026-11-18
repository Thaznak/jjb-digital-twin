import { facilities, PLACES_PER_TATAMI } from '../engine';
import type { Game } from '../game';
import { lineChart, legend } from './chart';
import { dot, eur, esc, hour, int, monthLabel, pct, DAYS, type State } from './format';

const stateOf = (v: number, warn: number, crisis: number, higherIsBad = true): State =>
  higherIsBad ? (v >= crisis ? 'crise' : v >= warn ? 'tension' : 'sain') : v <= crisis ? 'crise' : v <= warn ? 'tension' : 'sain';

/** Transverse view of the live game: money, members, mats and people. */
export function renderDashboard(root: HTMLElement, game: Game) {
  const sim = game.sim;
  const r = game.last;
  if (!r) return;
  const fac = facilities(game.config.buildings);
  const months = sim.months;
  const lastMonth = months[months.length - 1];
  const members = r.members.adulte + r.members.enfant;
  const week = sim.days.slice(-7).flatMap((d) => d.fills);
  const avgFill = week.length ? week.reduce((a, f) => a + (f.capacity ? f.attendees / f.capacity : 0), 0) / week.length : 0;
  const peak = week.reduce((m, f) => (f.capacity ? Math.max(m, f.demand / f.capacity) : m), 0);
  const maxLoad = Math.max(0, ...r.coachLoads.map((c) => c.load));
  const cashS = stateOf(r.cash, 2000, 0, false);
  const satS = stateOf(r.satisfaction, 0.7, 0.55, false);
  const fillS = stateOf(peak, 0.95, 1.15);
  const loadS = stateOf(maxLoad, 0.95, 1.2);

  root.innerHTML = `
    <h2>Tableau de bord</h2>
    <p>Vue transverse du club, mise à jour chaque jour simulé. Les fissures dorées sur la carte montrent les points de fragilité.</p>
    <div class="grid2">
      <div class="card"><div class="label">${dot(cashS)}Trésorerie</div><div class="value">${eur(r.cash)}</div><div class="sub">${lastMonth ? `Marge ${monthLabel(lastMonth.month)} : ${pct(lastMonth.margin)}` : 'Premier mois en cours'}</div></div>
      <div class="card"><div class="label">${dot('sain')}Adhérents</div><div class="value">${int(members)}</div><div class="sub">${int(r.members.adulte)} adultes, ${int(r.members.enfant)} enfants</div></div>
      <div class="card"><div class="label">${dot(fillS)}Remplissage (7 j)</div><div class="value">${pct(avgFill)}</div><div class="sub">Pic de demande : ${pct(peak)} de ${fac.slotCapacity} places</div></div>
      <div class="card"><div class="label">${dot(satS)}Satisfaction</div><div class="value">${pct(r.satisfaction)}</div><div class="sub">Influence inscriptions et départs</div></div>
    </div>

    <h3>Trésorerie, 120 derniers jours</h3>
    <canvas class="chart" id="dash-cash"></canvas>
    <h3>Adhérents par mois</h3>
    <canvas class="chart" id="dash-members"></canvas>
    ${legend([{ label: 'Adultes', color: '#3E7CB1' }, { label: 'Enfants', color: '#D9A93B' }])}

    <h3>Capacité de la salle</h3>
    <table class="t"><tbody>
      <tr><td>Tatamis</td><td class="n">${fac.matPlaces / PLACES_PER_TATAMI} tapis, ${fac.matPlaces} places</td></tr>
      <tr><td>Vestiaires</td><td class="n">${fac.lockerPlaces} places</td></tr>
      <tr><td>Places par créneau</td><td class="n"><b>${fac.slotCapacity}</b> (limité par : ${fac.bottleneck})</td></tr>
      <tr><td>Coûts des équipements</td><td class="n">${eur(fac.monthlyCost)} / mois</td></tr>
    </tbody></table>

    <h3>${dot(loadS)}Charge des profs</h3>
    <table class="t"><thead><tr><th>Prof</th><th>Heures / sem.</th><th>Charge</th></tr></thead><tbody>
      ${r.coachLoads.map((c) => `<tr><td>${esc(c.label)}</td><td class="n">${c.hours.toFixed(1)} h</td><td><div class="meter"><i class="${stateOf(c.load, 0.95, 1.2)}" style="width:${Math.min(100, c.load * 100)}%"></i></div></td></tr>`).join('')}
    </tbody></table>

    <h3>Créneaux de la semaine écoulée</h3>
    <div class="scroll-x"><table class="t"><thead><tr><th>Créneau</th><th>Venus</th><th>Demande</th><th>Remplissage</th></tr></thead><tbody>
      ${
        sim.days
          .slice(-7)
          .flatMap((d) => d.fills)
          .sort((a, b) => a.slot.day - b.slot.day || a.slot.start - b.slot.start)
          .map((f) => {
            const ratio = f.capacity ? f.demand / f.capacity : 0;
            return `<tr><td>${DAYS[f.slot.day].slice(0, 3)}. ${hour(f.slot.start)} ${esc(f.slot.label)}</td><td class="n">${Math.round(f.attendees)}</td><td class="n">${Math.round(f.demand)}</td><td><div class="meter"><i class="${stateOf(ratio, 0.95, 1.15)}" style="width:${Math.min(100, ratio * 100)}%"></i></div></td></tr>`;
          })
          .join('') || '<tr><td colspan="4" class="muted">Pas encore de créneau cette semaine.</td></tr>'
      }
    </tbody></table></div>
  `;

  const days = sim.days.slice(-120);
  lineChart(root.querySelector('#dash-cash')!, days.map((d) => d.date.slice(8, 10) + '/' + d.date.slice(5, 7)), [{ label: 'Trésorerie', color: '#3E7CB1', values: days.map((d) => d.cash) }], (n) => `${Math.round(n / 100) / 10}k€`, { zeroLine: true });
  const ms = months.slice(-12);
  const labels = [...ms.map((m) => monthLabel(m.month)), 'en cours'];
  lineChart(
    root.querySelector('#dash-members')!,
    labels,
    [
      { label: 'Adultes', color: '#3E7CB1', values: [...ms.map((m) => m.members - m.kids), r.members.adulte] },
      { label: 'Enfants', color: '#D9A93B', values: [...ms.map((m) => m.kids), r.members.enfant] },
    ],
    (n) => String(Math.round(n)),
  );
}
