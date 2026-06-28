/**
 * Clean Browse — Popup Script
 *
 * Loads settings, populates UI, handles user interactions.
 * All settings changes are persisted and messaged to the background script.
 *
 * Dependencies (loaded via <script> tags before this file):
 *   - window.CleanBrowse.Constants
 *   - window.CleanBrowse.Logger
 *   - window.CleanBrowse.Storage
 */
(function () {
  'use strict';

  var CB = window.CleanBrowse || {};
  var Constants = CB.Constants;
  var Storage = CB.Storage;
  var Logger = CB.Logger;

  var MESSAGE_TYPES = Constants.MESSAGE_TYPES;
  var log = Logger.createLogger('popup');

  var TIER_LABELS = { 1: 'Severe', 2: 'Moderate', 3: 'Mild' };

  // ── State ──────────────────────────────────────────────────────

  var currentSettings = JSON.parse(JSON.stringify(Constants.DEFAULT_SETTINGS));
  var currentDomain = null;

  // ── DOM Refs ───────────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }

  var els = {
    root: $('popup-root'),
    globalToggle: $('global-toggle'),
    modeSelector: $('mode-selector'),
    tierSlider: $('tier-slider'),
    tierBadge: $('tier-badge'),
    statsSession: $('stats-session'),
    statsTotal: $('stats-total'),
    siteDomain: $('site-domain'),
    siteToggle: $('site-toggle'),
    customWordsTrigger: $('custom-words-trigger'),
    customWordsPanel: $('custom-words-panel'),
    customWordInput: $('custom-word-input'),
    addWordsBtn: $('add-words-btn'),
    wordChips: $('word-chips'),
    footerVersion: $('footer-version'),
  };

  // ── Messaging ──────────────────────────────────────────────────

  function notifySettingsChanged() {
    try {
      browser.runtime.sendMessage({ type: MESSAGE_TYPES.SETTINGS_CHANGED });
    } catch (err) {
      log.warn('Failed to send message:', err.message);
    }
  }

  // ── UI Population ──────────────────────────────────────────────

  function populateUI() {
    // Global toggle
    els.globalToggle.checked = currentSettings.enabled;
    updateDisabledState();

    // Mode selector
    var modeButtons = els.modeSelector.querySelectorAll('.segmented__btn');
    for (var i = 0; i < modeButtons.length; i++) {
      var btn = modeButtons[i];
      var isActive = btn.getAttribute('data-mode') === currentSettings.mode;
      if (isActive) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      btn.setAttribute('aria-checked', String(isActive));
    }

    // Tier slider
    els.tierSlider.value = currentSettings.tier;
    updateTierLabel(currentSettings.tier);

    // Site override
    if (currentDomain) {
      els.siteDomain.textContent = currentDomain;
      var siteEnabled = currentSettings.siteOverrides
        ? currentSettings.siteOverrides[currentDomain] !== false
        : true;
      els.siteToggle.checked = siteEnabled;
    } else {
      els.siteDomain.textContent = '—';
      els.siteToggle.checked = true;
    }

    // Custom words
    renderWordChips();

    // Version
    try {
      var manifest = browser.runtime.getManifest();
      els.footerVersion.textContent = 'v' + manifest.version;
    } catch (e) {
      els.footerVersion.textContent = 'v1.0.0';
    }
  }

  function updateTierLabel(tier) {
    els.tierBadge.textContent = TIER_LABELS[tier] || 'Moderate';

    var items = document.querySelectorAll('.tier-labels__item');
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (Number(item.getAttribute('data-tier')) === tier) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    }
  }

  function updateDisabledState() {
    if (currentSettings.enabled) {
      els.root.classList.remove('popup--disabled');
    } else {
      els.root.classList.add('popup--disabled');
    }
  }

  // ── Stats ──────────────────────────────────────────────────────

  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return String(num);
  }

  function displayStats() {
    Storage.loadStats().then(function (stats) {
      els.statsSession.textContent = formatNumber(stats.sessionFiltered || 0);
      els.statsTotal.textContent = formatNumber(stats.totalFiltered || 0);
    }).catch(function (err) {
      log.warn('Failed to load stats:', err.message);
    });
  }

  // ── Custom Word Chips ──────────────────────────────────────────

  function renderWordChips() {
    els.wordChips.innerHTML = '';
    var words = currentSettings.customWords || [];

    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      var chip = document.createElement('span');
      chip.className = 'word-chip';
      chip.textContent = word;

      var removeBtn = document.createElement('button');
      removeBtn.className = 'word-chip__remove';
      removeBtn.setAttribute('aria-label', 'Remove ' + word);
      removeBtn.textContent = '\u00d7';
      removeBtn.setAttribute('data-word', word);
      removeBtn.addEventListener('click', handleRemoveWord);

      chip.appendChild(removeBtn);
      els.wordChips.appendChild(chip);
    }
  }

  function handleRemoveWord(e) {
    var word = e.currentTarget.getAttribute('data-word');
    currentSettings.customWords = (currentSettings.customWords || []).filter(function (w) {
      return w !== word;
    });

    Storage.saveSettings({ customWords: currentSettings.customWords }).then(function () {
      renderWordChips();
      notifySettingsChanged();
    });
  }

  function addWords() {
    var input = els.customWordInput.value.trim();
    if (!input) return;

    var newWords = input.split(',');
    var cleaned = [];
    for (var i = 0; i < newWords.length; i++) {
      var w = newWords[i].trim().toLowerCase();
      if (w.length > 0) cleaned.push(w);
    }

    if (cleaned.length === 0) return;

    var existing = {};
    var current = currentSettings.customWords || [];
    for (var j = 0; j < current.length; j++) {
      existing[current[j]] = true;
    }

    for (var k = 0; k < cleaned.length; k++) {
      if (!existing[cleaned[k]]) {
        current.push(cleaned[k]);
        existing[cleaned[k]] = true;
      }
    }

    currentSettings.customWords = current;
    els.customWordInput.value = '';

    Storage.saveSettings({ customWords: currentSettings.customWords }).then(function () {
      renderWordChips();
      notifySettingsChanged();
    });
  }

  // ── Current Tab Domain ─────────────────────────────────────────

  function getCurrentTabDomain() {
    return browser.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
      if (tabs.length > 0 && tabs[0].url) {
        try {
          var url = new URL(tabs[0].url);
          if (url.protocol === 'http:' || url.protocol === 'https:') {
            return url.hostname;
          }
        } catch (e) {
          // Invalid URL
        }
      }
      return null;
    }).catch(function () {
      return null;
    });
  }

  // ── Event Handlers ─────────────────────────────────────────────

  function bindEvents() {
    // Global toggle
    els.globalToggle.addEventListener('change', function () {
      currentSettings.enabled = els.globalToggle.checked;
      updateDisabledState();
      Storage.saveSettings({ enabled: currentSettings.enabled }).then(notifySettingsChanged);
    });

    // Mode selector
    var modeButtons = els.modeSelector.querySelectorAll('.segmented__btn');
    for (var i = 0; i < modeButtons.length; i++) {
      modeButtons[i].addEventListener('click', function (e) {
        var btn = e.currentTarget;
        var mode = btn.getAttribute('data-mode');
        if (mode === currentSettings.mode) return;

        currentSettings.mode = mode;

        var allBtns = els.modeSelector.querySelectorAll('.segmented__btn');
        for (var j = 0; j < allBtns.length; j++) {
          var isActive = allBtns[j].getAttribute('data-mode') === mode;
          if (isActive) {
            allBtns[j].classList.add('active');
          } else {
            allBtns[j].classList.remove('active');
          }
          allBtns[j].setAttribute('aria-checked', String(isActive));
        }

        Storage.saveSettings({ mode: mode }).then(notifySettingsChanged);
      });
    }

    // Tier slider
    els.tierSlider.addEventListener('input', function () {
      var tier = Number(els.tierSlider.value);
      currentSettings.tier = tier;
      updateTierLabel(tier);
      Storage.saveSettings({ tier: tier }).then(notifySettingsChanged);
    });

    // Site override toggle
    els.siteToggle.addEventListener('change', function () {
      if (!currentDomain) return;

      var overrides = {};
      var existing = currentSettings.siteOverrides || {};
      var keys = Object.keys(existing);
      for (var i = 0; i < keys.length; i++) {
        overrides[keys[i]] = existing[keys[i]];
      }
      overrides[currentDomain] = els.siteToggle.checked;
      currentSettings.siteOverrides = overrides;

      Storage.saveSettings({ siteOverrides: overrides }).then(notifySettingsChanged);
    });

    // Accordion
    els.customWordsTrigger.addEventListener('click', function () {
      var expanded = els.customWordsTrigger.getAttribute('aria-expanded') === 'true';
      els.customWordsTrigger.setAttribute('aria-expanded', String(!expanded));
      els.customWordsPanel.setAttribute('aria-hidden', String(expanded));
    });

    // Add words
    els.addWordsBtn.addEventListener('click', addWords);
    els.customWordInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addWords();
      }
    });
  }

  // ── Initialize ─────────────────────────────────────────────────

  function init() {
    getCurrentTabDomain().then(function (domain) {
      currentDomain = domain;
      return Storage.loadSettings();
    }).then(function (settings) {
      currentSettings = settings;
      populateUI();
      displayStats();
      bindEvents();
      log.debug('Popup initialized');
    }).catch(function (err) {
      log.error('Failed to initialize popup:', err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
