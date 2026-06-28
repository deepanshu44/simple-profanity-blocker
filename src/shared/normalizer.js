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
 * Depends on: none (standalone pure functions)
 */
(function (root) {
  'use strict';

  root.CleanBrowse = root.CleanBrowse || {};

  // ── Layer 1 helpers ────────────────────────────────────────────

  /** Zero-width characters to strip */
  var ZERO_WIDTH_RE = /[\u200B\u200C\u200D\uFEFF]/g;

  /** 3+ consecutive identical characters → 1 */
  var REPEATED_CHARS_RE = /(.)\1{2,}/gi;

  /**
   * Detect spaced-out single letters: f.u.c.k, f-u-c-k, f_u_c_k
   * Requires at least 3 single letters separated by non-alpha chars.
   */
  var SEPARATED_LETTERS_RE = /\b([a-zA-Z])[^a-zA-Z\s]([a-zA-Z])[^a-zA-Z\s]([a-zA-Z])(?:[^a-zA-Z\s]([a-zA-Z]))*/g;

  /**
   * Layer 1: Strip zero-width chars, collapse repeats, remove separators.
   * @param {string} text
   * @returns {string}
   */
  function stripObfuscation(text) {
    var result = text.replace(ZERO_WIDTH_RE, '');
    result = result.replace(REPEATED_CHARS_RE, '$1');
    result = result.replace(SEPARATED_LETTERS_RE, function (match) {
      return match.replace(/[^a-zA-Z]/g, '');
    });
    return result;
  }

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

  /**
   * Layer 2: Apply character substitution map (leetspeak).
   * @param {string} text
   * @returns {string}
   */
  function decodeLeetspeak(text) {
    var result = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      result += LEET_MAP[ch] || ch;
    }
    return result;
  }

  // ── Layer 3: Unicode normalization ─────────────────────────────

  /** Combining diacritical marks range */
  var COMBINING_MARKS_RE = /[\u0300-\u036f]/g;

  /**
   * Layer 3: Unicode NFKD normalization, strip combining marks, lowercase.
   * @param {string} text
   * @returns {string}
   */
  function normalizeUnicode(text) {
    var normalized = text.normalize('NFKD');
    normalized = normalized.replace(COMBINING_MARKS_RE, '');
    return normalized.toLowerCase();
  }

  // ── Full pipeline ──────────────────────────────────────────────

  /**
   * Full normalization pipeline (Layers 1-3).
   * @param {string} text - Raw text from DOM
   * @returns {string} Normalized text for matching
   */
  function normalize(text) {
    if (!text) return '';
    var result = stripObfuscation(text);
    result = decodeLeetspeak(result);
    result = normalizeUnicode(result);
    return result;
  }

  root.CleanBrowse.Normalizer = Object.freeze({
    normalize: normalize,
    stripObfuscation: stripObfuscation,
    decodeLeetspeak: decodeLeetspeak,
    normalizeUnicode: normalizeUnicode,
  });
})(typeof window !== 'undefined' ? window : self);
