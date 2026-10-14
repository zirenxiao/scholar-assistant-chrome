// Appends the statistics block to the "Cited by" box of a Google Scholar profile page.
(() => {
  const { scraper, stats, charts, i18n } = SA;
  const { el } = charts;
  const t = i18n.t;

  if (!scraper.isProfilePage()) return;
  const userId = scraper.getUserId();

  const state = {
    open: true,
    tab: 'overview',
    data: null,       // { profile, papers, partial, error }
    result: null,     // stats.analyze output
    selfOverride: '',
    loading: 0,
    error: null,
    rankingLists: [], // matchers from rankings.js (one per list in the index), resolved for this scholar
    rankingId: '',    // selected list
    rankTier: '',     // tier filter in the paper list ('' = all)
    rankShowAll: false,
    rowMarks: { first: true, corresponding: true, lists: {} }, // what to mark in Scholar's article list; lists[id] === false hides one
  };
  const RANK_PREVIEW = 30;
  // Opened up front so its small meta/abbreviation files load while papers are fetched.
  const rankIndex = SA.rankings.openPackagedIndex();

  // ---- persistence (language, selected ranking list, row marks, per-scholar name override) ----
  const store = {
    get: (keys) => new Promise((r) => { try { chrome.storage.local.get(keys, r); } catch { r({}); } }),
    set: (obj) => { try { chrome.storage.local.set(obj); } catch { /* extension reloaded */ } },
  };

  // ---- shell ----
  // Shadow DOM keeps our styles isolated; fonts and colors still inherit from Scholar.
  const host = el('div', { id: 'scholar-assistant-root' });
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.appendChild(el('link', { rel: 'stylesheet', href: chrome.runtime.getURL('src/panel.css') }));
  const panel = el('div', { class: 'sa-panel' });
  shadow.append(panel);
  const citedBy = document.querySelector('#gsc_rsb_cit');
  if (citedBy) citedBy.appendChild(host);
  else document.querySelector('#gsc_a_b')?.closest('form, div')?.before(host);

  // Always starts expanded; collapsing only lasts for the current page.
  function setOpen(open) {
    state.open = open;
    render();
  }

  const activeRanking = (r) => r.rankings.find((x) => x.id === state.rankingId) || r.rankings[0];

  // ---- formatting ----
  const num = (n, d = 0) => (n == null || Number.isNaN(n) ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }));
  // Charts are drawn in CSS pixels so axis text stays legible in the narrow sidebar.
  const chartWidth = () => Math.max(240, Math.round(panel.clientWidth || 300));
  const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`);

  function tile(label, value, sub, extraClass = '') {
    const d = el('div', { class: `sa-tile ${extraClass}`.trim() });
    d.append(el('div', { class: 'sa-tile-label', text: label }), el('div', { class: 'sa-tile-value', text: value }));
    if (sub) d.appendChild(el('div', { class: 'sa-tile-sub', text: sub }));
    return d;
  }

  function section(title, ...children) {
    const s = el('section', { class: 'sa-section' });
    if (title) s.appendChild(el('h3', { text: title }));
    s.append(...children.filter(Boolean));
    return s;
  }

  function grid(...tiles) {
    const g = el('div', { class: 'sa-grid' });
    g.append(...tiles.filter(Boolean));
    return g;
  }

  function note(text) {
    return el('p', { class: 'sa-note', text });
  }

  function table(headers, rows, numericFrom = 1) {
    const tbl = el('table', { class: 'sa-table' });
    const thead = el('thead');
    const hr = el('tr');
    headers.forEach((h, i) => hr.appendChild(el('th', { text: h, class: i >= numericFrom ? 'num' : '' })));
    thead.appendChild(hr);
    const tbody = el('tbody');
    rows.forEach((r) => {
      const tr = el('tr');
      r.forEach((c, i) => tr.appendChild(el('td', { text: c, class: i >= numericFrom ? 'num' : '', title: i === 0 ? c : '' })));
      tbody.appendChild(tr);
    });
    tbl.append(thead, tbody);
    return tbl;
  }

  // ---- tabs ----
  function renderOverview(r) {
    const b = r.basic;
    const off = state.data.profile.official;
    const now = new Date().getFullYear();
    const growth = b.citesGrowth == null ? '' : t('growth', { v: `${b.citesGrowth >= 0 ? '+' : ''}${(b.citesGrowth * 100).toFixed(0)}%` });
    const histYears = Object.keys(state.data.profile.citationHistogram).map(Number);
    const histFrom = histYears.length ? Math.min(...histYears) : Infinity;
    const yearsWithCites = r.perYear.filter((y) => y.year >= histFrom);
    return [
      grid(
        tile(t('papers'), num(b.papers)),
        tile(t('citations'), num(b.citations)),
        ...r.rankings.map((rk) => rankingTile(rk, b.papers)),
        tile(t('hIndex'), num(b.h)),
        tile(t('gIndex'), num(b.g)),
        tile(t('i10'), num(b.i10)),
        tile(t('eIndex'), num(b.e, 1)),
        tile(t('age'), b.age ? t('years', { n: b.age }) : '—', b.firstYear ? t('since', { y: b.firstYear }) : ''),
        tile(t('mIndex'), num(b.m, 2)),
        tile(t('papersPerYear'), num(b.papersPerYear, 1)),
        tile(t('meanCites'), num(b.meanCites, 1)),
        tile(t('medianCites'), num(b.medianCites, 1)),
        tile(t('maxCites'), num(b.maxCites), pct(b.topShare)),
        tile(t('uncited'), num(b.uncited), b.papers ? pct(b.uncited / b.papers) : ''),
        tile(t('hCoreShare'), pct(b.hCoreShare)),
        tile(t('recentPapers'), num(b.recentPapers), b.papers ? pct(b.recentPapers / b.papers) : ''),
        tile(t('recentCites'), num(b.recentCites), pct(b.recentCitesShare)),
        tile(t('citesLastYear', { y: now - 1 }), num(b.citesLastYear), growth),
      ),
      off ? note(t('officialNote', { c: num(off.citations), h: off.h, i: off.i10 })) : null,
      section(t('chartCitesPerYear'), charts.barChart(
        yearsWithCites.map((y) => ({ label: String(y.year), value: y.citesReceived })), { width: chartWidth(), unit: t('citesUnit') })),
      section(t('chartPapersPerYear'), charts.barChart(
        r.perYear.filter((y) => !b.firstYear || y.year >= b.firstYear).map((y) => ({
          label: String(y.year), value: y.papers, tip: t('citesOfPapers', { n: y.citesOfPapers.toLocaleString() }),
        })), { width: chartWidth(), unit: t('papersUnit') })),
      section(t('chartBuckets'), charts.hbars(r.buckets.map((x) => ({
        label: x.label, value: x.count, valueText: `${x.count} · ${pct(x.count / (b.papers || 1))}`,
      })))),
    ];
  }

  // One overview tile per ranking list: tier counts for rankings, a total for warning lists.
  function rankingTile(rk, papers) {
    const share = pct(papers ? rk.total / papers : 0);
    if (rk.kind === 'warning') {
      return tile(t('warnTile', { s: rk.shortName }), num(rk.total), rk.total ? t('warnShare', { p: share }) : t('warnNone'), rk.total ? 'sa-tile-warn' : '');
    }
    return tile(`${rk.shortName} ${rk.tiers.map((x) => x.label).join('/')}`, rk.tiers.map((x) => x.count).join(' / '),
      t('rankedShare', { n: rk.total, p: share }));
  }

  // Ranking lists and warning lists share a layout but not their wording.
  const rankText = (rk, key, vars) => t(rk.kind === 'warning' ? key.replace(/^rank/, 'warn') : key, vars);

  function renderAuthorship(r) {
    const a = r.authorship;
    const g = a.groups;
    const sub = (x) => t('citesH', { c: num(x.citations), h: x.h });
    const n = r.basic.papers || 1;

    const input = el('input', { class: 'sa-input', type: 'text', value: state.selfOverride || r.selfKey.replace(/\b\w/g, (c) => c.toUpperCase()), spellcheck: 'false' });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      state.selfOverride = input.value.trim();
      store.set({ [`self:${userId}`]: state.selfOverride });
      analyze();
    });
    const nameRow = el('label', { class: 'sa-field' });
    nameRow.append(el('span', { text: t('selfName') }), input, el('span', { class: 'sa-field-hint', text: t('selfNameHint') }));

    const posRows = [
      ['posFirst', g.first], ['posLast', g.last], ['posMiddle', g.middle],
      ['posHidden', g.hidden], ['posUnmatched', g.unmatched],
    ].filter(([k, x]) => x.count > 0 || !['posHidden', 'posUnmatched'].includes(k));
    const distKeys = Object.keys(a.positionDist).sort((x, y) => parseInt(x, 10) - parseInt(y, 10));

    return [
      nameRow,
      grid(
        tile(t('posFirst'), num(g.first.count), sub(g.first)),
        tile(t('posLast'), num(g.last.count), sub(g.last)),
        tile(t('posCorresponding'), num(a.corresponding.count), sub(a.corresponding)),
        tile(t('meanAuthors'), num(a.meanAuthors, 1)),
        tile(t('medianAuthors'), num(a.medianAuthors, 1)),
      ),
      section(t('chartPositions'), charts.hbars(posRows.map(([k, x]) => ({
        label: t(k), value: x.count, valueText: `${x.count} · ${pct(x.count / n)}`, sub: sub(x),
      })))),
      section(t('chartPositionIndex'), charts.barChart(
        distKeys.map((k) => ({ label: k, value: a.positionDist[k], tip: t('positionNth', { n: k }) })), { width: chartWidth(), unit: t('papersUnit'), height: 120 })),
      note(`${t('soleNote')} ${t('corrNote')}`),
      a.truncatedCount ? note(t('authorNote', { n: a.truncatedCount })) : null,
    ];
  }

  const TYPE_KEYS = { journal: 'typeJournal', conference: 'typeConference', preprint: 'typePreprint', patent: 'typePatent', thesis: 'typeThesis', book: 'typeBook', other: 'typeOther', unknown: 'typeUnknown' };
  const yearSpan = (a, b) => (a ? (a === b ? String(a) : `${a}–${b}`) : '—');

  function renderVenues(r) {
    const v = r.venues;
    const n = r.basic.papers || 1;
    const types = Object.entries(v.types).sort((a, b) => b[1].count - a[1].count);
    return [
      grid(
        tile(t('distinctVenues'), num(v.distinct)),
        ...types.slice(0, 2).map(([k, x]) => tile(t(TYPE_KEYS[k]), num(x.count), pct(x.count / n))),
      ),
      section(t('chartTypes'), charts.hbars(types.map(([k, x]) => ({
        label: t(TYPE_KEYS[k]), value: x.count, valueText: `${x.count} · ${pct(x.count / n)}`,
        sub: `${t('cites')}: ${num(x.citations)}`,
      })))),
      section(t('topVenues', { n: v.top.length }), v.top.length
        ? table([t('venue'), t('count'), t('cites'), t('yearRange')],
          v.top.map((x) => [x.name, num(x.count), num(x.citations), yearSpan(x.firstYear, x.lastYear)]))
        : note(t('empty'))),
      note(t('venueNote')),
    ];
  }

  function renderCoauthors(r) {
    const c = r.coauthors;
    return [
      grid(
        tile(t('distinctCoauthors'), num(c.distinct)),
        tile(t('repeatCoauthors'), num(c.repeat)),
        tile(t('collaborativeShare'), pct(c.collaborativeShare)),
      ),
      section(t('topCoauthors', { n: Math.min(10, c.top.length) }), c.top.length
        ? charts.hbars(c.top.slice(0, 10).map((x) => ({
          label: x.name, value: x.count,
          valueText: String(x.count),
          sub: `${t('jointCites')}: ${num(x.citations)} · ${yearSpan(x.firstYear, x.lastYear)}`,
        })))
        : note(t('empty'))),
      c.top.length ? section(t('topCoauthors', { n: c.top.length }), table([t('coauthor'), t('jointPapers'), t('jointCites'), t('yearRange')],
        c.top.map((x) => [x.name, num(x.count), num(x.citations), yearSpan(x.firstYear, x.lastYear)]))) : null,
      note(t('coauthorNote')),
    ];
  }

  const POSITION_KEYS = { first: 'posFirst', last: 'posLast', middle: 'posMiddle' };
  const SMALL_WORDS = new Set(['of', 'and', 'the', 'in', 'on', 'for', 'a', 'an', 'to', 'at', 'with']);
  const ACRONYMS = new Set(['ieee', 'acm', 'iet', 'siam', 'ieice', 'ifac', 'aiaa', 'asme', 'bmc', 'plos', 'jama', 'bmj']);
  // JCR-style lists spell names in ALL CAPS; show "IEEE Transactions on Robotics" instead.
  const displayName = (name) => (name !== name.toUpperCase() ? name : name.toLowerCase().replace(/[a-z]+/g, (w, i) => {
    if (ACRONYMS.has(w)) return w.toUpperCase();
    return i > 0 && SMALL_WORDS.has(w) ? w : w[0].toUpperCase() + w.slice(1);
  }));

  // Checkboxes for what to highlight in Scholar's own article list.
  function renderRowMarkSettings(r) {
    const box = el('div', { class: 'sa-checks' });
    const check = (label, checked, onChange) => {
      const row = el('label', { class: 'sa-check' });
      const input = el('input', { type: 'checkbox' });
      input.checked = checked;
      input.addEventListener('change', () => onChange(input.checked));
      row.append(input, document.createTextNode(label));
      box.appendChild(row);
    };
    check(t('firstShort'), state.rowMarks.first, (v) => setRowMark((m) => { m.first = v; }));
    check(t('corrShort'), state.rowMarks.corresponding !== false, (v) => setRowMark((m) => { m.corresponding = v; }));
    r.rankings.forEach((rk) => check(rk.name, state.rowMarks.lists[rk.id] !== false,
      (v) => setRowMark((m) => { m.lists[rk.id] = v; })));
    return section(t('rowMarks'), box);
  }

  function renderRankings(r) {
    const rk = activeRanking(r);
    if (!rk) return [note(t('rankNone'))];
    const n = r.basic.papers || 1;
    const out = [];

    if (r.rankings.length > 1) {
      const select = el('select', { class: 'sa-select' });
      r.rankings.forEach((x) => {
        const o = el('option', { value: x.id, text: x.name });
        o.selected = x.id === rk.id;
        select.appendChild(o);
      });
      select.addEventListener('change', () => {
        state.rankingId = select.value;
        state.rankTier = '';
        store.set({ rankingId: select.value });
        render();
      });
      const field = el('label', { class: 'sa-field' });
      field.append(el('span', { text: t('rankList') }), select);
      out.push(field);
    } else {
      out.push(el('div', { class: 'sa-field', text: rk.name }));
    }

    out.push(grid(
      tile(rankText(rk, 'rankTotal'), num(rk.total), pct(rk.total / n), rk.kind === 'warning' && rk.total ? 'sa-tile-warn' : ''),
      tile(rankText(rk, 'rankCites'), num(rk.citations), pct(r.basic.citations ? rk.citations / r.basic.citations : 0)),
      ...rk.tiers.map((x) => tile(`${rk.shortName}-${x.label}`, num(x.count), t('rankTierSub', { f: x.firstAuthor, c: num(x.citations) }))),
      rk.metric ? tile(t('metricMean', { l: rk.metric.label }), num(rk.metric.mean, rk.metric.decimals),
        t('metricMax', { v: num(rk.metric.max, rk.metric.decimals) })) : null,
      ...rk.flags.map((f) => tile(t('flagTile', { f: f.label }), num(f.count), pct(f.count / n), f.warn && f.count ? 'sa-tile-warn' : '')),
    ));

    out.push(section(rankText(rk, 'rankDist'), charts.hbars(rk.tiers.map((x) => ({
      label: `${rk.shortName}-${x.label}`, value: x.count,
      valueText: `${x.count} · ${pct(x.count / n)}`,
      sub: t('rankTierDetail', { j: x.journal, c: x.conference, h: x.h }),
    })))));

    // Paper list with a tier filter.
    const filter = el('div', { class: 'sa-chips' });
    // Filter values: '' (all), a tier value, or "flag:<label>".
    [['', t('rankAll')], ...rk.tiers.map((x) => [x.value, `${x.label} (${x.count})`]),
      ...rk.flags.filter((f) => f.count).map((f) => [`flag:${f.label}`, `${f.label} (${f.count})`])].forEach(([v, label]) => {
      const chip = el('button', { type: 'button', class: `sa-chip${state.rankTier === v ? ' sa-chip-active' : ''}`, text: label });
      chip.addEventListener('click', () => { state.rankTier = v; state.rankShowAll = false; render(); });
      filter.appendChild(chip);
    });
    const list = rk.papers.filter((p) => !state.rankTier || p.tier === state.rankTier
      || (state.rankTier.startsWith('flag:') && p.flags.includes(state.rankTier.slice(5))));
    const shown = state.rankShowAll ? list : list.slice(0, RANK_PREVIEW);
    const ul = el('ul', { class: 'sa-papers' });
    shown.forEach((p) => {
      const li = el('li');
      const a = el('a', { href: p.link, text: p.title, target: '_blank', rel: 'noopener' });
      const meta = el('div', { class: 'sa-paper-meta', title: displayName(p.venue) });
      const warnFlags = new Set(rk.flags.filter((f) => f.warn).map((f) => f.label));
      meta.append(
        el('span', { class: `sa-badge${rk.kind === 'warning' ? ' sa-badge-warn' : ''}`, text: `${rk.shortName}-${p.tierLabel}` }),
        ...p.flags.map((f) => el('span', { class: `sa-badge${warnFlags.has(f) ? ' sa-badge-warn' : ''}`, text: f })),
        document.createTextNode([p.abbr || displayName(p.venue), p.year,
          rk.metric && p.metric != null ? `${rk.metric.label} ${num(p.metric, rk.metric.decimals)}` : '',
          `${num(p.citations)} ${t('citesUnit')}`,
          POSITION_KEYS[p.position] ? t(POSITION_KEYS[p.position]) : '',
          p.corresponding ? t('posCorresponding') : ''].filter(Boolean).join(' · ')),
      );
      li.append(a, meta);
      ul.appendChild(li);
    });
    const parts = [filter, list.length ? ul : note(t('empty'))];
    if (list.length > shown.length) {
      const more = el('button', { type: 'button', class: 'sa-btn sa-more', text: t('showMore', { n: list.length - shown.length }) });
      more.addEventListener('click', () => { state.rankShowAll = true; render(); });
      parts.push(more);
    }
    out.push(section(rankText(rk, 'rankPapers'), ...parts));
    out.push(renderRowMarkSettings(r));
    out.push(note(t('rankNote')));
    return out;
  }

  // A tab label is an i18n key, or a function of the analysis result.
  const TABS = [
    ['overview', 'tabOverview', renderOverview],
    ['authorship', 'tabAuthorship', renderAuthorship],
    ['venues', 'tabVenues', renderVenues],
    ['coauthors', 'tabCoauthors', renderCoauthors],
    ['rankings', (r) => activeRanking(r)?.shortName || t('tabRankings'), renderRankings],
  ];

  // ---- render ----
  function render() {
    panel.innerHTML = '';

    const header = el('div', { class: 'sa-header' });
    const toggle = el('button', {
      type: 'button', class: 'sa-title', 'aria-expanded': String(state.open),
      text: `${state.open ? '▾' : '▸'} ${t('title')}`, title: state.open ? t('close') : t('expand'),
    });
    toggle.addEventListener('click', () => setOpen(!state.open));
    const actions = el('div', { class: 'sa-actions' });
    const langBtn = el('button', { type: 'button', class: 'sa-btn', text: t('lang') });
    langBtn.addEventListener('click', () => {
      i18n.lang = i18n.lang === 'zh' ? 'en' : 'zh';
      store.set({ lang: i18n.lang });
      render();
      if (state.result) markRows();
    });
    const reloadBtn = el('button', { type: 'button', class: 'sa-btn', text: t('refresh') });
    reloadBtn.disabled = state.loading > 0;
    reloadBtn.addEventListener('click', load);
    actions.append(langBtn, reloadBtn);
    header.append(toggle, actions);
    panel.appendChild(header);
    if (!state.open) return;

    if (state.loading) {
      panel.appendChild(el('div', { class: 'sa-status', text: t('loading', { n: state.loading - 1 }) }));
      const bar = el('div', { class: 'sa-progress' });
      bar.appendChild(el('div'));
      panel.appendChild(bar);
    }
    if (state.error) panel.appendChild(el('div', { class: 'sa-alert', text: t('failed', { err: state.error }) }));
    if (state.data?.partial) panel.appendChild(el('div', { class: 'sa-alert', text: t('partial', { err: state.data.error, n: state.data.papers.length }) }));
    if (!state.result) return;

    const nav = el('nav', { class: 'sa-tabs', role: 'tablist' });
    TABS.forEach(([id, label]) => {
      const text = typeof label === 'function' ? label(state.result) : t(label);
      const b = el('button', { type: 'button', role: 'tab', class: `sa-tab${state.tab === id ? ' sa-tab-active' : ''}`, text, 'aria-selected': String(state.tab === id) });
      b.addEventListener('click', () => { state.tab = id; render(); });
      nav.appendChild(b);
    });
    panel.appendChild(nav);

    const body = el('div', { class: 'sa-body' });
    panel.appendChild(body);
    const renderer = TABS.find(([id]) => id === state.tab)[2];
    body.append(...renderer(state.result).filter(Boolean));
  }

  function analyze() {
    if (!state.data) return;
    state.result = stats.analyze(state.data, { selfOverride: state.selfOverride, rankings: state.rankingLists });
    render();
    markRows();
  }

  function markRows() {
    SA.rowMarks.update(state.result, { settings: state.rowMarks, firstLabel: t('firstShort'), correspondingLabel: t('corrShort') });
  }

  function setRowMark(update) {
    update(state.rowMarks);
    store.set({ rowMarks: state.rowMarks });
    markRows();
  }

  async function load() {
    if (state.loading) return;
    state.loading = 1; // count + 1 so 0 papers still means "loading"
    state.error = null;
    render();
    try {
      state.data = await scraper.fetchAll(userId, (n) => { state.loading = n + 1; render(); });
      // Only the index shards for this scholar's venues are fetched.
      state.rankingLists = await rankIndex.resolve(state.data.papers.map((p) => ({ raw: p.venueRaw, type: stats.venueType(p.venueRaw) })))
        .catch((e) => { console.warn('[Scholar Assistant] ranking index', e); return []; });
      state.loading = 0;
      analyze();
    } catch (e) {
      state.loading = 0;
      state.error = e.message || String(e);
      render();
    }
  }

  store.get(['lang', 'rankingId', 'rowMarks', `self:${userId}`]).then((saved) => {
    if (saved.lang) i18n.lang = saved.lang;
    if (saved.rowMarks) state.rowMarks = { first: true, corresponding: true, lists: {}, ...saved.rowMarks };
    if (saved.rankingId) state.rankingId = saved.rankingId;
    state.selfOverride = saved[`self:${userId}`] || '';
    load();
  });
})();
