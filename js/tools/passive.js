// Инструмент «Пассивный доход»: когда смогу снимать $X/мес и жить с процентов
import { simulate } from '../model.js';
import { renderChart, thinPoints } from '../chart.js';
import { fmt } from '../format.js';

let targetMonthly = 2000, stopContrib = true;

export function render(root, ctx) {
  root.innerHTML = `
    <div class="card">
      <div class="grid">
        <div class="field">
          <label>Хочу снимать в месяц (на руки, после налога)</label>
          <input type="number" id="pTarget" min="1" step="any" value="${targetMonthly}">
        </div>
        <div class="field" style="align-self:end">
          <label class="switchline" style="margin:0"><input type="checkbox" id="pStop" ${stopContrib ? 'checked' : ''}>
            <span>после выхода прекратить взносы</span></label>
        </div>
      </div>
      <p class="mutednote" style="margin:12px 0 0">
        Фаза 1 — копим по сценарию сверху (без снятий). Выход = первый месяц, когда доход
        <b>после налога</b> покрывает цель и капитал при таком снятии не проедается.
        Фаза 2 — снимаем ровно цель, остальное реинвестируется.</p>
    </div>
    <div class="stats" id="pStats"></div>
    <div class="card chartwrap">
      <div class="chart-head">
        <span class="chart-title">Две фазы: накопление → жизнь с процентов</span>
        <div class="legend">
          <span><i class="sw" style="background:var(--s1)"></i>Баланс</span>
          <span><i class="sw" style="background:var(--s3)"></i>Снято (на руки)</span>
        </div>
        <label class="logline"><input type="checkbox" id="pLog"> лог</label>
      </div>
      <svg id="pChart" role="img" aria-label="Фазы накопления и снятия"></svg>
      <div class="tip" id="pTip"></div>
    </div>
    <div class="card" style="padding:16px 20px" id="pNote"></div>`;

  root.querySelector('#pTarget').addEventListener('input', e => { targetMonthly = +e.target.value || 1; update(root, ctx); });
  root.querySelector('#pStop').addEventListener('input', e => { stopContrib = e.target.checked; update(root, ctx); });
  root.querySelector('#pLog').addEventListener('input', () => update(root, ctx));

  update(root, ctx);
}

export function update(root, ctx) {
  const sc = JSON.parse(JSON.stringify(ctx.scenario));
  sc.wdSharePct = 0;                       // фаза накопления — без снятий
  const tax = (sc.taxPct || 0) / 100;

  // ищем месяц выхода: доход за месяц * (1-tax) >= цель
  const probe = simulate({ ...sc, years: Math.min(1000, sc.years) });
  let fireMonth = null;
  for (let i = 1; i < probe.pts.length; i++) {
    if (probe.pts[i].interest * (1 - tax) >= targetMonthly) { fireMonth = i; break; }
  }

  const statEl = root.querySelector('#pStats');
  const stat = (v, l, cls = '') => `<div class="stat ${cls}"><div class="v">${v}</div><div class="l">${l}</div></div>`;

  if (fireMonth == null) {
    statEl.innerHTML = stat('не в горизонте', `доход не дорастает до ${fmt(targetMonthly)}/мес за ${sc.years} лет — увеличь срок, взнос или ставку`);
    const capNeeded = estimateCapital(sc, targetMonthly, tax);
    root.querySelector('#pNote').innerHTML =
      `<span class="mutednote">Ориентир: для ${fmt(targetMonthly)}/мес на руки нужно ~<b>${fmt(capNeeded)}</b> капитала при текущей ставке.</span>`;
    renderPhaseChart(root, ctx, probe, null, tax);
    return;
  }

  // фаза 2: с месяца выхода снимаем фикс
  const sim2 = simulate(sc, {
    withdrawFixedMonthly: targetMonthly,
    withdrawStartMonth: fireMonth,
    stopContribOnWithdraw: stopContrib,
  });
  const last = sim2.pts[sim2.pts.length - 1];
  const fireYears = fireMonth / 12;
  const capAtFire = probe.pts[fireMonth].bal;
  const sustainable = last.bal >= capAtFire * 0.5 && last.bal > 0;

  statEl.innerHTML =
    stat(`через ${fireYears.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} лет`, 'выход на пассивный доход', 'hl') +
    stat(fmt(capAtFire), 'капитал в момент выхода') +
    stat(fmt(targetMonthly) + '/мес', 'снятие на руки' + (tax ? ` (до налога ${fmt(targetMonthly / (1 - tax))})` : ''), 'wd') +
    stat(fmt(last.bal), `баланс в конце горизонта ${sustainable ? '— капитал не проедается ✓' : '⚠ проедается'}`,
         sustainable ? '' : 'warn') +
    stat(fmt(last.wdNet), 'снято за всё время', 'wd');

  root.querySelector('#pNote').innerHTML = sustainable
    ? `<span class="mutednote">После выхода капитал продолжает расти: снятие ${fmt(targetMonthly)}/мес меньше дохода. Каждый год ожидания сверх точки выхода делает подушку толще.</span>`
    : `<span class="mutednote">⚠ На горизонте капитал тает: ставка последних сегментов ниже стартовой либо цель на грани. Подними цель года выхода или снизь снятие.</span>`;

  renderPhaseChart(root, ctx, sim2, fireMonth, tax);
}

function renderPhaseChart(root, ctx, sim, fireMonth, tax) {
  const log = root.querySelector('#pLog')?.checked;
  const series = [
    { key: 'bal', label: 'Баланс', color: 'var(--s1)', pts: thinPoints(sim.pts, 'm', 'bal').map(p => ({ x: p.x / 12, y: p.y })) },
  ];
  if (fireMonth != null)
    series.push({ key: 'wd', label: 'Снято', color: 'var(--s3)', pts: thinPoints(sim.pts, 'm', 'wdNet').map(p => ({ x: p.x / 12, y: p.y })) });
  renderChart(root.querySelector('#pChart'), root.querySelector('#pTip'), {
    series,
    markers: fireMonth != null ? [{ x: fireMonth / 12, label: '🏖 выход' }] : [],
    log, xMax: sim.years,
    tipTitle: x => `${Math.round(x * 10) / 10} г.`,
  });
}

function estimateCapital(sc, monthly, tax) {
  // капитал, при котором месячный доход последнего сегмента покрывает цель
  const lastSeg = sc.rates[sc.rates.length - 1];
  const mfLast = Math.pow(1 + lastSeg.ratePct / 100,
    (lastSeg.period === 'year' ? 1 : lastSeg.period === 'month' ? 12 : (365 * 24) / +lastSeg.period) / 12);
  return monthly / ((mfLast - 1) * (1 - tax));
}
