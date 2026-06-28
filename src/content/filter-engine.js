/**
 * @module filter-engine
 *
 * Core filtering logic. Combines normalizer + matcher to process text nodes.
 * Returns filter instructions — does NOT modify the DOM directly.
 *
 * Depends on: CleanBrowse.Normalizer, CleanBrowse.Matcher, CleanBrowse.Logger
 */
(function () {
  'use strict';

  window.CleanBrowse = window.CleanBrowse || {};

  var Normalizer = window.CleanBrowse.Normalizer;
  var Matcher = window.CleanBrowse.Matcher;
  var Logger = window.CleanBrowse.Logger;

  /**
   * Build a replacement string of `char` repeated `length` times.
   * @param {string} char
   * @param {number} length
   * @returns {string}
   */
  function buildReplacement(char, length) {
    var result = '';
    for (var i = 0; i < length; i++) {
      result += char;
    }
    return result;
  }

  /**
   * Map match indices from normalized text back to original text.
   *
   * When normalization preserves string length (1-to-1 char mapping like
   * lowercase, leet substitution), indices map directly. When it changes
   * length (collapsing repeats, stripping chars), we clamp to bounds.
   *
   * @param {Array} matches
   * @param {string} originalText
   * @param {string} normalizedText
   * @returns {Array}
   */
  function mapMatchesToOriginal(matches, originalText, normalizedText) {
    if (normalizedText.length === originalText.length) {
      return matches;
    }

    return matches.map(function (m) {
      var start = Math.min(m.index, originalText.length);
      var length = Math.min(m.length, originalText.length - start);
      return { word: m.word, index: start, length: length };
    });
  }

  /**
   * Create a filter engine configured with the given matcher and mode.
   *
   * @param {{ pattern: RegExp, whitelist: Set }} matcher - Compiled matcher
   * @param {'blur'|'replace'|'remove'} mode - Filter mode
   * @param {string} [replacementChar='*'] - Character for REPLACE mode
   * @returns {{ filterTextNode: function(Text): FilterResult }}
   */
  function createFilterEngine(matcher, mode, replacementChar) {
    var replChar = replacementChar || '*';
    var log = Logger
      ? Logger.createLogger('filter-engine')
      : { debug: function () {}, warn: function () {} };

    /**
     * Analyse a text node and return filtering instructions.
     *
     * @param {Text} textNode
     * @returns {{ hasMatches: boolean, instructions: Array, matchCount: number }}
     */
    function filterTextNode(textNode) {
      var originalText = textNode.textContent;

      if (!originalText || !originalText.trim()) {
        return { hasMatches: false, instructions: [], matchCount: 0 };
      }

      var normalizedText = Normalizer.normalize(originalText);
      var matches = Matcher.findMatches(matcher, originalText, normalizedText);

      if (!matches || matches.length === 0) {
        return { hasMatches: false, instructions: [], matchCount: 0 };
      }

      var mapped = mapMatchesToOriginal(matches, originalText, normalizedText);
      var instructions = [];

      for (var i = 0; i < mapped.length; i++) {
        var match = mapped[i];
        var startIdx = match.index;
        var endIdx = match.index + match.length;

        switch (mode) {
          case 'blur':
            instructions.push({
              action: 'wrap',
              startIndex: startIdx,
              endIndex: endIdx,
              className: 'cb-blur',
            });
            break;
          case 'replace':
            instructions.push({
              action: 'replace',
              startIndex: startIdx,
              endIndex: endIdx,
              replacement: buildReplacement(replChar, match.length),
            });
            break;
          case 'remove':
            instructions.push({
              action: 'remove',
              startIndex: startIdx,
              endIndex: endIdx,
            });
            break;
          default:
            log.warn('Unknown filter mode: ' + mode + ', falling back to replace');
            instructions.push({
              action: 'replace',
              startIndex: startIdx,
              endIndex: endIdx,
              replacement: buildReplacement(replChar, match.length),
            });
        }
      }

      return {
        hasMatches: true,
        instructions: instructions,
        matchCount: matches.length,
      };
    }

    return { filterTextNode: filterTextNode };
  }

  window.CleanBrowse.FilterEngine = Object.freeze({
    createFilterEngine: createFilterEngine,
  });
})();
