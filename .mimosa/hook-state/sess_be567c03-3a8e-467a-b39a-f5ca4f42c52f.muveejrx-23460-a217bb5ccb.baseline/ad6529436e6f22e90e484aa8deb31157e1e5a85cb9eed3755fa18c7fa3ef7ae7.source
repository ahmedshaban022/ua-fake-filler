// Fill engine. Strategy per field:
//   1. Classify (detect.js), read every declared constraint.
//   2. Generate a candidate: pattern sample > lookahead flags > kind
//      generator.
//   3. Verify with the browser's own validity state (covers pattern,
//      minlength/maxlength, min/max, step, and typeMismatch), retrying with
//      fresh values before giving up and leaving the field untouched.
//   4. Commit through native setters + input/change events so React, Vue,
//      Angular, and jQuery apps all see the value.
// Every fill snapshots prior values for one-click undo.
'use strict';

(function () {
  const UAF = (window.UAFakeFillerCore = window.UAFakeFillerCore || {});
  const pad2 = (n) => String(n).padStart(2, '0');

  // ---------- settings ----------

  const DEFAULTS = {
    seed: 0,          // 0 = fresh random data each fill
    skipFilled: true, // leave non-empty fields alone
    fillPasswords: true,
    highlight: true
  };

  async function getSettings() {
    try {
      const stored = await chrome.storage.sync.get(DEFAULTS);
      return Object.assign({}, DEFAULTS, stored);
    } catch (_) {
      return Object.assign({}, DEFAULTS);
    }
  }

  // ---------- value plumbing ----------

  const inputProto = HTMLInputElement.prototype;
  const nativeInputValue = Object.getOwnPropertyDescriptor(inputProto, 'value');
  const nativeTextareaValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  const nativeChecked = Object.getOwnPropertyDescriptor(inputProto, 'checked');
  const nativeSelectValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');

  function setSilent(el, value) {
    if (el.tagName === 'TEXTAREA') {
      nativeTextareaValue.set.call(el, value);
    } else if (el.tagName === 'SELECT') {
      nativeSelectValue.set.call(el, value);
    } else if (el.type === 'checkbox' || el.type === 'radio') {
      nativeChecked.set.call(el, !!value);
    } else if (el.isContentEditable) {
      el.textContent = value;
    } else {
      nativeInputValue.set.call(el, value);
    }
  }

  function commit(el, value) {
    setSilent(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ---------- validation ----------

  function typeOk(el, value) {
    // validity.typeMismatch covers email/url; tel is free-form by spec.
    return !el.validity || !el.validity.typeMismatch;
  }

  function patternOk(el, value) {
    const p = el.getAttribute && el.getAttribute('pattern');
    if (!p || value === '') return true;
    try {
      return new RegExp('^(?:' + p + ')$').test(value);
    } catch (_) {
      return true;
    }
  }

  function lengthOk(info, value) {
    if (!value) return true;
    if (info.max && value.length > info.max) return false;
    // minlength is only enforced by browsers on dirty fields; enforce here.
    if (info.min && value.length < info.min) return false;
    return true;
  }

  function candidateOk(el, info, value) {
    if (value == null) return false;
    if (!lengthOk(info, value)) return false;
    if (!patternOk(el, value)) return false;
    // Full browser check (covers number range/step + typeMismatch + pattern).
    setSilent(el, value);
    if (el.validity && !el.validity.valid) {
      // tooShort is dirty-gated in browsers; our own length check covers it.
      const v = el.validity;
      if (v.tooLong || v.rangeUnderflow || v.rangeOverflow || v.stepMismatch ||
          v.typeMismatch || v.patternMismatch) return false;
    }
    return true;
  }

  // ---------- numbers & dates ----------

  function snapToStep(min, step, v) {
    if (min == null) min = 0;
    return min + Math.round((v - min) / step) * step;
  }

  function numberValue(rng, info) {
    let lo = info.numMin != null ? info.numMin : 0;
    let hi = info.numMax != null ? info.numMax : lo + 100;
    if (hi < lo) hi = lo;
    const step = info.numStep > 0 ? info.numStep : 1;
    let v = snapToStep(info.numMin, step, UAF.int(rng, lo, hi));
    if (v > hi) v = snapToStep(info.numMin, step, hi);
    if (v < lo) v = lo;
    // Integer step -> integer value; decimal step -> one decimal.
    return Number.isInteger(step) ? String(v) : String(Number(v.toFixed(2)));
  }

  function dateRangeFor(info, hint) {
    const now = new Date();
    // ISO min/max attributes on date-like inputs win first.
    if (info.dateMin || info.dateMax) {
      return { min: info.dateMin || new Date(now.getFullYear() - 5, 0, 1), max: info.dateMax || new Date(now.getFullYear() + 5, 11, 31) };
    }
    let min = info.numMin ? new Date(info.numMin, 0, 1) : null;
    let max = info.numMax ? new Date(info.numMax, 11, 31) : null;
    if (/dob|birth/.test(hint)) {
      return { min: new Date(now.getFullYear() - 80, 0, 1), max: new Date(now.getFullYear() - 18, 11, 31) };
    }
    if (/expir|expires|expiration|end|deadline/.test(hint)) {
      return { min: now, max: new Date(now.getFullYear() + 5, 11, 31) };
    }
    if (min || max) return { min, max };
    return { min: new Date(now.getFullYear() - 5, 0, 1), max: new Date(now.getFullYear() + 2, 11, 31) };
  }

  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
    return [t.getUTCFullYear(), pad2(week)];
  }

  function dateValue(rng, info, hint) {
    const type = info.type;
    const range = dateRangeFor(info, hint);
    const d = UAF.generators.dateBetween(rng, range.min, range.max);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    if (type === 'date') return `${y}-${pad2(m)}-${pad2(day)}`;
    if (type === 'time') return `${pad2(UAF.int(rng, 8, 20))}:${pad2(UAF.pick(rng, [0, 5, 10, 15, 30, 45]))}`;
    if (type === 'month') {
      if (info.numMin != null && y < info.numMin) return `${info.numMin}-06`;
      return `${y}-${pad2(m)}`;
    }
    if (type === 'week') {
      const [wy, ww] = isoWeek(d);
      return `${wy}-W${ww}`;
    }
    if (type === 'datetime-local') return `${y}-${pad2(m)}-${pad2(day)}T${pad2(UAF.int(rng, 8, 20))}:${pad2(UAF.int(rng, 0, 59))}`;
    // Text input with a date-ish name.
    if (/expir|expires|expiration/.test(hint) && /mm|\/|yy|month/.test(hint)) {
      const e = new Date(now().getFullYear() + UAF.int(rng, 1, 5), UAF.int(rng, 0, 11), 1);
      return `${pad2(e.getMonth() + 1)}/${String(e.getFullYear()).slice(2)}`;
    }
    return `${pad2(m)}/${pad2(day)}/${y}`;
    function now() { return new Date(); }
  }

  // ---------- selects, radios, checkboxes ----------

  function isPlaceholderOption(text) {
    const t = String(text || '').trim().toLowerCase();
    if (!t) return true;
    return /^(select|choose|pick|please|make a|\-\-+|—+)/.test(t) || /^[-—]+$/.test(t);
  }

  function validOptions(select) {
    return Array.from(select.options).filter(
      (o) => !o.disabled && o.value !== '' && !isPlaceholderOption(o.textContent));
  }

  function fillSelect(select, info, rng) {
    const opts = validOptions(select);
    if (!opts.length) return { ok: false, skipped: true };
    // Try to pick an option matching the semantic kind for realistic data.
    const kindValue = UAF.generators.make(kindForSelect(info.kind), { rng });
    if (kindValue) {
      const want = String(kindValue).toLowerCase();
      const hit = opts.find((o) => {
        const t = (o.textContent || '').trim().toLowerCase();
        return t === want || t.toLowerCase() === want;
      }) || opts.find((o) => (o.textContent || '').toLowerCase().includes(want));
      if (hit) return { ok: true, value: hit.value };
    }
    const opt = UAF.pick(rng, opts);
    return { ok: true, value: opt.value };
  }

  function kindForSelect(kind) {
    // Only kinds where generating then matching an option makes sense.
    if (['country', 'state', 'stateName', 'language', 'month', 'city', 'color', 'jobTitle', 'degree'].includes(kind)) {
      return kind;
    }
    return null;
  }

  const CONSENT_RE = /agree|accept|terms|consent|privacy|policy|tos|gdpr|subscribe|newsletter|optin|opt-in|confirm/;

  function fillCheckbox(el, info, rng, hint) {
    const check = info.required || CONSENT_RE.test(hint) ? true : rng() < 0.5;
    return { ok: true, checked: check };
  }

  function fillRadioGroup(radios, rng) {
    const el = UAF.pick(rng, radios);
    return { ok: true, el, checked: true };
  }

  // ---------- main generation ----------

  const NUMERIC_KINDS = new Set(['money', 'number', 'integer', 'quantity', 'percent', 'rating', 'age']);

  // Numeric kinds must respect step ("0.5") as well as min/max, or the
  // browser reports stepMismatch. Snap and re-clamp after generating.
  function snapNumeric(value, info) {
    const v = Number(value);
    if (!Number.isFinite(v)) return value;
    const step = info.numStep > 0 ? info.numStep : 1;
    let snapped = snapToStep(info.numMin, step, v);
    const lo = info.numMin != null ? info.numMin : -Infinity;
    const hi = info.numMax != null ? info.numMax : Infinity;
    if (snapped > hi) snapped = snapToStep(info.numMin, step, hi);
    if (snapped < lo) snapped = lo;
    if (Number.isInteger(step)) return String(Math.round(snapped));
    const decimals = (String(step).split('.')[1] || '').length;
    return snapped.toFixed(Math.min(decimals, 4));
  }

  function generateValue(info, ctx) {
    const el = info.el;
    const hint = ctx.hint;

    // Pattern has the final say when present.
    if (info.pattern) {
      const sampled = UAF.sampler.sample(info.pattern, '', ctx.rng, {
        min: info.min || 1,
        max: info.max || 128
      });
      if (sampled != null) return sampled;
      const flags = UAF.sampler.analyzeLookarounds(info.pattern);
      if (flags && (info.kind === 'password' || /pass/i.test(hint))) {
        return UAF.generators.make('password', Object.assign({}, ctx, { flags }));
      }
      // Fall through to kind generator; validity check will judge it.
    }
    if (info.kind === 'date' || info.kind === 'time' || info.kind === 'datetime' ||
        info.kind === 'month' || info.kind === 'week' || info.kind === 'cardExpiry') {
      return dateValue(ctx.rng, info, hint);
    }
    const v = UAF.generators.make(info.kind, ctx);
    if (v != null && NUMERIC_KINDS.has(info.kind) &&
        (info.type === 'number' || info.type === 'range' || info.numStep !== 1)) {
      return snapNumeric(v, info);
    }
    return v;
  }

  function fillTextField(el, info, ctx, attempts) {
    const seedCtx = Object.assign({}, ctx, { min: info.min, max: info.max });
    let last = null;
    for (let i = 0; i < attempts; i++) {
      const v = generateValue(info, seedCtx);
      if (v == null) continue;
      last = v;
      if (candidateOk(el, info, v)) return { ok: true, value: v };
    }
    // Last resort: accept only if the browser's own validity agrees.
    if (last != null) {
      setSilent(el, last);
      if (patternOk(el, last) && lengthOk(info, last) && typeOk(el, last) &&
          (!el.validity || el.validity.valid)) {
        return { ok: true, value: last };
      }
    }
    return { ok: false };
  }

  // ---------- highlight ----------

  function flash(el) {
    try {
      el.classList.add('uaff-flash');
      setTimeout(() => el.classList.remove('uaff-flash'), 1200);
    } catch (_) { /* detached node */ }
  }

  function ensureStyle() {
    if (document.getElementById('uaff-style')) return;
    const st = document.createElement('style');
    st.id = 'uaff-style';
    st.textContent = '.uaff-flash{outline:2px solid #7c3aed!important;outline-offset:1px}';
    (document.head || document.documentElement).appendChild(st);
  }

  // ---------- snapshot / undo ----------

  function snapshot(el) {
    return {
      el,
      value: el.isContentEditable ? el.innerHTML : (el.value != null ? el.value : null),
      checked: el.type === 'checkbox' || el.type === 'radio' ? el.checked : undefined
    };
  }

  function reapply(snap) {
    const el = snap.el;
    if (!el || !el.isConnected) return;
    if (el.type === 'checkbox' || el.type === 'radio') {
      commit(el, snap.checked);
    } else if (el.isContentEditable) {
      el.innerHTML = snap.value || '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      commit(el, snap.value == null ? '' : snap.value);
    }
  }

  // ---------- run ----------

  UAF.run = async function run(opts) {
    const settings = await getSettings();
    opts = opts || {};
    const rng = UAF.makeRng(opts.seed || settings.seed || 0);
    const fields = UAF.detect.discover(document, 2);

    const history = (window.__uaffHistory = window.__uaffHistory || []);
    const snap = [];
    let filled = 0, invalid = 0, skipped = 0;

    if (settings.highlight) ensureStyle();

    // Radio groups: fill once per name.
    const radioGroups = new Map();

    for (const info of fields) {
      const el = info.el;
      if (el.disabled || el.readOnly) { skipped++; continue; }
      if (settings.skipFilled && !el.isContentEditable) {
        const val = el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value;
        if (val) { skipped++; continue; }
      }
      if (settings.fillPasswords === false && info.kind === 'password') { skipped++; continue; }

      const hint = [
        el.name, el.id, el.placeholder, el.getAttribute('aria-label'), UAF.fieldLabel(el)
      ].filter(Boolean).join(' ').toLowerCase();

      if (el.type === 'radio') {
        const key = (el.form || document) + '|' + (el.name || '');
        if (radioGroups.has(key)) { skipped++; continue; }
        radioGroups.set(key, true);
        const group = Array.from(document.querySelectorAll(
          'input[type="radio"][name="' + (CSS.escape(el.name || '')) + '"]'))
          .filter((r) => UAF.isVisible(r) && !r.disabled);
        if (!group.length) { skipped++; continue; }
        snap.push(snapshot(el));
        const res = fillRadioGroup(group, rng);
        commit(res.el, true);
        if (settings.highlight) flash(res.el);
        filled++;
        continue;
      }

      if (el.type === 'checkbox') {
        snap.push(snapshot(el));
        const res = fillCheckbox(el, info, rng, hint);
        commit(el, res.checked);
        if (settings.highlight) flash(el);
        filled++;
        continue;
      }

      if (el.tagName === 'SELECT') {
        const res = fillSelect(el, info, rng);
        if (!res.ok) { skipped++; continue; }
        snap.push(snapshot(el));
        commit(el, res.value);
        if (settings.highlight) flash(el);
        filled++;
        continue;
      }

      // Text-like fields.
      const ctx = { rng, hint, min: info.min, max: info.max, numMin: info.numMin, numMax: info.numMax };
      snap.push(snapshot(el));
      const res = fillTextField(el, info, ctx, 8);
      if (res.ok) {
        commit(el, res.value);
        if (settings.highlight) flash(el);
        filled++;
      } else {
        invalid++;
        setSilent(el, snap[snap.length - 1].value); // restore whatever was there
      }
    }

    if (snap.length) {
      history.push(snap);
      if (history.length > 5) history.shift();
    }
    return { filled, invalid, skipped };
  };

  UAF.restore = async function restore() {
    const history = window.__uaffHistory || [];
    const last = history.pop();
    let restored = 0;
    if (last) {
      for (const s of last) {
        try {
          reapply(s);
          restored++;
        } catch (_) { /* gone */ }
      }
    }
    return { restored };
  };
})();
