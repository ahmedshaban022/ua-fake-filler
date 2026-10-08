// End-to-end test in a real Chromium: loads the demo page, injects the
// content scripts (exactly what the extension does), fills, and checks the
// browser's own validity verdict.
// Run: NODE_PATH=<npx playwright node_modules> node test/e2e.js
'use strict';

const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const CONTENT = ['core.js', 'data.js', 'pattern.js', 'generators.js', 'detect.js', 'fill.js', 'index.js']
  .map((f) => path.join(ROOT, 'content', f));

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.log(`FAIL  ${name}${detail ? ' :: ' + detail : ''}`);
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  await page.goto('file:///' + path.join(ROOT, 'test', 'demo-form.html').replace(/\\/g, '/'));

  for (const f of CONTENT) await page.addScriptTag({ path: f });

  // 1. fill
  const res = await page.evaluate(() => window.UAFakeFiller.run({ seed: 777 }));
  console.log('fill result:', JSON.stringify(res));
  check('filled a healthy number of fields', res.filled >= 25, String(res.filled));
  check('zero unmatched fields', res.invalid === 0, String(res.invalid));

  // 2. browser validity verdict
  const bad = await page.evaluate(() => {
    const form = document.getElementById('demo');
    return [...form.elements]
      .filter((el) => el.willValidate && !el.checkValidity())
      .map((el) => `${el.name}:${el.validity.valid ? '' : [
        el.validity.valueMissing && 'missing',
        el.validity.patternMismatch && 'pattern',
        el.validity.rangeOverflow && 'over',
        el.validity.rangeUnderflow && 'under',
        el.validity.stepMismatch && 'step',
        el.validity.typeMismatch && 'type',
        el.validity.tooLong && 'tooLong'
      ].filter(Boolean).join(',')}`);
  });
  check('form fully valid after fill', bad.length === 0, bad.join(' '));

  // 3. opt-out fields stayed empty
  const empties = await page.evaluate(() => {
    const g = (n) => document.querySelector(`[name="${n}"]`);
    return {
      captcha: g('captcha_response').value,
      optedOut: g('manual').value,
      locked: g('locked').value,
      hidden: g('secret').value
    };
  });
  check('captcha skipped', empties.captcha === '', empties.captcha);
  check('data-uaff-skip honored', empties.optedOut === '', empties.optedOut);
  check('disabled untouched', empties.locked === '', empties.locked);
  check('hidden untouched', empties.hidden === '', empties.hidden);

  // 4. readonly + passwords still got values / readonly untouched
  const states = await page.evaluate(() => ({
    pw: document.querySelector('[name="passwd"]').value,
    readonly: document.querySelector('[name="fixed"]').value,
    radio: document.querySelector('input[name="plan"]:checked')?.value || '',
    terms: document.querySelector('[name="terms"]').checked,
    iframeEmail: document.querySelector('iframe').contentDocument.querySelector('[name="iframe_email"]').value,
    contenteditable: document.querySelector('[contenteditable]').textContent.length
  }));
  check('password filled & matches rule', /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/.test(states.pw), states.pw);
  check('readonly untouched', states.readonly === 'read-only', states.readonly);
  check('radio group chosen', states.radio !== '', states.radio);
  check('required terms checked', states.terms === true);
  check('iframe field filled', /@/.test(states.iframeEmail), states.iframeEmail);
  check('contenteditable filled', states.contenteditable > 0, String(states.contenteditable));

  // 5. pattern fields match their patterns exactly
  const pats = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('[pattern]')) {
      out.push([el.name, el.value, el.getAttribute('pattern')]);
    }
    return out;
  });
  for (const [name, value, pattern] of pats) {
    let ok = true;
    try { ok = new RegExp('^(?:' + pattern + ')$').test(value); } catch (_) {}
    if (name === 'passwd') continue; // handled above (lookahead pattern)
    check(`pattern ${name}`, ok, `${value} !~ ${pattern}`);
  }

  // 6. undo restores
  await page.evaluate(() => window.UAFakeFiller.restore());
  const after = await page.evaluate(() => ({
    email: document.querySelector('[name="email"]').value,
    plan: document.querySelector('input[name="plan"]:checked')?.value || '',
    terms: document.querySelector('[name="terms"]').checked
  }));
  check('undo cleared email', after.email === '', after.email);
  check('undo cleared radio', after.plan === '', after.plan);
  check('undo unchecked terms', after.terms === false);

  // 7. same seed -> same data
  await page.evaluate(() => window.UAFakeFiller.run({ seed: 777 }));
  const runA = await page.evaluate(() => document.querySelector('[name="email"]').value);
  await page.evaluate(() => { window.UAFakeFiller.restore(); return window.UAFakeFiller.restore(); });
  await page.evaluate(() => window.UAFakeFiller.run({ seed: 777 }));
  const runB = await page.evaluate(() => document.querySelector('[name="email"]').value);
  check('seeded fills are reproducible', runA === runB, `${runA} vs ${runB}`);

  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : '\nE2E: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error('E2E crashed:', e);
  process.exit(1);
});
