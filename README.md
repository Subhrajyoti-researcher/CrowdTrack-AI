# CrowdTrack AI – Rail Station CCTV Crowd Counter

End-to-end web app that counts people in CCTV footage using **YOLOv8** person detection, with headcount reported every **30 seconds**.

## Architecture

```
CrowdTrack-AI/
├── backend/
│   ├── main.py           FastAPI server + REST API
│   ├── crowd_counter.py  YOLOv8 video processing
│   └── requirements.txt
├── frontend/
│   ├── index.html        Upload + Results UI
│   ├── style.css         Dark professional theme
│   └── app.js            Polling, chart, table
├── setup.sh              One-time install
└── start.sh              Launch server
```

## Requirements

| Requirement | Notes |
|---|---|
| Python 3.9+ | |
| ffmpeg | Strongly recommended for WMV files · `brew install ffmpeg` |

## Quick Start

```bash
# 1 – Install dependencies (one time)
./setup.sh

# 2 – Start server
./start.sh

# 3 – Open browser
open http://localhost:8000
```

## How It Works

1. **Upload** – drag & drop (or browse) your `.wmv` / `.mp4` / `.avi` file
2. **Convert** – ffmpeg converts WMV to MP4 for OpenCV compatibility
3. **Detect** – YOLOv8n samples every 2 seconds and counts `person` class detections
4. **Aggregate** – counts are grouped into **30-second windows** (min / avg / max)
5. **Display** – bar chart + colour-coded table + summary stats

## API

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/upload` | Upload video, returns `job_id` |
| GET | `/api/status/{job_id}` | Poll job status & progress |
| GET | `/api/health` | Health check |

### Status response (completed)
```json
{
  "status": "completed",
  "progress": 100,
  "results": {
    "duration": 120.0,
    "fps": 25.0,
    "total_frames": 3000,
    "overall_max": 42,
    "overall_avg": 28.5,
    "intervals": [
      {
        "start": 0,
        "end": 30,
        "label": "00:00 – 00:30",
        "min_count": 18,
        "avg_count": 27.3,
        "max_count": 38,
        "samples": 15
      }
    ]
  }
}
```

## Crowd Level Thresholds

| Level | Colour | Condition |
|---|---|---|
| Low | 🟢 | max < 35% of peak |
| Medium | 🟡 | 35–70% of peak |
| High | 🔴 | ≥ 70% of peak |
