/**
 * @module constants
 *
 * All enums, defaults, and configuration constants for Clean Browse.
 * This is the FIRST module loaded — no dependencies on other CB modules.
 *
 * Attaches to window.CleanBrowse.Constants (content/popup contexts)
 * and self.CleanBrowse.Constants (background/service worker context).
 */
(function (root) {
  'use strict';

  root.CleanBrowse = root.CleanBrowse || {};

  /** Filter display modes */
  var FILTER_MODES = Object.freeze({
    BLUR: 'blur',
    REPLACE: 'replace',
    REMOVE: 'remove',
    EMOJI: 'emoji',
  });

  /** Profanity severity tiers (1 = most severe) */
  var TIERS = Object.freeze({
    SEVERE: 1,
    MODERATE: 2,
    MILD: 3,
  });

  /** browser.storage.local key names */
  var STORAGE_KEYS = Object.freeze({
    SETTINGS: 'cb_settings',
    STATS: 'cb_stats',
  });

  /** Default user settings — merged on first load */
  var DEFAULT_SETTINGS = Object.freeze({
    tier: 2,
    mode: 'blur',
    enabled: true,
    customWords: [],
    removedWords: [],
    siteOverrides: {},
    replacementChar: '*',
  });

  /** Default stats object */
  var DEFAULT_STATS = Object.freeze({
    totalFiltered: 0,
    sessionFiltered: 0,
    lastActive: null,
  });

  /** Tags to skip during DOM traversal */
  var EXCLUDED_TAGS = Object.freeze([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE',
    'TEXTAREA', 'INPUT', 'SVG', 'CANVAS', 'IMG',
    'VIDEO', 'AUDIO', 'IFRAME', 'OBJECT', 'EMBED',
  ]);

  /** Data attribute to mark processed nodes */
  var PROCESSED_ATTR = 'data-cb-processed';

  /** MutationObserver debounce interval in ms */
  var DEBOUNCE_MS = 50;

  /** Structured logging levels */
  var LOG_LEVELS = Object.freeze({
    DEBUG: 0,
    WARN: 1,
    ERROR: 2,
    CRITICAL: 3,
  });

  /** Debug mode flag — set to true during development */
  var IS_DEBUG = false;

  /**
   * Inter-module message types.
   * These strings MUST match across background, content, and popup scripts.
   */
  var MESSAGE_TYPES = Object.freeze({
    SETTINGS_CHANGED: 'cb_settings_changed',
    REFILTER: 'cb_refilter',
    GET_STATS: 'cb_get_stats',
    UPDATE_BADGE: 'cb_update_badge',
  });

  root.CleanBrowse.Constants = Object.freeze({
    FILTER_MODES: FILTER_MODES,
    TIERS: TIERS,
    STORAGE_KEYS: STORAGE_KEYS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    DEFAULT_STATS: DEFAULT_STATS,
    EXCLUDED_TAGS: EXCLUDED_TAGS,
    PROCESSED_ATTR: PROCESSED_ATTR,
    DEBOUNCE_MS: DEBOUNCE_MS,
    LOG_LEVELS: LOG_LEVELS,
    IS_DEBUG: IS_DEBUG,
    MESSAGE_TYPES: MESSAGE_TYPES,
  });
})(typeof window !== 'undefined' ? window : self);
