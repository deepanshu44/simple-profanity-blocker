# Contributing to Clean Browse

## Setup

```bash
git clone <repo-url>
cd clean-browse
npm install
```

## Code Style

- **ESLint**: `npm run lint` — must pass with zero errors
- **Prettier**: `npm run format:check` — must pass
- Auto-fix: `npm run lint:fix && npm run format`

### Conventions

| Convention | Rule |
|---|---|
| Variables / functions | `camelCase` |
| Constants | `UPPER_SNAKE_CASE` |
| Files / directories | `kebab-case` |
| DOM attributes / storage keys | Prefixed with `cb-` |
| Comments | JSDoc for public APIs, inline only for *why* not *what* |
| Magic numbers | Move to `constants.js` |

## Testing

```bash
npm run test           # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report
```

### Coverage Targets

| Module | Target |
|---|---|
| normalizer.js | 100% |
| matcher.js | 100% |
| filter-engine.js | 95%+ |
| storage.js | 90%+ |

## Extension Linting

```bash
npm run ext:lint   # web-ext lint
npm run ext:run    # Run in Firefox
```

## PR Checklist

Before submitting a PR, ensure ALL of the following pass:

- [ ] `npm run lint` — zero errors
- [ ] `npm run format:check` — all files formatted
- [ ] `npm run test` — all tests pass
- [ ] `npm run ext:lint` — web-ext lint passes
- [ ] New code has JSDoc comments on public functions
- [ ] New evasion patterns added to `tests/fixtures/evasion-samples.json`
- [ ] CHANGELOG.md updated

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add per-category word filtering
fix: false positive on "dictionary"
docs: update installation guide
test: add evasion fixture for spaced-out patterns
refactor: extract regex compilation into helper
```
