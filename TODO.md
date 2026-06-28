# Clean Browse — TODO

## Pending Tasks

### Icons
- [x] Generate proper PNG icons from the design (shield + crossed speech bubble, teal gradient)
- [x] Required sizes: `src/icons/icon-48.png`, `src/icons/icon-96.png`
- [x] Source image available at: `~/.gemini/antigravity-cli/brain/60b8c362-44d3-464f-a77f-17b96626cc13/clean_browse_icon_1782569183585.jpg`
- [x] Convert with ImageMagick: `convert source.jpg -resize 48x48 icon-48.png && convert source.jpg -resize 96x96 icon-96.png`
- [x] Extension will load without icons but toolbar button will show a generic icon

### Pre-launch
- [x] Run `npm install`
- [x] Run `npm run ext:lint` to validate with web-ext
- [ ] Test load via `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `src/manifest.json`
- [ ] Test on pages with known profanity (Reddit, etc.)
- [x] Verify false-positive protection on Wikipedia "Scunthorpe" article
- [ ] Test SPA behavior on Twitter/YouTube

### Tests
- [ ] Create `tests/unit/normalizer.test.js`
- [ ] Create `tests/unit/matcher.test.js`
- [ ] Create `tests/unit/filter-engine.test.js`
- [ ] Create `tests/fixtures/evasion-samples.json`
- [ ] Achieve coverage targets (normalizer 100%, matcher 100%, filter-engine 95%+)

### Future (V2)
- [ ] Multi-browser support (Chrome MV3, Edge, Safari)
- [ ] Multi-language word lists
- [ ] Spaced-out detection (Layer 4 evasion)
- [ ] IntersectionObserver lazy loading
- [ ] Options page for power users
- [ ] Import/export settings
- [ ] Sync settings across devices (storage.sync)
