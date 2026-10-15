// Ranking badges shown inside Scholar's own pages (profile article list and search results).
var SA = globalThis.SA || (globalThis.SA = {});

SA.badges = (() => {
  const STYLE_ID = 'sa-badge-style';
  // Lives in the page (not the panel's shadow root), so every class is prefixed.
  const STYLE = `
    #gsc_a_b tr.sa-row-first > td { background-color: #eef4fd; }
    .sa-self { font-weight: bold; color: #222; }
    .sa-row-badges { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 3px; }
    .sa-search-badges { display: flex; flex-wrap: wrap; gap: 3px; margin: 2px 0 4px; }
    .sa-rb {
      display: inline-block; padding: 0 5px; border: 1px solid; border-radius: 3px;
      font: 11px/16px Arial, sans-serif; white-space: nowrap; cursor: default;
    }
    .sa-rb-first { background: #1a73e8; border-color: #1a73e8; color: #fff; }
    .sa-rb-t1 { background: #e8f0fe; border-color: #aecbfa; color: #174ea6; font-weight: bold; }
    .sa-rb-t2 { background: #fff; border-color: #aecbfa; color: #1967d2; }
    .sa-rb-t3 { background: #fff; border-color: #dadce0; color: #5f6368; }
    .sa-rb-warn { background: #fce8e6; border-color: #f5b4ae; color: #c5221f; }
  `;

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

  /**
   * Badges for one venue match. rk: list description { name, shortName, kind, tiers, flags, metric };
   * p: matched entry { tier, tierLabel, flags (indexes into rk.flags), metric, venue }.
   */
  function rankBadges({ rk, p }) {
    const L = SA.i18n.L;
    const name = L(rk.name), short = L(rk.shortName), tier = L(p.tierLabel);
    const flags = rk.flags || [];
    const plainFlags = p.flags.filter((i) => !flags[i].warn).map((i) => L(flags[i].label));
    const warnFlags = p.flags.filter((i) => flags[i].warn).map((i) => L(flags[i].label));
    const metric = rk.metric && p.metric != null ? ` · ${L(rk.metric.label)} ${p.metric.toFixed(rk.metric.decimals)}` : '';
    const title = `${name}: ${tier}${plainFlags.length ? ` (${plainFlags.join(', ')})` : ''} — ${p.venue}`;
    const out = [badge(`${short}-${tier}${plainFlags.map((f) => ` ${f}`).join('')}${metric}`, tierClass(rk, p.tier), title)];
    warnFlags.forEach((f) => out.push(badge(`${short}-${f}`, 'sa-rb-warn', `${name}: ${f}`)));
    return out;
  }

  return { ensureStyle, badge, rankBadges };
})();
