#!/usr/bin/env node
// Builds index/ from data/rankings.json and the CSVs it lists. Run after changing any list:
//   node tools/build-index.js
const fs = require('fs');
const path = require('path');
const R = require('../src/rankings.js');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');
const outDir = path.join(root, 'index');

const config = JSON.parse(fs.readFileSync(path.join(dataDir, 'rankings.json'), 'utf8'));
const lists = config.lists.map((cfg) => {
  const table = R.parseCSV(fs.readFileSync(path.join(dataDir, cfg.file), 'utf8'));
  const list = R.readList(cfg, table);
  const perTier = {};
  list.entries.forEach((e) => { const l = list.meta.tiers[e.tier].label; perTier[l] = (perTier[l] || 0) + 1; });
  console.log(`${cfg.id.padEnd(14)} ${String(table.rows.length).padStart(6)} rows -> ${String(list.entries.length).padStart(6)} entries  ${JSON.stringify(perTier)}`);
  return list;
});

const { files } = R.buildIndex(lists);

// Replace the previous build entirely so removed lists leave no stale shards.
fs.rmSync(outDir, { recursive: true, force: true });
let total = 0, largest = 0;
for (const [rel, json] of Object.entries(files)) {
  const file = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = JSON.stringify(json);
  fs.writeFileSync(file, text);
  total += text.length;
  largest = Math.max(largest, text.length);
}
const meta = files['meta.json'];
console.log(`index/: ${meta.venues} venues, ${Object.keys(files).length} files, ${(total / 1e6).toFixed(1)} MB total, largest file ${(largest / 1e3).toFixed(0)} KB`);
