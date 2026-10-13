#!/bin/bash
# Install the oh-my-pi (omp) status line, model display names, usage row and
# terminal settings.
#
# omp-only: this writes ~/.omp/agent/config.yml, ~/.omp/agent/models.yml and
# ~/.omp/agent/extensions/opencode-go-status.ts. It does not touch pi, and the
# pi installer (../setup.sh) does not read anything in this directory.
#
# The statusLine block and the `tui.resizeScrollback` key are only appended when
# the target config has no such section/key yet, and models.yml is only copied
# when it does not exist, so it is safe to re-run and never clobbers settings you
# changed with `/settings`. The extension file is ours, so it is refreshed on
# every run.
set -e

HERE="$(cd "$(dirname "$0")" && pwd)"

if ! command -v omp > /dev/null 2>&1; then
  echo "  ✗ omp not found on PATH — install oh-my-pi first"
  exit 1
fi

# Resolve the agent dir the same way omp does (honours PI_CODING_AGENT_DIR and
# --profile), so this never writes into pi's ~/.pi/agent by accident.
# `omp config path` is run with stdin closed and its output filtered to the last
# absolute-path line: a host without a config yet can make it print onboarding
# greetings and a provider list around the real path.
AGENT_DIR="$(omp config path </dev/null 2>/dev/null | grep -x '/.*' | tail -n 1)"
case "$AGENT_DIR" in
  /*) ;;
  *) AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.omp/agent}" ;;
esac
CONFIG="$AGENT_DIR/config.yml"
EXT_DIR="$AGENT_DIR/extensions"

echo "=== omp status line setup ==="
echo ""

mkdir -p "$AGENT_DIR" "$EXT_DIR"
[ -f "$CONFIG" ] || : > "$CONFIG"

# 1. Extension: publishes the OpenCode Go plan windows as a row below the bar
#    (the built-in `usage` segment is dropped first on narrow terminals).
cp "$HERE/extensions/opencode-go-status.ts" "$EXT_DIR/opencode-go-status.ts"
echo "  ✓ installed $EXT_DIR/opencode-go-status.ts"

# 2. statusLine block
if grep -qE '^[[:space:]]*statusLine:' "$CONFIG"; then
  echo "  ⏭ $CONFIG already has a statusLine section — leaving it unchanged"
  if grep -qE '^[[:space:]]*-[[:space:]]*usage[[:space:]]*$' "$CONFIG"; then
    echo "     ⚠ it still lists the inline 'usage' segment; the usage row replaces it."
    echo "       Remove that line, or reset first:"
    echo "         omp config reset statusLine.preset statusLine.leftSegments statusLine.rightSegments statusLine.segmentOptions"
    echo "       then re-run this script to append the current block."
  else
    echo "     Merge omp/statusline.yml by hand, or reset first:"
    echo "       omp config reset statusLine.preset statusLine.leftSegments statusLine.rightSegments statusLine.segmentOptions"
  fi
else
  # Ensure the existing file ends on a newline before appending a top-level block.
  [ -s "$CONFIG" ] && [ -n "$(tail -c 1 "$CONFIG")" ] && printf '\n' >> "$CONFIG"
  printf '\n# status line (added by pi-config omp/setup.sh)\n' >> "$CONFIG"
  cat "$HERE/statusline.yml" >> "$CONFIG"
  echo "  ✓ appended statusLine section to $CONFIG"
fi

# 3. Terminal settings: on Android the soft keyboard is a height-only resize,
#    and omp's default ("rebuild") answers a height shrink by wiping native
#    scrollback and replaying the whole transcript — the chat appears to rewind
#    every time the keyboard opens. See tui.yml.
if grep -qE '^[[:space:]]*resizeScrollback:' "$CONFIG"; then
  echo "  ⏭ $CONFIG already sets tui.resizeScrollback — leaving it unchanged"
else
  # Ensure the existing file ends on a newline before appending a top-level block.
  [ -s "$CONFIG" ] && [ -n "$(tail -c 1 "$CONFIG")" ] && printf '\n' >> "$CONFIG"
  printf '\n# terminal (added by pi-config omp/setup.sh)\n' >> "$CONFIG"
  cat "$HERE/tui.yml" >> "$CONFIG"
  echo "  ✓ appended tui.resizeScrollback to $CONFIG"
fi

# 4. Model display names: the status line's `model` segment renders the resolved
#    model's catalog `name` (falling back to the raw id), so a models.yml
#    `modelOverrides.<id>.name` is what shortens "DeepSeek V4.1 Flash" to
#    "DS 4.1F" on the bar and in the /models picker. Installed only when absent:
#    unlike the extension, this file is yours to edit.
MODELS="$AGENT_DIR/models.yml"
if [ -f "$MODELS" ]; then
  echo "  ⏭ $MODELS exists — leaving it unchanged (merge omp/models.yml by hand)"
else
  cp "$HERE/models.yml" "$MODELS"
  echo "  ✓ installed $MODELS (model display names)"
fi

echo ""
echo "  Verify:  omp config get statusLine.preset      → custom"
echo "           omp config get statusLine.leftSegments"
echo "           omp config get tui.resizeScrollback   → preserve"
echo "           omp models find deepseek-v4.1-flash --json   (name: DS 4.1F)"
echo "           omp usage -p opencode-go              (numbers the row shows)"
echo ""
echo "  The usage row reads OpenCode Go limits only when the opencode-go"
echo "  provider is authenticated (`omp login` / OPENCODE_API_KEY). It uses"
echo "  omp's own cached usage reports — no cookies, and no patched bundle."
echo "  Restart omp (or start a new session) to load the extension."
echo ""
echo "  tui.resizeScrollback=preserve keeps phone-keyboard toggles from wiping"
echo "  and replaying the transcript. Do not edit it with /settings or"
echo "  \`omp config set\`: omp rewrites config.yml through a plain YAML"
echo "  round-trip, which drops the comment blocks appended here."
