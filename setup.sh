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
  # Merge: keep existing settings, update only the packages list.
  # Uses Node (always available with pi) — this repo targets Termux,
  # where python3 is NOT installed; the old python path would fail and
  # silently clobber the user's settings.json with the repo defaults.
  if SETTINGS_FILE="$SETTINGS_FILE" REPO_SETTINGS="$REPO_SETTINGS" node -e '
    const fs = require("fs");
    const current = JSON.parse(fs.readFileSync(process.env.SETTINGS_FILE, "utf8"));
    const repo = JSON.parse(fs.readFileSync(process.env.REPO_SETTINGS, "utf8"));
    current.packages = repo.packages ?? current.packages ?? [];
    fs.writeFileSync(process.env.SETTINGS_FILE, JSON.stringify(current, null, 2) + "\n");
    console.log("  ✓ settings.json updated");
  '; then
    :
  else
    echo "  ⚠ could not merge settings.json — leaving existing file untouched"
  fi
else
  cp "$REPO_SETTINGS" "$SETTINGS_FILE"
  echo "  ✓ settings.json created"
fi

# 4. pi-go-bars credentials
echo "[3/3] Go bars credentials..."
GOBARS_CONFIG="$AGENT_DIR/pi-go-bars.json"
if [ ! -f "$GOBARS_CONFIG" ]; then
  echo ""
  echo "  pi-go-bars needs Opencode Go credentials."
  echo "  You can skip this and run /gobars-setup inside pi later."
  echo ""
  read -p "  Enter workspace ID (or press Enter to skip): " WORKSPACE_ID
  if [ -n "$WORKSPACE_ID" ]; then
    read -p "  Enter auth cookie (auth, starts Fe26.2**): " AUTH_COOKIE
    read -p "  Enter session cookie (__Host-console_session, starts st_): " SESSION_COOKIE
    mkdir -p "$AGENT_DIR"
    cat > "$GOBARS_CONFIG" << JSONEOF
{
  "workspaceId": "$WORKSPACE_ID",
  "authCookie": "$AUTH_COOKIE",
  "sessionCookie": "$SESSION_COOKIE"
}
JSONEOF
    chmod 600 "$GOBARS_CONFIG"
    echo "  ✓ pi-go-bars.json created"
  else
    echo "  ⏭ skipped"
  fi
else
  HAVE_SESSION="$(
    GOBARS_CONFIG="$GOBARS_CONFIG" node -e '
      const fs = require("fs");
      try {
        const c = JSON.parse(fs.readFileSync(process.env.GOBARS_CONFIG, "utf8"));
        process.stdout.write(typeof c.sessionCookie === "string" && c.sessionCookie ? "1" : "");
      } catch {}
    '
  )"
  if [ -n "$HAVE_SESSION" ]; then
    echo "  ✓ already exists with sessionCookie, leaving unchanged"
  else
    echo ""
    echo "  ⚠ existing pi-go-bars.json has no 'sessionCookie' — required since"
    echo "    opencode.ai switched to the console JSON API (auth alone gives 401)."
    read -p "  Enter __Host-console_session cookie (or press Enter to skip): " SESSION_COOKIE
    if [ -n "$SESSION_COOKIE" ]; then
      GOBARS_CONFIG="$GOBARS_CONFIG" SESSION_COOKIE="$SESSION_COOKIE" node -e '
        const fs = require("fs");
        const c = JSON.parse(fs.readFileSync(process.env.GOBARS_CONFIG, "utf8"));
        c.sessionCookie = process.env.SESSION_COOKIE;
        fs.writeFileSync(process.env.GOBARS_CONFIG, JSON.stringify(c, null, 2) + "\n");
      '
      echo "  ✓ sessionCookie added"
    else
      echo "  ⏭ skipped — statusline will show a 'missing session cookie' hint"
    fi
  fi
fi

echo ""
echo "=== Done! Restart pi ==="
