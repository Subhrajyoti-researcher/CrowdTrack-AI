#!/usr/bin/env bash
# ============================================================
# CrowdTrack AI – Setup Script
# Run once to create the virtual environment and install deps
# ============================================================
set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     CrowdTrack AI – Setup            ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ---- Check Python ----
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 not found. Install Python 3.9+ and retry."
  exit 1
fi
PY_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "✓ Python $PY_VER found"

# ---- Check ffmpeg (optional but recommended for WMV) ----
if command -v ffmpeg &>/dev/null; then
  echo "✓ ffmpeg found (WMV conversion supported)"
else
  echo "⚠  ffmpeg not found – WMV files may not open."
  echo "   Install with:  brew install ffmpeg"
fi

# ---- Create venv ----
VENV_DIR="$(dirname "$0")/venv"
if [ ! -d "$VENV_DIR" ]; then
  echo "→ Creating virtual environment…"
  python3 -m venv "$VENV_DIR"
fi
echo "✓ Virtual environment ready"

# ---- Install dependencies ----
echo "→ Installing Python packages (may take a minute)…"
"$VENV_DIR/bin/pip" install --upgrade pip -q
"$VENV_DIR/bin/pip" install -r "$(dirname "$0")/backend/requirements.txt" -q
echo "✓ Dependencies installed"

# ---- Pre-download YOLOv8 model ----
echo "→ Pre-downloading YOLOv8n model weights…"
"$VENV_DIR/bin/python" -c "from ultralytics import YOLO; YOLO('yolov8n.pt')" 2>&1 | tail -2
echo "✓ Model ready"

echo ""
echo "Setup complete!  Run  ./start.sh  to launch the server."
echo ""
