# Scholar Assistant (Chrome extension)

Adds a statistics section to the **Cited by** box on Google Scholar profile pages (`/citations?user=...`),
below Scholar's own citation table and chart. It starts expanded on every page load and can be collapsed from its header.
It loads every publication on the profile automatically (100 per request, ~1 s apart) and computes:

- **Overview**: papers, citations, h / g / i10 / e-index, m-quotient, academic age, mean/median citations,
  uncited papers, h-core share, last-5-year output and citations, year-over-year citation growth.
  Charts: citations received per year, papers per year, papers by citation count.
- **Authorship**: first / last / middle and corresponding author counts with their citations and h-index
  (sole-authored papers count as first author; a name ending in `*`, e.g. `Z Xiao*`, marks the corresponding author),
  mean/median team size, byline position distribution. The owner's byline name is auto-detected and can be overridden.
- **Venues**: publication types (journal, conference, preprint, patent, …) and top venues with citations.
- **Co-authors**: distinct and repeat co-authors, co-authored share, top co-authors.
- **Rankings**: for each list in `data/rankings.json`, papers per tier with their citations and first-author
  counts, journal/conference split, list-specific extras (mean impact factor, Top / 预警 journals), and a list of
  matched papers filterable by tier or flag. Every list also gets a summary tile in Overview.

  | List | File | Tiers | Extras |
  |---|---|---|---|
  | CCF 推荐目录 2026 | `CCF2026-UTF8.csv` | A / B / C | journals and conferences |
  | 国际期刊预警名单 2025 | `GJQKYJMD2025.csv` | warning reason | warning list, exact names only |
  | 中科院分区表 2025 | `FQBJCR2025-UTF8.csv` | 1–4区 (大类分区) | Top, 预警 marks |
  | JCR 2025 | `JCR2025-UTF8.csv` | Q1–Q4 (best across categories) | impact factor |
  | 新锐期刊分区 2026 | `XR2026-UTF8.csv` | 1–4区 (大类新锐分区) | Top, 预警 marks |

**Article list marks.** Rows of Scholar's own article list (left) are marked too: first-author and
corresponding-author papers get a tinted background, a "一作" / "通讯" badge and the scholar's name in bold, and each paper gets a badge per matching ranking
list (e.g. `CCF-A`, `中科院-1区 Top`, `JCR-Q1 · IF 9.1`; top tiers are emphasized, warnings are red). Rows added by
"Show more" are marked as they appear. Each mark can be switched off in the Rankings tab ("在左侧文章列表中标注").

UI is available in Chinese and English (toggle in the section header; defaults to the browser language).

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. Open any Google Scholar profile, for example `https://scholar.google.com/citations?user=JicYPdAAAAAJ`.

## Ranking lists

Ranking lists live in `data/` and are declared in `data/rankings.json`. To add one (CORE, CAS 分区, a school's own list, ...):

1. Put a UTF-8 CSV in `data/`, one row per venue, with a header row.
2. Add an entry to `lists` in `data/rankings.json`:

   ```json
   {
     "id": "core2023",
     "name": "CORE 2023",
     "shortName": "CORE",
     "file": "CORE2023.csv",
     "columns": { "abbr": "Acronym", "name": "Title", "tier": "Rank", "type": "Type" },
     "typeValues": { "Journal": "journal", "Conference": "conference" },
     "tiers": [{ "value": "A*", "label": "A*" }, { "value": "A", "label": "A" }, { "value": "B", "label": "B" }],
     "aliases": { "Advances in Neural Information Processing Systems": "NeurIPS" }
   }
   ```

   - `columns` maps your CSV's header names. Only `name` is required; `abbr`, `tier`, `type` and `field` are optional.
   - `columns.tier` may also be a list of columns; the best tier across them is used (JCR quartiles per category).
   - `tierPattern` (optional) is a regex whose first group is the tier, e.g. `"^\\s*(\\d)"` (as written in JSON) turns `4 [625/778]` into `4`.
   - `tiers` (optional) lists the tier values to count, in display order; rows with other values are ignored.
     Without it, tiers are the distinct values of the `tier` column in file order (or one tier if there is no `tier` column).
   - `metric` (optional), e.g. `{ "column": "IF(2025)", "label": "IF", "decimals": 1 }`, is shown per paper and as a mean.
   - `flags` (optional) mark venues, e.g. `{ "column": "Top", "equals": "是", "label": "Top" }`; use `contains` or
     `notEmpty: true` instead of `equals` as needed, and `warn: true` to show the flag in red.
   - `defaultType` (optional) sets `journal` or `conference` for every row when there is no `type` column.
   - `kind: "warning"` (optional) marks a list of venues to avoid, such as the 国际期刊预警名单: it is shown in red
     with warning wording, and it matches exact names only (`strict: true`), because a near-miss would flag the wrong journal.
   - `aliases` maps venue names as Scholar prints them to an abbreviation or full name in the list,
     for venues whose Scholar name differs a lot from the official one.
3. Rebuild the index, then reload the extension:

   ```bash
   node tools/build-index.js
   ```

   With more than one list, the Rankings tab shows a selector; the choice is remembered.

### The index

The extension never reads the CSVs. `tools/build-index.js` merges all lists into `index/`: one record per
distinct venue name holding its tier, metric and flags in every list, split into 64 small shard files by a hash
of the venue key (`index/r/`), plus word postings for fuzzy matching (`index/t/`), abbreviations (`abbr.json`)
and list descriptions (`meta.json`). At run time the extension computes the keys and words of the scholar's own
venue strings and fetches only the shards they hash to — typically a few dozen files of under 100 KB each instead
of ~12 MB of CSV. `index/` is generated: commit it after rebuilding, since Chrome loads the folder as-is.

Venue matching (`src/rankings.js`) tries, in order: a parenthesised abbreviation such as "(TOG)", the exact
normalized full name, a standalone abbreviation of 4+ letters (e.g. "CVPR 2020"), then a word-overlap match that
also handles names Scholar truncated with "…". Workshops, Findings, companions and newsletters are never counted,
and a venue that calls itself a conference is never credited to a journal of the same name (ICML vs *Machine Learning*).
Matching logic lives in `src/rankings.js` and is shared by the build script (Node) and the extension.

## Limitations

- Scholar truncates long author lists with "...". Those papers are left out of team-size stats, and
  last authorship can't be determined for them.
- Venue names are normalized from Scholar's raw strings and publication types are keyword heuristics.
- Co-authors are merged by first initial + surname, so namesakes can merge.
- Ranking matches are heuristic: a heavily truncated or unusual venue string can be missed, and a book
  chapter titled like a journal can be counted as that journal.
- If Scholar shows a CAPTCHA partway through, the panel says so and shows stats for the papers loaded so far.

## Development

`test/harness.html` renders the panel with synthetic data and no network access.
Serve the repo root (for example `python -m http.server 8766`) and open `/test/harness.html`.
`src/stats.js` has no DOM dependencies and can be `require`d from Node.
