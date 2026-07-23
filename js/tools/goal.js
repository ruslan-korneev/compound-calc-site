// Инструмент «Цель» — обратный расчёт: что нужно, чтобы получить $X к году Y
import { simulate } from '../model.js';
import { renderChart, thinPoints } from '../chart.js';
import { fmt } from '../format.js';

let target = 1_000_000, targetYear = 20, solveFor = 'contrib';

const UNKNOWNS = {
  contrib: { label: 'взнос / мес', apply: (sc, v) => { sc.contrib.enabled = true; sc.contrib.amount = v; }, lo: 0, hi: 1e9, fmt: v => fmt(v) + '/мес' },
  start:   { label: 'стартовый вклад', apply: (sc, v) => { sc.start = v; }, lo: 0, hi: 1e12, fmt: v => fmt(v) },
  rate:    { label: 'нужный APY', apply: (sc, v) => { sc.rates = [{ years: sc.years, ratePct: v, period: 'year' }]; }, lo: 0, hi: 1000, fmt: v => v.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + '% годовых' },
  years:   { label: 'нужный срок', apply: null, lo: 1, hi: 1000, fmt: v => v + ' лет' },
};

function balanceAtYear(sc, year) {
  const s = simulate({ ...sc, years: Math.max(year, 1) });
  const i = Math.min(year * 12, s.pts.length - 1);
  return s.pts[i].bal;
}

function solve(baseSc, kind) {
  const u = UNKNOWNS[kind];
  if (kind === 'years') {
    const sc = JSON.parse(JSON.stringify(baseSc));
    sc.years = 1000;
    const s = simulate(sc);
    for (const p of s.pts) if (p.bal >= target) return p.m / 12;
    return null;
  }
  const test = v => {
    const sc = JSON.parse(JSON.stringify(baseSc));
    sc.years = targetYear;
    u.apply(sc, v);
    return balanceAtYear(sc, targetYear);
  };
  if (test(u.lo) >= target) return u.lo;
  if (test(u.hi) < target) return null;
  let lo = u.lo, hi = u.hi;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (test(mid) >= target) hi = mid; else lo = mid;
  }
  return hi;
}

export function render(root, ctx) {
  root.innerHTML = `
    <div class="card">
      <div class="grid">
        <div class="field">
          <label>Хочу получить</label>
          <input type="number" id="qTarget" min="1" step="any" value="${target}">
        </div>
        <div class="field">
          <label>К году</label>
          <input type="number" id="qYear" min="1" max="1000" step="1" value="${targetYear}">
        </div>
        <div class="field">
          <label>Найти</label>
          <select id="qSolve">
            ${Object.entries(UNKNOWNS).map(([k, u]) =>
              `<option value="${k}" ${k === solveFor ? 'selected' : ''}>${u.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <p class="mutednote" style="margin:12px 0 0">Остальные параметры берутся из сценария сверху.
        «Нужный срок» игнорирует поле «к году»; «нужный APY» заменяет все сегменты ставки одной годовой.</p>
    </div>
    <div class="stats" id="qResult"></div>
    <div class="card chartwrap">
      <div class="chart-head">
        <span class="chart-title">Путь к цели</span>
        <div class="legend"><span><i class="sw" style="background:var(--s1)"></i>Баланс</span></div>
      </div>
      <svg id="qChart" role="img" aria-label="Путь к цели"></svg>
      <div class="tip" id="qTip"></div>
    </div>`;

  root.querySelector('#qTarget').addEventListener('input', e => { target = +e.target.value || 1; update(root, ctx); });
  root.querySelector('#qYear').addEventListener('input', e => { targetYear = Math.max(1, Math.floor(+e.target.value || 1)); update(root, ctx); });
  root.querySelector('#qSolve').addEventListener('input', e => { solveFor = e.target.value; update(root, ctx); });

  update(root, ctx);
}

export function update(root, ctx) {
  const u = UNKNOWNS[solveFor];
  const v = solve(ctx.scenario, solveFor);

  const resEl = root.querySelector('#qResult');
  const stat = (val, l, cls = '') => `<div class="stat ${cls}"><div class="v">${val}</div><div class="l">${l}</div></div>`;

  const sc = JSON.parse(JSON.stringify(ctx.scenario));
  if (v == null) {
    resEl.innerHTML = stat('недостижимо', solveFor === 'years'
      ? 'баланс не дорастает до цели за 1000 лет'
      : `даже при максимуме (${u.fmt(u.hi)})`, '');
    root.querySelector('#qChart').innerHTML = '';
    return;
  }

  if (solveFor === 'years') {
    sc.years = Math.min(1000, Math.ceil(v) + 2);
  } else {
    u.apply(sc, v);
    sc.years = targetYear;
  }
  const sim = simulate(sc);
  const last = sim.pts[sim.pts.length - 1];

  resEl.innerHTML =
    stat(u.fmt(solveFor === 'years' ? Math.round(v * 10) / 10 : v), 'ответ: ' + u.label, 'hl') +
    stat(fmt(target), 'цель') +
    stat(fmt(last.invested), 'всего вложишь своих') +
    stat(`<span style="color:var(--good)">${fmt(Math.max(0, (solveFor === 'years' ? target : last.bal) - last.invested))}</span>`, 'сделает сложный процент');

  const goalX = solveFor === 'years' ? v : targetYear;
  renderChart(root.querySelector('#qChart'), root.querySelector('#qTip'), {
    series: [{ key: 'bal', label: 'Баланс', color: 'var(--s1)', pts: thinPoints(sim.pts, 'm', 'bal').map(p => ({ x: p.x / 12, y: p.y })) }],
    markers: [{ x: goalX, label: `цель: ${fmt(target)}` }],
    log: false, xMax: sim.years,
    tipTitle: x => `${Math.round(x * 10) / 10} г.`,
  });
}
