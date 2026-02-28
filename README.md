# CrowdTrack AI — Rail Station CCTV Crowd Analytics

Real-time crowd counting from CCTV footage using **YOLO11x** person detection. Upload a video, watch detections live, and get a full headcount report broken into **30-second windows**.

---

## Features

- **Head-region detection** — draws tight head boxes, not full-body rectangles
- **Live MJPEG stream** — see annotated frames as the video is processed
- **Annotated video output** — downloadable MP4 with headcount overlay
- **30-second window analytics** — min / avg / max count per window
- **Interactive dashboard** — bar+line chart, colour-coded table, frame gallery
- **Processing time** displayed alongside all results

---

## Architecture

```
CrowdTrack-AI/
├── backend/
│   ├── main.py              FastAPI server + REST API
│   ├── crowd_counter.py     YOLO11x tiled inference + head-region NMS
│   ├── requirements.txt     Python dependencies
│   ├── uploads/             Temporary uploaded videos (auto-deleted)
│   └── outputs/             Annotated MP4 output files
├── react-frontend/
│   ├── src/
│   │   ├── App.jsx          Root component + state + polling
│   │   ├── api.js           fetch wrappers
│   │   ├── utils.js         formatDuration, crowdLevel helpers
│   │   ├── style.css        Warm cream + terracotta theme
│   │   └── components/      Header, UploadSection, ProcessingSection,
│   │                        ResultsSection, CrowdChart, Lightbox, …
│   ├── vite.config.js       Dev proxy → FastAPI :8000
│   └── dist/                Production build (served by FastAPI)
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
# Terminal 1 – FastAPI
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

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload video → returns `{ job_id }` |
| `GET` | `/api/status/{job_id}` | Poll progress + results |
| `GET` | `/api/stream/{job_id}` | MJPEG live stream during processing |
| `GET` | `/api/video/{job_id}` | Download annotated MP4 |
| `GET` | `/api/health` | Health check |

### Completed status response
```json
{
  "status": "completed",
  "progress": 100,
  "results": {
    "duration": 120.0,
    "fps": 25.0,
    "overall_max": 14,
    "overall_avg": 9.5,
    "processing_time_s": 87.3,
    "video_url": "/api/video/{job_id}",
    "intervals": [
      {
        "start": 0, "end": 30,
        "label": "00:00 – 00:30",
        "min_count": 7, "avg_count": 9.5, "max_count": 14,
        "samples": 15,
        "preview_image": "<base64-jpeg>"
      }
    ]
  }
}
```

---

## Detection Pipeline

```
Upload video
    │
    ▼
OpenCV VideoCapture  →  Sample every 2 s
    │
    ▼
Split frame into 640×640 tiles (25% overlap)
    │
    ▼
YOLO11x  (conf ≥ 0.25, iou = 0.40, device = MPS/CUDA/CPU)
    │
    ▼
Map tile boxes → full-frame coordinates
    │
    ▼
Head-region NMS  (top 40% of box, iou ≤ 0.25)  →  final count
    │
    ▼
Draw head box (top 25% of body box) on every frame
    │
    ▼
Annotated MP4  +  MJPEG stream  +  30-s window stats
```

---

## Model

| Parameter | Value |
|---|---|
| Model | YOLO11x (`yolo11x.pt`) |
| Confidence threshold | 0.25 |
| Tile size | 640 × 640 px |
| Tile overlap | 25% |
| NMS IoU (cross-tile) | 0.25 |
| Device | Apple MPS · CUDA · CPU |
| Detect class | person (class 0) only |

---

## Crowd Level Thresholds

| Level | Condition |
|---|---|
| 🟢 Low | max < 35% of session peak |
| 🟡 Medium | 35–70% of session peak |
| 🔴 High | ≥ 70% of session peak |
