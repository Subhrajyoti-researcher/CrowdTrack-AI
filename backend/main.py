import asyncio
import logging
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import aiofiles
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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

ALLOWED_EXTENSIONS = {".wmv", ".mp4", ".avi", ".mkv", ".mov", ".m4v"}
MAX_FILE_SIZE_MB = 2000  # 2 GB soft limit

jobs: dict = {}  # job_id -> { status, progress, results?, error? }
executor = ThreadPoolExecutor(max_workers=2)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...)):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Accepted: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    job_id = str(uuid.uuid4())
    dest_path = UPLOAD_DIR / f"{job_id}{suffix}"

    # Stream file to disk
    async with aiofiles.open(dest_path, "wb") as out:
        chunk_size = 1024 * 1024  # 1 MB chunks
        while chunk := await file.read(chunk_size):
            await out.write(chunk)

    logger.info(f"[{job_id}] Saved upload → {dest_path}")
    jobs[job_id] = {"status": "processing", "progress": 0}

    # Kick off background processing
    loop = asyncio.get_event_loop()
    loop.run_in_executor(executor, _run_job, job_id, str(dest_path))

    return {"job_id": job_id}


@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]


# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------

def _run_job(job_id: str, file_path: str):
    try:
        logger.info(f"[{job_id}] Processing started")

        def on_progress(pct: int):
            jobs[job_id]["progress"] = pct

        result = process_video(file_path, progress_callback=on_progress)
        jobs[job_id] = {"status": "completed", "progress": 100, "results": result}
        logger.info(f"[{job_id}] Completed — {len(result['intervals'])} windows")

    except Exception as exc:
        logger.exception(f"[{job_id}] Failed")
        jobs[job_id] = {"status": "error", "progress": 0, "error": str(exc)}
    finally:
        # Remove uploaded file after processing
        try:
            Path(file_path).unlink(missing_ok=True)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Serve frontend (must be last — catch-all)
# ---------------------------------------------------------------------------

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="static")
