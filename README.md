# pi-config

Portable pi configuration — extensions & settings.

## Quick Setup

```bash
git clone git@github.com:d0m3k/pi-config.git ~/pi-config
cd ~/pi-config
./setup.sh
```

The setup script:
1. Copies extensions to `~/.pi/agent/extensions/`
2. Installs `settings.json` pointing to local extensions
3. Prompts for `pi-go-bars` credentials (`auth` + `__Host-console_session` cookies)

## What's Included

| Component | Description |
|---|---|
| `pi-go-bars-local` | Opencode Go usage in statusline (`🏃 Go · R 42% 4h58m · ...`), width-aware so it fits one line on phone terminals |
| `pi-statusline-local` | Custom footer with provider, no cost, Go+DS integration |
| `settings.json` | pi package registry |

## Credentials

`pi-go-bars` needs three values (browser DevTools → Application → Cookies → `opencode.ai`):

| Value | Where | Looks like |
|---|---|---|
| Workspace ID | the workspace URL | `wrk_...` |
| `auth` cookie | Cookies panel | `Fe26.2**...` |
| `__Host-console_session` cookie | Cookies panel | `st_...` |

The session cookie is **required** since opencode.ai moved to the console JSON API — `auth` alone returns `401`.

Run `/gobars-setup` inside pi, or re-run `./setup.sh`, to configure/refresh them.
