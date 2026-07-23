// Инструмент «Сравнение» — до 4 сценариев рядом
import { simulate, apyOf } from '../model.js';
import { renderChart, thinPoints } from '../chart.js';
import { fmt, fmtPct } from '../format.js';
import { loadCompareList, saveCompareList } from '../state.js';

const COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'];
const BENCHMARKS = [
  { name: 'Банк 4%', ratePct: 4 },
  { name: 'S&P 10%', ratePct: 10 },
];
let logMode = false;

export function render(root, ctx) {
  root.innerHTML = `
    <div class="card">
      <div class="chart-head" style="margin-bottom:0">
        <span class="chart-title">Сценарии</span>
        <button type="button" class="linkbtn" id="cAdd">+ добавить текущий сценарий</button>
        <span class="mutednote">бенчмарк:</span>
        ${BENCHMARKS.map((b, i) => `<button type="button" class="linkbtn" data-bench="${i}">+ ${b.name}</button>`).join('')}
      </div>
      <div id="cList" style="margin-top:10px"></div>
    </div>
    <div class="card chartwrap">
      <div class="chart-head">
        <span class="chart-title">Баланс по годам</span>
        <div class="legend" id="cLegend"></div>
        <label class="logline"><input type="checkbox" id="cLog"> лог</label>
      </div>
      <svg id="cChart" role="img" aria-label="Сравнение сценариев"></svg>
      <div class="tip" id="cTip"></div>
    </div>
    <div class="card" style="padding:0">
      <div class="tablewrap"><table>
        <thead id="cHead"></thead><tbody id="cRows"></tbody>
      </table></div>
    </div>`;

  root.querySelector('#cAdd').addEventListener('click', () => {
    const list = loadCompareList();
    if (list.length >= 4) return;
    const copy = JSON.parse(JSON.stringify(ctx.scenario));
    copy.name = prompt('Название сценария:', `Сценарий ${list.length + 1}`) || `Сценарий ${list.length + 1}`;
    list.push(copy);
    saveCompareList(list);
    update(root, ctx);
  });
  root.querySelectorAll('[data-bench]').forEach(b => b.addEventListener('click', () => {
    const list = loadCompareList();
    if (list.length >= 4) return;
    const bench = BENCHMARKS[+b.dataset.bench];
    if (list.some(x => x.benchRate === bench.ratePct || x.name === bench.name)) return;
    list.push({ name: bench.name, benchRate: bench.ratePct });
    saveCompareList(list);
    update(root, ctx);
  }));
  root.querySelector('#cLog').addEventListener('input', e => { logMode = e.target.checked; update(root, ctx); });
  root.querySelector('#cLog').checked = logMode;

  update(root, ctx);
}

const BENCH_NAMES = new Map(BENCHMARKS.map(b => [b.name, b.ratePct]));

export function update(root, ctx) {
  const saved = loadCompareList();
  const horizon = ctx.scenario.years;
  const all = [{ sc: { ...ctx.scenario, name: ctx.scenario.name || 'Текущий' }, live: true },
    ...saved.map(item => {
      const benchRate = item.benchRate ?? BENCH_NAMES.get(item.name);   // legacy-снапшоты бенчмарков тоже оживляем
      if (benchRate != null) {
        const sc = JSON.parse(JSON.stringify(ctx.scenario));
        sc.name = item.name;
        sc.rates = [{ years: horizon, ratePct: benchRate, period: 'year' }];
        return { sc, bench: true };
      }
      return { sc: item };
    })].slice(0, 4);

  root.querySelector('#cList').innerHTML = all.map((a, i) => `
    <div class="listrow">
      <i class="sw" style="background:${COLORS[i]}"></i>
      <b style="color:var(--ink)">${a.sc.name}</b>
      <span class="mutednote">${a.bench
        ? 'как текущий, но ставка ' + fmtPct(apyOf(a.sc.rates[0].ratePct, a.sc.rates[0].period) * 100) + ' APY'
        : `${fmtPct(apyOf(a.sc.rates[0].ratePct, a.sc.rates[0].period) * 100)} APY${a.sc.rates.length > 1 ? ' → …' : ''},
           взнос ${a.sc.contrib.enabled ? fmt(a.sc.contrib.amount) + '/мес' : 'нет'}${a.sc.wdSharePct ? ', снятие ' + a.sc.wdSharePct + '%' : ''}`}</span>
      ${a.live ? '<span class="mutednote">(текущий — правится сверху)</span>'
               : `<button type="button" class="del" data-del="${i - 1}" title="удалить">×</button>`}
    </div>`).join('');
  root.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    const list = loadCompareList();
    list.splice(+b.dataset.del, 1);
    saveCompareList(list);
    update(root, ctx);
  }));

  // все сценарии — на горизонте текущего: сравниваем стратегии, не сроки
  const sims = all.map(a => simulate({ ...a.sc, years: horizon }));
  const series = sims.map((s, i) => ({
    key: 'k' + i, label: all[i].sc.name, color: COLORS[i],
    pts: thinPoints(s.pts, 'm', 'bal').map(p => ({ x: p.x / 12, y: p.y })),
  }));

  root.querySelector('#cLegend').innerHTML = series.map(s =>
    `<span><i class="sw" style="background:${s.color}"></i>${s.label}</span>`).join('');

  renderChart(root.querySelector('#cChart'), root.querySelector('#cTip'), {
    series, log: logMode, xMax: horizon,
    tipTitle: x => `${Math.round(x)} г.`,
  });

  // таблица-дельта по контрольным годам
  const marks = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50, 75, 100].filter(y => y <= horizon);
  root.querySelector('#cHead').innerHTML = '<tr><th>Год</th>' +
    all.map((a, i) => `<th style="color:${COLORS[i]}">${a.sc.name}</th>`).join('') +
    (all.length > 1 ? '<th>лучший − текущий</th>' : '') + '</tr>';
  root.querySelector('#cRows').innerHTML = marks.map(y => {
    const vals = sims.map(s => s.pts[Math.min(y * 12, s.pts.length - 1)]?.bal ?? 0);
    const best = Math.max(...vals);
    const delta = best - vals[0];
    return `<tr><td>${y}</td>` +
      vals.map(v => `<td${v === best ? ' style="font-weight:700"' : ''}>${fmt(v)}</td>`).join('') +
      (all.length > 1 ? `<td class="${delta > 0 ? 'gain' : ''}">${delta > 0 ? '+' + fmt(delta) : '—'}</td>` : '') +
      '</tr>';
  }).join('');
}
