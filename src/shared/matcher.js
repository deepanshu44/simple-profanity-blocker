/**
 * @module matcher
 *
 * Compiles tiered word lists into a single regex pattern.
 * Handles whitelist exceptions.
 * Loads word lists via fetch + browser.runtime.getURL for MV2 compatibility.
 *
 * Depends on: CleanBrowse.Logger
 */
(function (root) {
  'use strict';

  root.CleanBrowse = root.CleanBrowse || {};

  var log = root.CleanBrowse.Logger.createLogger('matcher');

  /** Map tier numbers to their JSON file paths */
  var TIER_FILES = {
    1: 'data/wordlist-severe.json',
    2: 'data/wordlist-moderate.json',
    3: 'data/wordlist-mild.json',
  };

  var WHITELIST_FILE = 'data/whitelist.json';

  /**
   * Escape special regex characters in a string.
   * @param {string} str
   * @returns {string}
   */
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Fetch and parse a JSON file from the extension bundle.
   * @param {string} relativePath
   * @returns {Promise<Object>}
   */
  function fetchExtensionJSON(relativePath) {
    var url = browser.runtime.getURL(relativePath);
    return fetch(url).then(function (response) {
      if (!response.ok) {
        throw new Error('Failed to fetch ' + relativePath + ': ' + response.status);
      }
      return response.json();
    });
  }

  /**
   * Extract all words and variants from a word list JSON object.
   * @param {Object} wordListData
   * @returns {string[]}
   */
  function extractWords(wordListData) {
    var words = [];
    if (!wordListData || !Array.isArray(wordListData.words)) {
      return words;
    }
    for (var i = 0; i < wordListData.words.length; i++) {
      var entry = wordListData.words[i];
      if (entry.word) {
        words.push(entry.word.toLowerCase());
      }
      if (Array.isArray(entry.variants)) {
        for (var j = 0; j < entry.variants.length; j++) {
          words.push(entry.variants[j].toLowerCase());
        }
      }
    }
    return words;
  }

  /**
   * Compile word lists up to the specified tier into a single regex.
   *
   * @param {1|2|3} tier - Filter tier (1=severe only, 2=+moderate, 3=+mild)
   * @param {string[]} [customWords] - User-added words
   * @param {string[]} [removedWords] - User-removed words
   * @returns {Promise<{ pattern: RegExp, whitelist: Set, wordCount: number }>}
   */
  function compileMatcher(tier, customWords, removedWords) {
    customWords = customWords || [];
    removedWords = removedWords || [];

    // Determine which tier files to load (cumulative: tier 2 = severe + moderate)
    var filesToLoad = [];
    for (var t = 1; t <= tier; t++) {
      if (TIER_FILES[t]) {
        filesToLoad.push(TIER_FILES[t]);
      }
    }

    // Load all word list files + whitelist in parallel
    var fetchPromises = filesToLoad.map(function (file) {
      return fetchExtensionJSON(file);
    });
    fetchPromises.push(fetchExtensionJSON(WHITELIST_FILE));

    return Promise.all(fetchPromises).then(function (results) {
      var whitelistData = results[results.length - 1];
      var wordListResults = results.slice(0, results.length - 1);

      // Extract all words from tier files
      var allWords = [];
      for (var i = 0; i < wordListResults.length; i++) {
        allWords = allWords.concat(extractWords(wordListResults[i]));
      }

      // Add custom words
      for (var c = 0; c < customWords.length; c++) {
        var cw = customWords[c].toLowerCase().trim();
        if (cw.length > 0) {
          allWords.push(cw);
        }
      }

      // Build removed set
      var removedSet = new Set();
      for (var r = 0; r < removedWords.length; r++) {
        removedSet.add(removedWords[r].toLowerCase().trim());
      }

      // Deduplicate and filter
      var uniqueWords = [];
      var seen = new Set();
      for (var w = 0; w < allWords.length; w++) {
        var word = allWords[w];
        if (!removedSet.has(word) && !seen.has(word) && word.length > 0) {
          seen.add(word);
          uniqueWords.push(word);
        }
      }

      // Build whitelist Set
      var whitelist = new Set();
      if (whitelistData && Array.isArray(whitelistData.words)) {
        for (var wl = 0; wl < whitelistData.words.length; wl++) {
          whitelist.add(whitelistData.words[wl].toLowerCase());
        }
      }

      // Build regex — sort by length descending so longer words match first
      var escaped = uniqueWords.map(function (w) {
        return escapeRegex(w);
      });
      escaped.sort(function (a, b) {
        return b.length - a.length;
      });

      // Common English suffixes — auto-matches inflected forms
      // e.g. fuck → fucks, fucked, fucking, fucker, fuckers, fuckery
      var suffixes = '(?:s|ed|er|ers|es|ing|y|ey|ish|ery|able|iest|ier|ies|ty)?';
      var patternStr = '\\b(' + escaped.join('|') + ')' + suffixes + '\\b';
      var pattern = new RegExp(patternStr, 'gi');

      log.debug('Compiled: ' + uniqueWords.length + ' words, ' + whitelist.size + ' whitelist entries');

      return {
        pattern: pattern,
        whitelist: whitelist,
        wordCount: uniqueWords.length,
      };
    }).catch(function (err) {
      log.error('Failed to compile matcher', err);
      return {
        pattern: /(?!)/,
        whitelist: new Set(),
        wordCount: 0,
      };
    });
  }

  /**
   * Find all profanity matches in normalized text.
   * Checks each match against the whitelist using surrounding context
   * from the original text.
   *
   * @param {{ pattern: RegExp, whitelist: Set }} matcher
   * @param {string} originalText - Original text from the DOM
   * @param {string} normalizedText - Text after normalization pipeline
   * @returns {Array<{ word: string, index: number, length: number }>}
   */
  function findMatches(matcher, originalText, normalizedText) {
    var matches = [];
    var pattern = matcher.pattern;
    var whitelist = matcher.whitelist;

    if (!pattern || !normalizedText) {
      return matches;
    }

    pattern.lastIndex = 0;

    var match;
    while ((match = pattern.exec(normalizedText)) !== null) {
      var matchedWord = match[0].toLowerCase();
      var matchIndex = match.index;
      var matchLength = match[0].length;

      // Extract surrounding word from original text for whitelist check
      var origWord = extractOriginalWord(originalText, matchIndex, matchLength);

      if (whitelist.has(origWord.toLowerCase())) {
        continue;
      }
      if (whitelist.has(matchedWord)) {
        continue;
      }

      matches.push({
        word: matchedWord,
        index: matchIndex,
        length: matchLength,
      });
    }

    return matches;
  }

  /**
   * Extract the full word from original text at the given position.
   * Extends outward from the match to find word boundaries.
   * @param {string} text
   * @param {number} index
   * @param {number} length
   * @returns {string}
   */
  function extractOriginalWord(text, index, length) {
    var start = index;
    var end = index + length;

    while (start > 0 && /\w/.test(text[start - 1])) {
      start--;
    }
    while (end < text.length && /\w/.test(text[end])) {
      end++;
    }

    return text.substring(start, end);
  }

  root.CleanBrowse.Matcher = Object.freeze({
    compileMatcher: compileMatcher,
    findMatches: findMatches,
    escapeRegex: escapeRegex,
  });
})(typeof window !== 'undefined' ? window : self);
