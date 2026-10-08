// Generates the Chrome Web Store listing screenshot (1280x800) of the
// filled demo form. Run: NODE_PATH=<playwright> node tools/make-screenshot.js
'use strict';
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1
  });
  await page.goto('file:///' + path.resolve(__dirname, '..', 'test', 'demo-form.html').replace(/\\/g, '/'));
  for (const f of ['core', 'data', 'pattern', 'generators', 'detect', 'fill', 'index']) {
    await page.addScriptTag({ path: path.join(__dirname, '..', 'content', f + '.js') });
  }
  await page.evaluate(() => window.UAFakeFiller.run({ seed: 42 }));
  // Remove the transient fill-outline so the shot looks natural.
  await page.evaluate(() => {
    document.getElementById('uaff-style')?.remove();
    document.querySelectorAll('.uaff-flash').forEach((el) => el.classList.remove('uaff-flash'));
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, '..', 'store', 'screenshot-1280x800.png') });
  await browser.close();
  console.log('store/screenshot-1280x800.png written');
})().catch((e) => { console.error(e); process.exit(1); });
