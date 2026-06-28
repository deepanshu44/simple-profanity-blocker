# Clean Browse

A Firefox browser extension that filters profanity and foul language from web pages in real-time. Privacy-first — all processing stays local in your browser.

## Features

- **Three filter modes**: Blur (hover to reveal), Replace (with ****), or Remove entirely
- **Tiered filtering**: Severe, Moderate, or Mild — choose your comfort level
- **Evasion detection**: Catches leetspeak (f\*ck), Unicode tricks (fμck), repeated chars (fuuuck), and spaced-out patterns (f.u.c.k)
- **False-positive protection**: Built-in whitelist prevents innocent words like "cocktail" and "assassin" from being filtered
- **Per-site overrides**: Enable/disable filtering on specific websites
- **Custom words**: Add your own words to filter or remove defaults
- **SPA support**: MutationObserver catches dynamically loaded content (infinite scroll, AJAX, React/Vue apps)
- **Zero network requests**: No telemetry, no data leaves your browser, no remote word lists
- **Performance optimized**: TreeWalker API + compiled regex, targets < 20ms initial scan

## Installation (from source)

1. Clone or download this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click **"Load Temporary Add-on..."**
4. Select the `src/manifest.json` file
5. The extension icon appears in the toolbar — click it to configure

## Usage

1. Click the Clean Browse shield icon in the toolbar
2. Toggle filtering on/off globally or per-site
3. Choose your filter mode (Blur / Replace / Remove)
4. Adjust filter strength with the tier slider
5. Add custom words in the expandable Custom Words section

## Development

### Prerequisites

- Node.js 18+
- Firefox Developer Edition (recommended)

### Setup

```bash
cd clean-browse
npm install
```

### Commands

| Command | Description |
|---|---|
| `npm run ext:run` | Launch Firefox with the extension loaded |
| `npm run ext:lint` | Lint the extension with web-ext |
| `npm run ext:build` | Build .xpi for distribution |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix ESLint issues |
| `npm run format` | Format with Prettier |
| `npm run test` | Run tests |
| `npm run test:coverage` | Run tests with coverage |
| `npm run validate` | Run all checks (lint + format + test + ext:lint) |

### Project Structure

```
clean-browse/
├── src/
│   ├── manifest.json           # Firefox Manifest V2
│   ├── shared/                 # Shared modules (all contexts)
│   │   ├── constants.js        # Enums, defaults, message types
│   │   ├── logger.js           # Structured logging
│   │   ├── normalizer.js       # Evasion detection (3 layers)
│   │   ├── matcher.js          # Regex compilation + matching
│   │   └── storage.js          # browser.storage abstraction
│   ├── content/                # Content scripts (injected into pages)
│   │   ├── index.js            # Orchestrator entry point
│   │   ├── filter-engine.js    # Core filtering logic
│   │   ├── dom-walker.js       # TreeWalker DOM traversal
│   │   ├── mutation-handler.js # MutationObserver for SPAs
│   │   └── content.css         # Filter mode styles
│   ├── background/             # Background script
│   │   └── index.js            # Settings broker, badge management
│   ├── popup/                  # Extension popup UI
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── data/                   # Word lists (JSON)
│   │   ├── wordlist-severe.json
│   │   ├── wordlist-moderate.json
│   │   ├── wordlist-mild.json
│   │   └── whitelist.json
│   └── icons/
├── tests/
├── docs/
├── CONTRIBUTING.md
├── CHANGELOG.md
└── LICENSE
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, code style, and PR requirements.

## License

MIT — see [LICENSE](LICENSE).
