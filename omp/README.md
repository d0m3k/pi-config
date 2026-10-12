# omp — oh-my-pi status line config

**For [oh-my-pi](https://github.com/can1357/oh-my-pi) (`omp`) only. `pi` does not read anything in this directory.**

Everything else in this repo targets `pi`: `../settings.json` and `../extensions/*` are pi packages installed into `~/.pi/agent`. The files here configure `omp`'s own status line, written to `~/.omp/agent/config.yml`. The two installers never touch each other's files:

| | pi | oh-my-pi (omp) |
|---|---|---|
| Installer | `../setup.sh` | `./setup.sh` |
| Config file | `~/.pi/agent/settings.json` (pi package list) | `~/.omp/agent/config.yml` (`statusLine` block) |
| Extension API | `ctx.ui.setStatus()` → rendered by `pi-statusline-local` | `ctx.ui.setStatus()` → rendered by the `status` / footer hooks |
| Go plan usage | `pi-go-bars-local` fetches it (own cookies/credentials) | built into omp: `usage` segment, fetched from `https://opencode.ai/zen/go/v1/usage` |

## What it does

Adds the `usage` segment to the omp status line, right after the model, so the OpenCode Go plan windows appear inline:

```
π > DeepSeek V4.1 Flash > ⏱ Go · 5h 4% (55m) · 7d 2% (4h) · mo 2% (22d 18h) > 📁 ~/workdir/pi-config > ⑂ main ▶─0.7%──┃──1M─
```

`5h` / `7d` / `mo` are the rolling, weekly and monthly windows; the parenthesised value is the reset countdown. Percentages come straight from the provider's own `percent` field — omp does not recompute them.

## Install

```bash
./setup.sh                      # appends the statusLine block if absent
omp --config ./statusline.yml   # or: try it for one run only
omp config get statusLine.preset
```

`setup.sh` only appends when `~/.omp/agent/config.yml` has no `statusLine:` section, so it is safe to re-run and never overwrites settings you changed with `/settings`. To apply by hand:

```bash
omp config set statusLine.preset custom
omp config set statusLine.leftSegments '["pi","vim","model","usage","mode","collab","stream","path","git","pr","context_pct","cost"]'
omp config set statusLine.rightSegments '["session_name"]'
omp config set statusLine.segmentOptions '{"model":{"showThinkingLevel":true},"path":{"abbreviate":true,"maxLength":40,"stripWorkPrefix":true},"git":{"showBranch":true,"showStaged":true,"showUnstaged":true,"showUntracked":true}}'
```

## Why the config looks like this

- **`preset: custom` is required.** omp's resolver only honours `statusLine.leftSegments` / `rightSegments` when the preset is `custom`; with any other preset the stored segment lists are silently ignored (which is what made an earlier attempt appear to do nothing).
- **`usage` sits early in `leftSegments`.** When the terminal is narrow, the layout drops segments from the end of the list, so earlier entries survive. At ~110 columns the segment is still visible; the full-width bar above is 200 columns.
- **`segmentOptions` mirrors the built-in `default` preset** so switching to `custom` doesn't change how model/path/git render.
- **Status line changes apply live** — no restart needed. Verified by adding and removing a `time` segment in a running session; the bar followed immediately.
- **Percentages can trail the dashboard by up to ~5 minutes** (`use`-report cache TTL `300000` ms ± 25% jitter; reports whose limits are not exhausted are additionally re-ingested at most once per 60 s). Reset countdowns are always live, computed from `resetsAt`.

## Prerequisite: an authenticated opencode-go account

The segment is only visible when the `opencode-go` provider has a credential (that is what omp sends as the bearer token; `x-opencode-session` is added automatically):

```bash
omp login              # or
export OPENCODE_API_KEY=...
omp usage -p opencode-go
```

## The tier label

The segment renders the provider's `metadata.planType`, which oh-my-pi hardcodes as `"OpenCode Go"` (in `providers/opencode-go`, next to `planType` in the usage report). This repo's config cannot shorten it, and omp exposes no setting for it. In the harness running here it reads `Go` because of a one-line change to the built bundle:

```bash
# affects ~/.../\@oh-my-pi/pi-coding-agent/dist/cli.js; reverted by `omp update`
sed -i 's/planType:"OpenCode Go"/planType:"Go"/' \
  "$(dirname "$(readlink -f "$(command -v omp)")")/cli.js"
omp usage invalidate -p opencode-go   # drop the cached report holding the old label
```

The durable fix is that one string in the oh-my-pi source. An omp extension could also override the provider (`pi.registerProvider("opencode-go", { usage: … })`) if you want the short label in an unpatched install, at the cost of reimplementing the fetch and a distinct `cacheVersion`.

## Sources

- omp docs (bundled): `omp://settings.md` (`statusLine.*`), `omp://extensions.md` (extension `usage` providers)
- Segment renderers: `omp gallery --surface segment --segment usage`
- Report cache TTL / ingest throttle: `NN` (300000 + jitter) and `bgo` (60000) in the omp bundle
