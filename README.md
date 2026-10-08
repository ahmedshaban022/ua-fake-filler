# UA Fake Filler

A smart, lightweight Chrome extension (Manifest V3) that fills every form field with
realistic fake data — and **respects each field's validation rules** (`pattern`,
`minlength`/`maxlength`, `min`/`max`, `step`, input type), so filled forms actually
pass validation.

No dependencies, no build step, ~25 KB of plain JS.

## Install (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select this folder (`ua-fake-filler`)

## Use

- Toolbar button → **Fill** (or press **Alt+Shift+F** anywhere)
- Popup → **Undo** restores the previous fill (5 levels deep)
- Right-click page → *Fill form with fake data* / *Undo*
- Set a nonzero **Seed** to get the exact same data on every fill (great for reproducing bugs)

## What makes it smart

| Signal | Example |
|---|---|
| `autocomplete` attribute | `postal-code` → ZIP, `new-password` → password |
| input type | `email`, `tel`, `url`, `date`, `month`, `color`, `range`… |
| name / id / placeholder / label keywords | `dob` → birthdate, `ccNum` → card, `qty` → quantity, `cvv`, `otp`, `zip`, `company`, `job_title`… |
| option-list matching | country/state selects pick a real matching option |
| rich text | `contenteditable` gets a paragraph |

## What makes it validation-aware

1. **Pattern sampling** — the field's `pattern` regex is parsed into an AST and a
   matching string is *constructed* (then verified), e.g. `[A-Z0-9]{3}-[A-Z0-9]{3}`
   → `K7M-Q2X`. Constructs are refused for unsupported/dangerous regex
   (lookarounds, backrefs, nested quantifiers) instead of guessing.
2. **Lookahead rules** — password-style patterns the sampler can't construct
   (`(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}`) are *analyzed* into character-class
   requirements, and a compliant password is generated.
3. **Browser truth** — every candidate is committed through the native value setter
   and checked against the field's own `validity` state (`patternMismatch`,
   `rangeOverflow`, `stepMismatch`, `typeMismatch`…). Up to 8 candidates are tried;
   if none pass, the field is left untouched and reported as "unmatched" — never
   filled with garbage.
4. **Length fitting** — generators respect `minlength`/`maxlength` (emails get
   compacted, not mangled; messages grow; numeric strings zero-pad).

## What it deliberately skips

- `hidden` / `disabled` / `readonly` / `submit`-type fields and `file` inputs
- CAPTCHA-like fields (`captcha`, honeypots)
- anything marked `data-uaff-skip="1"` (per-field opt-out)

## Structure

```
manifest.json          MV3 manifest (activeTab + scripting + storage + contextMenus)
background.js          service worker: shortcut, context menu, popup messages
shared/inject.js       injects content scripts into all frames, runs fill/undo
content/
  core.js              seeded RNG, DOM helpers, iframe traversal
  data.js              compact fake-data pools
  pattern.js           regex parser + match-by-construction sampler
  generators.js        per-kind value generators
  detect.js            field discovery + classification + constraint extraction
  fill.js              fill engine: retries, validity checks, undo, highlighting
  index.js             exposes window.UAFakeFiller
popup/                 fill / undo / seed / toggles
test/run-tests.js      973-check unit suite: node test/run-tests.js
test/demo-form.html    kitchen-sink form; fill it and Submit → expect "0 invalid"
tools/gen-icons.js     regenerates icons: node tools/gen-icons.js
```

## Verify

- `node test/run-tests.js` — unit tests (sampler, generators, detection)
- Open `test/demo-form.html`, hit **Alt+Shift+F**, click **Submit** — the report
  should read *form is valid — 0 invalid fields*. The "Must stay empty" block
  (CAPTCHA, disabled, readonly, hidden, opted-out) stays untouched.

## Notes & limits

- Fake data is US-flavored (NANP phones with the fictional `555-01xx` line range,
  5-digit ZIPs) but country/name pools are easily extended in `content/data.js`.
- Cross-origin iframes can't be reached (browser security) — same-origin frames are filled.
- The regex sampler covers the common validation subset; anything exotic falls back
  to the keyword generator + browser-validity retry loop.
