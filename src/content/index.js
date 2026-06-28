/**
 * Clean Browse — Content Script Orchestrator
 *
 * Entry point. Coordinates all modules:
 *   1. Load user settings
 *   2. Check if filtering is enabled for this site
 *   3. Compile the matcher (loads word lists, builds regex)
 *   4. Create the filter engine
 *   5. Walk the DOM and apply filters
 *   6. Start MutationObserver for dynamic content
 *   7. Listen for REFILTER messages from background
 *
 * Depends on all shared + content modules (loaded via manifest.json in order)
 */
(function () {
  'use strict';

  var CB = window.CleanBrowse || {};
  var Constants = CB.Constants;
  var Logger = CB.Logger;
  var Storage = CB.Storage;
  var Matcher = CB.Matcher;
  var FilterEngine = CB.FilterEngine;
  var DOMWalker = CB.DOMWalker;
  var MutationHandler = CB.MutationHandler;

  var MESSAGE_TYPES = Constants.MESSAGE_TYPES;
  var log = Logger.createLogger('orchestrator');

  // ── State ──────────────────────────────────────────────────────

  var currentSettings = null;
  var currentEngine = null;
  var mutationHandler = null;
  var totalMatchCount = 0;

  // ── Helpers ────────────────────────────────────────────────────

  function getCurrentHostname() {
    try {
      return window.location.hostname;
    } catch (e) {
      return '';
    }
  }

  function isEnabledForSite(settings) {
    if (!settings.enabled) return false;

    var hostname = getCurrentHostname();
    if (!hostname) return true;

    var overrides = settings.siteOverrides || {};
    if (overrides.hasOwnProperty(hostname)) {
      return overrides[hostname];
    }

    return true;
  }

  function updateBadge(count) {
    try {
      browser.runtime.sendMessage({
        type: MESSAGE_TYPES.UPDATE_BADGE,
        count: count,
      });
    } catch (e) {
      // Background may not be ready
    }
  }

  function updateStats(matchCount) {
    if (matchCount <= 0) return;

    Storage.loadStats().then(function (stats) {
      return Storage.saveStats({
        totalFiltered: (stats.totalFiltered || 0) + matchCount,
        sessionFiltered: (stats.sessionFiltered || 0) + matchCount,
        lastActive: new Date().toISOString(),
      });
    }).catch(function (err) {
      log.warn('Failed to update stats', err);
    });
  }

  // ── Core Init ──────────────────────────────────────────────────

  function init() {
    var startTime = performance.now();

    Storage.loadSettings()
      .then(function (settings) {
        currentSettings = settings;

        if (!isEnabledForSite(settings)) {
          log.debug('Filtering disabled for: ' + getCurrentHostname());
          updateBadge(0);
          return null;
        }

        return Matcher.compileMatcher(
          settings.tier,
          settings.customWords,
          settings.removedWords
        );
      })
      .then(function (matcher) {
        if (!matcher) return;

        log.debug('Matcher compiled: ' + matcher.wordCount + ' words');

        currentEngine = FilterEngine.createFilterEngine(
          matcher,
          currentSettings.mode,
          currentSettings.replacementChar
        );

        var result = DOMWalker.walkAndFilter(document.body, currentEngine);
        totalMatchCount = result.matchCount;

        var elapsed = (performance.now() - startTime).toFixed(2);
        log.debug('Initial scan: ' + result.nodesProcessed + ' nodes, ' +
          result.matchCount + ' matches in ' + elapsed + 'ms');

        if (parseFloat(elapsed) > 20) {
          log.warn('Initial scan exceeded 20ms budget: ' + elapsed + 'ms');
        }

        updateBadge(totalMatchCount);
        updateStats(result.matchCount);

        mutationHandler = MutationHandler.createMutationHandler(currentEngine, DOMWalker);
        mutationHandler.observe(document.body);
      })
      .catch(function (err) {
        log.error('Initialization failed — page renders unfiltered', err);
      });
  }

  // ── Re-filter ──────────────────────────────────────────────────

  function refilter() {
    log.debug('Re-filtering page...');

    if (mutationHandler) {
      mutationHandler.disconnect();
      mutationHandler = null;
    }

    // Remove our injected spans and restore original text
    var blurs = document.querySelectorAll('.cb-blur, .cb-replaced');
    for (var i = 0; i < blurs.length; i++) {
      var span = blurs[i];
      var text = document.createTextNode(span.textContent);
      span.parentNode.replaceChild(text, span);
    }

    DOMWalker.resetProcessedMarkers(document.body);
    totalMatchCount = 0;
    init();
  }

  // ── Message Listener ───────────────────────────────────────────

  browser.runtime.onMessage.addListener(function (message) {
    if (!message || !message.type) return;

    if (message.type === MESSAGE_TYPES.REFILTER) {
      refilter();
    }
  });

  // ── Entry Point ────────────────────────────────────────────────

  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        try { init(); } catch (err) { log.error('Init failed', err); }
      });
    } else {
      init();
    }
    log.debug('Content script loaded for: ' + getCurrentHostname());
  } catch (err) {
    console.error('[CleanBrowse] Fatal error:', err);
  }
})();
