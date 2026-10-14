// Venue ranking lists (CCF, JCR, 中科院分区, ...): a sharded index built from the CSVs in data/,
// and the matcher that maps Scholar venue strings onto it.
//
// Build time (Node, tools/build-index.js): data/rankings.json + CSVs -> index/
//   meta.json      list descriptions (tiers, metric, flags) and shard count
//   abbr.json      abbreviation -> venue keys
//   r/NN.json      venue key -> per-list entries ("records"), sharded by hash(key)
//   t/NN.json      word -> venue keys containing it ("postings", for fuzzy matching), sharded by hash(word)
// Run time (extension): only the shards for the scholar's own venue keys and words are fetched.
var SA = globalThis.SA || (globalThis.SA = {});

SA.rankings = (() => {
  // Words that vary between Scholar's venue strings and official names without changing identity.
  const STOP = new Set(['the', 'of', 'on', 'in', 'for', 'and', 'at', 'a', 'an', 'to', 'proceedings', 'proc',
    'international', 'conference', 'conf', 'annual', 'meeting', 'ieee', 'acm', 'cvf', 'ifip',
    'basel']); // MDPI titles carry '-Basel' in JCR-style lists ('APPLIED SCIENCES-BASEL')
  // Edition numbers spelled out: "twelfth", "thirtieth", "twenty-first".
  const ORDINAL = /^(\d+(st|nd|rd|th)?|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|\w+teenth|\w+ieth|twenty|thirty|forty|fifty|sixty)$/;
  // Satellite events that must never be credited as the main venue.
  const SATELLITE = /\b(workshops?|findings|companion|extended abstracts|adjunct|posters?|demos?|doctoral|tutorials?|student research|newsletter|explorations|sigmod record|notes)\b/i;
  // A venue that says it is a conference must not be credited to a journal of the same name
  // ("International Conference on Machine Learning" vs the journal "Machine Learning").
  const CONF_SIGNAL = /\b(conference|symposium|workshop|congress|colloquium)\b/i;
  const NEVER_RANKED = new Set(['preprint', 'patent', 'thesis']);
  const MIN_SCORE = 0.7;
  const TYPE_CODE = { journal: 'j', conference: 'c', other: 'o' };
  const TYPE_NAME = { j: 'journal', c: 'conference', o: 'other' };

  // ---------------------------------------------------------------- shared helpers

  /** Parses CSV text into { header, rows } with rows as arrays of trimmed strings. */
  function parseCSV(text) {
    const s = text.replace(/^﻿/, '');
    const re = /(?:"((?:[^"]|"")*)"|([^,\r\n]*))(,|\r\n|\n|\r|$)/g;
    const rows = [];
    let row = [];
    let m;
    while ((m = re.exec(s))) {
      row.push((m[1] !== undefined ? m[1].replace(/""/g, '"') : m[2]).trim());
      if (m[3] === ',') continue;
      if (row.some(Boolean)) rows.push(row);
      row = [];
      if (!m[3] || re.lastIndex >= s.length) break;
    }
    const [header = [], ...body] = rows;
    return { header, rows: body };
  }

  function tokens(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((t) => t && !STOP.has(t) && !ORDINAL.test(t));
  }

  const keyOf = (toks) => [...new Set(toks)].sort().join(' ');
  // Full name including stopwords, for names made only of stopwords ("Proceedings of the IEEE").
  const fullKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  // One key per venue name: its sorted significant words, or the full name if it has none.
  function venueKey(name) {
    const toks = tokens(name);
    return toks.length ? keyOf(toks) : `=${fullKey(name)}`;
  }
  const keyTokens = (key) => (key.startsWith('=') ? [] : key.split(' '));

  // FNV-1a; decides which shard file holds a key or word.
  function shardOf(str, n) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0) % n;
  }
  const shardFile = (dir, i) => `${dir}/${String(i).padStart(2, '0')}.json`;

  // Venue string as Scholar prints it, minus volume/issue/pages and truncation.
  function cleanVenue(raw) {
    let s = String(raw || '').trim();
    const truncated = /(…|\.\.\.)\s*$/.test(s);
    s = s.replace(/\s*(…|\.\.\.)\s*$/, '')
      .replace(/,\s*\d{4}\s*$/, '')
      .replace(/\s+\d+[\w-]*\s*(\([^)]*\)?)?\s*(,.*)?$/, '') // "Nature 521 (7553), 436-444"
      .replace(/,\s*\d[\d\s-]*$/, '')                        // ", 770-778"
      .replace(/^(19|20)\d{2}\s+/, '')
      .replace(/\s*\([^)]*$/, '');                           // unclosed "(Cat. No" left by truncation
    return { text: s.trim(), truncated };
  }

  // ---------------------------------------------------------------- build time

  /**
   * Reads one list from its rankings.json entry and parsed CSV ({ header, rows }).
   *
   * config.columns: name (required), abbr, type, field — CSV header names. columns.tier may be one
   *   column or several; with several, the best tier across them is used (e.g. JCR quartiles per category).
   * config.tierPattern: optional regex; its first group (or whole match) is the tier, e.g. "4 [625/778]" -> "4".
   * config.tiers: optional [{ value, label }] in rank order; defaults to the distinct values in file order.
   * config.metric: optional { column, label, decimals } numeric value per venue (e.g. impact factor).
   * config.flags: optional [{ column, equals | contains | notEmpty, label, warn }] markers (e.g. Top journal).
   * Returns { meta, entries, aliases } where aliases are [aliasKey, entry] pairs.
   */
  function readList(config, table) {
    const col = config.columns;
    const header = table.header;
    const ix = (name) => {
      if (!name) return -1;
      const i = header.indexOf(name);
      if (i < 0) throw new Error(`${config.id}: column "${name}" not found in ${config.file}`);
      return i;
    };
    const nameI = ix(col.name), abbrI = ix(col.abbr), typeI = ix(col.type), fieldI = ix(col.field);
    const tierIs = [].concat(col.tier || []).map(ix);
    const pattern = config.tierPattern ? new RegExp(config.tierPattern) : null;
    const cell = (r, i) => (i >= 0 ? r[i] || '' : '');
    const tierValues = (r) => {
      if (!tierIs.length) return ['listed'];
      return tierIs.map((i) => {
        const v = cell(r, i);
        if (!pattern) return v;
        const m = pattern.exec(v);
        return m ? m[1] ?? m[0] : '';
      }).filter(Boolean);
    };
    const tiers = config.tiers || [...new Set(table.rows.map((r) => tierValues(r)[0]).filter(Boolean))]
      .map((v) => ({ value: v, label: v === 'listed' ? config.shortName || config.name : v }));
    const order = tiers.map((t) => t.value);
    const bestTier = (r) => {
      let best = -1;
      for (const v of tierValues(r)) {
        const k = order.indexOf(v);
        if (k >= 0 && (best < 0 || k < best)) best = k;
      }
      return best;
    };
    const metricI = config.metric ? ix(config.metric.column) : -1;
    const flagDefs = (config.flags || []).map((f) => ({ ...f, i: ix(f.column) }));
    const flagged = (r) => flagDefs.filter((f) => {
      const v = cell(r, f.i);
      if (f.equals !== undefined) return v === f.equals;
      if (f.contains !== undefined) return v.includes(f.contains);
      return f.notEmpty ? v !== '' && v !== '-' && v !== '—' : false;
    }).map((f) => f.label);

    const entries = [];
    for (const r of table.rows) {
      const name = cell(r, nameI);
      const tier = bestTier(r);
      if (!name || tier < 0) continue;
      const m = metricI >= 0 ? parseFloat(cell(r, metricI)) : NaN;
      entries.push({
        key: venueKey(name),
        name,
        tier,
        abbr: cell(r, abbrI),
        type: (typeI >= 0 && (config.typeValues || {})[cell(r, typeI)]) || config.defaultType || 'other',
        field: cell(r, fieldI),
        metric: Number.isFinite(m) ? m : null,
        flags: flagged(r),
      });
    }

    // Aliases resolve to an abbreviation or an official name in the list.
    const aliases = [];
    for (const [alias, target] of Object.entries(config.aliases || {})) {
      const t = target.toLowerCase(), tk = venueKey(target);
      const hits = entries.filter((e) => e.abbr.toLowerCase() === t);
      (hits.length ? hits : entries.filter((e) => e.key === tk)).forEach((e) => aliases.push([venueKey(alias), e]));
    }

    const meta = {
      id: config.id,
      name: config.name,
      shortName: config.shortName || config.name,
      kind: config.kind || 'ranking',
      strict: config.strict ?? config.kind === 'warning',
      tiers,
      metric: config.metric ? { label: config.metric.label, decimals: config.metric.decimals ?? 1 } : null,
      flags: (config.flags || []).map((f) => ({ label: f.label, warn: !!f.warn })),
    };
    return { meta, entries, aliases };
  }

  /**
   * Merges lists into one sharded index. lists: [{ meta, entries, aliases }].
   * Returns { files: { path: json } } ready to be written under index/.
   */
  function buildIndex(lists, { shards = 64, maxPosting = 1000 } = {}) {
    // records[key][listId] = [[tierIndex, typeCode, name, abbr, metric, flags], ...]
    const records = new Map();
    const put = (key, listId, e) => {
      if (!records.has(key)) records.set(key, {});
      const rec = records.get(key);
      const row = [e.tier, TYPE_CODE[e.type] || 'o', e.name, e.abbr, e.metric, e.flags];
      while (row.length > 3 && (row[row.length - 1] == null || row[row.length - 1] === ''
        || (Array.isArray(row[row.length - 1]) && !row[row.length - 1].length))) row.pop();
      const list = rec[listId] || (rec[listId] = []);
      if (!list.some((x) => JSON.stringify(x) === JSON.stringify(row))) list.push(row);
    };
    const abbr = {};
    for (const { meta, entries, aliases } of lists) {
      for (const e of entries) {
        put(e.key, meta.id, e);
        if (e.abbr) {
          const a = e.abbr.toLowerCase();
          if (!(abbr[a] || (abbr[a] = [])).includes(e.key)) abbr[a].push(e.key);
        }
      }
      for (const [aliasKey, e] of aliases) put(aliasKey, meta.id, e);
    }

    // Postings: each key under each of its words, except words so common (e.g. "journal") that
    // their posting list would be huge. A key made only of common words is indexed under all of them.
    const df = new Map();
    for (const key of records.keys()) for (const t of keyTokens(key)) df.set(t, (df.get(t) || 0) + 1);
    const postings = new Map();
    for (const key of records.keys()) {
      const toks = keyTokens(key);
      const rare = toks.filter((t) => df.get(t) <= maxPosting);
      for (const t of rare.length ? rare : toks) {
        if (!postings.has(t)) postings.set(t, []);
        postings.get(t).push(key);
      }
    }

    const files = {};
    const shardMaps = (dir, map) => {
      const out = Array.from({ length: shards }, () => ({}));
      for (const [k, v] of map) out[shardOf(k, shards)][k] = v;
      out.forEach((obj, i) => { files[shardFile(dir, i)] = obj; });
    };
    shardMaps('r', records);
    shardMaps('t', postings);
    files['abbr.json'] = abbr;
    files['meta.json'] = {
      version: 1,
      shards,
      lists: lists.map((l) => ({ ...l.meta, size: l.entries.length })),
      venues: records.size,
    };
    return { files };
  }

  // ---------------------------------------------------------------- run time

  /**
   * Opens an index. read(path) must resolve to the parsed JSON of a file under index/.
   * resolve(venues) loads what those venues need and returns one matcher per list:
   * { config, tiers, metric, match(venueRaw) -> entry | null }.
   */
  function openIndex(read) {
    const loaded = new Map();
    const load = (path) => {
      if (!loaded.has(path)) loaded.set(path, read(path));
      return loaded.get(path);
    };
    const metaP = load('meta.json');
    const abbrP = load('abbr.json');

    async function getAll(dir, keys) {
      const meta = await metaP;
      const byShard = new Map();
      for (const k of keys) {
        const f = shardFile(dir, shardOf(k, meta.shards));
        if (!byShard.has(f)) byShard.set(f, []);
        byShard.get(f).push(k);
      }
      const out = new Map();
      await Promise.all([...byShard].map(async ([f, ks]) => {
        const data = await load(f);
        ks.forEach((k) => { if (data[k]) out.set(k, data[k]); });
      }));
      return out;
    }

    const entryOf = (list, row) => ({
      tier: list.tiers[row[0]].value,
      tierLabel: list.tiers[row[0]].label,
      type: TYPE_NAME[row[1]] || 'other',
      name: row[2],
      abbr: row[3] || '',
      metric: row[4] ?? null,
      flags: row[5] || [],
    });

    // Picks one candidate: never a journal for a venue that calls itself a conference,
    // the one matching the venue's type when several remain, else only an unambiguous one.
    function prefer(cands, type, conf) {
      if (!cands || !cands.length) return null;
      const ok = conf ? cands.filter((e) => e.type !== 'journal') : cands;
      return ok.find((e) => e.type === type) || (ok.length === 1 ? ok[0] : null);
    }

    // Abbreviations of 4+ characters that appear as a standalone word (CVPR, NeurIPS).
    function abbrWords(raw) {
      // In an ALL-CAPS venue every word looks like an abbreviation.
      if ((raw.match(/[A-Za-z]{3,}/g) || []).length >= 3 && raw === raw.toUpperCase()) return [];
      return (raw.match(/[A-Za-z][A-Za-z0-9&-]{2,}/g) || [])
        .filter((w) => w.length >= 4 && (w === w.toUpperCase() || /^[A-Z][a-z]+[A-Z]/.test(w)))
        .map((w) => w.toLowerCase());
    }

    function prepare(raw, type) {
      if (!raw || NEVER_RANKED.has(type) || SATELLITE.test(raw) || /^arxiv/i.test(raw)) return null;
      let { text, truncated } = cleanVenue(raw);
      // "ACM Transactions on Graphics (TOG)": the parenthesised abbreviation is a strong signal.
      const paren = /\(([A-Z][A-Za-z0-9&-]{1,15})\)/.exec(text);
      if (paren) text = text.replace(paren[0], ' ');
      const vt = new Set(tokens(text));
      if (!vt.size && !fullKey(text)) return null;
      return {
        raw, type, truncated, vt,
        conf: CONF_SIGNAL.test(raw),
        paren: paren ? paren[1].toLowerCase() : null,
        key: vt.size ? keyOf(vt) : `=${fullKey(text)}`,
        full: fullKey(text),
        words: abbrWords(raw),
      };
    }

    // Fuzzy score of a candidate key against the venue's words: one name's words must contain
    // the other's; a truncated venue only shows a prefix, so it may cover part of a name.
    function fuzzyScore(key, v) {
      const kt = keyTokens(key);
      if (!kt.length) return 0;
      let inter = 0;
      for (const t of kt) if (v.vt.has(t)) inter++;
      const jac = inter / (kt.length + v.vt.size - inter);
      if (inter === kt.length && jac >= MIN_SCORE) return jac;
      if (v.truncated && inter === v.vt.size && inter / kt.length >= (v.vt.size >= 3 ? 0.3 : 0.6)) return inter / kt.length;
      return 0;
    }

    async function resolve(venues) {
      const meta = await metaP;
      const abbr = await abbrP;
      const lists = meta.lists;
      const prepared = new Map();
      for (const { raw, type } of venues) {
        if (!prepared.has(raw)) prepared.set(raw, prepare(raw, type));
      }
      const vs = [...prepared.values()].filter(Boolean);

      // Stage 1: exact keys and abbreviations.
      const wanted = new Set();
      for (const v of vs) {
        wanted.add(v.key);
        for (const a of [v.paren, ...v.words]) (abbr[a] || []).forEach((k) => wanted.add(k));
      }
      const records = await getAll('r', wanted);
      const entriesFor = (keys, list, abbrFilter) => {
        const out = [];
        for (const k of keys) {
          for (const row of (records.get(k) || {})[list.id] || []) {
            const e = entryOf(list, row);
            if (!abbrFilter || e.abbr.toLowerCase() === abbrFilter) out.push(e);
          }
        }
        return out;
      };
      const result = new Map(); // raw -> { listId: entry }
      const pending = [];        // venues still unmatched in some non-strict list
      for (const v of vs) {
        const hits = {};
        for (const list of lists) {
          let hit = v.paren ? prefer(entriesFor(abbr[v.paren] || [], list, v.paren), v.type, v.conf) : null;
          // The exact full name beats a mere same-words key ("Pattern Recognition" vs ICPR).
          const sameKey = entriesFor([v.key], list);
          hit = hit || prefer(sameKey.filter((e) => fullKey(e.name) === v.full), v.type, v.conf);
          hit = hit || prefer(sameKey, v.type, v.conf);
          for (const w of v.words) {
            if (hit) break;
            hit = prefer(entriesFor(abbr[w] || [], list, w), v.type, v.conf);
          }
          if (hit) hits[list.id] = hit;
        }
        result.set(v.raw, hits);
        if (lists.some((l) => !l.strict && !hits[l.id]) && v.vt.size) pending.push(v);
      }

      // Stage 2: fuzzy matching through word postings, for lists that allow it.
      if (pending.length) {
        const words = new Set();
        pending.forEach((v) => v.vt.forEach((t) => words.add(t)));
        const postings = await getAll('t', words);
        const scored = pending.map((v) => {
          const cands = new Map();
          v.vt.forEach((t) => (postings.get(t) || []).forEach((k) => {
            if (!cands.has(k)) {
              const s = fuzzyScore(k, v);
              if (s) cands.set(k, s);
            }
          }));
          return { v, cands };
        });
        const more = new Set();
        scored.forEach(({ cands }) => cands.forEach((_, k) => { if (!records.has(k)) more.add(k); }));
        (await getAll('r', more)).forEach((rec, k) => records.set(k, rec));
        for (const { v, cands } of scored) {
          const hits = result.get(v.raw);
          for (const list of lists) {
            if (list.strict || hits[list.id]) continue;
            let best = [], bestScore = 0;
            for (const [k, s] of cands) {
              if (s < bestScore) continue;
              const es = entriesFor([k], list).filter((e) => !(v.conf && e.type === 'journal'));
              if (!es.length) continue;
              if (s > bestScore) { best = []; bestScore = s; }
              best.push(...es);
            }
            const typed = best.filter((e) => e.type === v.type);
            const hit = typed.length === 1 ? typed[0] : best.length === 1 ? best[0] : null;
            if (hit) hits[list.id] = hit;
          }
        }
      }

      return lists.map((list) => ({
        config: list,
        tiers: list.tiers,
        metric: list.metric,
        match: (raw) => (result.get(raw) || {})[list.id] || null,
      }));
    }

    return { resolve, meta: metaP };
  }

  // Browser: the index ships inside the extension under index/.
  function openPackagedIndex() {
    return openIndex((p) => fetch(chrome.runtime.getURL(`index/${p}`)).then((r) => {
      if (!r.ok) throw new Error(`index/${p}: HTTP ${r.status}`);
      return r.json();
    }));
  }

  return { parseCSV, tokens, venueKey, cleanVenue, readList, buildIndex, openIndex, openPackagedIndex };
})();

if (typeof module !== 'undefined') module.exports = SA.rankings;
