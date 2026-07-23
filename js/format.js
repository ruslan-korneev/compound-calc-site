export function fmt(x) {
  if (!isFinite(x)) return '∞';
  if (Math.abs(x) >= 1e15) return x.toExponential(3).replace('e+', '·10^');
  const opts = Math.abs(x) < 10000 ? { maximumFractionDigits: 2 } : { maximumFractionDigits: 0 };
  return x.toLocaleString('ru-RU', opts);
}

export function fmtShort(x) {
  if (!isFinite(x)) return '∞';
  const a = Math.abs(x);
  if (a >= 1e15) return x.toExponential(1).replace('e+', 'e');
  if (a >= 1e12) return (x / 1e12).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' трлн';
  if (a >= 1e9)  return (x / 1e9).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' млрд';
  if (a >= 1e6)  return (x / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' млн';
  if (a >= 1e3)  return (x / 1e3).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' тыс';
  return x.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
}

export function fmtPct(x, d = 2) {
  return x.toLocaleString('ru-RU', { maximumFractionDigits: d }) + '%';
}
