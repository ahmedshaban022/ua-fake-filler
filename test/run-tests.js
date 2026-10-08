// Unit tests for the content-script logic (sampler, generators, detection).
// Runs with plain Node: node test/run-tests.js
//
// The content scripts are plain scripts that hang everything off
// `window`, so we alias window to globalThis and require them directly.
// DOM-heavy code (fill.js) is exercised via the demo page instead.
'use strict';

global.window = globalThis;

require('../content/core.js');
require('../content/data.js');
require('../content/pattern.js');
require('../content/generators.js');
require('../content/detect.js');

const U = global.window.UAFakeFillerCore;

// ---------- harness ----------

let pass = 0, fail = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(name + (detail ? ` :: ${detail}` : ''));
  }
}

function eq(name, actual, expected) {
  check(name, actual === expected, `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

// ---------- pattern sampler ----------

{
  const rng = U.makeRng(7);
  const cases = [
    '^\\d{5}$',
    '^[A-Z]{2,3}-\\d{4}$',
    '[a-c]{3}',
    '^\\+?[0-9]{7,15}$',
    '\\d{3}-\\d{2}-\\d{4}',
    '^(?:AB|CD)\\d{2}$',
    '[A-F0-9]{8}',
    '[^0-9]{4}',
    '^[a-z]{4}[0-9]{2}$',
    '\\u0041{2}',
    'a?',
    '^\\(\\d{3}\\) \\d{3}-\\d{4}$',
    '[A-Za-z0-9_-]{6,12}'
  ];
  for (const src of cases) {
    for (let i = 0; i < 25; i++) {
      const s = U.sampler.sample(src, null, rng, {});
      check(`sample ${src} -> non-null`, s != null, 'null');
      if (s == null) break;
      let re;
      try { re = new RegExp(src); } catch (_) { re = null; }
      if (re) check(`sample ${src} matches`, re.test(s), JSON.stringify(s));
    }
  }

  // unsupported / dangerous constructs -> null (callers fall back)
  eq('backref rejected', U.sampler.parse('(a)\\1'), null);
  eq('lookaround rejected by parse', U.sampler.parse('(?=.*\\d).{8,}'), null);
  eq('nested quantifier rejected', U.sampler.parse('(a+)+$'), null);
  eq('huge bound rejected', U.sampler.parse('a{900}'), null);
  eq('unterminated class rejected', U.sampler.parse('[a-'), null);

  // lookahead analysis
  const fl = U.sampler.analyzeLookarounds('(?=.*\\d)(?=.*[a-z])(?=.*[A-Z]).{8,}');
  check('lookahead digit', fl && fl.digit === true);
  check('lookahead lower', fl && fl.lower === true);
  check('lookahead upper', fl && fl.upper === true);
  check('lookahead min', fl && fl.min === 8);
  const fl2 = U.sampler.analyzeLookarounds('(?=.*[!@#$%^&*])(?=.*\\d).{10,20}$');
  check('lookahead special', fl2 && fl2.special === true);
  check('lookahead max', fl2 && fl2.max === 20);
  eq('no lookahead -> null', U.sampler.analyzeLookarounds('^\\d{4}$'), null);
  const fl3 = U.sampler.analyzeLookarounds('(?=.*[A-Z]).{6,}');
  check('upper-only not special', fl3 && fl3.upper && !fl3.special);
}

// ---------- generators ----------

{
  const rng = U.makeRng(42);
  for (let i = 0; i < 30; i++) {
    const e = U.generators.make('email', { rng });
    check('email format', /^[a-z0-9._-]+@[a-z0-9.-]+$/.test(e), e);
    const p = U.generators.make('phone', { rng });
    check('phone NANP', /^[2-9]\d{2}-555-01\d{2}$/.test(p), p);
    const u = U.generators.make('uuid', { rng });
    check('uuid v4', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/.test(u), u);
    const n = U.generators.make('integer', { rng, numMin: 5, numMax: 10 });
    const nv = Number(n);
    check('integer in range', nv >= 5 && nv <= 10 && Number.isInteger(nv), n);
    const m = U.generators.make('money', { rng, numMin: 1, numMax: 99 });
    check('money 2dp', /^\d+\.\d{2}$/.test(m), m);
    const pw = U.generators.make('password', { rng, min: 10, max: 16, flags: { digit: 1, lower: 1, upper: 1, special: 1, min: 8 } });
    check('pw length', pw.length >= 10 && pw.length <= 16, pw);
    check('pw classes', /[0-9]/.test(pw) && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[^a-zA-Z0-9]/.test(pw), pw);
    const w = U.generators.make('message', { rng, min: 80 });
    check('message min len', w.length >= 80, `${w.length}`);
    const z = U.generators.make('zip', { rng });
    check('zip 5 digits', /^\d{5}$/.test(z), z);
  }

  // determinism: same seed, same output sequence
  const a = U.makeRng(1234);
  const b = U.makeRng(1234);
  let same = true;
  for (let i = 0; i < 100; i++) if (a() !== b()) same = false;
  eq('rng deterministic', same, true);

  // regression: otp/text kinds must have generators
  const otp = U.generators.make('otp', { rng });
  check('otp 6 digits', /^\d{6}$/.test(otp), otp);
  const txt = U.generators.make('text', { rng });
  check('text kind generates words', typeof txt === 'string' && txt.length > 0, txt);
  const g = U.generators.make('gender', { rng });
  check('gender kind', typeof g === 'string' && g.length > 0, g);
}

// ---------- detection ----------

{
  function fakeEl(props) {
    const attrs = Object.assign({}, props.attrs);
    const el = Object.assign({
      tagName: 'INPUT',
      type: 'text',
      name: '',
      id: '',
      placeholder: '',
      title: '',
      required: false,
      dataset: {},
      value: '',
      closest() { return null; }
    }, props);
    el.getAttribute = (n) => (attrs[n] !== undefined ? attrs[n] : null);
    return el;
  }

  const cases = [
    [fakeEl({ name: 'email' }), 'email'],
    [fakeEl({ type: 'email', name: 'x' }), 'email'],
    [fakeEl({ type: 'password' }), 'password'],
    [fakeEl({ name: 'pwd', type: 'text' }), 'password'],
    [fakeEl({ attrs: { autocomplete: 'postal-code' } }), 'zip'],
    [fakeEl({ attrs: { autocomplete: 'given-name' } }), 'firstName'],
    [fakeEl({ attrs: { autocomplete: 'new-password' } }), 'password'],
    [fakeEl({ name: 'first_name' }), 'firstName'],
    [fakeEl({ name: 'last_name' }), 'lastName'],
    [fakeEl({ placeholder: 'First and last name' }), 'fullName'],
    [fakeEl({ name: 'phone' }), 'phone'],
    [fakeEl({ type: 'tel' }), 'phone'],
    [fakeEl({ name: 'zip' }), 'zip'],
    [fakeEl({ name: 'city' }), 'city'],
    [fakeEl({ name: 'dob' }), 'date'],
    [fakeEl({ name: 'website' }), 'url'],
    [fakeEl({ type: 'url' }), 'url'],
    [fakeEl({ placeholder: 'Search products...' }), 'search'],
    [fakeEl({ tagName: 'TEXTAREA', name: 'notes' }), 'message'],
    [fakeEl({ name: 'age', type: 'number' }), 'age'],
    [fakeEl({ name: 'qty', type: 'number' }), 'quantity'],
    [fakeEl({ name: 'amount', type: 'number' }), 'money'],
    [fakeEl({ name: 'company' }), 'company'],
    [fakeEl({ name: 'job_title' }), 'jobTitle'],
    [fakeEl({ name: 'state' }), 'state'],
    [fakeEl({ name: 'country' }), 'country'],
    [fakeEl({ name: 'ccNum' }), 'card'],
    [fakeEl({ name: 'cvv' }), 'cvv'],
    [fakeEl({ name: 'otp_code', attrs: { maxlength: '6' } }), 'otp'],
    [fakeEl({ name: 'coupon_code' }), 'coupon'],
    [fakeEl({ name: 'captcha_response' }), null, 'skip'],
    [fakeEl({ name: 'zzz_unknown', type: 'text' }), 'text']
  ];

  for (const [el, kind, flag] of cases) {
    const info = U.detect.classify(el);
    if (flag === 'skip') {
      eq(`skip ${el.name}`, info.skip, true);
    } else {
      eq(`kind ${el.name || el.type || el.tagName} -> ${kind}`, info.kind, kind);
    }
  }

  // constraints are extracted
  const c = U.detect.classify(fakeEl({
    name: 'x',
    attrs: { minlength: '3', maxlength: '12', min: '5', max: '50', step: '2', pattern: '[A-Z]\\d{3}' }
  }));
  eq('minlength', c.min, 3);
  eq('maxlength', c.max, 12);
  eq('numMin', c.numMin, 5);
  eq('numMax', c.numMax, 50);
  eq('numStep', c.numStep, 2);
  eq('pattern', c.pattern, '[A-Z]\\d{3}');

  // regression: ISO min/max on date-like inputs land in dateMin/dateMax
  const dc = U.detect.classify(fakeEl({ type: 'date', name: 'expires', attrs: { min: '2026-01-01', max: '2030-12-31' } }));
  check('dateMin parsed', dc.dateMin instanceof Date && dc.dateMin.getFullYear() === 2026, String(dc.dateMin));
  check('dateMax parsed', dc.dateMax instanceof Date && dc.dateMax.getFullYear() === 2030, String(dc.dateMax));
  check('numMin null for ISO dates', dc.numMin === null, String(dc.numMin));
  const nc = U.detect.classify(fakeEl({ type: 'number', name: 'x', attrs: { min: '5' } }));
  eq('numeric min still numeric', nc.numMin, 5);

  // pattern sampling end-to-end against a classified field
  const info = U.detect.classify(fakeEl({ name: 'code', attrs: { pattern: '[A-Z]\\d{3}', maxlength: '4' } }));
  const ctx = { rng: U.makeRng(9), min: info.min, max: info.max };
  const s = U.sampler.sample(info.pattern, '', ctx.rng, { min: info.min || 1, max: info.max || 128 });
  check('pattern sample respects shape', s != null && /^[A-Z]\d{3}$/.test(s), String(s));
}

// ---------- results ----------

console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log('FAILURES:');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
