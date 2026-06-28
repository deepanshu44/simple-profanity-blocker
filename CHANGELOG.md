# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-06-28

### Added

- Core profanity filtering engine with three modes: Blur, Replace, Remove
- Three-tier word list system (Severe, Moderate, Mild)
- Text normalization pipeline with 3 evasion detection layers:
  - Layer 1: Zero-width char stripping, repeated char collapsing, separator removal
  - Layer 2: Leetspeak/character substitution decoding
  - Layer 3: Unicode NFKD normalization
- False-positive whitelist with 80+ exception words
- MutationObserver for dynamic content (SPAs, infinite scroll)
- Per-site enable/disable overrides
- Custom word add/remove support
- Premium dark popup UI with teal accent theme
- Badge showing filtered word count per tab
- Statistics tracking (session and all-time)
- Performance-optimized TreeWalker + compiled regex
- Firefox Manifest V2 support
