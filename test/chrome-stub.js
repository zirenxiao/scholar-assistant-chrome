// Minimal chrome.* stand-in for the test pages. Storage lives in localStorage, so test pages open in
// different tabs share settings, and a change in one tab fires storage.onChanged in the others.
(() => {
  const KEY = 'sa-test-storage';
  const listeners = [];
  const read = (raw = localStorage.getItem(KEY)) => { try { return JSON.parse(raw || '{}'); } catch { return {}; } };
  const diff = (before, after) => Object.fromEntries(Object.keys({ ...before, ...after })
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((k) => [k, { oldValue: before[k], newValue: after[k] }]));
  const notify = (changes) => { if (Object.keys(changes).length) listeners.forEach((fn) => fn(changes, 'local')); };

  window.chrome = {
    runtime: {
      getURL: (p) => new URL(`../${p}`, location.href).href,
      getManifest: () => ({ version: 'test' }),
    },
    storage: {
      local: {
        get(keys, cb) {
          const data = read();
          cb(Object.fromEntries([].concat(keys).filter((k) => k in data).map((k) => [k, data[k]])));
        },
        set(obj) {
          const before = read();
          const after = { ...before, ...JSON.parse(JSON.stringify(obj)) };
          localStorage.setItem(KEY, JSON.stringify(after));
          notify(diff(before, after));
        },
      },
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
  };
  // Changes saved by another tab (e.g. test/popup.html) arrive as a "storage" event.
  window.addEventListener('storage', (e) => { if (e.key === KEY) notify(diff(read(e.oldValue), read(e.newValue))); });
})();
