// Popup logic: settings persistence + fill/undo via the service worker
// (which owns tab access). The popup never talks to a tab directly.
const $ = (id) => document.getElementById(id);
const DEFAULTS = { seed: 0, skipFilled: true, fillPasswords: true, highlight: true };

chrome.storage.sync.get(DEFAULTS).then((s) => {
  $('seed').value = s.seed || 0;
  $('skipFilled').checked = !!s.skipFilled;
  $('fillPasswords').checked = !!s.fillPasswords;
  $('highlight').checked = !!s.highlight;
});

function saveSettings() {
  chrome.storage.sync.set({
    seed: Math.max(0, Math.floor(Number($('seed').value) || 0)),
    skipFilled: $('skipFilled').checked,
    fillPasswords: $('fillPasswords').checked,
    highlight: $('highlight').checked
  });
}

function send(type) {
  return chrome.runtime.sendMessage({ type }).catch(() => null);
}

function showStats(res, verb) {
  const el = $('stats');
  if (!res) {
    el.textContent = 'Could not run on this page (try a normal http(s) page).';
    return;
  }
  el.innerHTML =
    `${verb}: <b>${res.filled}</b> filled` +
    (res.invalid ? `, <b>${res.invalid}</b> unmatched` : '') +
    (res.skipped ? `, ${res.skipped} skipped` : '');
}

for (const id of ['seed', 'skipFilled', 'fillPasswords', 'highlight']) {
  $(id).addEventListener('change', saveSettings);
}

$('fill').addEventListener('click', async () => {
  saveSettings();
  const res = await send('ua-ff:fill');
  showStats(res, 'Done');
});

$('undo').addEventListener('click', async () => {
  const res = await send('ua-ff:undo');
  showStats(res, 'Undone');
});
