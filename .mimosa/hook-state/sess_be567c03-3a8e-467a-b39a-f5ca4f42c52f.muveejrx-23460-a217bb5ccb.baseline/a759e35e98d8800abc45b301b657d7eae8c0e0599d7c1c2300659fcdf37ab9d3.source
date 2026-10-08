// Stress: 10 unseeded fills on the demo page; every fill must yield
// invalid:0 and a fully valid form.
'use strict';
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  await page.goto('file:///' + path.resolve(__dirname, 'demo-form.html').replace(/\\/g, '/'));
  for (const f of ['core', 'data', 'pattern', 'generators', 'detect', 'fill', 'index']) {
    await page.addScriptTag({ path: path.join(__dirname, '..', 'content', f + '.js') });
  }
  let bad = 0;
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => { window.UAFakeFiller.restore(); });
    const r = await page.evaluate(() => window.UAFakeFiller.run({}));
    const badNames = await page.evaluate(() =>
      [...document.getElementById('demo').elements]
        .filter((el) => el.willValidate && !el.checkValidity())
        .map((el) => el.name));
    const ok = r.invalid === 0 && badNames.length === 0;
    if (!ok) bad++;
    console.log(`run ${i + 1}: filled=${r.filled} invalid=${r.invalid} bad=[${badNames.join(',')}] ${ok ? 'OK' : 'FAIL'}`);
  }
  await browser.close();
  console.log(bad ? `${bad} failing runs` : 'stress: all runs clean');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
