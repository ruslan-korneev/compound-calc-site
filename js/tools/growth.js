// Инструмент «Рост»
import { simulate, toRows, milestones, apyOf } from '../model.js';
import { renderChart, thinPoints } from '../chart.js';
import { fmt, fmtPct } from '../format.js';

let view = 'years', areaMode = false, realMode = false, logMode = false;

export function render(root, ctx) {
  root.innerHTML = `
    <div class="stats" id="gStats"></div>
    <div class="card chartwrap">
      <div class="chart-head">
        <span class="chart-title">Рост капитала</span>
        <div class="legend" id="gLegend"></div>
        <div class="seg small" id="gMode">
          <button type="button" data-v="lines" class="on">Линии</button>
          <button type="button" data-v="area">Слои</button>
        </div>
        <label class="logline"><input type="checkbox" id="gReal"> в сегодняшних деньгах</label>
        <label class="logline"><input type="checkbox" id="gLog"> лог</label>
      </div>
      <svg id="gChart" role="img" aria-label="Рост капитала"></svg>
      <div class="tip" id="gTip"></div>
    </div>
    <div class="card" style="padding:0">
      <div class="tablehead">
        <div class="seg small" id="gView">
          <button type="button" data-v="years" class="on">По годам</button>
          <button type="button" data-v="months">По месяцам</button>
        </div>
        <span class="mutednote" id="gWarn"></span>
      </div>
      <div class="tablewrap">
        <table>
          <thead><tr>
            <th id="gPeriodHead">Год</th><th>Баланс</th><th>Вложено</th>
            <th>Доход за период</th><th>Снято за период</th><th>Снято всего</th>
          </tr></thead>
          <tbody id="gRows"></tbody>
        </table>
      </div>
    </div>`;

  root.querySelector('#gMode').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    areaMode = b.dataset.v === 'area';
    [...ev.currentTarget.children].forEach(x => x.classList.toggle('on', x === b));
    update(root, ctx);
  });
  root.querySelector('#gView').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    view = b.dataset.v;
    [...ev.currentTarget.children].forEach(x => x.classList.toggle('on', x === b));
    update(root, ctx);
  });
  root.querySelector('#gReal').addEventListener('input', e => { realMode = e.target.checked; update(root, ctx); });
  root.querySelector('#gLog').addEventListener('input', e => { logMode = e.target.checked; update(root, ctx); });
  root.querySelector('#gReal').checked = realMode;
  root.querySelector('#gLog').checked = logMode;

  update(root, ctx);
}

export function update(root, ctx) {
  const sc = ctx.scenario;
  const sim = simulate(sc);
  const { pts, defl } = sim;
  const dz = realMode ? defl : () => 1;
  const showWd = sc.wdSharePct > 0;
  const last = pts[pts.length - 1];

  const apy1 = apyOf(sc.rates[0].ratePct, sc.rates[0].period) * 100;
  const lastYearWd = pts.length > 13 ? (last.wdNet - pts[pts.length - 13].wdNet) : last.wdNet;
  const stat = (v, l, cls = '') => `<div class="stat ${cls}"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  root.querySelector('#gStats').innerHTML =
    stat(fmtPct(apy1), 'APY стартового сегмента' + (sc.rates.length > 1 ? ` (+${sc.rates.length - 1} сегм.)` : '')) +
    stat(fmt(last.bal * dz(last.m)), 'итог на счету' + (realMode ? ' (реальные)' : ''), 'hl') +
    stat(fmt(last.invested), 'вложено своих') +
    stat(`<span style="color:var(--good)">${fmt((last.bal - last.invested) * dz(last.m))}</span>`, 'доход (реинвестированный)') +
    (showWd ? stat(fmt(last.wdNet * 1), 'снято себе (после налога)', 'wd') : '') +
    (showWd ? stat(fmt(lastYearWd / 12) + '/мес', 'пассивный доход в последний год', 'wd') : '');

  const mkPts = key => thinPoints(pts, 'm', key).map(p => ({ x: p.x / 12, y: p.y * dz(p.x * 12) }));
  const series = [
    { key: 'bal', label: 'Баланс', color: 'var(--s1)', pts: mkPts('bal') },
    { key: 'invested', label: 'Вложено', color: 'var(--s2)', pts: mkPts('invested') },
  ];
  if (showWd) series.push({ key: 'wd', label: 'Снято', color: 'var(--s3)', pts: mkPts('wdNet') });

  root.querySelector('#gLegend').innerHTML = series.map(s =>
    `<span><i class="sw" style="background:${s.color}"></i>${s.label}</span>`).join('');

  renderChart(root.querySelector('#gChart'), root.querySelector('#gTip'), {
    series,
    areaPair: areaMode ? ['invested', 'bal'] : null,
    markers: milestones(sim).map(m => ({ x: m.m / 12, label: m.label })),
    log: logMode,
    xMax: sim.years,
    tipTitle: x => { const yr = Math.floor(x), mo = Math.round((x - yr) * 12); return yr ? `${yr} г.${mo ? ' ' + mo + ' мес.' : ''}` : 'старт'; },
  });

  const rows = toRows(sim, view);
  root.querySelector('#gPeriodHead').textContent = view === 'months' ? 'Месяц' : 'Год';
  root.querySelector('#gWarn').textContent = rows.length >= 12000 ? 'показаны первые 12 000 строк' : '';
  root.querySelector('#gRows').innerHTML = rows.map(r => {
    const d = dz(view === 'months' ? r.period : r.period * 12);
    return `<tr><td>${r.period}</td><td>${fmt(r.bal * d)}</td><td>${fmt(r.invested)}</td>` +
      `<td class="gain">+${fmt(r.gain * d)}</td><td class="wd">${r.take ? '+' + fmt(r.take * d) : '—'}</td>` +
      `<td class="wd">${r.wdTotal ? fmt(r.wdTotal * d) : '—'}</td></tr>`;
  }).join('');
}
