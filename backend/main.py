import asyncio
import logging
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import aiofiles
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from crowd_counter import process_video

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
app = FastAPI(title="CrowdTrack AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

OUTPUT_DIR = Path(__file__).parent / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".wmv", ".mp4", ".avi", ".mkv", ".mov", ".m4v"}
MAX_FILE_SIZE_MB = 2000  # 2 GB soft limit

jobs: dict = {}          # job_id -> { status, progress, results?, error? }
latest_frames: dict = {} # job_id -> latest JPEG bytes for MJPEG stream
executor = ThreadPoolExecutor(max_workers=2)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {"status": "ok"}


async def _handle_upload(file: UploadFile, mode: str) -> dict:
    """Shared upload handler — saves the file and starts a background job."""
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Accepted: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    job_id    = str(uuid.uuid4())
    dest_path = UPLOAD_DIR / f"{job_id}{suffix}"

    async with aiofiles.open(dest_path, "wb") as out:
        chunk_size = 1024 * 1024
        while chunk := await file.read(chunk_size):
            await out.write(chunk)

    logger.info(f"[{job_id}] Saved upload → {dest_path} (mode={mode})")
    jobs[job_id] = {"status": "processing", "progress": 0, "partial_intervals": []}

    loop = asyncio.get_event_loop()
    loop.run_in_executor(executor, _run_job, job_id, str(dest_path), mode)

    return {"job_id": job_id}


@app.post("/api/upload")
async def upload_standard(file: UploadFile = File(...)):
    """Standard-mode upload — balanced precision for low-to-medium density crowds."""
    return await _handle_upload(file, mode='standard')


@app.post("/api/upload-dense")
async def upload_dense(file: UploadFile = File(...)):
    """Dense-mode upload — 99 % recall target for high-density crowds."""
    return await _handle_upload(file, mode='dense')



@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]


@app.get("/api/video/{job_id}")
async def get_video(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs[job_id]
    if job.get("status") != "completed":
        raise HTTPException(status_code=404, detail="Video not ready yet")
    video_path = job.get("results", {}).get("video_path")
    if not video_path or not Path(video_path).exists():
        raise HTTPException(status_code=404, detail="Annotated video not available")
    return FileResponse(
        path=video_path,
        media_type="video/mp4",
        filename=f"crowdtrack_{job_id}.mp4",
    )


@app.get("/api/stream/{job_id}")
async def stream_video(job_id: str):
    """MJPEG stream of annotated frames as they are detected."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    async def mjpeg_generator():
        last_sent = None
        while True:
            job = jobs.get(job_id)
            if not job:
                break

            frame_bytes = latest_frames.get(job_id)
            if frame_bytes is not None and frame_bytes is not last_sent:
                last_sent = frame_bytes
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" +
                    frame_bytes +
                    b"\r\n"
                )

            if job.get("status") in ("completed", "error"):
                break

            await asyncio.sleep(0.15)

    return StreamingResponse(
        mjpeg_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------

def _run_job(job_id: str, file_path: str, mode: str = 'standard'):
    import time
    output_path = str(OUTPUT_DIR / f"{job_id}_annotated.mp4")
    try:
        logger.info(f"[{job_id}] Processing started (mode={mode})")
        t_start = time.time()

        def on_progress(pct: int):
            jobs[job_id]["progress"] = pct

        def on_frame(frame_bytes: bytes):
            latest_frames[job_id] = frame_bytes

        def on_window(interval: dict):
            jobs[job_id]["partial_intervals"].append(interval)

        # Dense mode uses ~4x more tiles per frame; sample every 2 s
        # to keep wall-clock time comparable to standard mode.
        sample_secs = 2.0 if mode == 'dense' else 1.0

        result = process_video(
            file_path,
            progress_callback=on_progress,
            output_video_path=output_path,
            frame_callback=on_frame,
            window_callback=on_window,
            sample_every_n_seconds=sample_secs,
            mode=mode,
        )

        result["processing_time_s"] = round(time.time() - t_start, 1)

        # Attach video URL if output was written successfully
        if result.get("video_path") and Path(result["video_path"]).exists():
            result["video_url"] = f"/api/video/{job_id}"

        jobs[job_id] = {"status": "completed", "progress": 100, "results": result}
        logger.info(f"[{job_id}] Completed — {len(result['intervals'])} windows | {result['processing_time_s']}s")

    except Exception as exc:
        logger.exception(f"[{job_id}] Failed")
        error_msg = str(exc) or f"{type(exc).__name__}: processing failed"
        jobs[job_id] = {"status": "error", "progress": 0, "error": error_msg}
    finally:
        # Remove uploaded file after processing
        try:
            Path(file_path).unlink(missing_ok=True)
        except Exception:
            pass
        # Clear frame buffer
        latest_frames.pop(job_id, None)


# ---------------------------------------------------------------------------
# Serve frontend (must be last — catch-all)
# ---------------------------------------------------------------------------

FRONTEND_DIR = Path(__file__).parent.parent / "react-frontend" / "dist"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="static")
