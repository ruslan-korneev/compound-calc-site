// Инструмент «Веер» — Monte-Carlo: неопределённость ставки → веер исходов
import { simulate, periodsPerYear, MAX_MONTHS } from '../model.js';
import { renderChart, thinPoints } from '../chart.js';
import { fmt, fmtPct } from '../format.js';

let volPct = 30, runs = 300, goal = 1_000_000;

// один прогон: годовая APY каждого года = базовая * (1 + N(0, vol)), floor −95%
function mcRun(sc, rng) {
  const years = Math.min(100, sc.years);
  const months = years * 12;
  const mfBase = [];
  let filled = 0;
  for (const seg of sc.rates) {
    const apy = Math.pow(1 + seg.ratePct / 100, periodsPerYear(seg.period)) - 1;
    for (let i = 0; i < seg.years && filled < years; i++, filled++) mfBase.push(apy);
  }
  while (filled < years) { mfBase.push(mfBase[mfBase.length - 1] ?? 0); filled++; }

  const fee = (sc.feePct || 0) / 100;
  const wdShare = (sc.wdSharePct || 0) / 100;
  let bal = sc.start || 0, prevY = -1, mf = 1;
  const balByYear = [bal];
  const evByYear = {};
  for (const e of sc.events || []) evByYear[Math.floor(e.year)] = (evByYear[Math.floor(e.year)] || 0) + (+e.amount || 0);

  for (let m = 1; m <= months; m++) {
    const yIdx = Math.ceil(m / 12) - 1;
    if (yIdx !== prevY) {
      const noise = 1 + volPct / 100 * gauss(rng);
      const apy = Math.max(-0.95, mfBase[yIdx] * noise);
      mf = Math.pow(1 + apy, 1 / 12);
      prevY = yIdx;
      const e = evByYear[yIdx + 1];
      if (e) { if (e > 0) bal += e * (1 - fee); else bal = Math.max(0, bal + e); }
    }
    const interest = bal * (mf - 1);
    const c = sc.contrib.enabled ? (sc.contrib.amount || 0) * Math.pow(1 + (sc.contrib.growthPct || 0) / 100, yIdx) : 0;
    bal += interest - interest * wdShare + c * (1 - fee);
    if (bal < 0) bal = 0;
    if (m % 12 === 0) balByYear.push(bal);
  }
  return balByYear;
}

function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function render(root, ctx) {
  root.innerHTML = `
    <div class="card">
      <div class="grid">
        <div class="field">
          <label>Волатильность ставки, % <span class="hint" title="Относительное стандартное отклонение годовой APY. 30% при базе 14% ≈ типичный год в диапазоне 10–18%">?</span></label>
          <div class="rangeline">
            <input type="range" id="fVol" min="0" max="100" step="5" value="${volPct}">
            <span class="rangeval" id="fVolVal">${volPct}%</span>
          </div>
        </div>
        <div class="field">
          <label>Прогонов</label>
          <select id="fRuns">
            <option value="100">100</option>
            <option value="300" selected>300</option>
            <option value="1000">1000</option>
          </select>
        </div>
        <div class="field">
          <label>Цель (для вероятности)</label>
          <input type="number" id="fGoal" min="1" step="any" value="${goal}">
        </div>
      </div>
      <p class="mutednote" style="margin:12px 0 0">Каждый год каждого прогона ставка дёргается случайно вокруг сценарной.
        Горизонт веера ограничен 100 годами. Снятие-% и события учитываются, налог на снятое — нет (смотрим капитал).</p>
    </div>
    <div class="stats" id="fStats"></div>
    <div class="card chartwrap">
      <div class="chart-head">
        <span class="chart-title">Веер исходов</span>
        <div class="legend">
          <span><i class="sw" style="background:var(--band);height:10px"></i>p10–p90</span>
          <span><i class="sw" style="background:var(--s1)"></i>медиана</span>
          <span><i class="sw" style="background:var(--s2)"></i>план без шума</span>
        </div>
        <label class="logline"><input type="checkbox" id="fLog"> лог</label>
      </div>
      <svg id="fChart" role="img" aria-label="Веер Монте-Карло"></svg>
      <div class="tip" id="fTip"></div>
    </div>`;

  root.querySelector('#fVol').addEventListener('input', e => {
    volPct = +e.target.value;
    root.querySelector('#fVolVal').textContent = volPct + '%';
    update(root, ctx);
  });
  root.querySelector('#fRuns').addEventListener('input', e => { runs = +e.target.value; update(root, ctx); });
  root.querySelector('#fGoal').addEventListener('input', e => { goal = +e.target.value || 1; update(root, ctx); });
  root.querySelector('#fLog').addEventListener('input', () => update(root, ctx));

  update(root, ctx);
}

export function update(root, ctx) {
  const sc = ctx.scenario;
  const years = Math.min(100, sc.years);

  const finals = [];
  const byYear = Array.from({ length: years + 1 }, () => []);
  for (let r = 0; r < runs; r++) {
    const rng = mulberry32(1234 + r * 7919);
    const path = mcRun(sc, rng);
    for (let y = 0; y < path.length; y++) byYear[y].push(path[y]);
    finals.push(path[path.length - 1]);
  }
  const pct = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };

  const xs = [], lo = [], mid = [], hi = [];
  for (let y = 0; y <= years; y++) {
    xs.push(y);
    lo.push(pct(byYear[y], 0.10));
    mid.push(pct(byYear[y], 0.50));
    hi.push(pct(byYear[y], 0.90));
  }

  const plan = simulate({ ...sc, years });
  const planPts = thinPoints(plan.pts, 'm', 'bal').map(p => ({ x: p.x / 12, y: p.y }));

  const pGoal = finals.filter(v => v >= goal).length / finals.length;
  const stat = (v, l, cls = '') => `<div class="stat ${cls}"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  root.querySelector('#fStats').innerHTML =
    stat(fmt(pct(finals, 0.5)), `медианный итог (${years} лет)`, 'hl') +
    stat(fmt(pct(finals, 0.1)), 'пессимистичный (p10)') +
    stat(fmt(pct(finals, 0.9)), 'оптимистичный (p90)') +
    stat(fmtPct(pGoal * 100, 0), `вероятность достичь ${fmt(goal)}`, pGoal >= 0.5 ? 'wd' : '');

  renderChart(root.querySelector('#fChart'), root.querySelector('#fTip'), {
    series: [
      { key: 'mid', label: 'Медиана', color: 'var(--s1)', pts: xs.map((x, i) => ({ x, y: mid[i] })) },
      { key: 'plan', label: 'План', color: 'var(--s2)', pts: planPts },
    ],
    band: { x: xs, lo, hi },
    log: root.querySelector('#fLog')?.checked,
    xMax: years,
    tipTitle: x => `${Math.round(x)} г.`,
  });
}
