# ============================================================
# CrowdTrack AI – Dockerfile
# Multi-stage build:
#   Stage 1 (builder) – compile React frontend
#   Stage 2 (runtime) – Python + FastAPI + built frontend
# ============================================================

# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /app/react-frontend
COPY react-frontend/package*.json ./
RUN npm ci --cache /tmp/npm-cache
COPY react-frontend/ ./
RUN npm run build


# ── Stage 2: Python runtime ───────────────────────────────────────────────────
FROM python:3.11-slim

# System deps: ffmpeg (video conversion), libGL (OpenCV), curl (health check)
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        libglib2.0-0 \
        libgl1 \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install PyTorch first with a configurable wheel index so the same Dockerfile
# produces both a CPU image (default) and a CUDA-enabled GPU image without
# changing the base image.  The NVIDIA container runtime injects libcuda.so at
# container start, so python:3.11-slim works fine for GPU deployments too.
#
#   CPU  (default): https://download.pytorch.org/whl/cpu
#   GPU CUDA 12.1 : https://download.pytorch.org/whl/cu121
#
# requirements.txt still lists torch==2.3.1 for local/dev installs.
# pip sees the version already satisfied here and skips re-downloading it.
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir \
        torch==2.3.1 \
        torchvision==0.18.1 \
        --index-url ${TORCH_INDEX_URL}

# Install remaining Python deps (torch already satisfied above → skipped)
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend into the location the backend expects
COPY --from=frontend-builder /app/react-frontend/dist ./react-frontend/dist/

# Persistent directories for uploads and output videos.
# The YOLO model (yolo11x.pt) is NOT baked into the image — it is mounted
# at runtime via the volume in docker-compose.yml (see below).
RUN mkdir -p /app/backend/uploads /app/backend/outputs

WORKDIR /app/backend

# ── Runtime config ────────────────────────────────────────────────────────────
# CROWDTRACK_DEVICE: auto | cuda | cpu  (default: auto-detect)
# CROWDTRACK_MODEL:  path to .pt file   (default: yolo11x.pt)
ENV CROWDTRACK_DEVICE=auto \
    CROWDTRACK_MODEL=yolo11x.pt \
    PYTHONUNBUFFERED=1

EXPOSE 8000

# start-period is generous: on first run Ultralytics may download model weights
# which can take several minutes.  60 s is enough for a pre-mounted model.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# --workers 1 is intentional: inference is CPU/GPU-bound and coordinated via
# _GPU_LOCK in crowd_counter.py.  Multiple workers would create duplicate locks.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
