// Редактор сценария — общая панель для всех инструментов
import { PRESETS } from './state.js';

const PERIOD_OPTS = `
  <option value="18">18 часов</option>
  <option value="24">день</option>
  <option value="168">неделя</option>
  <option value="month">месяц</option>
  <option value="year">год (APY)</option>`;

export function renderEditor(root, scenario, onChange) {
  root.innerHTML = `
    <div class="grid">
      <div class="field">
        <label>Пресет <span class="hint" title="Готовые ставки: применяются к сценарию">?</span></label>
        <select id="ePreset"><option value="">—</option>
          ${PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Стартовый вклад</label>
        <input type="number" id="eStart" min="0" step="any">
      </div>
      <div class="field">
        <label>Взнос / мес</label>
        <input type="number" id="eContrib" min="0" step="any">
        <label class="switchline"><input type="checkbox" id="eContribOn"><span>добавлять каждый месяц</span></label>
      </div>
      <div class="field">
        <label>Сколько лет (1–1000)</label>
        <input type="number" id="eYears" min="1" max="1000" step="1">
      </div>
    </div>
    <div class="grid" style="margin-top:14px">
      <div class="field" style="grid-column: span 2; min-width:260px">
        <label>Забирать себе из дохода <span class="hint" title="Доля каждого начисления, снимаемая на жизнь; остальное реинвестируется">?</span></label>
        <div class="rangeline">
          <input type="range" id="eWd" min="0" max="100" step="5">
          <span class="rangeval" id="eWdVal"></span>
        </div>
      </div>
      <div class="field">
        <label>Инфляция, %/год <span class="hint" title="Для пересчёта в «сегодняшние деньги»">?</span></label>
        <input type="number" id="eInfl" min="0" max="100" step="any">
      </div>
      <div class="field" style="align-self:end">
        <button type="button" class="linkbtn" id="eAdvToggle">Расширенные ▾</button>
      </div>
    </div>
    <div id="eAdv" style="display:none; margin-top:16px; border-top:1px solid var(--grid); padding-top:16px">
      <div class="advcols">
        <div>
          <label class="grouplabel">Ставка по периодам <span class="hint" title="Сегменты подряд; последний тянется до горизонта">?</span></label>
          <div id="eRates"></div>
          <button type="button" class="linkbtn" id="eAddRate">+ сегмент</button>
        </div>
        <div>
          <label class="grouplabel">Разовые события <span class="hint" title="Плюс — довнесение, минус — изъятие в начале года N">?</span></label>
          <div id="eEvents"></div>
          <button type="button" class="linkbtn" id="eAddEvent">+ событие</button>
        </div>
        <div>
          <label class="grouplabel">Прочее</label>
          <div class="field"><label>Рост взноса, %/год</label>
            <input type="number" id="eGrowth" step="any" min="0"></div>
          <div class="field" style="margin-top:8px"><label>Комиссия на взнос, %</label>
            <input type="number" id="eFee" step="any" min="0" max="100"></div>
          <div class="field" style="margin-top:8px"><label>Налог со снятого, %</label>
            <input type="number" id="eTax" step="any" min="0" max="100"></div>
        </div>
      </div>
    </div>`;

  const $ = id => root.querySelector('#' + id);

  function fill() {
    $('eStart').value = scenario.start;
    $('eContrib').value = scenario.contrib.amount;
    $('eContribOn').checked = scenario.contrib.enabled;
    $('eContrib').disabled = !scenario.contrib.enabled;
    $('eYears').value = scenario.years;
    $('eWd').value = scenario.wdSharePct;
    $('eWdVal').textContent = scenario.wdSharePct + '%';
    $('eInfl').value = scenario.inflationPct;
    $('eGrowth').value = scenario.contrib.growthPct;
    $('eFee').value = scenario.feePct;
    $('eTax').value = scenario.taxPct;
    fillRates(); fillEvents();
  }

  function fillRates() {
    $('eRates').innerHTML = scenario.rates.map((r, i) => `
      <div class="listrow" data-i="${i}">
        <input type="number" class="rYears" value="${r.years}" min="1" step="1" title="лет">
        <span>лет:</span>
        <input type="number" class="rPct" value="${r.ratePct}" min="0" step="any" title="ставка %">
        <span>% за</span>
        <select class="rPer">${PERIOD_OPTS}</select>
        ${scenario.rates.length > 1 ? '<button type="button" class="del" title="удалить">×</button>' : ''}
      </div>`).join('');
    [...$('eRates').querySelectorAll('.listrow')].forEach(row => {
      const i = +row.dataset.i;
      row.querySelector('.rPer').value = scenario.rates[i].period;
      row.querySelector('.rYears').addEventListener('input', e => { scenario.rates[i].years = Math.max(1, +e.target.value || 1); onChange(); });
      row.querySelector('.rPct').addEventListener('input', e => { scenario.rates[i].ratePct = +e.target.value || 0; onChange(); });
      row.querySelector('.rPer').addEventListener('input', e => { scenario.rates[i].period = e.target.value; onChange(); });
      row.querySelector('.del')?.addEventListener('click', () => { scenario.rates.splice(i, 1); fillRates(); onChange(); });
    });
  }

  function fillEvents() {
    $('eEvents').innerHTML = scenario.events.length
      ? scenario.events.map((e, i) => `
        <div class="listrow" data-i="${i}">
          <span>год</span>
          <input type="number" class="evYear" value="${e.year}" min="1" step="1">
          <input type="number" class="evAmt" value="${e.amount}" step="any" title="±сумма">
          <button type="button" class="del" title="удалить">×</button>
        </div>`).join('')
      : '<div class="mutednote">нет</div>';
    [...$('eEvents').querySelectorAll('.listrow')].forEach(row => {
      const i = +row.dataset.i;
      row.querySelector('.evYear').addEventListener('input', e => { scenario.events[i].year = +e.target.value || 1; onChange(); });
      row.querySelector('.evAmt').addEventListener('input', e => { scenario.events[i].amount = +e.target.value || 0; onChange(); });
      row.querySelector('.del').addEventListener('click', () => { scenario.events.splice(i, 1); fillEvents(); onChange(); });
    });
  }

  $('ePreset').addEventListener('input', e => {
    const p = PRESETS[+e.target.value];
    if (!p) return;
    Object.assign(scenario, JSON.parse(JSON.stringify(p.patch)));
    fill(); onChange();
  });
  $('eStart').addEventListener('input', e => { scenario.start = +e.target.value || 0; onChange(); });
  $('eContrib').addEventListener('input', e => { scenario.contrib.amount = +e.target.value || 0; onChange(); });
  $('eContribOn').addEventListener('input', e => { scenario.contrib.enabled = e.target.checked; $('eContrib').disabled = !e.target.checked; onChange(); });
  $('eYears').addEventListener('input', e => { scenario.years = Math.min(1000, Math.max(1, Math.floor(+e.target.value || 1))); onChange(); });
  $('eWd').addEventListener('input', e => { scenario.wdSharePct = +e.target.value; $('eWdVal').textContent = scenario.wdSharePct + '%'; onChange(); });
  $('eInfl').addEventListener('input', e => { scenario.inflationPct = +e.target.value || 0; onChange(); });
  $('eGrowth').addEventListener('input', e => { scenario.contrib.growthPct = +e.target.value || 0; onChange(); });
  $('eFee').addEventListener('input', e => { scenario.feePct = +e.target.value || 0; onChange(); });
  $('eTax').addEventListener('input', e => { scenario.taxPct = +e.target.value || 0; onChange(); });
  $('eAdvToggle').addEventListener('click', () => {
    const adv = $('eAdv');
    const open = adv.style.display === 'none';
    adv.style.display = open ? '' : 'none';
    $('eAdvToggle').textContent = open ? 'Расширенные ▴' : 'Расширенные ▾';
  });
  $('eAddRate').addEventListener('click', () => {
    const last = scenario.rates[scenario.rates.length - 1];
    scenario.rates.push({ years: 5, ratePct: last.ratePct, period: last.period });
    fillRates(); onChange();
  });
  $('eAddEvent').addEventListener('click', () => {
    scenario.events.push({ year: 5, amount: 1000 });
    fillEvents(); onChange();
  });

  fill();
  return { refresh: fill };
}
