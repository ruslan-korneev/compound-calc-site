// URL-hash + localStorage + пресеты
import { defaultScenario } from './model.js';

const LS_KEY = 'ccalc-state-v1';

export const PRESETS = [
  { name: 'GRAM-фарм (0.0275% / 18ч)', patch: { rates: [{ years: 40, ratePct: 0.0275, period: '18' }] } },
  { name: 'TON staking ~14% APY',      patch: { rates: [{ years: 40, ratePct: 14, period: 'year' }] } },
  { name: 'Стейблы ~6% APY',           patch: { rates: [{ years: 40, ratePct: 6, period: 'year' }] } },
  { name: 'S&P 500 ~10% APY',          patch: { rates: [{ years: 40, ratePct: 10, period: 'year' }] } },
  { name: 'Банк ~4% APY',              patch: { rates: [{ years: 40, ratePct: 4, period: 'year' }] } },
  { name: 'DeFi реалистичный (14% → 6% с года 6)', patch: { rates: [
      { years: 5, ratePct: 14, period: 'year' }, { years: 35, ratePct: 6, period: 'year' }] } },
];

function encode(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(s) {
  try {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(s))));
  } catch { return null; }
}

export function loadState() {
  const h = location.hash.slice(1);
  const [tool, q] = h.split('?s=');
  let sc = null;
  if (q) sc = decode(q);
  if (!sc) {
    try { sc = JSON.parse(localStorage.getItem(LS_KEY) || 'null')?.scenario; } catch {}
  }
  const scenario = Object.assign(defaultScenario(), sc || {});
  scenario.contrib = Object.assign(defaultScenario().contrib, scenario.contrib || {});
  if (!Array.isArray(scenario.rates) || !scenario.rates.length) scenario.rates = defaultScenario().rates;
  if (!Array.isArray(scenario.events)) scenario.events = [];
  return { tool: tool || 'growth', scenario };
}

let saveTimer = null;
export function saveState(tool, scenario) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const hash = `${tool}?s=${encode(scenario)}`;
    history.replaceState(null, '', '#' + hash);
    try { localStorage.setItem(LS_KEY, JSON.stringify({ scenario })); } catch {}
  }, 250);
}

// список сохранённых сценариев для Сравнения
const CMP_KEY = 'ccalc-compare-v1';
export function loadCompareList() {
  try { return JSON.parse(localStorage.getItem(CMP_KEY) || '[]'); } catch { return []; }
}
export function saveCompareList(list) {
  try { localStorage.setItem(CMP_KEY, JSON.stringify(list.slice(0, 4))); } catch {}
}
