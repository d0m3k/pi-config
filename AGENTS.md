# AGENTS.md — shared context

<!--
  Source of truth: github.com/d0m3k/pi-config
  Assembled by ./setup.sh into ~/.pi/agent/AGENTS.md from three parts:

    1. AGENTS.md              (this file — host independent, tracked)
    2. hosts/<profile>.md     (tracked; profile picked from the platform)
    3. hosts/private.local.md (gitignored, optional; secrets and one-offs)

  Do not edit the installed copy: edit here, run ./setup.sh, then /reload in pi.
  pi loads ~/.pi/agent/AGENTS.md in every session, in every working directory,
  on every host — that is why this file must stay portable, and why secrets
  belong in hosts/private.local.md and nowhere else.
-->

## Fleet

Two machines, one configuration. Everything in this file must be true on both;
anything true on only one belongs in a `hosts/*.md` profile (appended below).

| Host profile | Hardware / OS | Harness |
|---|---|---|
| `termux-android` | Samsung SM-S916B, aarch64, Android 16, Termux | pi (managed install), oh-my-pi (`omp`) |
| `fedora-intel` | Intel x86_64 laptop, Fedora | pi (managed install), `omp` optional |

Shared: the `pi-config` repo, the `opencode-go` provider as default, the same
`~/.ssh/id_ed25519` key, the same projects and infra.

## pi — harness facts (host independent)

- **Managed install**, not npm-global: `~/.pi/agent/bin/pi` is a shim that reads
  `~/.pi/agent/install/current-version` and execs
  `~/.pi/agent/install/releases/<version>/node_modules/.bin/pi`.
  Upgrade with `pi update`; never `npm i -g`. Older releases stay on disk.
- **Docs / examples**: `~/.pi/agent/install/releases/<version>/node_modules/@earendil-works/pi-coding-agent/{docs,examples}`.
- **Config files** in `~/.pi/agent/`: `settings.json`, `auth.json`, `mcp.json`,
  `models.json`, `keybindings.json`, `extensions/`, `skills/`, `prompts/`,
  `themes/`, `sessions/` (JSONL per project), `AGENTS.md`.
- **Context files**: `<agent-dir>/AGENTS.md` applies globally; `AGENTS.md` in the
  working directory or any parent applies from there down; `AGENTS.override.md`
  replaces `AGENTS.md`/`CLAUDE.md` *in its own directory only*. No import
  directive — that is why this file is assembled by concatenation.
- **Tools**: `read` (text + images), `bash`, `edit` (exact-text, multi-block),
  `write`. Use `read` rather than `cat`.
- **CLI**: `-p`/`--print`, `-c`/`--continue`, `-r`/`--resume`, `--name`,
  `--thinking`, `-e`/`--extension`, `--provider`, `--model`.
- **Packages**: `pi install npm:<pkg|@scope/pkg>`, `pi install git:<url>`;
  cached under `~/.pi/agent/npm/`; gallery packages carry the `pi-package` keyword.
- **Model routing is native**: `pi.registerVirtualModel()` routes per request
  (`docs/virtual-models.md`), with classifier models reachable through
  `ctx.modelRegistry.classify()`. A router plugin is only justified for polling,
  budgets or failover — not for plain model selection.
- **Model costs** live in the catalog: `model.cost` = USD per 1M tokens
  (`input`, `output`, `cacheRead`, `cacheWrite`, optional `tiers`);
  `~/.pi/agent/models-store.json` holds the cached copy; `pi update --models`
  refreshes it.

### Docs index

`usage.md`, `quickstart.md`, `settings.md`, `configuration.md`, `models.md`,
`models-configuration.md`, `virtual-models.md`, `providers.md`,
`custom-provider.md`, `security.md`, `extensions.md`, `skills.md`,
`prompt-templates.md`, `packages.md`, `sessions.md`, `session-format.md`,
`codemode.md`, `sdk.md`, `rpc.md`, `json.md`, `tui.md`, `themes.md`,
`keybindings.md`, `termux.md`, `compaction.md`.

## Defaults and preferences (both hosts)

```
provider  opencode-go
model     deepseek-v4.1-flash
thinking  high
theme     bluegrey
```

- Start sessions on `deepseek-v4.1-flash`; deviate only when the task or the
  user argues for it.
- Prefer Node.js for scratch scripting. A host without a Python interpreter is
  the rule on Android, so nothing shared may depend on one.
- Keep answers concise; name file paths when touching files.
- `opencode-go` is a **subscription** (5h / 7d / month usage windows), not
  pay-per-token: a model's catalog `$`/1M is a notional list price, the real
  scarce resource is plan-quota percentage. Say which currency you mean.

## Config sync — `pi-config`

- Repo `git@github.com:d0m3k/pi-config.git`, branch **`main`**, cloned to
  `~/pi-config` on every host.
- `./setup.sh` — **pi**: copies extensions, merges the `packages` array into
  `settings.json` (other keys untouched), assembles this AGENTS file, offers the
  `pi-go-bars` cookie prompt.
- `./omp/setup.sh` — **oh-my-pi only**: `~/.omp/agent/config.yml`,
  `models.yml`, `extensions/`, `tui.resizeScrollback`. pi never reads it.
- After `git pull`, re-run both scripts, then `/reload` inside pi.
- Tracked: extensions, settings template, AGENTS parts, omp config blocks.
  Never tracked: `hosts/private.local.md`, auth/cookies (`pi-go-bars.json`),
  caches, sessions, `node_modules`.

## Projects and infrastructure

### rybaspotting

PWA for spotting "Ryby z dupom" graffiti in Kraków. Repo
`git@github.com:d0m3k/rybaspotting.git` → `~/rybaspotting`. Go + chi + sqlx +
PostgreSQL backend, Preact + Vite + PWA + Leaflet frontend. Deploy: mikr.us VPS
(nginx + cloudflared).

1. Edit locally.
2. `git add -A && git commit -m "msg" && git push origin master`.
3. GitHub Actions builds backend + frontend and cuts a GitHub Release.
4. On the VPS: `ssh amy "curl -sL https://raw.githubusercontent.com/d0m3k/rybaspotting/master/scripts/get-latest-release.sh | bash"`.

### VPS (`amy135`)

- `amy135.mikrus.xyz:10135`, server `srv70.mikr.us`, IPv6 `2a01:4f9:3070:1984::135`.
- Reached through Cloudflare Tunnel as `shell.dom3k.pl`: `ssh amy`
  (`ssh/config` uses `cloudflared access ssh --hostname %h`, which sidesteps
  carrier port issues).
- **Key-only SSH**: publickey is the sole accepted method
  (`/etc/ssh/sshd_config.d/10-key-only.conf`, `AuthenticationMethods publickey`).
  The root password stays set only for the mikrus panel web console — the
  out-of-band recovery path. It is not stored in this repo.
- Website `https://ryby.dom3k.pl` (Cloudflare-proxied).

### Home Raspberry Pi

`ssh pi@pihole` over Tailscale (MagicDNS), `armv6l`, runs Pi-hole.

### mikrus house rules

No voice servers, no network scanning or torrenting (block risk), no hacking.
`start` for quick setup; scripts in `/root/noobs/scripts/`; wiki
<https://wiki.mikr.us/>.

## Host profile

Platform-specific facts are appended below by `./setup.sh`. If the section is
missing or names the wrong machine, the profile did not match — add one under
`hosts/` and re-run the script.
