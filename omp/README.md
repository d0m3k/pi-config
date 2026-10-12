# omp — oh-my-pi status line + OpenCode Go usage row

**For [oh-my-pi](https://github.com/can1357/oh-my-pi) (`omp`) only. `pi` does not read anything in this directory.**

Everything else in this repo targets `pi`: `../settings.json` and `../extensions/*` are pi packages installed into `~/.pi/agent`. The files here configure `omp`'s own status line, written to `~/.omp/agent/config.yml`, plus one omp extension. The two installers never touch each other's files:

| | pi | oh-my-pi (omp) |
|---|---|---|
| Installer | `../setup.sh` | `./setup.sh` |
| Config file | `~/.pi/agent/settings.json` (pi package list) | `~/.omp/agent/config.yml` (`statusLine` block) |
| Extensions | `../extensions/*` → `~/.pi/agent/extensions/` | `extensions/opencode-go-status.ts` → `~/.omp/agent/extensions/` |
| Extension API | `ctx.ui.setStatus()` → rendered by `pi-statusline-local` | `ctx.ui.setStatus()` → rendered as its own row below the bar |
| Go plan usage | `pi-go-bars-local` fetches it (own cookies/credentials) | built into omp: `authStorage.usage.reports()`, fetched from `https://opencode.ai/zen/go/v1/usage` |

## What it does

Two rows instead of one:

```
 π > ◒ DeepSeek V4.1 Flash > 📁 ~/pi-config > ⑂ main ▶─0.7%──────────────┃──1M─
 ⏱ Go · 5h 1% (4h 31m) · 7d 0% (6d 4h) · mo 2% (21d 18h)
```

The bar is omp's status line (`statusline.yml`). The second row is the OpenCode Go plan windows — rolling 5h, weekly 7d and monthly — published by `extensions/opencode-go-status.ts`. `5h` / `7d` / `mo` are the windows and the parenthesised value is the reset countdown; percentages come from the provider's own report, omp does not recompute them.

## Why the usage numbers are a second row, not a segment

omp's status line is a **single row**, and when the segment list does not fit the terminal it shrinks `session_name`, shrinks `path`, then **drops the last non-`path` entry of `statusLine.leftSegments`** until the line fits (see `@oh-my-pi/pi-tui` `src/status-line/component.ts`). The built-in `usage` segment is ~52 columns — the widest thing that can sit on the bar — so it is always the first thing to go on a small screen.

Measured on this repo's config:

| Terminal width | `usage` on the bar |
|---|---|
| 200 cols | rendered |
| 60–100 cols | dropped (the context fill and `path` survive, being never-dropped / shrink-only) |

Hook status text set through `ctx.ui.setStatus(key, text)` is rendered as **one row per key below the bar** (`render()` appends `#sortedHookStatuses`), where width only truncates — it is never dropped from the layout. That is the row used here.

## Install

```bash
./setup.sh          # installs the extension + appends the statusLine block if absent
omp config get statusLine.preset
```

`setup.sh` is safe to re-run: the extension file is refreshed every run and the `statusLine` block is only appended when `~/.omp/agent/config.yml` has no `statusLine:` section yet, so settings you changed with `/settings` are never clobbered. If the section already exists it prints how to merge by hand. To apply by hand:

```bash
cp extensions/opencode-go-status.ts ~/.omp/agent/extensions/
omp config set statusLine.preset custom
omp config set statusLine.leftSegments '["pi","vim","model","mode","collab","stream","path","git","pr","context_pct","cost"]'
omp config set statusLine.rightSegments '["session_name"]'
omp config set statusLine.segmentOptions '{"model":{"showThinkingLevel":true},"path":{"abbreviate":true,"maxLength":40,"stripWorkPrefix":true},"git":{"showBranch":true,"showStaged":true,"showUnstaged":true,"showUntracked":true}}'
```

`omp --config statusline.yml` loads the bar for a single run only; it does **not** install the extension, so the usage row is absent until `./setup.sh` (or the `cp` above) has run.

## The extension

`extensions/opencode-go-status.ts`:

- **Data.** `ctx.modelRegistry.authStorage.usage.reports()` — the same in-process, AuthStorage-cached reports the built-in `usage` segment and `/usage` use. No subprocess, no second HTTP implementation, no cookies.
- **Cadence.** Publishes on `session_start` and every 60 s. The underlying report is cached by AuthStorage (omp's own TTL), so ticks are cache reads; the minutes tick also keeps the reset countdowns moving.
- **Format.** `⏱ Go · 5h <used>% (<reset>) · 1d … · 7d … · mo …`, mirroring the built-in segment: `Math.round` for the 5h/1d/7d windows, `Math.floor` for monthly, same compact countdowns (`31m`, `4h 31m`, `6d 4h`).
- **Labelling.** The row prints the short `Go` tier itself, so no provider/bundle patch is involved (earlier revisions of this folder patched `planType` in `dist/cli.js`; that advice is obsolete — and `omp update` reverting such a patch no longer changes anything here).
- **Not shown.** Banked reset credits (`✦ N` in the built-in segment); `/usage` reports those.
- **Several accounts.** The first `opencode-go` report wins; use `/usage` for per-account detail.

## Prerequisite: an authenticated opencode-go account

The row is only visible when the `opencode-go` provider has a credential (that is what omp sends as the bearer token; `x-opencode-session` is added automatically):

```bash
omp login              # or
export OPENCODE_API_KEY=...
omp usage -p opencode-go
```

## Verify

```bash
omp config get statusLine.preset         # custom
omp config get statusLine.leftSegments   # … and no "usage" entry
omp usage -p opencode-go                 # the numbers the row shows
```

Formatter unit tests (window mapping, round/floor, countdown boundaries, report shapes):

```bash
node --test --experimental-strip-types omp/extensions/opencode-go-status.test.ts
```

Percentages can trail the dashboard by up to ~5 minutes (omp's own report cache TTL ± jitter); reset countdowns are computed live from `resetsAt`. Status line and hook rows are reloaded live — no restart needed for bar edits.

## Sources

- omp docs (bundled): `omp://settings.md` (`statusLine.*`), `omp://extensions.md` (extensions, `registerProvider` usage providers, `ctx.ui.setStatus`)
- Fit rule and hook rows: `@oh-my-pi/pi-tui` `src/status-line/component.ts`
- Usage data path: `@oh-my-pi/pi-ai` `src/auth/types.ts` (`UsageApi.reports`), `src/usage.ts` (`UsageReport`)
