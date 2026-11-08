# Host profile: `fedora-intel`

**Status: skeleton.** Verified on the Termux host only in the sense that it is
*not* that host; the values below marked `TODO` must be filled in on the laptop.
Fill them once, commit, and this file stops being a guess.

To produce the facts, run this on the laptop and paste the output in:

```bash
{
  echo "== os";      grep -E '^(NAME|VERSION|VARIANT)=' /etc/os-release
  echo "== kernel";  uname -srm
  echo "== cpu";     lscpu | grep -E '^(Model name|Architecture|CPU\(s\)):'
  echo "== mem";     free -h | head -2
  echo "== disk";    df -h /home | tail -1
  echo "== tools";   for c in node npm python3 git dnf podman docker jq; do
                       printf '%s: %s\n' "$c" "$(command -v "$c" || echo missing)"; done
  echo "== pi";      pi --version
  echo "== omp";     omp --version 2>/dev/null || echo "omp: not installed"
  echo "== agentdir"; ls ~/.pi/agent/install/current-version && \
                      cat ~/.pi/agent/install/current-version
}
```

| Detail | Value |
|---|---|
| Machine | TODO (model, e.g. ThinkPad T14 Gen 4) |
| OS | Fedora **TODO** (Workstation/KDE?), kernel TODO |
| CPU | Intel x86_64, TODO cores/threads, model |
| RAM | TODO |
| Disk | TODO free on `/home` |
| Shell | TODO (bash/zsh, version) |
| Node.js | TODO — installed where (`fnm`/`nvm`/`dnf`)? |
| Python | TODO (`python3` expected present — do not assume it is absent) |
| Package manager | `dnf` (assume; confirm) |
| Container runtime | TODO (`podman` likely) |
| pi | managed install; version TODO (`pi --version`) |
| omp | TODO — installed? which version? |
| Display | TODO (HiDPI scaling affects TUI width) |

## Expected differences from `termux-android`

- Real Linux paths (`/usr`, `/etc`, `/tmp`), no `$PREFIX` relocation.
- `which` exists; Python is likely available — but shared scripts stay Node-only
  so one set of instructions keeps working on both.
- No Android sandbox, no Termux:API; clipboard and "open file" go through the
  desktop (wl-clipboard / xdg-open) if anything needs them.
- Long-running background jobs and full-screen TUIs are fine here; the Android
  precautions above do not apply.

## Constraints

- TODO: anything that must not be assumed (company VPN policy, disk encryption,
  no Docker daemon, etc.).
