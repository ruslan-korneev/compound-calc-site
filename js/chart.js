// Общий график: линии / area-стек / полоса перцентилей / маркеры / hover
import { fmt, fmtShort } from './format.js';

const W = 960, H = 360, PAD = { l: 74, r: 100, t: 16, b: 34 };

// cfg: { series: [{key,label,color,pts:[{x,y}]}], areaPair: [invKey, balKey] | null,
//        band: {x:[], lo:[], hi:[]} | null, markers: [{x,label}], log, xMax, xLabel }
export function renderChart(host, tipEl, cfg) {
  const { series, log } = cfg;
  const xMax = cfg.xMax ?? Math.max(...series.flatMap(s => s.pts.map(p => p.x)), 1);

  const allY = [
    ...series.flatMap(s => s.pts.map(p => p.y)),
    ...(cfg.band ? [...cfg.band.lo, ...cfg.band.hi] : []),
  ].filter(v => isFinite(v) && (!log || v > 0));
  let vMin = Math.min(...allY), vMax = Math.max(...allY);
  if (!isFinite(vMin)) { vMin = 0; vMax = 1; }
  if (vMax === vMin) vMax = vMin + 1;
  if (!log) vMin = 0;

  const X = x => PAD.l + (x / xMax) * (W - PAD.l - PAD.r);
  const Y = log
    ? (v => { const lo = Math.log10(Math.max(vMin, 1e-9)), hi = Math.log10(vMax);
              return PAD.t + (1 - (Math.log10(Math.max(v, 1e-9)) - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b); })
    : (v => PAD.t + (1 - (v - vMin) / (vMax - vMin)) * (H - PAD.t - PAD.b));

  let ticks = [];
  if (log) {
    const lo = Math.ceil(Math.log10(Math.max(vMin, 1e-9))), hi = Math.floor(Math.log10(vMax));
    const every = Math.max(1, Math.ceil((hi - lo) / 5));
    for (let e = lo; e <= hi; e += every) ticks.push(10 ** e);
    if (!ticks.length) ticks = [vMin, vMax];
  } else {
    const raw = (vMax - vMin) / 5, mag = 10 ** Math.floor(Math.log10(raw || 1));
    const nice = ([1, 2, 2.5, 5, 10].find(k => k * mag >= raw) || 10) * mag;
    for (let v = Math.ceil(vMin / nice) * nice; v <= vMax + 1e-9; v += nice) ticks.push(v);
  }

  const xTickEvery = xMax <= 12 ? 1 : Math.ceil(xMax / 10);
  const path = pts => 'M' + pts.map(p => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('L');

  let s = '';
  for (const v of ticks) {
    const y = Y(v).toFixed(1);
    s += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y}" y2="${y}" stroke="var(--grid)"/>`;
    s += `<text x="${PAD.l - 8}" y="${+y + 4}" text-anchor="end">${fmtShort(v)}</text>`;
  }
  for (let x = 0; x <= xMax; x += xTickEvery)
    s += `<text x="${X(x).toFixed(1)}" y="${H - PAD.b + 18}" text-anchor="middle">${x}</text>`;
  s += `<text x="${W - PAD.r}" y="${H - PAD.b + 18}" dx="10">${cfg.xLabel || 'лет'}</text>`;
  s += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${H - PAD.b}" y2="${H - PAD.b}" stroke="var(--axis)"/>`;

  if (cfg.band) {
    const up = cfg.band.x.map((x, i) => `${X(x).toFixed(1)},${Y(Math.max(cfg.band.hi[i], log ? vMin : 0)).toFixed(1)}`);
    const dn = cfg.band.x.map((x, i) => `${X(x).toFixed(1)},${Y(Math.max(cfg.band.lo[i], log ? vMin : 0)).toFixed(1)}`).reverse();
    s += `<path d="M${up.join('L')}L${dn.join('L')}Z" fill="var(--band)" stroke="none"/>`;
  }

  if (cfg.areaPair) {
    const [aKey, bKey] = cfg.areaPair;
    const a = series.find(x => x.key === aKey), b = series.find(x => x.key === bKey);
    if (a && b) {
      const base = `M${X(a.pts[0].x)},${Y(log ? Math.max(a.pts[0].y, vMin) : 0).toFixed(1)}` +
        a.pts.map(p => `L${X(p.x).toFixed(1)},${Y(Math.max(p.y, log ? vMin : 0)).toFixed(1)}`).join('') +
        `L${X(a.pts[a.pts.length - 1].x).toFixed(1)},${Y(log ? vMin : 0).toFixed(1)}Z`;
      s += `<path d="${base}" fill="${a.color}" opacity="0.25" stroke="none"/>`;
      const up = b.pts.map(p => `${X(p.x).toFixed(1)},${Y(Math.max(p.y, log ? vMin : 0)).toFixed(1)}`);
      const dn = a.pts.map(p => `${X(p.x).toFixed(1)},${Y(Math.max(p.y, log ? vMin : 0)).toFixed(1)}`).reverse();
      s += `<path d="M${up.join('L')}L${dn.join('L')}Z" fill="${b.color}" opacity="0.18" stroke="none"/>`;
    }
  }

  (cfg.markers || []).forEach((m, i) => {
    const x = X(m.x).toFixed(1);
    const ty = PAD.t + 10 + (i % 3) * 14;
    s += `<line x1="${x}" x2="${x}" y1="${PAD.t}" y2="${H - PAD.b}" stroke="var(--axis)" stroke-dasharray="4 4"/>`;
    s += `<text x="${x}" y="${ty}" text-anchor="middle" style="fill:var(--muted)">${m.label}</text>`;
  });

  for (const sr of series)
    s += `<path d="${path(sr.pts)}" fill="none" stroke="${sr.color}" stroke-width="2"/>`;

  const ends = series.map(sr => ({ c: sr.color, v: sr.pts[sr.pts.length - 1]?.y ?? 0 }))
    .map(e => ({ ...e, y: Y(Math.max(e.v, log ? vMin : 0)) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
  for (const e of ends)
    s += `<text class="endlabel" x="${W - PAD.r + 6}" y="${e.y + 4}" style="fill:${e.c}">${fmtShort(e.v)}</text>`;

  s += `<line class="crosshair" y1="${PAD.t}" y2="${H - PAD.b}" stroke="var(--axis)" visibility="hidden"/>`;
  series.forEach((sr, i) => {
    s += `<circle class="dot" data-i="${i}" r="4" fill="${sr.color}" stroke="var(--panel)" stroke-width="2" visibility="hidden"/>`;
  });
  s += `<rect class="hover" x="${PAD.l}" y="${PAD.t}" width="${W - PAD.l - PAD.r}" height="${H - PAD.t - PAD.b}" fill="transparent"/>`;

  host.setAttribute('viewBox', `0 0 ${W} ${H}`);
  host.innerHTML = s;

  const hover = host.querySelector('.hover');
  const cross = host.querySelector('.crosshair');
  const dots = [...host.querySelectorAll('.dot')];
  hover.addEventListener('pointermove', ev => {
    const rect = host.getBoundingClientRect();
    const sx = (ev.clientX - rect.left) * (W / rect.width);
    const xVal = Math.min(xMax, Math.max(0, (sx - PAD.l) / (W - PAD.l - PAD.r) * xMax));
    const rows = [];
    let xShow = xVal;
    series.forEach((sr, i) => {
      let best = sr.pts[0], bd = Infinity;
      for (const p of sr.pts) { const d = Math.abs(p.x - xVal); if (d < bd) { bd = d; best = p; } }
      if (!best) return;
      xShow = best.x;
      dots[i].setAttribute('cx', X(best.x)); dots[i].setAttribute('cy', Y(Math.max(best.y, log ? vMin : 0)));
      dots[i].setAttribute('visibility', 'visible');
      rows.push(`<div class="r"><i class="sw" style="background:${sr.color}"></i>${sr.label}: <b>${fmt(best.y)}</b></div>`);
    });
    const cx = X(xShow);
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    tipEl.innerHTML = `<div class="t">${cfg.tipTitle ? cfg.tipTitle(xShow) : xShow}</div>` + rows.join('');
    tipEl.style.display = 'block';
    const pr = host.parentElement.getBoundingClientRect();
    let left = ev.clientX - pr.left + 16;
    if (left + tipEl.offsetWidth > pr.width - 8) left = ev.clientX - pr.left - tipEl.offsetWidth - 16;
    tipEl.style.left = left + 'px';
    tipEl.style.top = (ev.clientY - pr.top - 10) + 'px';
  });
  hover.addEventListener('pointerleave', () => {
    tipEl.style.display = 'none';
    cross.setAttribute('visibility', 'hidden');
    dots.forEach(d => d.setAttribute('visibility', 'hidden'));
  });
}

export function thinPoints(pts, xKey, yKey, maxN = 600) {
  const stride = Math.max(1, Math.ceil(pts.length / maxN));
  const out = [];
  for (let i = 0; i < pts.length; i += stride) out.push({ x: pts[i][xKey], y: pts[i][yKey] });
  const last = pts[pts.length - 1];
  if (out[out.length - 1]?.x !== last[xKey]) out.push({ x: last[xKey], y: last[yKey] });
  return out;
}
