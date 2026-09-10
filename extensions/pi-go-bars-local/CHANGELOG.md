# Changelog
## [Unreleased]

### Changed
- **Width-aware statusline**: the cached status text now picks the widest density tier that fits the terminal, so the Go usage row stays on a single line on narrow (phone) terminals. Tiers: `🏃 Go  │  R 0% ⟳ 4h58m  │  …` (wide) → `🏃 Go · R 0% ⟳4h58m · …` → `🏃 Go · R 0% 4h58m · …` → drop brand → `R 0% · W 0% · M 7%`. Countdowns use a tight `4h58m` / `3d4h` / `22d18h` form; the widget and `/gobars` view still use the roomier `formatDuration`.

## [0.3.0] — 2026-06-18

### Added
- **Zen pay-as-you-go billing (opt-in)**: New `Zen $20.00 $0.00/$50.00` segment appears beside the Go usage bars in the footer, with a full balance / monthly-spend / reload breakdown in `/gobars`. Enable with `OPENCODE_GO_SHOW_ZEN=1` or `"showZen": true` in `~/.pi/agent/pi-go-bars.json`. Reuses the existing workspace ID and auth cookie — no new credentials. The `/billing` scrape is anchored on `customerID:"cus_..."` with a depth-counted brace scan, so a future component on that page exposing its own `balance:` field cannot be silently matched. Default behaviour for existing Go-only users is unchanged.
- **Test suite**: `npm test` runs 12 unit tests covering `parseBilling`, `parseDashboard`, `formatUsd`, and the `showZen` opt-in. Uses `node:test` with Node's built-in type stripping — no new dependencies. Sanitized fixtures under `extensions/pi-go-bars/testdata/`.

### Changed
- **Generic cache helpers**: `readCacheFile<T>` / `writeCacheFile<T>` extracted so the Go-usage and Zen-billing caches share an atomic write path (tmp file + `chmod 600` + rename).


## [0.2.1] — 2026-05-09

### Changed
- **Migrated imports** from `@mariozechner/pi-*` to `@earendil-works/pi-*` to align with the pi package namespace migration.
- Bumped peerDependencies to `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui`.

### Fixed
- **Thinking level display**: Footer now correctly shows the user's configured thinking level (e.g. "high") instead of always showing "off". The extension reads the initial level via `pi.getThinkingLevel()` on session start and re-renders on live level changes.
- **Hidden cost for opencode-go**: Per-token cost display (`$X.XXX`) is now suppressed when the active model is opencode-go (flat-rate subscription, not token-priced).

## [0.1.0] — 2026-05-01

Initial release
