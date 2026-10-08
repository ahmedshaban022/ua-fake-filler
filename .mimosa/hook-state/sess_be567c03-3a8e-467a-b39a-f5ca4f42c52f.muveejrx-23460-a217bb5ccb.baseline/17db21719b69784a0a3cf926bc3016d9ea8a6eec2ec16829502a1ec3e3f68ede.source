// Generators: produce fake values per semantic kind ("email", "phone",
// "date", ...). Detection (detect.js) decides the kind; the fill engine
// passes constraints (minlength/maxlength, min/max, step, pattern flags)
// through ctx. All functions are pure-ish: they only use ctx.rng.
'use strict';

(function () {
  const UAF = (window.UAFakeFillerCore = window.UAFakeFillerCore || {});
  const D = UAF.DATA;

  const pad2 = (n) => String(n).padStart(2, '0');

  function firstName(rng) {
    return UAF.pick(rng, D.maleFirst.concat(D.femaleFirst));
  }
  function lastName(rng) {
    return UAF.pick(rng, D.last);
  }
  function username(rng) {
    const styles = [
      () => firstName(rng).toLowerCase() + '.' + lastName(rng).toLowerCase(),
      () => firstName(rng).toLowerCase() + UAF.int(rng, 11, 99),
      () => firstName(rng)[0].toLowerCase() + lastName(rng).toLowerCase() + UAF.int(rng, 1, 9),
      () => lastName(rng).toLowerCase() + '_' + firstName(rng).toLowerCase()
    ];
    return UAF.pick(rng, styles)();
  }
  function email(rng) {
    const u = username(rng).replace(/[^a-z0-9._-]/g, '');
    return u + UAF.int(rng, 1, 99) + '@' + UAF.pick(rng, D.domains);
  }
  function password(rng, fl, min, max) {
    fl = fl || {};
    const lo = Math.max(min || 0, fl.min || 0, 8);
    const hi = Math.max(max || 24, lo);
    const len = UAF.int(rng, Math.min(lo, hi), hi);
    const pools = [];
    if (fl.upper) pools.push('ABCDEFGHJKLMNPQRSTUVWXYZ');
    if (fl.lower) pools.push('abcdefghijkmnpqrstuvwxyz');
    if (fl.digit) pools.push('23456789');
    if (fl.special) pools.push('!@#$%^&*_-+?');
    if (!pools.length) pools.push('abcdefghijkmnpqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789');
    let chars = pools.map((p) => p[Math.floor(rng() * p.length)]);
    const all = pools.join('');
    while (chars.length < len) chars.push(all[Math.floor(rng() * all.length)]);
    // Fisher-Yates with our rng.
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }
  function phone(rng) {
    // NANP-valid fictional number: [2-9]XX - 555 - 01XX
    const area = String(UAF.int(rng, 2, 9)) + UAF.int(rng, 0, 9) + UAF.int(rng, 0, 9);
    const line = '01' + String(UAF.int(rng, 0, 9)) + String(UAF.int(rng, 0, 9));
    return area + '-555-' + line;
  }
  function zip(rng) {
    return String(UAF.int(rng, 501, 99950)).padStart(5, '0');
  }
  function address(rng) {
    return UAF.int(rng, 12, 9800) + ' ' + UAF.pick(rng, D.streets);
  }
  function dateBetween(rng, min, max) {
    const lo = min ? min.getTime() : Date.now() - 40 * 365.25 * 86400000;
    const hi = max ? max.getTime() : Date.now() + 2 * 365.25 * 86400000;
    return new Date(UAF.int(rng, Math.min(lo, hi), Math.max(lo, hi)));
  }

  const GEN = {
    firstName,
    lastName,
    fullName: (rng) => firstName(rng) + ' ' + lastName(rng),
    initials: (rng) => firstName(rng)[0] + lastName(rng)[0],
    username,
    email,
    password,
    phone,
    mobile: phone,
    fax: phone,
    tel: phone,
    url: (rng) => UAF.pick(rng, D.urls),
    company: (rng) => UAF.pick(rng, D.companies),
    organization: (rng) => UAF.pick(rng, D.companies),
    jobTitle: (rng) => UAF.pick(rng, D.jobTitles),
    department: (rng) => UAF.pick(rng, D.departments),
    address,
    address2: (rng) => 'Apt ' + UAF.int(rng, 1, 40) + UAF.pick(rng, ['A', 'B', 'C', '']),
    street: address,
    city: (rng) => UAF.pick(rng, D.cities),
    state: (rng) => UAF.pick(rng, D.states),
    stateName: (rng) => UAF.pick(rng, D.stateNames),
    province: (rng) => UAF.pick(rng, D.states),
    zip,
    postalCode: zip,
    postal: zip,
    postcode: zip,
    country: (rng) => UAF.pick(rng, D.countries),
    countryName: (rng) => UAF.pick(rng, D.countries),
    nationality: (rng) => UAF.pick(rng, ['American', 'Canadian', 'British', 'German', 'French', 'Australian']),
    language: (rng) => UAF.pick(rng, D.langs),
    timezone: (rng) => UAF.pick(rng, D.tzNames),
    university: (rng) => UAF.pick(rng, D.universities),
    degree: (rng) => UAF.pick(rng, ['BSc', 'BA', 'MSc', 'MBA', 'PhD']),
    grade: (rng) => UAF.pick(rng, ['A', 'B', 'C', 'B+', 'A-']),
    color: (rng) => UAF.pick(rng, D.colors),
    colorHex: (rng) => '#' + [0, 1, 2].map(() => Math.floor(rng() * 256).toString(16).padStart(2, '0')).join(''),
    search: (rng) => UAF.pick(rng, D.words) + ' ' + UAF.pick(rng, D.words),
    text: (rng, ctx) => GEN.words(rng, ctx),
    otp: (rng) => String(UAF.int(rng, 0, 999999)).padStart(6, '0'),
    gender: (rng) => UAF.pick(rng, ['Male', 'Female', 'Non-binary', 'Prefer not to say']),
    slug: (rng) => UAF.pick(rng, D.words) + '-' + UAF.pick(rng, D.words),
    words: (rng, ctx) => {
      const n = UAF.int(rng, 2, Math.max(3, Math.min(8, (ctx && ctx.max) || 8)));
      const out = [];
      for (let i = 0; i < n; i++) out.push(UAF.pick(rng, D.words));
      return out.join(' ');
    },
    sentence: (rng) => UAF.pick(rng, D.sentences),
    message: (rng, ctx) => {
      const target = (ctx && ctx.min) || 60;
      let out = UAF.pick(rng, D.sentences);
      while (out.length < target) out += ' ' + UAF.pick(rng, D.sentences);
      return out;
    },
    paragraph: (rng, ctx) => GEN.message(rng, ctx),
    card: (rng) => UAF.pick(rng, D.cardBrand),
    cvv: (rng) => String(UAF.int(rng, 100, 999)),
    iban: () => 'DE89370400440532013000',
    uuid: (rng) => {
      let s = '';
      for (let i = 0; i < 32; i++) s += Math.floor(rng() * 16).toString(16);
      return s.slice(0, 8) + '-' + s.slice(8, 12) + '-4' + s.slice(13, 16) +
        '-a' + s.slice(17, 20) + '-' + s.slice(20, 32);
    },
    ip: (rng) => [UAF.int(rng, 10, 250), UAF.int(rng, 0, 255), UAF.int(rng, 0, 255), UAF.int(rng, 1, 254)].join('.'),
    mac: (rng) => {
      const oct = () => Math.floor(rng() * 256).toString(16).padStart(2, '0');
      return ['02', oct(), oct(), oct(), oct(), oct()].join(':');
    },
    age: (rng, ctx) => {
      const lo = Math.max((ctx && ctx.numMin) || 18, 16);
      const hi = Math.min((ctx && ctx.numMax) || 85, 99);
      return String(UAF.int(rng, Math.min(lo, hi), Math.max(lo, hi)));
    },
    percent: (rng, ctx) => {
      const lo = (ctx && ctx.numMin) || 0;
      const hi = (ctx && ctx.numMax != null) ? Math.min(ctx.numMax, 100) : 100;
      return String(UAF.int(rng, Math.min(lo, hi), Math.max(lo, hi)));
    },
    rating: (rng, ctx) => {
      const lo = (ctx && ctx.numMin) || 1;
      const hi = (ctx && ctx.numMax != null) ? Math.min(ctx.numMax, 5) : 5;
      return String(UAF.int(rng, Math.min(lo, hi), Math.max(lo, hi)));
    },
    money: (rng, ctx) => {
      const lo = (ctx && ctx.numMin != null) ? ctx.numMin : 1;
      const hi = (ctx && ctx.numMax != null) ? ctx.numMax : 5000;
      const v = UAF.int(rng, Math.min(lo, hi) * 100, Math.max(lo, hi) * 100) / 100;
      return v.toFixed(2);
    },
    integer: (rng, ctx) => {
      const lo = (ctx && ctx.numMin != null) ? ctx.numMin : 1;
      const hi = (ctx && ctx.numMax != null) ? ctx.numMax : 1000;
      return String(UAF.int(rng, Math.min(lo, hi), Math.max(lo, hi)));
    },
    number: (rng, ctx) => {
      const lo = (ctx && ctx.numMin != null) ? ctx.numMin : 0;
      const hi = (ctx && ctx.numMax != null) ? ctx.numMax : 100;
      const v = UAF.int(rng, Math.min(lo, hi) * 10, Math.max(lo, hi) * 10) / 10;
      return Number.isInteger(v) ? String(v) : v.toFixed(1);
    },
    quantity: (rng, ctx) => GEN.integer(rng, ctx)
  };

  // Kinds that produce date strings; the fill engine formats the Date per
  // input type, so they are handled specially there.
  UAF.generators = {
    KINDS: Object.keys(GEN).concat(['date', 'time', 'datetime', 'month', 'week']),
    make(kind, ctx) {
      ctx = ctx || {};
      const rng = ctx.rng;
      if (kind === 'password') return password(rng, ctx.flags, ctx.min, ctx.max);
      const fn = GEN[kind];
      if (!fn) return null;
      let v = fn(rng, ctx);
      if (typeof v !== 'string') v = String(v);
      return fit(v, ctx, kind);
    },
    dateBetween
  };

  function fit(v, ctx, kind) {
    let out = v;
    if (ctx.max && out.length > ctx.max) {
      if (kind === 'email') {
        out = out.split('@')[0].slice(0, Math.max(ctx.max - 10, 3)) + '@' + out.split('@')[1];
      } else if (kind === 'uuid' || kind === 'card' || kind === 'iban' || kind === 'phone' || kind === 'ip' || kind === 'mac') {
        // Structured formats: don't mangle; report as-is (filler validates).
        return out;
      } else {
        out = out.slice(0, ctx.max);
      }
    }
    if (ctx.min && out.length < ctx.min) {
      if (kind === 'words' || kind === 'message' || kind === 'sentence' || kind === 'search' || kind === 'paragraph') {
        let guard = 0;
        while (out.length < ctx.min && guard++ < 50) out += ' ' + UAF.pick(ctx.rng, D.words);
      } else if (kind === 'password' || kind === 'username') {
        out = (out + UAF.pick(ctx.rng, D.words) + UAF.int(ctx.rng, 10, 99)).slice(0, Math.max(ctx.max || 64, ctx.min));
      } else if (/^[0-9]+$/.test(out)) {
        out = out.padStart(ctx.min, '0');
      }
    }
    return out;
  }
})();
