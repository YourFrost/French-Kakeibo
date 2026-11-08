// Graphiques SVG/HTML légers et animés. Les rendus sont "à l'état initial" ;
// kick() déclenche ensuite les animations (anneaux, barres, courbes, compteurs).
import { TYPES, TYPE_KEYS, eur } from './calc.js';

/** Anneau multi-segments. parts: [{ v: fraction 0-1, color }] */
export function ring(parts, { size = 220, stroke = 14, over = false, children = '' } = {}) {
  let off = 0;
  const segs = parts.filter(p => p.v > 0).map(p => {
    const len = Math.min(p.v * 100, 100 - off);
    const s = `<circle class="seg" cx="50" cy="50" r="42" pathLength="100" stroke="${over ? 'var(--bad)' : p.color}"
      stroke-width="${stroke / size * 100}" stroke-dasharray="0 100" stroke-dashoffset="${-off}" data-dash="${len.toFixed(3)} ${(100 - len).toFixed(3)}"/>`;
    off += len; return s;
  }).join('');
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" pathLength="100" class="track" stroke-width="${stroke / size * 100}"/>${segs}</svg>
    <div class="ring-in">${children}</div></div>`;
}

/** Barre horizontale empilée. parts: [{ v, color, label }] */
export function stackBar(parts) {
  const total = parts.reduce((t, p) => t + Math.max(0, p.v), 0) || 1;
  return `<div class="hbar">${parts.filter(p => p.v > 0).map(p =>
    `<span style="background:${p.color}" data-w="${(p.v / total * 100).toFixed(2)}%"></span>`).join('')}</div>`;
}

/** Barres journalières empilées par type. */
export function bars(daily) {
  const W = 300, H = 110, n = daily.length, gap = 2, bw = (W - gap * (n - 1)) / n;
  const tot = daily.map(d => d.besoin + d.plaisir + d.imprevu);
  const max = Math.max(...tot, 1);
  const g = daily.map((d, i) => {
    let y = H;
    const rects = TYPE_KEYS.map(t => {
      const h = d[t] / max * (H - 6);
      if (!h) return '';
      y -= h;
      return `<rect x="${(i * (bw + gap)).toFixed(2)}" y="${y.toFixed(2)}" width="${bw.toFixed(2)}" height="${h.toFixed(2)}" fill="${TYPES[t].color}" rx="${Math.min(3, bw / 2)}"/>`;
    }).join('');
    const stub = tot[i] ? '' : `<rect x="${(i * (bw + gap)).toFixed(2)}" y="${H - 2}" width="${bw.toFixed(2)}" height="2" rx="1" fill="var(--line)"/>`;
    return `<g class="bar" style="transition-delay:${i * 16}ms">${rects}${stub}</g>`;
  }).join('');
  const lab = [1, Math.ceil(n / 4), Math.ceil(n / 2), Math.ceil(n * 3 / 4), n];
  return `<svg class="bars" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${g}</svg>
    <div class="axis">${lab.map(l => `<span>${l}</span>`).join('')}</div>`;
}

/** Courbe cumulée vs rythme idéal. */
export function line(cumulative, budget, day) {
  const W = 300, H = 120, n = cumulative.length;
  const pts = cumulative.slice(0, Math.max(day, 1));
  const max = Math.max(budget, ...pts, 1) * 1.08;
  const x = i => i / (n - 1) * W, y = v => H - v / max * H;
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const last = pts.length - 1;
  const area = `${d} L${x(last).toFixed(1)} ${H} L0 ${H} Z`;
  const over = pts[last] > budget;
  const col = over ? 'var(--bad)' : 'var(--accent)';
  return `<svg class="linechart" viewBox="0 0 ${W} ${H + 4}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    <line x1="0" y1="${y(budget)}" x2="${W}" y2="${y(budget)}" class="budget-line"/>
    <line x1="0" y1="${H}" x2="${W}" y2="${y(budget)}" class="pace-line"/>
    <path d="${area}" fill="url(#lg)" class="area"/>
    <path d="${d}" class="draw" pathLength="1" stroke="${col}" fill="none"/>
    <circle cx="${x(last)}" cy="${y(pts[last])}" r="3.6" fill="${col}" class="dot"/>
  </svg>`;
}

export function legend(byType, total) {
  return `<ul class="legend">${TYPE_KEYS.map(t => `<li><i style="background:${TYPES[t].color}"></i><span>${TYPES[t].label}</span>
    <b>${eur(byType[t])}</b><small>${total ? Math.round(byType[t] / total * 100) : 0} %</small></li>`).join('')}</ul>`;
}

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = t => 1 - Math.pow(1 - t, 3);

/** Déclenche toutes les animations présentes dans `root`. */
export function kick(root) {
  const run = () => {
    root.querySelectorAll('[data-dash]').forEach(c => { c.style.strokeDasharray = c.dataset.dash; });
    root.querySelectorAll('[data-w]').forEach(s => { s.style.width = s.dataset.w; });
    root.querySelectorAll('.bar, .draw, .area, .dot, .pbar > i').forEach(e => e.classList.add('go'));
    root.querySelectorAll('.pbar > i[data-p]').forEach(e => { e.style.width = e.dataset.p; });
  };
  root.querySelectorAll('[data-count]').forEach(el => {
    const to = parseFloat(el.dataset.count) || 0;
    if (reduce()) { el.textContent = eur(to); return; }
    const t0 = performance.now(), dur = 900;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = eur(to * ease(k));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  if (reduce()) { root.querySelectorAll('[data-dash]').forEach(c => { c.style.transition = 'none'; }); }
  requestAnimationFrame(() => requestAnimationFrame(run));
}
