/**
 * @module mutation-handler
 *
 * MutationObserver management for dynamic content (SPAs, infinite scroll).
 * Debounces mutations and re-filters only new/changed nodes.
 *
 * Depends on: CleanBrowse.Constants, CleanBrowse.Logger
 */
(function () {
  'use strict';

  window.CleanBrowse = window.CleanBrowse || {};

  var Constants = window.CleanBrowse.Constants;
  var Logger = window.CleanBrowse.Logger;
  var log = Logger.createLogger('mutation-handler');

  var PROCESSED_ATTR = Constants.PROCESSED_ATTR;
  var DEBOUNCE_MS = Constants.DEBOUNCE_MS;

  /**
   * Check whether a node was produced by our own DOM modifications.
   * @param {Node} node
   * @returns {boolean}
   */
  function isOwnMutation(node) {
    if (!node) return true;

    var el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!el) return false;

    if (el.hasAttribute(PROCESSED_ATTR)) return true;
    if (el.parentElement && el.parentElement.hasAttribute(PROCESSED_ATTR)) return true;

    if (el.classList &&
        (el.classList.contains('cb-blur') ||
         el.classList.contains('cb-replaced') ||
         el.classList.contains('cb-removed'))) {
      return true;
    }

    return false;
  }

  /**
   * Create a MutationHandler that watches for DOM changes and re-filters.
   *
   * @param {{ filterTextNode: function }} filterEngine
   * @param {{ walkAndFilter: function }} domWalker
   * @returns {{ observe: function(Node), disconnect: function }}
   */
  function createMutationHandler(filterEngine, domWalker) {
    var observer = null;
    var pendingNodes = [];
    var debounceTimer = null;
    var isProcessing = false;

    /**
     * Schedule a debounced processing pass.
     */
    function scheduleProcessing() {
      if (debounceTimer) return;

      if (typeof requestIdleCallback === 'function') {
        debounceTimer = requestIdleCallback(processPendingNodes, {
          timeout: DEBOUNCE_MS,
        });
      } else {
        debounceTimer = setTimeout(processPendingNodes, DEBOUNCE_MS);
      }
    }

    /**
     * Process all pending nodes accumulated since the last batch.
     */
    function processPendingNodes() {
      debounceTimer = null;

      if (pendingNodes.length === 0) return;

      var nodes = pendingNodes;
      pendingNodes = [];
      isProcessing = true;

      var totalMatches = 0;

      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];

        if (!node.parentNode && node !== document.body) continue;
        if (isOwnMutation(node)) continue;

        try {
          var result = domWalker.walkAndFilter(node, filterEngine);
          totalMatches += result.matchCount;
        } catch (err) {
          log.warn('Error processing mutation target', err.message);
        }
      }

      isProcessing = false;

      if (totalMatches > 0) {
        log.debug('Mutation batch: ' + totalMatches + ' matches');

        // Notify background to update badge
        try {
          browser.runtime.sendMessage({
            type: Constants.MESSAGE_TYPES.UPDATE_BADGE,
            count: totalMatches,
            incremental: true,
          });
        } catch (e) {
          // Ignore
        }
      }
    }

    /**
     * MutationObserver callback.
     * @param {MutationRecord[]} mutations
     */
    function onMutation(mutations) {
      if (isProcessing) return;

      for (var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i];

        if (mutation.type === 'childList') {
          for (var j = 0; j < mutation.addedNodes.length; j++) {
            var added = mutation.addedNodes[j];
            if (isOwnMutation(added)) continue;
            if (added.nodeType !== Node.ELEMENT_NODE && added.nodeType !== Node.TEXT_NODE) continue;
            pendingNodes.push(added);
          }
        } else if (mutation.type === 'characterData') {
          var target = mutation.target;
          if (isOwnMutation(target)) continue;
          pendingNodes.push(target);
        }
      }

      if (pendingNodes.length > 0) {
        scheduleProcessing();
      }
    }

    /**
     * Start observing the given root for mutations.
     * @param {Node} root
     */
    function observe(root) {
      if (observer) {
        observer.disconnect();
      }

      observer = new MutationObserver(onMutation);
      observer.observe(root, {
        childList: true,
        characterData: true,
        subtree: true,
      });

      log.debug('MutationObserver started');
    }

    /**
     * Stop observing and clean up.
     */
    function disconnect() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }

      if (debounceTimer) {
        if (typeof cancelIdleCallback === 'function') {
          cancelIdleCallback(debounceTimer);
        } else {
          clearTimeout(debounceTimer);
        }
        debounceTimer = null;
      }

      pendingNodes = [];
      isProcessing = false;
      log.debug('MutationObserver disconnected');
    }

    return {
      observe: observe,
      disconnect: disconnect,
    };
  }

  window.CleanBrowse.MutationHandler = Object.freeze({
    createMutationHandler: createMutationHandler,
  });
})();
