// Field discovery + classification. classify() decides WHAT a field is
// (semantic kind) using, in order of trust: input type, autocomplete
// attribute, then keyword scoring over name/id/placeholder/aria-label and
// the associated <label>. It also extracts every validation constraint the
// field declares so the fill engine can respect it.
'use strict';

(function () {
  const UAF = (window.UAFakeFillerCore = window.UAFakeFillerCore || {});
  const D = UAF.DATA;

  // autocomplete token -> kind (checked first; highest signal).
  const AC = {
    'given-name': 'firstName', 'additional-name': 'firstName', 'nickname': 'username',
    'family-name': 'lastName', 'name': 'fullName', 'honorific-prefix': 'text',
    'username': 'username', 'email': 'email', 'new-password': 'password',
    'current-password': 'password', 'one-time-code': 'otp',
    'tel': 'phone', 'tel-national': 'phone', 'tel-area-code': 'phone', 'fax': 'fax',
    'street-address': 'address', 'address-line1': 'address', 'address-line2': 'address2',
    'postal-code': 'zip', 'postal-code-ext': 'zip',
    'country': 'country', 'country-name': 'country',
    'organization': 'company', 'organization-title': 'jobTitle',
    'bday': 'date', 'bday-day': 'integer', 'bday-month': 'month', 'bday-year': 'integer',
    'cc-number': 'card', 'cc-csc': 'cvv', 'cc-exp': 'cardExpiry', 'cc-name': 'fullName',
    'url': 'url', 'photo': 'text', 'language': 'language', 'sex': 'gender'
  };

  // keyword -> kind. Exact token match scores 3, substring scores 1.
  const KW = [
    ['firstName', ['firstname', 'fname', 'forename', 'givenname', 'first']],
    ['lastName', ['lastname', 'lname', 'surname', 'familyname', 'last']],
    ['fullName', ['fullname', 'yourname', 'contactname', 'customername', 'name']],
    ['email', ['email', 'emailaddress', 'mail']],
    ['username', ['username', 'loginname', 'nickname', 'handle', 'userid', 'login', 'user']],
    ['password', ['password', 'passwd', 'pwd', 'passphrase']],
    ['otp', ['otp', 'onetimecode', 'verificationcode', 'code']],
    ['coupon', ['coupon', 'promo', 'promocode', 'voucher', 'discountcode', 'referral', 'ref', 'invite']],
    ['phone', ['phone', 'telephone', 'tel', 'mobile', 'cellphone', 'msisdn', 'whatsapp', 'contact']],
    ['fax', ['fax']],
    ['zip', ['zip', 'zipcode', 'zipcod', 'postal', 'postcode', 'pincode']],
    ['city', ['city', 'town', 'locality', 'suburb']],
    ['state', ['state', 'province', 'region', 'county']],
    ['country', ['country', 'nation']],
    ['address', ['address', 'street', 'addr']],
    ['address2', ['address2', 'apt', 'apartment', 'suite', 'unit']],
    ['company', ['company', 'organization', 'employer', 'business', 'firm', 'organisation']],
    ['jobTitle', ['jobtitle', 'designation', 'position', 'occupation', 'job']],
    ['department', ['department', 'dept', 'team']],
    ['date', ['date', 'dob', 'birth', 'birthday', 'expiry', 'expires', 'expiration', 'when', 'schedule', 'deadline', 'start', 'end']],
    ['time', ['time', 'clock']],
    ['month', ['month']],
    ['week', ['week']],
    ['url', ['url', 'website', 'site', 'link', 'homepage']],
    ['search', ['search', 'query', 'keyword', 'keywords']],
    ['message', ['message', 'comment', 'note', 'notes', 'description', 'bio', 'about', 'details', 'summary', 'feedback', 'review', 'inquiry', 'enquiry', 'essay', 'answer', 'body', 'content']],
    ['card', ['cardnumber', 'creditcard', 'ccnumber', 'cardnum', 'cc']],
    ['cvv', ['cvv', 'cvc', 'securitycode', 'cardcode']],
    ['cardExpiry', ['cardexpiry', 'ccexp', 'expmonth', 'expyear', 'expdate']],
    ['age', ['age']],
    ['percent', ['percent', 'percentage', 'pct']],
    ['rating', ['rating', 'stars', 'score']],
    ['money', ['price', 'amount', 'cost', 'salary', 'income', 'total', 'fee', 'budget', 'revenue', 'payment']],
    ['quantity', ['qty', 'quantity', 'count', 'stock', 'items']],
    ['uuid', ['uuid', 'guid']],
    ['ip', ['ip', 'ipaddress']],
    ['mac', ['mac']],
    ['slug', ['slug']],
    ['color', ['color', 'colour']],
    ['language', ['language', 'lang', 'locale']],
    ['timezone', ['timezone', 'tz']],
    ['initials', ['initials']],
    ['university', ['university', 'college', 'school', 'institute']],
    ['degree', ['degree', 'qualification']],
    ['nationality', ['nationality']]
  ];

  // Types we fill by input type alone, mapped to kinds.
  const TYPE_KIND = {
    email: 'email', password: 'password', tel: 'phone', url: 'url',
    search: 'search', number: 'number', range: 'number', color: 'colorHex',
    date: 'date', time: 'time', 'datetime-local': 'datetime', month: 'month', week: 'week'
  };

  function tokens(s) {
    return String(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  }

  function hintString(el) {
    const parts = [
      el.name, el.id, el.placeholder, el.getAttribute('aria-label'),
      UAF.fieldLabel(el), el.title
    ];
    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  function detectType(el) {
    const t = (el.tagName === 'TEXTAREA') ? 'textarea' : String(el.type || 'text').toLowerCase();
    return t;
  }

  function numberAttr(el, name) {
    const raw = el.getAttribute && el.getAttribute(name);
    if (raw == null || raw === '') return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  }

  // min/max on date-like inputs are ISO strings ("2026-01-01"), not numbers.
  function dateAttr(el, name) {
    const raw = el.getAttribute && el.getAttribute(name);
    if (!raw || /^\d+$/.test(raw)) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  UAF.detect = {
    classify(el) {
      const type = detectType(el);
      const hint = hintString(el);
      const toks = tokens(hint);
      const info = {
        el,
        type,
        kind: null,
        source: 'default',
        min: numberAttr(el, 'minlength'),
        max: numberAttr(el, 'maxlength'),
        numMin: numberAttr(el, 'min'),
        numMax: numberAttr(el, 'max'),
        numStep: numberAttr(el, 'step') || 1,
        dateMin: dateAttr(el, 'min'),
        dateMax: dateAttr(el, 'max'),
        pattern: el.getAttribute && el.getAttribute('pattern'),
        required: !!(el.required || el.getAttribute && el.getAttribute('aria-required') === 'true'),
        skip: false
      };
      // Number-ish text inputs usually declare inputmode/step too.
      const inputmode = el.getAttribute && el.getAttribute('inputmode');

      // 0. manual opt-out
      const dataKind = el.dataset && el.dataset.uaffKind;
      if (el.dataset && (el.dataset.uaffSkip === '1')) info.skip = true;

      // 1. explicit type
      if (TYPE_KIND[type]) {
        info.kind = TYPE_KIND[type];
        info.source = 'type';
      }

      // 2. autocomplete attribute (comma list: "shipping postal-code")
      if (!info.kind) {
        const acRaw = el.getAttribute && el.getAttribute('autocomplete');
        if (acRaw) {
          for (const part of acRaw.toLowerCase().split(/\s+/)) {
            if (AC[part]) {
              info.kind = AC[part];
              info.source = 'autocomplete';
              break;
            }
          }
        }
      }

      // 3. keyword scoring
      if (!info.kind || info.kind === 'number' || info.kind === 'text' || info.source === 'default') {
        // "coupon_code" must not read as OTP via the generic "code" token.
        const couponish = toks.some((t) => /^(coupon|promo|voucher|discount|referral|invite)/.test(t));
        let best = null, bestScore = 0;
        for (const [kind, words] of KW) {
          if (kind === 'otp' && couponish) continue;
          let score = 0;
          for (const w of words) {
            if (toks.includes(w)) score = Math.max(score, 3);
            else if (hint.includes(w)) score = Math.max(score, 1);
          }
          if (score > bestScore) {
            best = kind;
            bestScore = score;
          }
        }
        if (best && bestScore >= (info.kind ? 3 : 1)) {
          // keyword only overrides type-based number/text kinds on strong hit
          if (best === 'firstName' && toks.includes('last')) best = 'fullName';
          if (best === 'lastName' && toks.includes('first')) best = 'fullName';
          info.kind = best;
          info.source = 'keywords';
        }
      }

      // 4. fallbacks by tag/type
      if (!info.kind) {
        if (el.isContentEditable) info.kind = 'message';
        else if (type === 'textarea') info.kind = 'message';
        else if (type === 'number') info.kind = 'number';
        else if (type === 'text' && inputmode === 'numeric') info.kind = 'integer';
        else if (type === 'text' && inputmode === 'tel') info.kind = 'phone';
        else info.kind = 'text';
        info.source = 'default';
      }

      // CAPTCHA-ish fields: skip, no reliable way to fake them.
      if (/captcha|areyoubot|honeypot/.test(hint)) info.skip = true;

      // A maxlength on otp-ish single codes sharpens the kind.
      if (info.kind === 'text' && info.max && info.max <= 6 && (inputmode === 'numeric' || info.pattern && /\\d/.test(info.pattern))) {
        info.kind = 'otp';
      }
      return info;
    },

    // Discover fields in this document (and same-origin iframes up to depth).
    discover(doc, depth) {
      return UAF.collectFields(doc || document, depth == null ? 2 : depth)
        .map((el) => UAF.detect.classify(el))
        .filter((info) => !info.skip);
    },

    _kw: KW,
    _ac: AC,
    _data: D
  };
})();
