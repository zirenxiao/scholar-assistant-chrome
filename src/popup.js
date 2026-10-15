// Toolbar popup: which ranking lists are enabled, what to mark, and the interface language.
// Every change is saved immediately to chrome.storage.local; open Scholar pages update live.
(async () => {
  const { i18n, settings: store } = SA;
  const t = i18n.t;
  const L = i18n.L;
  const $ = (id) => document.getElementById(id);

  const settings = await store.load();
  if (settings.lang) i18n.lang = settings.lang;
  // List names and tiers come from the packaged index, so new lists appear here automatically.
  const meta = await fetch(chrome.runtime.getURL('index/meta.json')).then((r) => r.json()).catch(() => ({ lists: [] }));

  function renderText() {
    document.documentElement.lang = i18n.lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-t]').forEach((e) => { e.textContent = t(e.dataset.t); });
    $('version').textContent = `v${chrome.runtime.getManifest().version}`;
    renderLists();
  }

  function renderLists() {
    const box = $('lists');
    box.textContent = '';
    meta.lists.forEach((list) => {
      const row = document.createElement('label');
      row.className = 'check';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = store.listEnabled(settings, list.id);
      input.addEventListener('change', () => {
        settings.marks.lists[list.id] = input.checked;
        save();
      });
      const text = document.createElement('span');
      const name = document.createElement('span');
      name.textContent = L(list.name);
      const tiers = document.createElement('small');
      tiers.textContent = list.tiers.map((x) => L(x.label)).join(' / ');
      text.append(name, tiers);
      if (list.kind === 'warning') row.classList.add('warn');
      row.append(input, text);
      box.appendChild(row);
    });
  }

  let statusTimer;
  function save() {
    store.save(settings);
    $('status').textContent = t('popupSaved');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { $('status').textContent = ''; }, 1500);
  }

  $('lang').value = settings.lang || '';
  $('lang').addEventListener('change', () => {
    settings.lang = $('lang').value || null;
    i18n.lang = settings.lang || i18n.browserLang;
    renderText();
    save();
  });
  [['first', 'first'], ['corresponding', 'corresponding']].forEach(([id, key]) => {
    $(id).checked = settings.marks[key] !== false;
    $(id).addEventListener('change', () => { settings.marks[key] = $(id).checked; save(); });
  });
  $('searchMarks').checked = settings.searchMarks;
  $('searchMarks').addEventListener('change', () => { settings.searchMarks = $('searchMarks').checked; save(); });

  renderText();
})();
