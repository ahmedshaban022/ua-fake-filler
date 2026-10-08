// Pattern sampler: given a field's `pattern` regex, return a string that
// satisfies it.
//
// Strategy:
//   1. Parse a conservative subset of regex syntax into an AST. Anything we
//      can't model (lookarounds, backrefs, nested quantifiers) -> null.
//   2. Emit a matching string directly from the AST ("match by
//      construction"), then verify with the real RegExp as a safety net.
//   3. For patterns we can't parse (most commonly password-style lookahead
//      rules), `analyzeLookarounds` extracts the character requirements they
//      imply so callers can generate a compliant string heuristically.
'use strict';

(function () {
  const UAF = (window.UAFakeFillerCore = window.UAFakeFillerCore || {});
  const MAX_EMIT = 4096; // hard cap on emitted length

  // ---------- mini regex parser (subset) ----------

  function parse(src) {
    if (!src || src.length > 1000) return null;
    const pos = { i: 0 };
    let ast;
    try {
      ast = parseAlt(src, pos, 0);
      if (pos.i < src.length) return null;
    } catch (_) {
      return null;
    }
    if (hasRepeatableGroup(ast)) return null;
    return ast;
  }

  function parseAlt(src, pos, depth) {
    if (depth > 12) throw new Error('too deep');
    const parts = [parseSeq(src, pos, depth)];
    while (src[pos.i] === '|') {
      pos.i++;
      parts.push(parseSeq(src, pos, depth));
    }
    return parts.length === 1 ? parts[0] : { t: 'alt', parts };
  }

  function parseSeq(src, pos, depth) {
    const nodes = [];
    while (pos.i < src.length && src[pos.i] !== '|' && src[pos.i] !== ')') {
      const atom = parseAtom(src, pos, depth);
      const q = parseQuant(src, pos);
      if (q) {
        if (atom.t === 'anchor') throw new Error('quantified anchor');
        if (q.max === 0 || q.min > 64 || q.max > 128) throw new Error('bound out of range');
        nodes.push({ t: 'rep', child: atom, min: q.min, max: q.max });
      } else {
        nodes.push(atom);
      }
    }
    if (!nodes.length) return { t: 'seq', nodes: [] };
    return nodes.length === 1 ? nodes[0] : { t: 'seq', nodes };
  }

  function parseQuant(src, pos) {
    const c = src[pos.i];
    if (c === '*') { pos.i++; return lazy(src, pos, 0, Infinity); }
    if (c === '+') { pos.i++; return lazy(src, pos, 1, Infinity); }
    if (c === '?') { pos.i++; return lazy(src, pos, 0, 1); }
    if (c === '{') {
      const m = /^\{(\d+)(,(\d*)?)?\}/.exec(src.slice(pos.i));
      if (m) {
        pos.i += m[0].length;
        const min = parseInt(m[1], 10);
        const max = m[2] === undefined ? min : (m[3] !== undefined ? parseInt(m[3], 10) : Infinity);
        return lazy(src, pos, min, max);
      }
      return null; // literal '{'
    }
    return null;
  }

  function lazy(src, pos, min, max) {
    if (src[pos.i] === '?') pos.i++; // lazy vs greedy doesn't change construction
    return { min, max };
  }

  function parseAtom(src, pos, depth) {
    const c = src[pos.i];
    if (c === '(') {
      pos.i++;
      if (src[pos.i] === '?') {
        const n = src[pos.i + 1];
        if (n === ':') pos.i += 2;
        else throw new Error('lookaround/backref'); // (?= (?! (?<= (?<! (?<name>
      }
      const inner = parseAlt(src, pos, depth + 1);
      if (src[pos.i] !== ')') throw new Error('unbalanced group');
      pos.i++;
      return inner;
    }
    if (c === '[') { const cls = parseClass(src, pos); return { t: 'cls', ...cls }; }
    if (c === '.') { pos.i++; return { t: 'dot' }; }
    if (c === '^') { pos.i++; return { t: 'anchor', v: '^' }; }
    if (c === '$') { pos.i++; return { t: 'anchor', v: '$' }; }
    if (c === '\\') {
      pos.i++;
      const e = src[pos.i++];
      if (e === undefined) throw new Error('trailing backslash');
      if (e === 'd' || e === 'w' || e === 's') return shorthand(e);
      if (e === 'D' || e === 'W' || e === 'S' || e === 'b' || e === 'B') throw new Error('unsupported escape');
      if (/[1-9]/.test(e)) throw new Error('backreference');
      if ('nrtfv0'.includes(e)) {
        const map = { n: '\n', r: '\r', t: '\t', f: '\f', v: '\v', 0: '\0' };
        return { t: 'lit', ch: map[e] };
      }
      if (e === 'x') {
        const hex = src.slice(pos.i, pos.i + 2);
        if (!/^[0-9a-fA-F]{2}$/.test(hex)) throw new Error('bad \\x');
        pos.i += 2;
        return { t: 'lit', ch: String.fromCharCode(parseInt(hex, 16)) };
      }
      if (e === 'u') {
        if (src[pos.i] === '{') {
          const close = src.indexOf('}', pos.i);
          const inner = src.slice(pos.i + 1, close);
          if (close < 0 || !/^[0-9a-fA-F]+$/.test(inner)) throw new Error('bad \\u{}');
          pos.i = close + 1;
          return { t: 'lit', ch: String.fromCodePoint(parseInt(inner, 16)) };
        }
        const hex = src.slice(pos.i, pos.i + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new Error('bad \\u');
        pos.i += 4;
        return { t: 'lit', ch: String.fromCharCode(parseInt(hex, 16)) };
      }
      return { t: 'lit', ch: e };
    }
    if (c === '*' || c === '+' || c === '?') throw new Error('stray quantifier');
    pos.i++;
    return { t: 'lit', ch: c };
  }

  function shorthand(e) {
    if (e === 'd') return { t: 'cls', ranges: [[48, 57]], neg: false };
    if (e === 'w') return { t: 'cls', ranges: [[48, 57], [65, 90], [95, 95], [97, 122]], neg: false };
    return { t: 'cls', ranges: [[9, 13], [32, 32]], neg: false }; // \s
  }

  function parseClass(src, pos) {
    pos.i++; // consume '['
    let neg = false;
    if (src[pos.i] === '^') { neg = true; pos.i++; }
    const items = [];
    let first = true;
    while (true) {
      const c = src[pos.i];
      if (c === undefined) throw new Error('unterminated class');
      if (c === ']' && !first) { pos.i++; break; }
      first = false;
      let lo;
      if (c === '\\') {
        pos.i++;
        const e = src[pos.i++];
        if (e === 'd') { items.push([48, 57]); lo = null; }
        else if (e === 'w') { items.push([48, 57], [65, 90], [97, 122], [95, 95]); lo = null; }
        else if (e === 's') { items.push([9, 13], [32, 32]); lo = null; }
        else if (e === 'n') lo = 10;
        else if (e === 'r') lo = 13;
        else if (e === 't') lo = 9;
        else if (e === 'x') { lo = parseInt(src.slice(pos.i, pos.i + 2), 16); pos.i += 2; }
        else if (e === 'u') { lo = parseInt(src.slice(pos.i, pos.i + 4), 16); pos.i += 4; }
        else lo = e.charCodeAt(0);
      } else {
        lo = c.charCodeAt(0);
        pos.i++;
      }
      if (lo == null || Number.isNaN(lo)) continue;
      if (src[pos.i] === '-' && src[pos.i + 1] && src[pos.i + 1] !== ']') {
        pos.i++;
        let hi;
        const h = src[pos.i];
        if (h === '\\') {
          pos.i++;
          const e = src[pos.i++];
          if (e === 'x') { hi = parseInt(src.slice(pos.i, pos.i + 2), 16); pos.i += 2; }
          else if (e === 'u') { hi = parseInt(src.slice(pos.i, pos.i + 4), 16); pos.i += 4; }
          else hi = e.charCodeAt(0);
        } else {
          hi = h.charCodeAt(0);
          pos.i++;
        }
        items.push([lo, hi]);
      } else {
        items.push([lo, lo]);
      }
    }
    if (!items.length) throw new Error('empty class');
    return { ranges: items, neg };
  }

  function hasRepeatableGroup(n) {
    // A quantifier over something that can match >1 char risks combinatorial
    // blowup in variety/length; we simply refuse and let callers fall back.
    switch (n.t) {
      case 'rep': {
        if (n.max !== 1 && groupWidth(n.child) > 1) return true;
        return hasRepeatableGroup(n.child);
      }
      case 'seq': return n.nodes.some(hasRepeatableGroup);
      case 'alt': return n.parts.some(hasRepeatableGroup);
      default: return false;
    }
    function groupWidth(c) {
      if (c.t === 'alt') return Math.max(...c.parts.map(minLen));
      return minLen(c);
    }
  }

  function minLen(n) {
    switch (n.t) {
      case 'lit': case 'cls': case 'dot': return 1;
      case 'anchor': return 0;
      case 'seq': return n.nodes.reduce((s, x) => s + minLen(x), 0);
      case 'alt': return Math.min(...n.parts.map(minLen));
      case 'rep': return minLen(n.child) * n.min;
      default: return 0;
    }
  }

  // ---------- construction ----------

  function emitNode(n, rng, budget) {
    switch (n.t) {
      case 'lit': return n.ch;
      case 'anchor': return '';
      case 'dot': return UAF.pick(rng, ['a', 'k', 'm', 'x', '7', '3']);
      case 'cls': return emitClass(n, rng);
      case 'alt': {
        // Prefer branches that fit the remaining budget.
        const sorted = n.parts.slice().sort((a, b) => minLen(a) - minLen(b));
        const fitting = sorted.filter((p) => minLen(p) <= budget());
        const branch = UAF.pick(rng, fitting.length ? fitting : sorted);
        return emitNode(branch, rng, budget);
      }
      case 'seq': {
        let out = '';
        for (const x of n.nodes) {
          const piece = emitNode(x, rng, budget);
          out += piece;
          if (out.length > MAX_EMIT) return out.slice(0, MAX_EMIT);
        }
        return out;
      }
      case 'rep': {
        // Emit between min and min+2 iterations, respecting the budget.
        let count = n.min;
        if (n.max > n.min) count += Math.floor(rng() * 3);
        if (n.max !== Infinity) count = Math.min(count, n.max);
        const unit = minLen(n.child) || 1;
        count = Math.min(count, Math.max(0, Math.floor(budget() / unit)));
        let out = '';
        for (let k = 0; k < count; k++) out += emitNode(n.child, rng, budget);
        return out;
      }
      default: return '';
    }
  }

  function emitClass(n, rng) {
    if (n.neg) {
      // Printable char outside the ranges (lowercase letters are a safe bet
      // unless excluded; verify a few candidates).
      for (let tries = 0; tries < 40; tries++) {
        const cp = 33 + Math.floor(rng() * 93);
        const ch = String.fromCharCode(cp);
        const inside = n.ranges.some((r) => cp >= r[0] && cp <= r[1]);
        if (!inside) return ch;
      }
      return 'q';
    }
    const ranges = n.ranges;
    // Prefer letters/digits ~80% of the time for realistic data.
    const nice = ranges.filter((r) =>
      (r[0] >= 48 && r[1] <= 57) || (r[0] >= 65 && r[1] <= 90) || (r[0] >= 97 && r[1] <= 122));
    const pool = nice.length && rng() < 0.8 ? nice : ranges;
    const r = pool[Math.floor(rng() * pool.length)];
    const span = Math.min(r[1], 0x10ffff) - r[0];
    return String.fromCharCode(r[0] + Math.floor(rng() * (span + 1)));
  }

  // ---------- lookahead analysis (password-style rules) ----------

  // Extracts requirements implied by common lookahead patterns, e.g.
  // (?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}  -> {digit, lower, upper, min:8}
  // Returns null when the pattern isn't of this recognizable shape.
  function analyzeLookarounds(pattern) {
    if (!pattern || pattern.length > 300) return null;
    let flags = { digit: false, lower: false, upper: false, special: false, min: null, max: null };
    let sawLookahead = false;
    const re = /\(\?=([^)]*)\)|\(\?<=([^)]*)\)/g;
    let rest = pattern;
    const found = Array.from(pattern.matchAll(re));
    if (!found.length) return null;
    const firstHit = found[0];
    const lastHit = found[found.length - 1];
    // Drop the matched lookarounds, keeping the rest of the pattern.
    rest = pattern.slice(0, firstHit.index) + pattern.slice(lastHit.index + lastHit[0].length);
    for (const hit of found) {
      sawLookahead = true;
      const body = (hit[1] || hit[2] || '').replace(/^\.?\*/, '');
      const classes = Array.from(body.matchAll(/\[([^\]]+)\]/g), (x) => x[1]);
      const bare = body.replace(/\[[^\]]*\]/g, ''); // shorthand-only remains
      if (/\\d/.test(bare) || classes.some((s) => /[0-9]/.test(s) || /0-9/.test(s))) flags.digit = true;
      if (classes.some((s) => /[a-z]/.test(s))) flags.lower = true;
      if (classes.some((s) => /[A-Z]/.test(s))) flags.upper = true;
      if (/\\W/.test(bare) || classes.some((s) => /[^a-zA-Z0-9\s-]/.test(s))) flags.special = true;
    }
    if (!sawLookahead) return null;
    const tail = /(\{(\d+)(,(\d*)?)?\}|(\+|\*))\s*\$?\s*$/.exec(rest.trim());
    if (tail) {
      if (tail[2] !== undefined) {
        flags.min = parseInt(tail[2], 10);
        flags.max = tail[4] !== undefined && tail[4] !== '' ? parseInt(tail[4], 10) : null;
      }
      rest = rest.replace(tail[0], '').trim();
    }
    // The remainder should be a simple dot/class quantifier; if it's anything
    // exotic we still return the flags (caller enforces min/max separately).
    return flags;
  }

  // ---------- public API ----------

  UAF.sampler = {
    parse,
    minLen,
    analyzeLookarounds,

    // Returns a string matching `pattern` (with `flags`), or null.
    sample: function sample(pattern, flags, rng, opts) {
      opts = opts || {};
      const ast = parse(pattern);
      if (!ast) return null;
      let f = flags || '';
      f = f.replace(/[gy]/g, '');
      let re;
      try {
        re = new RegExp(pattern, f);
      } catch (_) {
        return null;
      }
      const maxLen = opts.max || MAX_EMIT;
      const budget = () => Math.max(maxLen - out.length, 1);
      let out = '';
      try {
        out = emitNode(ast, rng, budget);
      } catch (_) {
        return null;
      }
      if (!out.length && minLen(ast) > 0) return null;
      if (out.length > maxLen) out = out.slice(0, maxLen);
      // Safety net: the construction should always match; verify anyway.
      try {
        if (!re.test(out)) return null;
      } catch (_) {
        return null;
      }
      return out;
    }
  };
})();
