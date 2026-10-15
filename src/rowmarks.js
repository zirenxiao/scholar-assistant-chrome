// Marks rows of Scholar's own article list: first-author papers and ranking-list tiers.
// Rows are matched to analyzed papers by their citation_for_view id, so "Show more" and re-sorting work.
var SA = globalThis.SA || (globalThis.SA = {});

SA.rowMarks = (() => {
  let info = new Map();   // citation_for_view id -> { position, selfIndex, ranks: [{ rk, p }] }
  let settings = { first: true, corresponding: true, lists: {} };
  let labels = { first: '1st', corresponding: 'Corr.' };
  let observer = null;

  const idOf = (href) => {
    try { return new URL(href, location.origin).searchParams.get('citation_for_view'); } catch { return null; }
  };

  const { badge, rankBadges } = SA.badges; // shared with the search-results marks

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
    SA.badges.ensureStyle();
    watch();
    annotateAll();
  }

  return { update };
})();
