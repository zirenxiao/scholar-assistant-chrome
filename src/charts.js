// Minimal dependency-free SVG/HTML charts with hover tooltips.
var SA = globalThis.SA || (globalThis.SA = {});

SA.charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs = {}, ns) {
    const e = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.setAttribute('class', v);
      else e.setAttribute(k, v);
    }
    return e;
  }

  function niceMax(v) {
    if (v <= 0) return 1;
    const mag = 10 ** Math.floor(Math.log10(v));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * mag >= v) return m * mag;
    return 10 * mag;
  }

  const fmt = (n) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(Math.round(n)));

  // Bar with 4px rounded top, flat on the baseline.
  function barPath(x, y, w, h) {
    const r = Math.min(4, w / 2, h);
    if (h <= 0) return '';
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  /**
   * Vertical bar chart. data: [{ label, value, tip? }]
   * Returns a wrapper element containing the SVG and its tooltip.
   */
  function barChart(data, { height = 140, unit = '', width = 300 } = {}) {
    const wrap = el('div', { class: 'sa-chart' });
    if (!data.length) return wrap;
    const W = width, H = height, padL = 34, padR = 4, padT = 8, padB = 20;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const max = niceMax(Math.max(...data.map((d) => d.value)));
    const step = plotW / data.length;
    const gap = data.length > 40 ? 1 : 2;
    const bw = Math.max(1, step - gap);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'sa-svg', role: 'img' }, NS);

    for (let i = 0; i <= 2; i++) {
      const v = (max * i) / 2;
      const y = padT + plotH - (plotH * i) / 2;
      svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: y, y2: y, class: i ? 'sa-gridline' : 'sa-axis' }, NS));
      svg.appendChild(el('text', { x: padL - 6, y: y + 3, 'text-anchor': 'end', class: 'sa-tick', text: fmt(v) }, NS));
    }

    const labelEvery = Math.ceil(data.length / Math.max(3, Math.floor(plotW / 42)));
    const bars = [];
    data.forEach((d, i) => {
      const x = padL + i * step + gap / 2;
      const h = (d.value / max) * plotH;
      const bar = el('path', { d: barPath(x, padT + plotH - h, bw, h), class: 'sa-bar' }, NS);
      svg.appendChild(bar);
      bars.push(bar);
      if ((data.length - 1 - i) % labelEvery === 0) {
        svg.appendChild(el('text', { x: x + bw / 2, y: H - 6, 'text-anchor': 'middle', class: 'sa-tick', text: d.label }, NS));
      }
      const hit = el('rect', { x: padL + i * step, y: padT, width: step, height: plotH, class: 'sa-hit' }, NS);
      hit.addEventListener('mouseenter', () => {
        svg.classList.add('sa-hovering');
        bar.classList.add('sa-active');
        tip.innerHTML = '';
        tip.appendChild(el('div', { class: 'sa-tip-title', text: d.label }));
        tip.appendChild(el('div', { text: `${d.value.toLocaleString()} ${unit}`.trim() }));
        if (d.tip) tip.appendChild(el('div', { class: 'sa-tip-sub', text: d.tip }));
        tip.style.display = 'block';
        const frac = (padL + i * step + step / 2) / W;
        tip.style.left = `${frac * 100}%`;
        tip.style.transform = `translateX(${frac > 0.7 ? '-100%' : frac < 0.3 ? '0' : '-50%'})`;
      });
      hit.addEventListener('mouseleave', () => {
        svg.classList.remove('sa-hovering');
        bar.classList.remove('sa-active');
        tip.style.display = 'none';
      });
      svg.appendChild(hit);
    });

    const tip = el('div', { class: 'sa-tip' });
    wrap.append(svg, tip);
    return wrap;
  }

  /** Horizontal labelled bars. data: [{ label, value, valueText?, sub? }] */
  function hbars(data) {
    const wrap = el('div', { class: 'sa-hbars' });
    const max = Math.max(1, ...data.map((d) => d.value));
    data.forEach((d) => {
      const row = el('div', { class: 'sa-hbar-row' });
      const label = el('div', { class: 'sa-hbar-label', text: d.label, title: d.label });
      const track = el('div', { class: 'sa-hbar-track' });
      const fill = el('div', { class: 'sa-hbar-fill' });
      fill.style.width = `${(d.value / max) * 100}%`;
      track.appendChild(fill);
      const val = el('div', { class: 'sa-hbar-value', text: d.valueText ?? d.value.toLocaleString() });
      row.append(label, track, val);
      if (d.sub) row.title = d.sub;
      wrap.appendChild(row);
    });
    return wrap;
  }

  return { barChart, hbars, el };
})();
