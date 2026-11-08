# Host profile: `termux-android`

pi runs inside Termux on Android. Everything below is true of this host and
may be false of `fedora-intel` — do not copy it there.

| Detail | Value |
|---|---|
| Device | Samsung SM-S916B (Galaxy S23+) |
| OS | Android 16, Linux kernel 5.15.189-android13-8 |
| Userspace | Termux 0.118.3 (F-Droid), termux-tools 1.45.0 |
| CPU | aarch64; ABIs arm64-v8a, armeabi-v7a, armeabi |
| Prefix | `/data/data/com.termux/files/usr` |
| Home | `/data/data/com.termux/files/home` |
| Shell | bash 5.3.9 |
| Node.js | v26.3.1 (system-wide in `$PREFIX`) |
| Python | **not installed** |
| Package manager | `apt` (Debian format), repo `packages-cf.termux.dev` |
| Disk / RAM | 460G total, ~249G free / 6.9G total |
| SELinux | process runs as `untrusted_app_27` (`u:r:untrusted_app_27:s0:c255,c258,c512,c768`) |
| Termux plugins | `com.termux.api` (v1002) |

The authoritative env dump is `env | sort`. Notable values:
`TERMUX__PREFIX`, `TERMUX__HOME`, `TERMUX_APP__DATA_DIR=/data/user/0/com.termux`,
`TERMUX_APP_PACKAGE_MANAGER=apt`, `LD_PRELOAD` = `libtermux-exec-ld-preload.so`,
`LD_LIBRARY_PATH` empty.

## Constraints

1. **No Python** — no interpreter at all. Use Node.js for scripting.
2. **Filesystem is relocated** — standard paths live under
   `/data/data/com.termux/files/`: `$PREFIX/{bin,etc,tmp,lib}`. Hardcoded
   `/usr`, `/etc`, `/bin` paths in scripts will not work.
3. **`which` is not available** — use `command -v` or `type`.
4. **Android SELinux** — `untrusted_app_27` restricts some operations;
   `/proc` visibility and background process lifetimes differ from a desktop.
5. **Shared storage** — `/storage/emulated/0` and `~/storage/` after
   `termux-setup-storage`; do not touch it unless the task requires it.
6. **Clipboard / intents** — `termux-clipboard-get|set`, `termux-open`,
   `termux-open-url` (needs the Termux:API app + `termux-api` package).
   Clipboard is text-only; images cannot be pasted into the editor.
7. **Phone terminal** — soft-keyboard show/hide is a height-only resize; that
   is why `omp` is configured with `tui.resizeScrollback: preserve`.
8. **Versions** — not written down here on purpose: the installed pi/omp/node
   versions and the release path are probed by `./setup.sh` into *Runtime facts*.

## Working style here

- Keep commands short and avoid full-screen TUIs in tool calls.
- Batch `git`/`apt` operations; the session may be interrupted (Android can
  reclaim background processes).
- Prefer `node -e` over `jq` for JSON — `jq` may not be installed.
