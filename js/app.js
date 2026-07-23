import { loadState, saveState } from './state.js';
import { renderEditor } from './editor.js';
import * as growth from './tools/growth.js';
import * as compare from './tools/compare.js';
import * as goal from './tools/goal.js';
import * as passive from './tools/passive.js';
import * as fan from './tools/fan.js';

const TOOLS = {
  growth:  { title: '📈 Рост',            mod: growth },
  compare: { title: '⚖️ Сравнение',       mod: compare },
  goal:    { title: '🎯 Цель',            mod: goal },
  passive: { title: '🏖 Пассивный доход', mod: passive },
  fan:     { title: '🎲 Веер',            mod: fan },
};

const st = loadState();
const ctx = { scenario: st.scenario, tool: TOOLS[st.tool] ? st.tool : 'growth' };

const nav = document.getElementById('nav');
const toolRoot = document.getElementById('tool');
const editorRoot = document.getElementById('editor');

function renderNav() {
  nav.innerHTML = Object.entries(TOOLS).map(([id, t]) =>
    `<button type="button" data-t="${id}" class="${id === ctx.tool ? 'on' : ''} ${t.mod ? '' : 'soon'}">${t.title}${t.mod ? '' : ' <small>скоро</small>'}</button>`
  ).join('');
}
nav.addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b) return;
  const t = b.dataset.t;
  if (!TOOLS[t].mod) return;
  ctx.tool = t;
  renderNav();
  TOOLS[t].mod.render(toolRoot, ctx);
  saveState(ctx.tool, ctx.scenario);
});

function onScenarioChange() {
  const t = TOOLS[ctx.tool];
  if (t.mod?.update) t.mod.update(toolRoot, ctx);
  else if (t.mod) t.mod.render(toolRoot, ctx);
  saveState(ctx.tool, ctx.scenario);
}

// ручная тема: auto -> dark -> light
const THEME_KEY = 'ccalc-theme';
const themeBtn = document.getElementById('themeBtn');
function applyTheme(t) {
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  themeBtn.textContent = { auto: '◐', dark: '🌙', light: '☀️' }[t];
  themeBtn.title = 'Тема: ' + { auto: 'системная', dark: 'тёмная', light: 'светлая' }[t];
}
let theme = localStorage.getItem(THEME_KEY) || 'auto';
applyTheme(theme);
themeBtn.addEventListener('click', () => {
  theme = { auto: 'dark', dark: 'light', light: 'auto' }[theme];
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
});

if ('serviceWorker' in navigator && location.protocol === 'https:')
  navigator.serviceWorker.register('sw.js').catch(() => {});

renderNav();
renderEditor(editorRoot, ctx.scenario, onScenarioChange);
TOOLS[ctx.tool].mod.render(toolRoot, ctx);
saveState(ctx.tool, ctx.scenario);

export { ctx, onScenarioChange, TOOLS, toolRoot, renderNav };
