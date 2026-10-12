# pi-config

Portable **pi** configuration — extensions & settings — plus a status line config for **oh-my-pi (`omp`)**.

Two targets, deliberately kept apart:

| Target | Lives in | Installed by | Config file |
|---|---|---|---|
| `pi` | `extensions/`, `settings.json` | `./setup.sh` | `~/.pi/agent/settings.json` |
| `omp` (oh-my-pi) | `omp/` | `omp/setup.sh` | `~/.omp/agent/config.yml` |

The `omp/` directory is **not** read by pi, and `./setup.sh` never touches it — see [oh-my-pi (omp)](#oh-my-pi-omp) below.

## Quick Setup

```bash
git clone git@github.com:d0m3k/pi-config.git ~/pi-config
cd ~/pi-config
./setup.sh          # pi: extensions + settings.json
./omp/setup.sh      # omp: status line + OpenCode Go usage row (skip if you don't use oh-my-pi)
```

The pi setup script:
1. Copies extensions to `~/.pi/agent/extensions/`
2. Installs `settings.json` pointing to local extensions
3. Prompts for `pi-go-bars` credentials (`auth` + `__Host-console_session` cookies)

## What's Included

| Component | Target | Description |
|---|---|---|
| `pi-go-bars-local` | pi | Opencode Go usage in statusline (`🏃 Go · R 42% 4h58m · ...`), width-aware so it fits one line on phone terminals |
| `pi-statusline-local` | pi | Custom footer with provider, no cost, Go+DS integration |
| `pi-subagents` | pi | Subagent delegation, declared in `settings.json` and installed from npm on first start |
| `settings.json` | pi | pi package registry |
| `omp/` | **oh-my-pi (omp)** | omp status line + OpenCode Go usage row (5h / 7d / month windows, above the editor's second line). **pi ignores this directory.** |

## Subagents

`pi-subagents` is declared in `settings.json` (`packages`), so pi installs it from
npm on first startup. Its built-in agents (scout, worker, reviewer, oracle, ...)
ship with the package, so no agent files or model pins are committed here — agents
inherit the parent session's model unless a model is pinned.

To install or refresh it manually:

```bash
pi install npm:pi-subagents
```

## oh-my-pi (omp)

`omp/` configures **oh-my-pi**, a different harness from `pi` — nothing in it is read by pi, and `./setup.sh` (pi) leaves it alone. It installs omp's status line plus an extension that puts the OpenCode Go plan windows on their own row underneath it:

```
 π > ◒ DeepSeek V4.1 Flash > 📁 ~/pi-config > ⑂ main ▶─0.7%──────────────┃──1M─
 ⏱ Go · 5h 1% (4h 31m) · 7d 0% (6d 4h) · mo 2% (21d 18h)
```

The numbers are a second row because omp's status line is a single row that drops its last segment when the terminal is narrow — the built-in `usage` segment (~52 columns) is always the first casualty on a phone screen. Hook status rows are never dropped.

```bash
./omp/setup.sh   # extension + statusLine and tui settings (idempotent)
```

omp fetches these numbers itself (`GET https://opencode.ai/zen/go/v1/usage`, authenticated `opencode-go` credential, shared with `/usage`) — it needs no cookies, unlike `pi-go-bars`. Requires the provider to be logged in (`omp login` / `OPENCODE_API_KEY`). Details, rationale and caveats: [`omp/README.md`](omp/README.md).

The same script also sets `tui.resizeScrollback: preserve`. On Android the soft keyboard is a height-only resize, and omp's default (`rebuild`) answers a height shrink by wiping native scrollback and replaying the whole transcript — the chat appears to rewind every time the keyboard opens. See [Phone terminals](omp/README.md#phone-terminals-android--termux-keyboard-toggles).

## Credentials

`pi-go-bars` needs three values (browser DevTools → Application → Cookies → `opencode.ai`):

| Value | Where | Looks like |
|---|---|---|
| Workspace ID | the workspace URL | `wrk_...` |
| `auth` cookie | Cookies panel | `Fe26.2**...` |
| `__Host-console_session` cookie | Cookies panel | `st_...` |

The session cookie is **required** since opencode.ai moved to the console JSON API — `auth` alone returns `401`.

Run `/gobars-setup` inside pi, or re-run `./setup.sh`, to configure/refresh them.
