import { loadState, saveState } from './state.js';
import { renderEditor } from './editor.js';
import * as growth from './tools/growth.js';
import * as compare from './tools/compare.js';
import * as goal from './tools/goal.js';

const TOOLS = {
  growth:  { title: '📈 Рост',            mod: growth },
  compare: { title: '⚖️ Сравнение',       mod: compare },
  goal:    { title: '🎯 Цель',            mod: goal },
  passive: { title: '🏖 Пассивный доход', mod: null },
  fan:     { title: '🎲 Веер',            mod: null },
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

renderNav();
renderEditor(editorRoot, ctx.scenario, onScenarioChange);
TOOLS[ctx.tool].mod.render(toolRoot, ctx);
saveState(ctx.tool, ctx.scenario);

export { ctx, onScenarioChange, TOOLS, toolRoot, renderNav };
