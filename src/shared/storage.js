/**
 * @module storage
 *
 * Thin abstraction over browser.storage.local.
 * Validates settings schema on read and write.
 * Provides defaults for missing keys.
 *
 * Depends on: CleanBrowse.Constants, CleanBrowse.Logger
 */
(function (root) {
  'use strict';

  root.CleanBrowse = root.CleanBrowse || {};

  var Constants = root.CleanBrowse.Constants;
  var log = root.CleanBrowse.Logger.createLogger('storage');

  var SETTINGS_KEY = Constants.STORAGE_KEYS.SETTINGS;
  var STATS_KEY = Constants.STORAGE_KEYS.STATS;

  /**
   * Merge defaults into a stored object, filling only missing keys.
   * @param {Object} stored
   * @param {Object} defaults
   * @returns {Object}
   */
  function mergeDefaults(stored, defaults) {
    var result = {};
    var keys = Object.keys(defaults);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (stored && stored.hasOwnProperty(key)) {
        result[key] = stored[key];
      } else {
        var val = defaults[key];
        if (Array.isArray(val)) {
          result[key] = val.slice();
        } else if (val && typeof val === 'object') {
          result[key] = JSON.parse(JSON.stringify(val));
        } else {
          result[key] = val;
        }
      }
    }
    return result;
  }

  /**
   * Validate and sanitize settings values.
   * @param {Object} settings
   * @returns {Object}
   */
  function validateSettings(settings) {
    var valid = {};

    valid.tier = [1, 2, 3].indexOf(settings.tier) !== -1
      ? settings.tier
      : Constants.DEFAULT_SETTINGS.tier;

    var modes = [Constants.FILTER_MODES.BLUR, Constants.FILTER_MODES.REPLACE, Constants.FILTER_MODES.REMOVE, Constants.FILTER_MODES.EMOJI];
    valid.mode = modes.indexOf(settings.mode) !== -1
      ? settings.mode
      : Constants.DEFAULT_SETTINGS.mode;

    valid.enabled = typeof settings.enabled === 'boolean'
      ? settings.enabled
      : Constants.DEFAULT_SETTINGS.enabled;

    valid.customWords = Array.isArray(settings.customWords)
      ? settings.customWords.filter(function (w) { return typeof w === 'string' && w.trim().length > 0; })
      : [];

    valid.removedWords = Array.isArray(settings.removedWords)
      ? settings.removedWords.filter(function (w) { return typeof w === 'string' && w.trim().length > 0; })
      : [];

    valid.siteOverrides = {};
    if (settings.siteOverrides && typeof settings.siteOverrides === 'object') {
      var domains = Object.keys(settings.siteOverrides);
      for (var i = 0; i < domains.length; i++) {
        if (typeof settings.siteOverrides[domains[i]] === 'boolean') {
          valid.siteOverrides[domains[i]] = settings.siteOverrides[domains[i]];
        }
      }
    }

    valid.replacementChar = typeof settings.replacementChar === 'string' && settings.replacementChar.length > 0
      ? settings.replacementChar.charAt(0)
      : Constants.DEFAULT_SETTINGS.replacementChar;

    return valid;
  }

  /**
   * Load settings with defaults for missing keys.
   * @returns {Promise<Object>}
   */
  function loadSettings() {
    return browser.storage.local.get(SETTINGS_KEY).then(function (data) {
      var stored = data[SETTINGS_KEY] || {};
      var merged = mergeDefaults(stored, Constants.DEFAULT_SETTINGS);
      return validateSettings(merged);
    }).catch(function (err) {
      log.error('Failed to load settings, using defaults', err);
      return validateSettings(mergeDefaults({}, Constants.DEFAULT_SETTINGS));
    });
  }

  /**
   * Save partial settings (merges with existing).
   * @param {Object} updates
   * @returns {Promise<void>}
   */
  function saveSettings(updates) {
    return loadSettings().then(function (current) {
      var keys = Object.keys(updates);
      for (var i = 0; i < keys.length; i++) {
        current[keys[i]] = updates[keys[i]];
      }
      var validated = validateSettings(current);
      var payload = {};
      payload[SETTINGS_KEY] = validated;
      return browser.storage.local.set(payload);
    }).catch(function (err) {
      log.error('Failed to save settings', err);
    });
  }

  /**
   * Load stats with defaults for missing keys.
   * @returns {Promise<Object>}
   */
  function loadStats() {
    return browser.storage.local.get(STATS_KEY).then(function (data) {
      var stored = data[STATS_KEY] || {};
      return mergeDefaults(stored, Constants.DEFAULT_STATS);
    }).catch(function (err) {
      log.error('Failed to load stats, using defaults', err);
      return mergeDefaults({}, Constants.DEFAULT_STATS);
    });
  }

  /**
   * Save partial stats (merges with existing).
   * @param {Object} updates
   * @returns {Promise<void>}
   */
  function saveStats(updates) {
    return loadStats().then(function (current) {
      var keys = Object.keys(updates);
      for (var i = 0; i < keys.length; i++) {
        current[keys[i]] = updates[keys[i]];
      }
      var payload = {};
      payload[STATS_KEY] = current;
      return browser.storage.local.set(payload);
    }).catch(function (err) {
      log.error('Failed to save stats', err);
    });
  }

  /**
   * Subscribe to settings changes.
   * @param {Function} callback - Receives the new validated settings
   */
  function onSettingsChanged(callback) {
    browser.storage.onChanged.addListener(function (changes, areaName) {
      if (areaName !== 'local') return;
      if (!changes[SETTINGS_KEY]) return;
      var newValue = changes[SETTINGS_KEY].newValue;
      if (newValue) {
        callback(validateSettings(mergeDefaults(newValue, Constants.DEFAULT_SETTINGS)));
      }
    });
  }

  root.CleanBrowse.Storage = Object.freeze({
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    loadStats: loadStats,
    saveStats: saveStats,
    onSettingsChanged: onSettingsChanged,
  });
})(typeof window !== 'undefined' ? window : self);
