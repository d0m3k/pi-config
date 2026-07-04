#!/bin/bash
set -e

AGENT_DIR="$HOME/.pi/agent"
EXT_DIR="$AGENT_DIR/extensions"
CONFIG_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== pi-config setup ==="
echo ""

# 1. Ensure agent directories exist
mkdir -p "$AGENT_DIR" "$EXT_DIR"

# 2. Copy extensions
echo "[1/3] Installing extensions..."
for ext in pi-go-bars-local pi-statusline-local; do
  if [ -d "$CONFIG_DIR/extensions/$ext" ]; then
    rm -rf "$EXT_DIR/$ext"
    cp -r "$CONFIG_DIR/extensions/$ext" "$EXT_DIR/$ext"
    echo "  ✓ $ext"
  else
    echo "  ✗ $ext not found — skipping"
  fi
done

# 3. Install settings.json (merge new extensions, keep existing)
echo "[2/3] Installing settings..."
SETTINGS_FILE="$AGENT_DIR/settings.json"
REPO_SETTINGS="$CONFIG_DIR/settings.json"

if [ -f "$SETTINGS_FILE" ]; then
  # Merge: keep existing settings, update packages list
  python3 -c "
import json, sys

with open('$SETTINGS_FILE') as f:
    current = json.load(f)
with open('$REPO_SETTINGS') as f:
    repo = json.load(f)

# Replace packages list with repo's
current['packages'] = repo.get('packages', current.get('packages', []))

with open('$SETTINGS_FILE', 'w') as f:
    json.dump(current, f, indent=2)
    f.write('\n')
print('  ✓ settings.json updated')
" 2>/dev/null || {
    cp "$REPO_SETTINGS" "$SETTINGS_FILE"
    echo "  ✓ settings.json created (no merge needed)"
  }
else
  cp "$REPO_SETTINGS" "$SETTINGS_FILE"
  echo "  ✓ settings.json created"
fi

# 4. Optional: pi-go-bars credentials
echo "[3/3] Go bars credentials..."
GOBARS_CONFIG="$AGENT_DIR/pi-go-bars.json"
if [ ! -f "$GOBARS_CONFIG" ]; then
  echo ""
  echo "  pi-go-bars needs Opencode Go credentials."
  echo "  You can skip this and run /gobars-setup inside pi later."
  echo ""
  read -p "  Enter workspace ID (or press Enter to skip): " WORKSPACE_ID
  if [ -n "$WORKSPACE_ID" ]; then
    read -p "  Enter auth cookie: " AUTH_COOKIE
    mkdir -p "$AGENT_DIR"
    cat > "$GOBARS_CONFIG" << JSONEOF
{
  "workspaceId": "$WORKSPACE_ID",
  "authCookie": "$AUTH_COOKIE"
}
JSONEOF
    chmod 600 "$GOBARS_CONFIG"
    echo "  ✓ pi-go-bars.json created"
  else
    echo "  ⏭ skipped"
  fi
else
  echo "  ✓ already exists, leaving unchanged"
fi

echo ""
echo "=== Done! Restart pi ==="
