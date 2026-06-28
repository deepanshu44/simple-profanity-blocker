/**
 * @module dom-walker
 *
 * Traverses the DOM using TreeWalker API and applies filter instructions.
 * This is the ONLY module that directly modifies the DOM.
 *
 * Depends on: CleanBrowse.Constants, CleanBrowse.Logger
 */
(function () {
  'use strict';

  window.CleanBrowse = window.CleanBrowse || {};

  var Constants = window.CleanBrowse.Constants;
  var Logger = window.CleanBrowse.Logger;
  var log = Logger.createLogger('dom-walker');

  var EXCLUDED_TAGS_LIST = Constants.EXCLUDED_TAGS;
  var PROCESSED_ATTR = Constants.PROCESSED_ATTR;

  /** Build a fast-lookup object from the excluded tags list */
  var EXCLUDED_SET = {};
  for (var i = 0; i < EXCLUDED_TAGS_LIST.length; i++) {
    EXCLUDED_SET[EXCLUDED_TAGS_LIST[i]] = true;
  }

  // ── Helpers ────────────────────────────────────────────────────

  /**
   * Check whether a node (or its parent) has the processed marker.
   * @param {Node} node
   * @returns {boolean}
   */
  function isProcessed(node) {
    var el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return el ? el.hasAttribute(PROCESSED_ATTR) : false;
  }

  /**
   * Mark an element as processed.
   * @param {Element} el
   */
  function markProcessed(el) {
    if (el && el.setAttribute) {
      el.setAttribute(PROCESSED_ATTR, '1');
    }
  }

  // ── Instruction applicators ────────────────────────────────────

  /**
   * Apply a 'wrap' instruction — split text node and wrap segment in a span.
   * @param {Text} textNode
   * @param {Object} instr - { startIndex, endIndex, className }
   */
  function applyWrap(textNode, instr) {
    var afterNode = textNode.splitText(instr.startIndex);
    afterNode.splitText(instr.endIndex - instr.startIndex);
    // afterNode now contains only the matched text

    var wrapper = document.createElement('span');
    wrapper.className = instr.className;
    wrapper.textContent = afterNode.textContent;
    afterNode.parentNode.replaceChild(wrapper, afterNode);
  }

  /**
   * Apply a 'replace' instruction — swap matched segment text.
   * @param {Text} textNode
   * @param {Object} instr - { startIndex, endIndex, replacement }
   */
  function applyReplace(textNode, instr) {
    var afterNode = textNode.splitText(instr.startIndex);
    afterNode.splitText(instr.endIndex - instr.startIndex);

    var wrapper = document.createElement('span');
    wrapper.className = 'cb-replaced';
    wrapper.textContent = instr.replacement;
    afterNode.parentNode.replaceChild(wrapper, afterNode);
  }

  /**
   * Apply a 'remove' instruction — delete matched segment.
   * @param {Text} textNode
   * @param {Object} instr - { startIndex, endIndex }
   */
  function applyRemove(textNode, instr) {
    var afterNode = textNode.splitText(instr.startIndex);
    afterNode.splitText(instr.endIndex - instr.startIndex);
    afterNode.parentNode.removeChild(afterNode);
  }

  /**
   * Apply an array of filter instructions to a text node.
   * CRITICAL: Instructions are processed in reverse order (right-to-left)
   * so that character indices remain valid after each split.
   *
   * @param {Text} textNode
   * @param {Array} instructions
   */
  function applyInstructions(textNode, instructions) {
    var sorted = instructions.slice().sort(function (a, b) {
      return b.startIndex - a.startIndex;
    });

    for (var i = 0; i < sorted.length; i++) {
      var instr = sorted[i];

      if (instr.startIndex < 0 || instr.endIndex > textNode.textContent.length) {
        log.warn('Instruction indices out of bounds, skipping', instr);
        continue;
      }

      switch (instr.action) {
        case 'wrap':
          applyWrap(textNode, instr);
          break;
        case 'replace':
          applyReplace(textNode, instr);
          break;
        case 'remove':
          applyRemove(textNode, instr);
          break;
        default:
          log.warn('Unknown instruction action: ' + instr.action);
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────

  /**
   * Walk all text nodes under root and apply the filter engine.
   *
   * @param {Node} root
   * @param {{ filterTextNode: function }} engine
   * @returns {{ nodesProcessed: number, matchCount: number }}
   */
  function walkAndFilter(root, engine) {
    if (!root) {
      return { nodesProcessed: 0, matchCount: 0 };
    }

    var totalNodes = 0;
    var totalMatches = 0;

    // Collect text nodes FIRST, then process — avoids live-collection issues
    var textNodes = [];

    var walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          if (node.parentElement && EXCLUDED_SET[node.parentElement.tagName]) {
            return NodeFilter.FILTER_REJECT;
          }
          if (isProcessed(node)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (!node.textContent || !node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    var node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    for (var i = 0; i < textNodes.length; i++) {
      var textNode = textNodes[i];

      // Node may have been removed by a previous instruction
      if (!textNode.parentNode) continue;

      var result = engine.filterTextNode(textNode);

      if (result.hasMatches) {
        applyInstructions(textNode, result.instructions);
        totalMatches += result.matchCount;
      }

      // Mark parent as processed
      if (textNode.parentElement) {
        markProcessed(textNode.parentElement);
      }

      totalNodes++;
    }

    log.debug('Walk: ' + totalNodes + ' nodes, ' + totalMatches + ' matches');
    return { nodesProcessed: totalNodes, matchCount: totalMatches };
  }

  /**
   * Remove all processed markers from root and descendants.
   * Used when settings change and the page needs re-filtering.
   *
   * @param {Node} root
   */
  function resetProcessedMarkers(root) {
    if (!root) return;

    if (root.nodeType === Node.ELEMENT_NODE && root.hasAttribute(PROCESSED_ATTR)) {
      root.removeAttribute(PROCESSED_ATTR);
    }

    var marked = root.querySelectorAll('[' + PROCESSED_ATTR + ']');
    for (var i = 0; i < marked.length; i++) {
      marked[i].removeAttribute(PROCESSED_ATTR);
    }
  }

  window.CleanBrowse.DOMWalker = Object.freeze({
    walkAndFilter: walkAndFilter,
    resetProcessedMarkers: resetProcessedMarkers,
  });
})();
