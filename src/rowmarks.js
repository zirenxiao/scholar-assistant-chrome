// Marks rows of Scholar's own article list: first-author papers and ranking-list tiers.
// Rows are matched to analyzed papers by their citation_for_view id, so "Show more" and re-sorting work.
var SA = globalThis.SA || (globalThis.SA = {});

SA.rowMarks = (() => {
  const STYLE_ID = 'sa-row-style';
  // Lives in the page (not the panel's shadow root), so every class is prefixed.
  const STYLE = `
    #gsc_a_b tr.sa-row-first > td { background-color: #eef4fd; }
    #gsc_a_b .sa-self { font-weight: bold; color: #222; }
    #gsc_a_b .sa-row-badges { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 3px; }
    #gsc_a_b .sa-rb {
      display: inline-block; padding: 0 5px; border: 1px solid; border-radius: 3px;
      font-size: 11px; line-height: 16px; white-space: nowrap; cursor: default;
    }
    #gsc_a_b .sa-rb-first { background: #1a73e8; border-color: #1a73e8; color: #fff; }
    #gsc_a_b .sa-rb-t1 { background: #e8f0fe; border-color: #aecbfa; color: #174ea6; font-weight: bold; }
    #gsc_a_b .sa-rb-t2 { background: #fff; border-color: #aecbfa; color: #1967d2; }
    #gsc_a_b .sa-rb-t3 { background: #fff; border-color: #dadce0; color: #5f6368; }
    #gsc_a_b .sa-rb-warn { background: #fce8e6; border-color: #f5b4ae; color: #c5221f; }
  `;

  let info = new Map();   // citation_for_view id -> { position, selfIndex, ranks: [{ rk, p }] }
  let settings = { first: true, corresponding: true, lists: {} };
  let labels = { first: '1st', corresponding: 'Corr.' };
  let observer = null;

  const idOf = (href) => {
    try { return new URL(href, location.origin).searchParams.get('citation_for_view'); } catch { return null; }
  };

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = STYLE;
    document.head.appendChild(st);
  }

  function badge(text, cls, title) {
    const b = document.createElement('span');
    b.className = `sa-rb ${cls}`;
    b.textContent = text;
    if (title) b.title = title;
    return b;
  }

  // Strongest styling for the list's top tier, lighter for the second, neutral below.
  function tierClass(rk, tierValue) {
    if (rk.kind === 'warning') return 'sa-rb-warn';
    const i = rk.tiers.findIndex((x) => x.value === tierValue);
    return i === 0 ? 'sa-rb-t1' : i === 1 ? 'sa-rb-t2' : 'sa-rb-t3';
  }

  function rankBadges({ rk, p }) {
    const warnFlags = new Set(rk.flags.filter((f) => f.warn).map((f) => f.label));
    const plainFlags = p.flags.filter((f) => !warnFlags.has(f));
    const metric = rk.metric && p.metric != null ? ` · ${rk.metric.label} ${p.metric.toFixed(rk.metric.decimals)}` : '';
    const title = `${rk.name}: ${p.tierLabel}${plainFlags.length ? ` (${plainFlags.join(', ')})` : ''} — ${p.venue}`;
    const out = [badge(`${rk.shortName}-${p.tierLabel}${plainFlags.map((f) => ` ${f}`).join('')}${metric}`, tierClass(rk, p.tier), title)];
    p.flags.filter((f) => warnFlags.has(f)).forEach((f) => out.push(badge(`${rk.shortName}-${f}`, 'sa-rb-warn', `${rk.name}: ${f}`)));
    return out;
  }

  // Bold the owner's name in the byline; the original text is kept to undo it on re-render.
  function markSelf(authorsEl, selfIndex) {
    if (!authorsEl.dataset.saOrig) authorsEl.dataset.saOrig = authorsEl.textContent;
    const names = authorsEl.dataset.saOrig.split(', ');
    if (selfIndex == null || selfIndex < 0 || selfIndex >= names.length) return;
    authorsEl.textContent = '';
    names.forEach((n, i) => {
      if (i) authorsEl.appendChild(document.createTextNode(', '));
      if (i === selfIndex) {
        const b = document.createElement('span');
        b.className = 'sa-self';
        b.textContent = n;
        authorsEl.appendChild(b);
      } else authorsEl.appendChild(document.createTextNode(n));
    });
  }

  function annotateRow(tr) {
    const cell = tr.querySelector('td.gsc_a_t');
    const link = tr.querySelector('.gsc_a_at');
    if (!cell || !link) return;
    cell.querySelectorAll('.sa-row-badges').forEach((e) => e.remove());
    tr.classList.remove('sa-row-first');
    const authorsEl = cell.querySelector('.gs_gray');
    if (authorsEl && authorsEl.dataset.saOrig) authorsEl.textContent = authorsEl.dataset.saOrig;

    const inf = info.get(idOf(link.getAttribute('href') || link.getAttribute('data-href') || ''));
    if (!inf) return;
    // First and corresponding authorship are marked the same way.
    const badges = [];
    const first = settings.first && inf.position === 'first';
    const corresponding = settings.corresponding !== false && inf.corresponding;
    if (first) badges.push(badge(labels.first, 'sa-rb-first'));
    if (corresponding) badges.push(badge(labels.corresponding, 'sa-rb-first'));
    if (first || corresponding) {
      tr.classList.add('sa-row-first');
      if (authorsEl) markSelf(authorsEl, inf.selfIndex);
    }
    inf.ranks.filter(({ rk }) => settings.lists[rk.id] !== false).forEach((r) => badges.push(...rankBadges(r)));
    if (!badges.length) return;
    const box = document.createElement('div');
    box.className = 'sa-row-badges';
    box.append(...badges);
    cell.appendChild(box);
  }

  function annotateAll() {
    document.querySelectorAll('#gsc_a_b tr.gsc_a_tr').forEach(annotateRow);
  }

  // Scholar appends rows on "Show more" and replaces them when sorting; only direct
  // children are watched, so our own edits inside cells don't retrigger this.
  // (MutationObserver already batches; requestAnimationFrame would stall in background tabs.)
  function watch() {
    const body = document.querySelector('#gsc_a_b');
    if (!body || observer) return;
    observer = new MutationObserver((records) => {
      records.forEach((rec) => rec.addedNodes.forEach((n) => {
        if (n.nodeType === 1 && n.matches('tr.gsc_a_tr')) annotateRow(n);
      }));
    });
    observer.observe(body, { childList: true });
  }

  /** result: stats.analyze output; opts: { settings, firstLabel }. */
  function update(result, opts = {}) {
    if (opts.settings) settings = opts.settings;
    if (opts.firstLabel) labels.first = opts.firstLabel;
    if (opts.correspondingLabel) labels.corresponding = opts.correspondingLabel;
    info = new Map();
    if (result) {
      result.papers.forEach((p) => {
        const id = idOf(p.link);
        if (id) info.set(id, { position: p.position, selfIndex: p.selfIndex, corresponding: p.corresponding, ranks: [] });
      });
      result.rankings.forEach((rk) => rk.papers.forEach((p) => {
        const inf = info.get(idOf(p.link));
        if (inf) inf.ranks.push({ rk, p });
      }));
    }
    ensureStyle();
    watch();
    annotateAll();
  }

  return { update };
})();
