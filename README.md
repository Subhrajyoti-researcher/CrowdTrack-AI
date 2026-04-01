# CrowdTrack AI — Rail Station CCTV Crowd Analytics

Real-time crowd counting from CCTV footage using **YOLO11x** person detection. Upload one or two videos, watch detections live side-by-side, and get a full headcount report broken into **30-second windows**.

---

## Features

- **Dual analysis modes** — run Standard and Dense analysis on different videos simultaneously
- **Head-region detection** — draws tight head boxes, not full-body rectangles
- **Live MJPEG streams** — see annotated frames side-by-side as videos are processed
- **GPU fairness lock** — tile-by-tile MPS serialisation ensures both jobs make equal progress
- **Annotated video output** — downloadable MP4 with headcount overlay per job
- **30-second window analytics** — min / avg / max count per window, live preview thumbnails
- **Interactive dashboard** — bar+line chart, colour-coded table, frame gallery
- **Excel export** — download all results (Summary + per-mode interval tables) as a single `.xlsx` file
- **Processing time** displayed alongside all results

---

## Analysis Modes

| Mode | Tile size | Confidence | Best for |
|---|---|---|---|
| **Standard** | 640 × 640 px | 0.30 | Low-to-medium density crowds |
| **Dense** | 384 × 384 px | 0.10 | High-density crowds — 99% recall target |

Upload a video to either or both drop zones. Both jobs process concurrently, sharing the GPU tile-by-tile via a threading lock so neither starves the other.

---

## Architecture

```
CrowdTrack-AI/
├── backend/
│   ├── main.py              FastAPI server + REST API
│   ├── crowd_counter.py     YOLO11x tiled inference + head-region NMS + GPU lock
│   ├── requirements.txt     Python dependencies
│   ├── uploads/             Temporary uploaded videos (auto-deleted after processing)
│   └── outputs/             Annotated MP4 output files
├── react-frontend/
│   ├── src/
│   │   ├── App.jsx          Root component + state management
│   │   ├── api.js           fetch wrappers (upload, status)
│   │   ├── utils.js         formatDuration, crowdLevel helpers
│   │   ├── style.css        Corporate dark theme
│   │   ├── hooks/
│   │   │   └── useJobPoller.js  Polling hook shared by both jobs
│   │   └── components/      Header, UploadSection, ProcessingSection,
│   │                        ResultsSection, CrowdChart, Lightbox, …
│   ├── vite.config.js       Dev proxy → FastAPI :8000
│   └── dist/                Production build (served by FastAPI)
├── Dockerfile               Multi-stage build (Node → Python, CPU + GPU via build arg)
├── docker-compose.yml       CPU (default) and NVIDIA GPU deployment profiles
├── .dockerignore            Excludes venv, node_modules, model weights, outputs
├── DEPLOY.md                Step-by-step on-prem deployment guide for edge teams
├── setup.sh                 One-time install (Python venv + Node build)
└── start.sh                 Launch production server
```

---

## Requirements

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.9+ | |
| Node.js | 18+ | Only needed to rebuild the frontend |
| ffmpeg | any | `brew install ffmpeg` — for WMV/AVI/MKV conversion |

---

## Quick Start

### Docker (recommended)

```bash
# CPU (any machine with Docker)
docker compose up -d

# NVIDIA GPU
docker compose --profile gpu up -d

# Open browser
open http://localhost:8000
```

> **Note:** `yolo11x.pt` must be present in the repo root before starting — it is mounted into the container at runtime and is not baked into the image.  
> See [DEPLOY.md](DEPLOY.md) for the full on-prem edge deployment guide.

### Local (dev / no Docker)

```bash
# 1 – Install Python deps and build React frontend (one time)
./setup.sh

# 2 – Start production server
./start.sh

# 3 – Open browser
open http://localhost:8000
```

---

## Development (hot reload)

```bash
# Terminal 1 – FastAPI (auto-reloads on backend changes)
cd backend
../venv/bin/python -m uvicorn main:app --port 8000 --reload

# Terminal 2 – Vite dev server (proxies /api/* to :8000)
cd react-frontend
npm run dev
# open http://localhost:5173
```

After making frontend changes, rebuild for production:
```bash
cd react-frontend && npm run build
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CROWDTRACK_DEVICE` | `auto` | Inference device: `auto` (CUDA → MPS → CPU), `cuda`, `mps`, `cpu` |
| `CROWDTRACK_MODEL` | `yolo11x.pt` | Path to YOLO model weights file |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload video for Standard analysis → `{ job_id }` |
| `POST` | `/api/upload-dense` | Upload video for Dense analysis → `{ job_id }` |
| `GET` | `/api/status/{job_id}` | Poll progress + results |
| `GET` | `/api/stream/{job_id}` | MJPEG live stream during processing |
| `GET` | `/api/video/{job_id}` | Download annotated MP4 |
| `GET` | `/api/export-excel` | Download results as `.xlsx` — query params: `std_job_id`, `dense_job_id` |
| `GET` | `/api/health` | Health check |

### Status response (completed)
```json
{
  "status": "completed",
  "progress": 100,
  "results": {
    "duration": 120.0,
    "fps": 25.0,
    "overall_max": 42,
    "overall_avg": 28.5,
    "processing_time_s": 87.3,
    "video_url": "/api/video/{job_id}",
    "intervals": [
      {
        "start": 0, "end": 30,
        "label": "00:00 – 00:30",
        "min_count": 20, "avg_count": 28.5, "max_count": 42,
        "samples": 15,
        "preview_image": "<base64-jpeg>"
      }
    ]
  }
}
```

---

## Detection Pipeline

### Standard mode
```
Upload video
    │
    ▼
OpenCV VideoCapture  →  Sample every 1 s
    │
    ▼
Split frame into 640×640 tiles (35% overlap)
    │
    ▼
YOLO11x  (conf ≥ 0.30, per-tile iou = 0.45, device = auto: CUDA → MPS → CPU)
    │
    ▼
Acquire _GPU_LOCK  →  run inference  →  release lock
    │
    ▼
Map tile boxes → full-frame coordinates
    │
    ▼
Head-region NMS  (top 40% of box, iou ≤ 0.35)  →  final count
    │
    ▼
Annotated MP4  +  MJPEG stream  +  30-s window stats
```

### Dense mode (high-density crowds)
```
Same pipeline, different parameters:
  • Tile size   384×384 px  (smaller → fewer people per tile)
  • Tile overlap 60%        (every person seen in 2-3 tiles)
  • Confidence  0.10        (aggressive — catches occluded people)
  • Per-tile NMS iou 0.85   (near-disabled — keep all candidates)
  • Head-region NMS top 12% (pure head crown — minimal overlap)
  • Sample every 2 s        (more tiles per frame → slower per sample)
```

---

## Model Parameters

### Standard mode
| Parameter | Value |
|---|---|
| Model | YOLO11x (`yolo11x.pt`) |
| Confidence threshold | 0.30 |
| Tile size | 640 × 640 px |
| Tile overlap | 35% |
| Per-tile NMS IoU | 0.45 |
| Head-region NMS IoU | 0.35 |
| Head fraction (NMS) | top 40% of box |

### Dense mode
| Parameter | Value |
|---|---|
| Model | YOLO11x (`yolo11x.pt`) |
| Confidence threshold | 0.10 |
| Tile size | 384 × 384 px |
| Tile overlap | 60% |
| Per-tile NMS IoU | 0.85 |
| Head-region NMS IoU | 0.20 |
| Head fraction (NMS) | top 12% of box |

---

## Crowd Level Thresholds

| Level | Condition |
|---|---|
| 🟢 Low | max < 35% of session peak |
| 🟡 Medium | 35–70% of session peak |
| 🔴 High | ≥ 70% of session peak |
