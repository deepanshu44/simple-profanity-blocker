/**
 * Clean Browse — Background Script
 *
 * Responsibilities:
 * - Settings broker: relay settings changes to content scripts
 * - Badge management: display filtered word count on extension icon
 * - Lifecycle: initialize defaults on install
 *
 * Shared modules (constants, logger, storage) are loaded via manifest.json
 * background.scripts array before this file.
 */
(function () {
  'use strict';

  var CB = self.CleanBrowse || {};
  var Constants = CB.Constants;
  var Storage = CB.Storage;
  var Logger = CB.Logger;

  var MESSAGE_TYPES = Constants.MESSAGE_TYPES;
  var log = Logger.createLogger('background');

  var BADGE_COLOR = '#0D9488';

  // ── Badge Management ───────────────────────────────────────────

  function updateBadge(count, tabId) {
    var text = count > 0 ? String(count) : '';
    var details = { text: text };
    if (tabId !== undefined) {
      details.tabId = tabId;
    }

    try {
      browser.browserAction.setBadgeText(details);
      browser.browserAction.setBadgeBackgroundColor({ color: BADGE_COLOR });
    } catch (err) {
      log.warn('Failed to update badge:', err.message);
    }
  }

  function clearBadge(tabId) {
    updateBadge(0, tabId);
  }

  // ── Broadcast to Content Scripts ───────────────────────────────

  function broadcastRefilter() {
    browser.tabs.query({}).then(function (tabs) {
      for (var i = 0; i < tabs.length; i++) {
        var tab = tabs[i];
        if (!tab.url || tab.url.indexOf('about:') === 0 || tab.url.indexOf('moz-extension:') === 0) {
          continue;
        }
        browser.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.REFILTER }).catch(function () {
          // Tab may not have content script
        });
      }
      log.debug('Broadcast REFILTER to all tabs');
    }).catch(function (err) {
      log.warn('Failed to broadcast refilter:', err.message);
    });
  }

  // ── Message Handler ────────────────────────────────────────────

  function handleMessage(message, sender, sendResponse) {
    if (!message || !message.type) {
      return false;
    }

    switch (message.type) {
      case MESSAGE_TYPES.SETTINGS_CHANGED:
        Storage.loadSettings().then(function (settings) {
          if (!settings.enabled) {
            browser.tabs.query({}).then(function (tabs) {
              for (var i = 0; i < tabs.length; i++) {
                clearBadge(tabs[i].id);
              }
            });
          }
          broadcastRefilter();
          log.debug('Settings changed, broadcast complete');
        });
        return false;

      case MESSAGE_TYPES.GET_STATS:
        Storage.loadStats().then(function (stats) {
          sendResponse({ success: true, stats: stats });
        }).catch(function (err) {
          sendResponse({ success: false, error: err.message });
        });
        return true; // Keep channel open for async response

      case MESSAGE_TYPES.UPDATE_BADGE:
        var count = message.count || 0;
        var tabId = sender.tab ? sender.tab.id : undefined;
        if (tabId !== undefined) {
          updateBadge(count, tabId);
        }
        return false;

      default:
        log.debug('Unknown message type:', message.type);
        return false;
    }
  }

  // ── Tab Listeners ──────────────────────────────────────────────

  function handleTabUpdated(tabId, changeInfo) {
    if (changeInfo.status === 'loading') {
      clearBadge(tabId);
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  function handleInstalled(details) {
    log.debug('Extension installed/updated:', details.reason);

    if (details.reason === 'install') {
      var payload = {};
      payload[Constants.STORAGE_KEYS.SETTINGS] = JSON.parse(JSON.stringify(Constants.DEFAULT_SETTINGS));
      payload[Constants.STORAGE_KEYS.STATS] = JSON.parse(JSON.stringify(Constants.DEFAULT_STATS));

      browser.storage.local.set(payload).then(function () {
        log.debug('Default settings initialized');
      }).catch(function (err) {
        log.error('Failed to initialize defaults:', err.message);
      });
    }

    browser.browserAction.setBadgeBackgroundColor({ color: BADGE_COLOR });
  }

  // ── Register Listeners ─────────────────────────────────────────

  browser.runtime.onMessage.addListener(handleMessage);
  browser.runtime.onInstalled.addListener(handleInstalled);
  browser.tabs.onUpdated.addListener(handleTabUpdated);

  browser.browserAction.setBadgeBackgroundColor({ color: BADGE_COLOR });
  log.debug('Background script loaded');
})();
