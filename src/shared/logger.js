/**
 * @module logger
 *
 * Structured logging utility for Clean Browse.
 * Each logger instance is scoped to a module name.
 * Debug output is gated by Constants.IS_DEBUG.
 *
 * Depends on: CleanBrowse.Constants (loaded first via manifest)
 */
(function (root) {
  'use strict';

  root.CleanBrowse = root.CleanBrowse || {};

  var Constants = root.CleanBrowse.Constants || {};
  var IS_DEBUG = Constants.IS_DEBUG || false;

  /**
   * Create a scoped logger for a specific module.
   * @param {string} moduleName - Name of the calling module
   * @returns {{ debug: Function, warn: Function, error: Function, critical: Function }}
   */
  function createLogger(moduleName) {
    var prefix = '[SimpleProfanityBlocker:' + moduleName + ']';

    return {
      /** Debug-level log. Only outputs when IS_DEBUG is true. */
      debug: function () {
        if (!IS_DEBUG) return;
        var args = [prefix + ' [DEBUG]'];
        for (var i = 0; i < arguments.length; i++) {
          args.push(arguments[i]);
        }
        console.log.apply(console, args);
      },

      /** Warning-level log. Always outputs. */
      warn: function () {
        var args = [prefix + ' [WARN]'];
        for (var i = 0; i < arguments.length; i++) {
          args.push(arguments[i]);
        }
        console.warn.apply(console, args);
      },

      /** Error-level log with stack trace. Always outputs. */
      error: function () {
        var args = [prefix + ' [ERROR]'];
        for (var i = 0; i < arguments.length; i++) {
          args.push(arguments[i]);
        }
        args.push('\n' + new Error().stack);
        console.error.apply(console, args);
      },

      /** Critical-level log with stack trace. Extension-breaking failures. */
      critical: function () {
        var args = [prefix + ' [CRITICAL]'];
        for (var i = 0; i < arguments.length; i++) {
          args.push(arguments[i]);
        }
        args.push('\n' + new Error().stack);
        console.error.apply(console, args);
      },
    };
  }

  root.CleanBrowse.Logger = Object.freeze({
    createLogger: createLogger,
  });
})(typeof window !== 'undefined' ? window : self);
