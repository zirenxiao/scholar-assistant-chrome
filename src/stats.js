// Pure statistics over parsed Scholar data. No DOM access, so it is testable in Node.
var SA = globalThis.SA || (globalThis.SA = {});

SA.stats = (() => {
  const TITLE_WORDS = new Set(['dr', 'prof', 'professor', 'phd', 'md', 'mr', 'ms', 'mrs', 'jr', 'sr', 'ieee', 'fellow', 'frs', 'facm']);

  function normName(s) {
    return String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z\s'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // "J Smith", "John Smith", "J. A. Smith" all map to "j smith".
  function authorKey(name) {
    const tokens = normName(name).split(' ').filter(Boolean);
    if (!tokens.length) return '';
    if (tokens.length === 1) return tokens[0];
    return `${tokens[0][0]} ${tokens[tokens.length - 1]}`;
  }

  function parseAuthors(raw) {
    const s = String(raw || '').trim();
    const truncated = /(\.\.\.|…)\s*$/.test(s);
    const names = s.replace(/,?\s*(\.\.\.|…)\s*$/, '')
      .split(',').map((x) => x.trim()).filter(Boolean);
    return { names, keys: names.map(authorKey), truncated };
  }

  // Possible "initial surname" keys for a profile name, whatever its token order.
  function candidateSelfKeys(profileName) {
    const tokens = normName(String(profileName || '').replace(/\(.*?\)|（.*?）/g, ' '))
      .split(' ').filter((t) => t && !TITLE_WORDS.has(t));
    const keys = new Set();
    for (let i = 0; i < tokens.length; i++) {
      for (let j = 0; j < tokens.length; j++) {
        if (i !== j) keys.add(`${tokens[i][0]} ${tokens[j]}`);
      }
    }
    return keys;
  }

  // Picks the author keys that represent the profile owner across the paper list.
  // Returns { primary, alternates }: the owner's usual byline form, plus other name orders
  // (e.g. "h geoffrey") that are only trusted on papers where the primary form is absent,
  // because for many names the reversed form is a different person ("Y Liu" vs "L Yang").
  function detectSelfKeys(papers, profileName, override) {
    if (override && authorKey(override)) return { primary: authorKey(override), alternates: new Set() };
    const freq = new Map();
    // Names without Latin letters have an empty key; they must not merge into one "author".
    papers.forEach((p) => new Set(p.authors.keys.filter(Boolean)).forEach((k) => freq.set(k, (freq.get(k) || 0) + 1)));
    if (!freq.size) return { primary: '', alternates: new Set() };
    const candidates = candidateSelfKeys(profileName);
    let best = '', bestN = 0, top = '', topN = 0;
    for (const [k, n] of freq) {
      if (n > topN) { top = k; topN = n; }
      if (candidates.has(k) && n > bestN) { best = k; bestN = n; }
    }
    // The owner appears on most papers; if the name match is weak, trust frequency.
    if (!best || bestN < 0.3 * topN) return { primary: top, alternates: new Set() };
    candidates.delete(best);
    return { primary: best, alternates: candidates };
  }

  // Strips volume/issue/pages from Scholar's venue string.
  function normVenue(raw) {
    let s = String(raw || '').trim();
    if (!s) return '';
    if (/^arxiv/i.test(s)) return 'arXiv';
    s = s.replace(/\s*(…|\.\.\.)\s*$/, '');                // Scholar truncation
    s = s.replace(/,\s*\d{4}\s*$/, '');
    s = s.split(',')[0];
    s = s.replace(/\s*\([^)]*$/, '');                       // unclosed "(ICML" left by truncation
    s = s.replace(/^(19|20)\d{2}\s+/, '');                  // "2013 IEEE international ..."
    s = s.replace(/\b(\d+(st|nd|rd|th)|first|second|third)\s+/gi, ''); // "the 27th international ..."
    s = s.replace(/\s+\d+[\w-]*(\s*\(.*)?$/, '');   // "Nature 521 (7553)" -> "Nature"
    s = s.replace(/\s*\(\s*\d.*$/, '');              // "Journal (3)" -> "Journal"
    return s.replace(/\s+/g, ' ').trim();
  }

  function venueType(raw) {
    const s = String(raw || '').toLowerCase();
    if (!s) return 'unknown';
    if (/\b(arxiv|biorxiv|medrxiv|ssrn|preprint|research square|techrxiv|chemrxiv|psyarxiv|osf)\b/.test(s)) return 'preprint';
    if (/\bpatent\b/.test(s)) return 'patent';
    if (/\b(thesis|dissertation)\b/.test(s)) return 'thesis';
    if (/\b(proceedings|proc\.|conference|conf\.|workshop|symposium|congress|meeting|colloquium|summit)\b/.test(s)) return 'conference';
    if (/^advances in neural information processing|\b(neurips|nips|icml|iclr|cvpr|iccv|eccv|aaai|ijcai|acl|emnlp|naacl|coling|kdd|sigir|sigmod|vldb|icde|chi|uist|cscw|icra|iros|miccai|interspeech|icassp|wsdm|cikm|recsys|siggraph|infocom|sigcomm|nsdi|osdi|sosp|usenix|ccs|ndss|isca|dac|iccad)\b/.test(s)) return 'conference';
    if (/\b(journal|transactions|letters|review|annals|bulletin|magazine|quarterly)\b/.test(s) || /\d+\s*\(\d+\)/.test(s)) return 'journal';
    if (/\b(book|press|springer|chapter|handbook|edition)\b/.test(s)) return 'book';
    return 'other';
  }

  function hIndex(sortedDesc) {
    let h = 0;
    while (h < sortedDesc.length && sortedDesc[h] >= h + 1) h++;
    return h;
  }

  function gIndex(sortedDesc) {
    let sum = 0, g = 0;
    for (let i = 0; i < sortedDesc.length; i++) {
      sum += sortedDesc[i];
      if (sum >= (i + 1) * (i + 1)) g = i + 1;
    }
    return g;
  }

  function median(arr) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  const sum = (arr) => arr.reduce((a, b) => a + b, 0);

  // Earliest year, skipping isolated outliers (e.g. a mis-dated 1905 entry).
  function robustFirstYear(years) {
    if (!years.length) return null;
    const s = [...years].sort((a, b) => a - b);
    let i = 0;
    while (i < s.length - 1 && i < s.length * 0.05 && s[i + 1] - s[i] > 5) i++;
    return s[i];
  }

  function basicMetrics(papers, histogram, now) {
    const cites = papers.map((p) => p.citations).sort((a, b) => b - a);
    const total = sum(cites);
    const h = hIndex(cites);
    const hCore = sum(cites.slice(0, h));
    const years = papers.map((p) => p.year).filter(Boolean);
    const firstYear = robustFirstYear(years);
    const lastYear = years.length ? Math.max(...years) : null;
    const age = firstYear ? now - firstYear + 1 : 0;
    const recentFrom = now - 4;
    const histYears = Object.keys(histogram).map(Number);
    const citesRecent = sum(histYears.filter((y) => y >= recentFrom).map((y) => histogram[y]));
    const histTotal = sum(histYears.map((y) => histogram[y]));
    const prev = histogram[now - 1] || 0, prev2 = histogram[now - 2] || 0;
    return {
      papers: papers.length,
      citations: total,
      h,
      g: gIndex(cites),
      i10: cites.filter((c) => c >= 10).length,
      e: Math.sqrt(Math.max(0, hCore - h * h)),
      m: age ? h / age : 0,
      meanCites: papers.length ? total / papers.length : 0,
      medianCites: median(cites),
      maxCites: cites[0] || 0,
      uncited: cites.filter((c) => c === 0).length,
      topShare: total ? cites[0] / total : 0,
      hCoreShare: total ? hCore / total : 0,
      firstYear, lastYear, age,
      papersPerYear: age ? years.filter((y) => y >= firstYear).length / age : 0,
      noYear: papers.length - years.length,
      recentPapers: years.filter((y) => y >= recentFrom).length,
      recentCites: citesRecent,
      recentCitesShare: histTotal ? citesRecent / histTotal : 0,
      citesLastYear: prev,
      citesGrowth: prev2 ? (prev - prev2) / prev2 : null,
    };
  }

  function perYear(papers, histogram) {
    const years = new Set(papers.map((p) => p.year).filter(Boolean));
    Object.keys(histogram).forEach((y) => years.add(+y));
    if (!years.size) return [];
    const min = Math.min(...years), max = Math.max(...years);
    const rows = [];
    for (let y = min; y <= max; y++) {
      const ps = papers.filter((p) => p.year === y);
      rows.push({ year: y, papers: ps.length, citesOfPapers: sum(ps.map((p) => p.citations)), citesReceived: histogram[y] || 0 });
    }
    return rows;
  }

  const CITE_BUCKETS = [[0, 0, '0'], [1, 9, '1–9'], [10, 49, '10–49'], [50, 99, '50–99'], [100, 499, '100–499'], [500, 999, '500–999'], [1000, Infinity, '1000+']];
  function citationBuckets(papers) {
    return CITE_BUCKETS.map(([lo, hi, label]) => ({ label, count: papers.filter((p) => p.citations >= lo && p.citations <= hi).length }));
  }

  // Classifies the owner's byline position on each paper.
  function authorship(papers, selfKeys) {
    const groups = { first: [], last: [], middle: [], hidden: [], unmatched: [] };
    const positions = [];
    papers.forEach((p) => {
      const { keys, truncated } = p.authors;
      const n = keys.length;
      let idx = selfKeys.primary ? keys.indexOf(selfKeys.primary) : -1;
      if (idx < 0) idx = keys.findIndex((k) => k && selfKeys.alternates.has(k));
      let pos;
      if (idx < 0) pos = truncated ? 'hidden' : 'unmatched';
      else if (idx === 0) pos = 'first'; // includes sole-authored papers
      else if (idx === n - 1 && !truncated) pos = 'last';
      else pos = 'middle';
      p.position = pos;
      p.selfIndex = idx;
      // A trailing "*" on the owner's name ("Z Xiao*") marks the corresponding author.
      p.corresponding = idx >= 0 && /\*\s*$/.test(p.authors.names[idx]);
      groups[pos].push(p);
      if (idx >= 0) positions.push(idx + 1);
    });
    const summarize = (ps) => ({ count: ps.length, citations: sum(ps.map((p) => p.citations)), h: hIndex(ps.map((p) => p.citations).sort((a, b) => b - a)) });
    const complete = papers.filter((p) => !p.authors.truncated && p.authors.keys.length);
    const sizes = complete.map((p) => p.authors.keys.length);
    const positionDist = {};
    positions.forEach((i) => { const k = i >= 6 ? '6+' : String(i); positionDist[k] = (positionDist[k] || 0) + 1; });
    return {
      groups: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, summarize(v)])),
      corresponding: summarize(papers.filter((p) => p.corresponding)),
      meanAuthors: sizes.length ? sum(sizes) / sizes.length : 0,
      medianAuthors: median(sizes),
      truncatedCount: papers.length - complete.length,
      positionDist,
    };
  }

  function venues(papers, topN = 15) {
    const byKey = new Map();
    const types = {};
    papers.forEach((p) => {
      const type = venueType(p.venueRaw);
      types[type] = types[type] || { count: 0, citations: 0 };
      types[type].count++;
      types[type].citations += p.citations;
      const name = normVenue(p.venueRaw);
      if (!name) return;
      const key = name.toLowerCase();
      const v = byKey.get(key) || { names: new Map(), count: 0, citations: 0, type, years: [] };
      v.names.set(name, (v.names.get(name) || 0) + 1);
      v.count++;
      v.citations += p.citations;
      if (p.year) v.years.push(p.year);
      byKey.set(key, v);
    });
    const list = [...byKey.values()].map((v) => ({
      name: [...v.names.entries()].sort((a, b) => b[1] - a[1])[0][0],
      count: v.count,
      citations: v.citations,
      meanCites: v.citations / v.count,
      type: v.type,
      firstYear: v.years.length ? Math.min(...v.years) : null,
      lastYear: v.years.length ? Math.max(...v.years) : null,
    })).sort((a, b) => b.count - a.count || b.citations - a.citations);
    return { distinct: list.length, top: list.slice(0, topN), types, noVenue: papers.filter((p) => !normVenue(p.venueRaw)).length };
  }

  function coauthors(papers, selfKeys, topN = 20) {
    const byKey = new Map();
    const isSelf = (p, k, i) => i === p.selfIndex || k === selfKeys.primary;
    papers.forEach((p) => {
      const seen = new Set();
      p.authors.keys.forEach((k, i) => {
        if (!k || isSelf(p, k, i) || seen.has(k)) return;
        seen.add(k);
        const c = byKey.get(k) || { names: new Map(), count: 0, citations: 0, years: [] };
        const name = p.authors.names[i].replace(/\*+\s*$/, ''); // drop corresponding-author marks
        c.names.set(name, (c.names.get(name) || 0) + 1);
        c.count++;
        c.citations += p.citations;
        if (p.year) c.years.push(p.year);
        byKey.set(k, c);
      });
    });
    const list = [...byKey.values()].map((c) => ({
      name: [...c.names.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0],
      count: c.count,
      citations: c.citations,
      firstYear: c.years.length ? Math.min(...c.years) : null,
      lastYear: c.years.length ? Math.max(...c.years) : null,
    })).sort((a, b) => b.count - a.count || b.citations - a.citations);
    const withCoauthors = papers.filter((p) => p.authors.keys.some((k, i) => k && !isSelf(p, k, i))).length;
    return {
      distinct: list.length,
      repeat: list.filter((c) => c.count >= 2).length,
      collaborativeShare: papers.length ? withCoauthors / papers.length : 0,
      top: list.slice(0, topN),
    };
  }

  // Counts papers per tier of a ranking list (see rankings.js). Needs p.position from authorship().
  function rankingStats(papers, matcher) {
    const { config } = matcher;
    const tiers = matcher.tiers.map((t) => ({ value: t.value, label: t.label, count: 0, citations: 0, firstAuthor: 0, journal: 0, conference: 0, cites: [] }));
    const matched = [];
    papers.forEach((p) => {
      const e = matcher.match(p.venueRaw, venueType(p.venueRaw));
      if (!e) return;
      const tier = tiers.find((t) => t.value === e.tier);
      tier.count++;
      tier.citations += p.citations;
      tier.cites.push(p.citations);
      if (p.position === 'first' || p.corresponding) tier.firstAuthor++; // first or corresponding author
      if (e.type === 'journal') tier.journal++;
      else if (e.type === 'conference') tier.conference++;
      matched.push({
        title: p.title, link: p.link, year: p.year, citations: p.citations, position: p.position, corresponding: p.corresponding,
        tier: e.tier, tierLabel: e.tierLabel, abbr: e.abbr, venue: e.name, type: e.type,
        metric: e.metric, flags: e.flags || [],
      });
    });
    const metricValues = matched.map((m) => m.metric).filter((v) => v != null);
    // Every configured flag is reported, so a zero count ("no warning journals") is visible too.
    const flags = (config.flags || []).map((f, i) => ({
      label: f.label, warn: !!f.warn, count: matched.filter((m) => m.flags.includes(i)).length,
    }));
    const order = matcher.tiers.map((t) => t.value);
    matched.sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier) || b.citations - a.citations);
    return {
      id: config.id,
      name: config.name,
      shortName: config.shortName || config.name,
      kind: config.kind || 'ranking',
      tiers: tiers.map(({ cites, ...t }) => ({ ...t, h: hIndex(cites.sort((a, b) => b - a)) })),
      total: matched.length,
      citations: sum(matched.map((m) => m.citations)),
      metric: matcher.metric && metricValues.length ? {
        label: matcher.metric.label, decimals: matcher.metric.decimals ?? 1,
        mean: sum(metricValues) / metricValues.length, max: Math.max(...metricValues),
      } : null,
      flags,
      papers: matched,
    };
  }

  function analyze(data, opts = {}) {
    const now = opts.now || new Date().getFullYear();
    const histogram = (data.profile && data.profile.citationHistogram) || {};
    const papers = data.papers.map((p) => ({ ...p, authors: parseAuthors(p.authorsRaw) }));
    const selfKeys = detectSelfKeys(papers, data.profile && data.profile.name, opts.selfOverride);
    const authorshipResult = authorship(papers, selfKeys); // sets p.position, used by rankingStats
    return {
      selfKey: selfKeys.primary,
      basic: basicMetrics(papers, histogram, now),
      perYear: perYear(papers, histogram),
      buckets: citationBuckets(papers),
      authorship: authorshipResult,
      venues: venues(papers),
      coauthors: coauthors(papers, selfKeys),
      rankings: (opts.rankings || []).map((m) => rankingStats(papers, m)),
      // Per-paper byline facts, for marking rows of Scholar's article list.
      papers: papers.map((p) => ({ link: p.link, position: p.position, selfIndex: p.selfIndex, corresponding: p.corresponding })),
    };
  }

  return { analyze, normName, authorKey, parseAuthors, candidateSelfKeys, detectSelfKeys, normVenue, venueType, hIndex, gIndex, rankingStats };
})();

if (typeof module !== 'undefined') module.exports = SA.stats;
