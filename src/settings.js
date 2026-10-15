// User settings shared by the popup, the profile panel and the search-results marks.
// Stored in chrome.storage.local, so they persist across pages and browser restarts.
var SA = globalThis.SA || (globalThis.SA = {});

SA.settings = (() => {
  // marks: what to highlight in Scholar's lists. lists[id] === false disables a ranking list everywhere
  // (statistics, article list and search results). Stored under "rowMarks" for compatibility with v0.1.x.
  const DEFAULTS = {
    lang: null,                       // null = follow the browser language
    marks: { first: true, corresponding: true, lists: {} },
    searchMarks: true,                // ranking badges on Scholar search results
  };

  const area = () => {
    try { return chrome.storage.local; } catch { return null; }
  };

  function load() {
    return new Promise((resolve) => {
      const s = area();
      if (!s) { resolve(structuredClone(DEFAULTS)); return; }
      s.get(['lang', 'rowMarks', 'searchMarks'], (saved) => {
        resolve({
          lang: saved.lang || DEFAULTS.lang,
          marks: { ...DEFAULTS.marks, ...(saved.rowMarks || {}), lists: { ...((saved.rowMarks || {}).lists || {}) } },
          searchMarks: saved.searchMarks !== false,
        });
      });
    });
  }

  function save(settings) {
    const s = area();
    if (!s) return;
    try {
      s.set({ lang: settings.lang, rowMarks: settings.marks, searchMarks: settings.searchMarks });
    } catch { /* extension reloaded */ }
  }

  // Calls fn(settings) whenever the popup (or another page) changes a setting.
  function onChange(fn) {
    try {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && ['lang', 'rowMarks', 'searchMarks'].some((k) => k in changes)) load().then(fn);
      });
    } catch { /* not in an extension context (test harness) */ }
  }

  const listEnabled = (settings, id) => settings.marks.lists[id] !== false;

  return { load, save, onChange, listEnabled, DEFAULTS };
})();
