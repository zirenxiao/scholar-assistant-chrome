// Shows venue ranking badges under each result on Google Scholar search pages (/scholar?q=...).
(() => {
  const { rankings, stats, i18n, badges, settings: store } = SA;

  // A result's green line reads "authors - venue, year - source"; Scholar separates the parts
  // with " - " (sometimes a non-breaking space) and cuts long venue names with "…".
  function venueOf(result) {
    const line = result.querySelector('.gs_a');
    if (!line) return '';
    const parts = line.textContent.replace(/ /g, ' ').replace(/\s+/g, ' ').trim().split(' - ');
    if (parts.length < 2) return '';
    const middle = (parts.length >= 3 ? parts.slice(1, -1).join(' - ') : parts[1]).trim();
    if (/^\S+\.\S+$/.test(middle)) return '';                // only a source domain ("books.google.com")
    return middle.replace(/,?\s*(19|20)\d{2}\s*$/, '').trim(); // drop ", 2016" (a bare year leaves nothing)
  }

  const resultsOf = () => [...document.querySelectorAll('.gs_r.gs_or .gs_ri, .gs_r .gs_ri')]
    .filter((r, i, all) => all.indexOf(r) === i && r.querySelector('.gs_a'));

  let current = null;  // { lists, settings }

  function render() {
    if (!current) return;
    const { lists, settings } = current;
    const L = i18n.L;
    resultsOf().forEach((r) => {
      r.querySelectorAll('.sa-search-badges').forEach((e) => e.remove());
      if (!settings.searchMarks) return;
      const venue = venueOf(r);
      if (!venue) return;
      const out = [];
      lists.filter((l) => store.listEnabled(settings, l.config.id)).forEach((l) => {
        const e = l.match(venue);
        if (!e) return;
        const rk = { ...l.config, tiers: l.tiers, metric: l.metric, flags: l.config.flags || [] };
        out.push(...badges.rankBadges({ rk, p: { ...e, venue: e.name } }));
      });
      if (!out.length) return;
      const box = document.createElement('div');
      box.className = 'sa-search-badges';
      box.title = L({ zh: 'Scholar Assistant：期刊/会议排名', en: 'Scholar Assistant: venue rankings' });
      box.append(...out);
      r.querySelector('.gs_a').after(box);
    });
  }

  async function start() {
    const results = resultsOf();
    if (!results.length) return;
    const settings = await store.load();
    if (settings.lang) i18n.lang = settings.lang;
    const venues = results.map(venueOf).filter(Boolean);
    const lists = await rankings.openPackagedIndex()
      .resolve(venues.map((raw) => ({ raw, type: stats.venueType(raw) })))
      .catch((e) => { console.warn('[Scholar Assistant] ranking index', e); return []; });
    current = { lists, settings };
    badges.ensureStyle();
    render();
    // Settings changed in the popup apply immediately.
    store.onChange((s) => {
      i18n.lang = s.lang || i18n.browserLang;
      current.settings = s;
      render();
    });
  }

  start();
})();
