// Shared injection helper used by the service worker and the popup.
// Injects the content bundle into every accessible frame of a tab, then
// invokes a function in the same isolated world to run or undo a fill.

export const CONTENT_FILES = [
  'content/core.js',
  'content/data.js',
  'content/pattern.js',
  'content/generators.js',
  'content/detect.js',
  'content/fill.js',
  'content/index.js'
];

function sumResults(results) {
  const totals = { filled: 0, invalid: 0, skipped: 0, frames: 0 };
  for (const r of results || []) {
    const v = r && r.result;
    if (v && typeof v === 'object') {
      totals.filled += v.filled || 0;
      totals.invalid += v.invalid || 0;
      totals.skipped += v.skipped || 0;
      if (v.filled) totals.frames += 1;
    }
  }
  return totals;
}

export async function fillTab(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: CONTENT_FILES
  });
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () =>
      window.UAFakeFiller
        ? window.UAFakeFiller.run().catch(() => ({ filled: 0, invalid: 0, skipped: 0 }))
        : { filled: 0, invalid: 0, skipped: 0 }
  });
  return sumResults(results);
}

export async function undoTab(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: CONTENT_FILES
  });
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () =>
      window.UAFakeFiller
        ? window.UAFakeFiller.restore().catch(() => ({ filled: 0, invalid: 0, skipped: 0 }))
        : { filled: 0, invalid: 0, skipped: 0 }
  });
  return sumResults(results);
}
