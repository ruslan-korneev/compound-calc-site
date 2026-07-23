// Модель сценария и симуляция. Все инструменты работают поверх неё.

export const MAX_MONTHS = 12000;

export const defaultScenario = () => ({
  name: 'Мой сценарий',
  start: 400,
  years: 40,
  // сегменты ставки: подряд, последний тянется до горизонта
  rates: [{ years: 40, ratePct: 0.0275, period: '18' }],
  contrib: { enabled: true, amount: 400, growthPct: 0 },
  events: [],              // { year, amount } — плюс = довнесение, минус = изъятие капитала
  wdSharePct: 0,           // % каждого начисления — себе
  inflationPct: 0,
  feePct: 0,               // комиссия на взнос
  taxPct: 0,               // налог со снятого
});

export function periodsPerYear(period) {
  if (period === 'year') return 1;
  if (period === 'month') return 12;
  return (365 * 24) / +period;
}

export function apyOf(ratePct, period) {
  return Math.pow(1 + ratePct / 100, periodsPerYear(period)) - 1;
}

export function monthlyFactor(ratePct, period) {
  return Math.pow(1 + ratePct / 100, periodsPerYear(period) / 12);
}

// opts: { withdrawFixedMonthly, withdrawStartMonth, stopContribOnWithdraw } — для Пассива
export function simulate(sc, opts = {}) {
  const years = Math.min(1000, Math.max(1, Math.floor(sc.years || 1)));
  const months = Math.min(MAX_MONTHS, years * 12);

  const mfByYear = [];
  let filled = 0;
  for (const seg of sc.rates) {
    const mf = monthlyFactor(seg.ratePct, seg.period);
    for (let i = 0; i < seg.years && filled < years; i++, filled++) mfByYear.push(mf);
  }
  const lastMf = mfByYear[mfByYear.length - 1] ?? 1;
  while (filled < years) { mfByYear.push(lastMf); filled++; }

  const evByYear = {};
  for (const e of sc.events || []) {
    const y = Math.floor(e.year);
    if (y >= 1 && y <= years) evByYear[y] = (evByYear[y] || 0) + (+e.amount || 0);
  }

  const fee = (sc.feePct || 0) / 100;
  const tax = (sc.taxPct || 0) / 100;
  const wdShare = (sc.wdSharePct || 0) / 100;
  const defl = m => Math.pow(1 + (sc.inflationPct || 0) / 100, -m / 12);

  let bal = sc.start || 0;
  let invested = sc.start || 0;
  let wdGross = 0, wdNet = 0, eventsOut = 0;
  const pts = [{ m: 0, bal, invested, wd: 0, wdNet: 0, interest: 0, contrib: 0 }];

  for (let m = 1; m <= months; m++) {
    const yIdx = Math.ceil(m / 12) - 1;
    const mf = mfByYear[yIdx];
    const interest = bal * (mf - 1);

    const inWithdrawPhase = opts.withdrawStartMonth != null && m >= opts.withdrawStartMonth;
    let take;
    if (inWithdrawPhase && opts.withdrawFixedMonthly != null) {
      take = Math.min(bal + interest, opts.withdrawFixedMonthly / (1 - tax || 1));
    } else {
      take = interest * wdShare;
    }

    let c = 0;
    const contribOn = sc.contrib.enabled && !(inWithdrawPhase && opts.stopContribOnWithdraw);
    if (contribOn) c = (sc.contrib.amount || 0) * Math.pow(1 + (sc.contrib.growthPct || 0) / 100, yIdx);

    bal += interest - take + c * (1 - fee);
    invested += c;
    wdGross += take;
    wdNet += take * (1 - tax);

    if (m % 12 === 1 || (m === 1)) {
      const y = yIdx + 1;
      if (evByYear[y]) {
        const e = evByYear[y];
        if (e > 0) { bal += e * (1 - fee); invested += e; }
        else { const out = Math.min(bal, -e); bal -= out; eventsOut += out; }
        delete evByYear[y];
      }
    }
    if (bal < 0) bal = 0;
    pts.push({ m, bal, invested, wd: wdGross, wdNet, interest, contrib: c });
    if (!isFinite(bal)) break;
  }

  return { pts, years, defl, eventsOut,
           apy: apyOf(sc.rates[0].ratePct, sc.rates[0].period) };
}

// годовые (или месячные) строки для таблиц
export function toRows(sim, view) {
  const step = view === 'months' ? 1 : 12;
  const rows = [];
  let prevInterest = 0, prevWd = 0, prevIdx = 0;
  for (let i = step; i < sim.pts.length; i += step) {
    const p = sim.pts[i], prev = sim.pts[prevIdx];
    let per = 0, perWd = 0;
    for (let j = prevIdx + 1; j <= i; j++) {
      per += sim.pts[j].interest;
      }
    perWd = p.wd - prev.wd;
    rows.push({
      period: view === 'months' ? p.m : p.m / 12,
      bal: p.bal, invested: p.invested,
      gain: per - perWd, take: perWd, wdTotal: p.wd, wdNetTotal: p.wdNet,
    });
    prevIdx = i;
  }
  return rows;
}

// вехи для графика Роста
export function milestones(sim) {
  const out = [];
  const { pts } = sim;
  let x2, x10, m1, flip;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (!x2 && p.invested > 0 && p.bal >= 2 * p.invested) { x2 = p.m; out.push({ m: p.m, label: '×2 от вложенного' }); }
    if (!x10 && p.invested > 0 && p.bal >= 10 * p.invested) { x10 = p.m; out.push({ m: p.m, label: '×10' }); }
    if (!m1 && p.bal >= 1_000_000) { m1 = p.m; out.push({ m: p.m, label: '1 млн' }); }
  }
  // перелом: доход за год > взносов за год
  for (let y = 1; y * 12 < pts.length; y++) {
    let interest = 0, contrib = 0;
    for (let j = (y - 1) * 12 + 1; j <= y * 12; j++) { interest += pts[j].interest; contrib += pts[j].contrib; }
    if (contrib > 0 && interest > contrib) { out.push({ m: y * 12, label: 'доход > взносов' }); flip = true; break; }
  }
  return out.slice(0, 4);
}
