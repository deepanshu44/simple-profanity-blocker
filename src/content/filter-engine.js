/**
 * @module filter-engine
 *
 * Core filtering logic. Combines normalizer + matcher to process text nodes.
 * Returns filter instructions — does NOT modify the DOM directly.
 *
 * Uses normalizeWithOffsets() to get precise index mapping between
 * normalized and original text, even when normalization changes string length.
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
   * Map match indices from normalized text back to original text
   * using the offset map produced by normalizeWithOffsets().
   *
   * offsets[i] = the index in the ORIGINAL string that produced
   * normalized character i.
   *
   * For a match at normalized [start, start+len), we look up:
   *   origStart = offsets[start]
   *   origEnd   = offsets[start+len-1] + 1
   *
   * Then extend origEnd to capture the full original word boundary
   * (e.g. "fuuuuuck" when normalized match is just "fuck").
   *
   * @param {Array} matches - From Matcher.findMatches
   * @param {string} originalText
   * @param {number[]} offsets - From normalizeWithOffsets
   * @returns {Array} Matches with corrected original indices
   */
  function mapMatchesToOriginal(matches, originalText, offsets) {
    return matches.map(function (m) {
      var normStart = m.index;
      var normEnd = m.index + m.length - 1;

      // Clamp to offset bounds
      if (normStart >= offsets.length) return null;
      if (normEnd >= offsets.length) normEnd = offsets.length - 1;

      var origStart = offsets[normStart];
      var origEnd = offsets[normEnd] + 1;

      // Extend to cover the full original word at word boundaries.
      // Walk backward from origStart to find actual word start.
      while (origStart > 0 && /\w/.test(originalText[origStart - 1])) {
        origStart--;
      }
      // Walk forward from origEnd to find actual word end.
      while (origEnd < originalText.length && /\w/.test(originalText[origEnd])) {
        origEnd++;
      }

      return {
        word: m.word,
        index: origStart,
        length: origEnd - origStart,
      };
    }).filter(function (m) { return m !== null; });
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

      var result = Normalizer.normalizeWithOffsets(originalText);
      var normalizedText = result.text;
      var offsets = result.offsets;

      var matches = Matcher.findMatches(matcher, originalText, normalizedText);

      if (!matches || matches.length === 0) {
        return { hasMatches: false, instructions: [], matchCount: 0 };
      }

      var mapped = mapMatchesToOriginal(matches, originalText, offsets);
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
