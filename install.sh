#!/usr/bin/env bash
set -euo pipefail

REPO_RAW_URL="${CDX_RAW_URL:-https://raw.githubusercontent.com/WangHaowen99/codex-deck/develop/cdx}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
TARGET="$INSTALL_DIR/cdx"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing dependency: $1" >&2
    exit 1
  fi
}

need python3
need tmux
need codex

mkdir -p "$INSTALL_DIR"

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$REPO_RAW_URL" -o "$TARGET"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$TARGET" "$REPO_RAW_URL"
else
  echo "Missing dependency: curl or wget" >&2
  exit 1
fi

chmod +x "$TARGET"

echo "Installed cdx to $TARGET"
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    echo "Note: $INSTALL_DIR is not in PATH."
    echo "Add this to your shell profile:"
    echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
    ;;
esac

if [ "${CDX_SKIP_INIT:-0}" != "1" ]; then
  "$TARGET" init
else
  echo "Skipped init because CDX_SKIP_INIT=1."
fi

