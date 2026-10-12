#!/bin/bash
# Install the oh-my-pi (omp) status line from statusline.yml.
#
# omp-only: this writes ~/.omp/agent/config.yml. It does not touch pi, and the
# pi installer (../setup.sh) does not read anything in this directory.
#
# Only appends when the target config has no `statusLine:` section yet, so it is
# safe to re-run and never clobbers settings you changed with `/settings`.
set -e

HERE="$(cd "$(dirname "$0")" && pwd)"

if ! command -v omp > /dev/null 2>&1; then
  echo "  ✗ omp not found on PATH — install oh-my-pi first"
  exit 1
fi

# Resolve the agent dir the same way omp does (honours PI_CODING_AGENT_DIR and
# --profile), so this never writes into pi's ~/.pi/agent by accident. Only the
# last line is kept: a brand-new agent dir can make omp print onboarding text
# before the path.
AGENT_DIR="$(omp config path 2>/dev/null | tail -n 1)"
case "$AGENT_DIR" in
  /*) ;;
  *) AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.omp/agent}" ;;
esac
CONFIG="$AGENT_DIR/config.yml"

echo "=== omp status line setup ==="
echo ""

mkdir -p "$AGENT_DIR"
[ -f "$CONFIG" ] || : > "$CONFIG"

if grep -qE '^[[:space:]]*statusLine:' "$CONFIG"; then
  echo "  ⏭ $CONFIG already has a statusLine section — leaving it unchanged"
  echo "     Merge omp/statusline.yml by hand, or reset first:"
  echo "       omp config reset statusLine.preset statusLine.leftSegments statusLine.rightSegments statusLine.segmentOptions"
  exit 0
fi

# Ensure the existing file ends on a newline before appending a top-level block.
[ -s "$CONFIG" ] && [ -n "$(tail -c 1 "$CONFIG")" ] && printf '\n' >> "$CONFIG"
printf '\n# status line (added by pi-config omp/setup.sh)\n' >> "$CONFIG"
cat "$HERE/statusline.yml" >> "$CONFIG"

echo "  ✓ appended statusLine section to $CONFIG"
echo ""
echo "  Verify:  omp config get statusLine.preset   → custom"
echo "           omp config get statusLine.leftSegments"
echo ""
echo "  Note: the usage segment shows OpenCode Go limits only when the"
echo "        opencode-go provider is authenticated (`omp login` / OPENCODE_API_KEY)."
echo "        Its tier label reads 'OpenCode Go' unless the one-line provider change"
echo "        in this folder's README.md is applied."
