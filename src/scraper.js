// Fetches and parses every publication on a Google Scholar profile.
var SA = globalThis.SA || (globalThis.SA = {});

SA.scraper = (() => {
  const PAGE_SIZE = 100;     // Scholar's maximum page size
  const PAGE_DELAY_MS = 900; // throttle between pages to avoid triggering a CAPTCHA

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const toInt = (s) => {
    const n = parseInt(String(s || '').replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  };

  function getUserId(url = location.href) {
    return new URL(url).searchParams.get('user');
  }

  function isProfilePage(doc = document) {
    return !!(getUserId() && doc.querySelector('#gsc_prf_in') && doc.querySelector('#gsc_a_b'));
  }

  function parseRow(tr, origin) {
    const a = tr.querySelector('.gsc_a_at');
    if (!a) return null;
    const grays = tr.querySelectorAll('.gsc_a_t .gs_gray');
    let venueRaw = '';
    if (grays[1]) {
      const clone = grays[1].cloneNode(true);
      clone.querySelectorAll('.gs_oph').forEach((e) => e.remove()); // trailing ", 2020"
      venueRaw = text(clone);
    }
    const href = a.getAttribute('href') || a.getAttribute('data-href') || '';
    const year = toInt(text(tr.querySelector('.gsc_a_y .gsc_a_h, .gsc_a_h')));
    return {
      title: text(a),
      link: href ? new URL(href, origin).href : '',
      authorsRaw: text(grays[0]),
      venueRaw,
      citations: toInt(text(tr.querySelector('.gsc_a_ac'))),
      year: year || null,
    };
  }

  function parseRows(doc, origin) {
    return [...doc.querySelectorAll('tr.gsc_a_tr')].map((tr) => parseRow(tr, origin)).filter(Boolean);
  }

  // Header info, the official stats table and the citations-per-year histogram.
  function parseProfile(doc) {
    const cells = [...doc.querySelectorAll('#gsc_rsb_st td.gsc_rsb_std')].map((td) => toInt(text(td)));
    const sinceHeader = text(doc.querySelectorAll('#gsc_rsb_st th.gsc_rsb_sth')[2]);
    // Bars and year labels are absolutely positioned; years with zero citations have
    // no bar, so pair each bar with the year label nearest to its `right:` offset.
    const histogram = {};
    const rightPx = (e) => parseFloat(/right:\s*([\d.]+)px/.exec(e.getAttribute('style') || '')?.[1]);
    const labels = [...doc.querySelectorAll('.gsc_md_hist_b .gsc_g_t')]
      .map((e) => ({ year: toInt(text(e)), right: rightPx(e) }))
      .filter((l) => l.year && Number.isFinite(l.right));
    labels.forEach((l) => { histogram[l.year] = 0; });
    doc.querySelectorAll('.gsc_md_hist_b a.gsc_g_a').forEach((bar) => {
      const r = rightPx(bar);
      if (!Number.isFinite(r) || !labels.length) return;
      const nearest = labels.reduce((best, l) => (Math.abs(l.right - r) < Math.abs(best.right - r) ? l : best));
      histogram[nearest.year] = toInt(text(bar.querySelector('.gsc_g_al')));
    });
    return {
      name: text(doc.querySelector('#gsc_prf_in')),
      affiliation: text(doc.querySelector('.gsc_prf_il')),
      official: cells.length >= 6 ? {
        citations: cells[0], citationsSince: cells[1],
        h: cells[2], hSince: cells[3],
        i10: cells[4], i10Since: cells[5],
        sinceYear: toInt(sinceHeader) || null,
      } : null,
      citationHistogram: histogram,
    };
  }

  /**
   * Loads all pages of a profile. onProgress(count) is called after each page.
   * Resolves to { profile, papers, partial, error }; partial is true when Scholar
   * stopped serving pages (e.g. a CAPTCHA) and only some papers were loaded.
   */
  async function fetchAll(userId, onProgress) {
    const origin = location.origin;
    const papers = [];
    const seen = new Set();
    let profile = null;
    for (let cstart = 0; ; cstart += PAGE_SIZE) {
      const url = `${origin}/citations?user=${encodeURIComponent(userId)}&hl=en&cstart=${cstart}&pagesize=${PAGE_SIZE}`;
      let doc;
      try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        if (!doc.querySelector('#gsc_a_b')) throw new Error('blocked');
      } catch (e) {
        if (!profile) throw e;
        return { profile, papers, partial: true, error: e.message };
      }
      if (!profile) profile = parseProfile(doc);
      const rows = parseRows(doc, origin);
      for (const p of rows) {
        const key = (p.link && new URL(p.link).searchParams.get('citation_for_view')) || `${p.title}|${p.year}`;
        if (seen.has(key)) continue;
        seen.add(key);
        papers.push(p);
      }
      onProgress && onProgress(papers.length);
      const more = doc.querySelector('#gsc_bpf_more');
      if (rows.length < PAGE_SIZE || (more && more.disabled)) break;
      await sleep(PAGE_DELAY_MS);
    }
    return { profile, papers, partial: false, error: null };
  }

  return { getUserId, isProfilePage, parseRows, parseProfile, fetchAll };
})();
