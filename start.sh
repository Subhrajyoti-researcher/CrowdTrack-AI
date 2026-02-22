#!/usr/bin/env bash
# ============================================================
# CrowdTrack AI – Start Server
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_PYTHON="$SCRIPT_DIR/venv/bin/python"

if [ ! -f "$VENV_PYTHON" ]; then
  echo "Virtual environment not found. Run ./setup.sh first."
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     CrowdTrack AI – Starting         ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "  URL → http://localhost:8000"
echo "  Press Ctrl+C to stop"
echo ""

cd "$SCRIPT_DIR/backend"
"$VENV_PYTHON" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
