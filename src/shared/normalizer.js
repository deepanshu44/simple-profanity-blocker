/**
 * @module normalizer
 *
 * Normalizes input text to defeat common evasion techniques.
 * All functions are pure — no DOM access, no side effects.
 *
 * Layer 1: Strip zero-width chars, collapse repeated chars, remove separators
 * Layer 2: Leetspeak / character substitution decoding
 * Layer 3: Unicode NFKD normalization + combining mark removal + lowercase
 *
 * The full pipeline returns BOTH the normalized string AND an offset map
 * so that match indices can be traced back to the original text.
 *
 * Depends on: none (standalone pure functions)
 */
(function (root) {
  'use strict';

  root.CleanBrowse = root.CleanBrowse || {};

  // ── Layer 1 helpers ────────────────────────────────────────────

  /** Zero-width characters to strip */
  var ZERO_WIDTH = '\u200B\u200C\u200D\uFEFF';

  /** Combining diacritical marks range */
  var COMBINING_MARKS_RE = /[\u0300-\u036f]/g;

  // ── Layer 2: Leetspeak ─────────────────────────────────────────

  /** Comprehensive leetspeak substitution map */
  var LEET_MAP = {
    '@': 'a', '0': 'o', '1': 'i', '3': 'e', '$': 's',
    '!': 'i', '5': 's', '7': 't', '4': 'a', '8': 'b',
    '+': 't', '|': 'i', '(': 'c', '<': 'c', '{': 'c',
    '9': 'g', '6': 'g', '2': 'z', '#': 'h',
    '¡': 'i', '€': 'e', '£': 'l', '¥': 'y',
    'ß': 'b', 'ø': 'o', 'æ': 'a', 'µ': 'u', 'ñ': 'n',
    'ç': 'c', 'đ': 'd', 'ð': 'd', 'þ': 'th',
    'α': 'a', 'β': 'b', 'δ': 'd', 'ε': 'e', 'η': 'n',
    'ι': 'i', 'κ': 'k', 'μ': 'u', 'ν': 'n', 'ο': 'o',
    'π': 'p', 'ρ': 'r', 'σ': 's', 'τ': 't', 'υ': 'u',
    'φ': 'f', 'ω': 'w', 'Ω': 'w',
  };

  // ── Offset-tracked pipeline ────────────────────────────────────

  /**
   * Full normalization pipeline that also builds an offset map.
   *
   * Returns { text: string, offsets: number[] } where offsets[i] is the
   * index in the ORIGINAL string that produced normalized char i.
   *
   * This allows precise mapping of match ranges back to original text.
   *
   * @param {string} input - Raw text from DOM
   * @returns {{ text: string, offsets: number[] }}
   */
  function normalizeWithOffsets(input) {
    if (!input) return { text: '', offsets: [] };

    // Start: each char maps to its own index
    var chars = [];
    var offsets = [];
    for (var i = 0; i < input.length; i++) {
      chars.push(input[i]);
      offsets.push(i);
    }

    // ── Layer 1a: Strip zero-width characters ──
    var c1 = [];
    var o1 = [];
    for (var z = 0; z < chars.length; z++) {
      if (ZERO_WIDTH.indexOf(chars[z]) === -1) {
        c1.push(chars[z]);
        o1.push(offsets[z]);
      }
    }
    chars = c1;
    offsets = o1;

    // ── Layer 1b: Collapse 3+ repeated chars → 1 ──
    var c2 = [];
    var o2 = [];
    var ri = 0;
    while (ri < chars.length) {
      var ch = chars[ri].toLowerCase();
      var runStart = ri;
      while (ri < chars.length && chars[ri].toLowerCase() === ch) {
        ri++;
      }
      var runLen = ri - runStart;
      if (runLen >= 3) {
        // Keep only 1 copy, mapped to the original range start
        c2.push(chars[runStart]);
        o2.push(offsets[runStart]);
      } else {
        for (var rj = runStart; rj < ri; rj++) {
          c2.push(chars[rj]);
          o2.push(offsets[rj]);
        }
      }
    }
    chars = c2;
    offsets = o2;

    // ── Layer 1c: Remove separators between single letters (f.u.c.k) ──
    // Look for patterns: letter, non-alpha, letter, non-alpha, letter...
    var c3 = [];
    var o3 = [];
    var si = 0;
    while (si < chars.length) {
      // Check if we're at the start of a spaced-out pattern
      if (/[a-zA-Z]/.test(chars[si]) && si + 2 < chars.length) {
        var seqChars = [si];
        var sj = si + 1;
        var isSpaced = true;

        while (sj < chars.length && isSpaced) {
          // Expect: non-alpha separator, then letter
          if (sj < chars.length && /[^a-zA-Z\s]/.test(chars[sj])) {
            if (sj + 1 < chars.length && /[a-zA-Z]/.test(chars[sj + 1])) {
              // Check previous letter was single (the char before separator)
              seqChars.push(sj + 1);
              sj += 2;
            } else {
              isSpaced = false;
            }
          } else {
            isSpaced = false;
          }
        }

        if (seqChars.length >= 3) {
          // It's a spaced-out word — keep only the letters
          for (var sk = 0; sk < seqChars.length; sk++) {
            c3.push(chars[seqChars[sk]]);
            o3.push(offsets[seqChars[sk]]);
          }
          si = sj;
          continue;
        }
      }

      c3.push(chars[si]);
      o3.push(offsets[si]);
      si++;
    }
    chars = c3;
    offsets = o3;

    // ── Layer 2: Leetspeak substitution ──
    var c4 = [];
    var o4 = [];
    for (var li = 0; li < chars.length; li++) {
      var mapped = LEET_MAP[chars[li]];
      if (mapped) {
        // Some mappings produce multiple chars (e.g. 'þ' → 'th')
        for (var lk = 0; lk < mapped.length; lk++) {
          c4.push(mapped[lk]);
          o4.push(offsets[li]);
        }
      } else {
        c4.push(chars[li]);
        o4.push(offsets[li]);
      }
    }
    chars = c4;
    offsets = o4;

    // ── Layer 3: Unicode NFKD + strip combining marks + lowercase ──
    var intermediate = chars.join('');
    var nfkd = intermediate.normalize('NFKD');

    // Build offset map for NFKD expansion
    // NFKD can expand 1 char → multiple chars (base + combining marks)
    // We need to map each NFKD output char back to the pre-NFKD source
    var nfkdOffsets = [];
    var srcIdx = 0;
    var srcPos = 0;
    for (var ni = 0; ni < nfkd.length; ni++) {
      // Move srcPos forward when we've consumed the NFKD expansion of chars[srcIdx]
      if (srcIdx < intermediate.length) {
        var expanded = intermediate[srcIdx].normalize('NFKD');
        var expandedLen = expanded.length;
        // Check if we've moved past the current source char's expansion
        if (srcPos >= expandedLen) {
          srcIdx++;
          srcPos = 0;
        }
      }
      if (srcIdx < offsets.length) {
        nfkdOffsets.push(offsets[srcIdx]);
      } else {
        nfkdOffsets.push(offsets[offsets.length - 1]);
      }
      srcPos++;
    }

    // Strip combining marks and lowercase
    var finalChars = [];
    var finalOffsets = [];
    for (var fi = 0; fi < nfkd.length; fi++) {
      if (!COMBINING_MARKS_RE.test(nfkd[fi])) {
        finalChars.push(nfkd[fi].toLowerCase());
        finalOffsets.push(nfkdOffsets[fi]);
      }
      // Reset lastIndex since we reuse the regex
      COMBINING_MARKS_RE.lastIndex = 0;
    }

    return {
      text: finalChars.join(''),
      offsets: finalOffsets,
    };
  }

  // ── Simple normalize (backward compat) ─────────────────────────

  /**
   * Simple normalization — returns only the normalized string.
   * Use normalizeWithOffsets() when you need index mapping.
   * @param {string} text
   * @returns {string}
   */
  function normalize(text) {
    return normalizeWithOffsets(text).text;
  }

  // ── Individual layers (exported for unit testing) ──────────────

  function stripObfuscation(text) {
    if (!text) return '';
    var result = text.replace(new RegExp('[' + ZERO_WIDTH + ']', 'g'), '');
    result = result.replace(/(.)(\1){2,}/gi, '$1');
    result = result.replace(
      /\b([a-zA-Z])[^a-zA-Z\s]([a-zA-Z])[^a-zA-Z\s]([a-zA-Z])(?:[^a-zA-Z\s]([a-zA-Z]))*/g,
      function (match) { return match.replace(/[^a-zA-Z]/g, ''); }
    );
    return result;
  }

  function decodeLeetspeak(text) {
    if (!text) return '';
    var result = '';
    for (var i = 0; i < text.length; i++) {
      result += LEET_MAP[text[i]] || text[i];
    }
    return result;
  }

  function normalizeUnicode(text) {
    if (!text) return '';
    var normalized = text.normalize('NFKD');
    normalized = normalized.replace(COMBINING_MARKS_RE, '');
    return normalized.toLowerCase();
  }

  root.CleanBrowse.Normalizer = Object.freeze({
    normalize: normalize,
    normalizeWithOffsets: normalizeWithOffsets,
    stripObfuscation: stripObfuscation,
    decodeLeetspeak: decodeLeetspeak,
    normalizeUnicode: normalizeUnicode,
  });
})(typeof window !== 'undefined' ? window : self);
