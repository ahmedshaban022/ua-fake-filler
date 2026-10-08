// Core utilities: seeded RNG so a seed regenerates identical data, DOM
// helpers, and iframe traversal. Everything stays dependency-free.
'use strict';

const UAF = (window.UAFakeFillerCore = window.UAFakeFillerCore || {});

// --- Seeded RNG (mulberry32). A seed of 0 means "true random" per fill. ---
UAF.makeRng = function makeRng(seed) {
  let a = seed >>> 0;
  if (a === 0) {
    // Unseeded fill: draw real entropy when available (nothing here is
    // cryptographic; the seeded path below is intentionally reproducible).
    if (window.crypto && window.crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      a = buf[0] >>> 0;
    } else {
      a = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    }
  }
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

UAF.pick = function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
};

// Random integer in [min, max], both inclusive.
UAF.int = function int(rng, min, max) {
  if (!Number.isFinite(min)) min = 0;
  if (!Number.isFinite(max)) max = min;
  if (max < min) [min, max] = [max, min];
  return Math.floor(rng() * (max - min + 1)) + min;
};

// --- DOM helpers ---

const TAGS = 'INPUT,TEXTAREA,SELECT';

UAF.isVisible = function isVisible(el) {
  if (!el || !el.getClientRects().length) return false;
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none') return false;
  if (el.disabled || el.readOnly) return false;
  return true;
};

UAF.fieldLabel = function fieldLabel(el) {
  // 1. <label for=id>  2. wrapping <label>  3. aria-label  4. aria-labelledby
  // 5. placeholder  6. name  7. title  8. table header cell to the left.
  if (el.id) {
    const lbl = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
    if (lbl) return lbl.textContent || '';
  }
  const wrap = el.closest('label');
  if (wrap) return wrap.textContent || '';
  const ariaBy = el.getAttribute('aria-labelledby');
  if (ariaBy) {
    let text = '';
    for (const id of ariaBy.split(/\s+/)) {
      const n = id && document.getElementById(id);
      if (n) text += ' ' + (n.textContent || '');
    }
    if (text.trim()) return text;
  }
  const named =
    el.getAttribute('aria-label') ||
    el.placeholder ||
    el.name ||
    el.title ||
    '';
  if (named) return named;
  // Common table layout: label lives in the cell to the left of the input.
  const cell = el.closest('td');
  if (cell) {
    const prev = cell.previousElementSibling;
    if (prev) return prev.textContent || '';
  }
  return '';
};

// Collect fillable fields in this document, descending into same-origin
// iframes (one level of recursion via depth guard in callers).
UAF.collectFields = function collectFields(root, depth) {
  const out = [];
  const scope = root || document;
  scope.querySelectorAll(TAGS).forEach((el) => {
    if (!UAF.isVisible(el)) return;
    if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button' ||
        el.type === 'image' || el.type === 'reset' || el.type === 'file') return;
    if (el.dataset.uaffSkip === '1') return;
    out.push(el);
  });
  // Contenteditable rich-text areas.
  scope.querySelectorAll('[contenteditable="true"],[contenteditable=""]').forEach((el) => {
    if (UAF.isVisible(el)) out.push(el);
  });
  if (depth > 0) {
    scope.querySelectorAll('iframe').forEach((f) => {
      try {
        const doc = f.contentDocument;
        if (doc && doc.body) out.push(...UAF.collectFields(doc, depth - 1));
      } catch (_) {
        /* cross-origin iframe: not reachable */
      }
    });
  }
  return out;
};
