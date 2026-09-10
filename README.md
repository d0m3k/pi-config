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
3. Prompts for optional `pi-go-bars` credentials

## What's Included

| Component | Description |
|---|---|
| `pi-go-bars-local` | Opencode Go usage in statusline (`🏃 Go · R 42% 4h58m · ...`), width-aware so it fits one line on phone terminals |
| `pi-statusline-local` | Custom footer with provider, no cost, Go+DS integration |
| `settings.json` | pi package registry |

## Credentials

Run `/gobars-setup` inside pi after setup to configure Go bars credentials.
