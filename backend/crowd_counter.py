import cv2
import subprocess
import os
import base64
import logging
import threading
import numpy as np
from pathlib import Path
from typing import Callable, Optional, Dict, List, Tuple

logger = logging.getLogger(__name__)

# ── Device auto-detection ─────────────────────────────────────────────────────
# Priority: CROWDTRACK_DEVICE env var → CUDA → MPS (Apple) → CPU
# Edge deployments set CROWDTRACK_DEVICE=cuda or CROWDTRACK_DEVICE=cpu
def _resolve_device() -> str:
    env = os.environ.get("CROWDTRACK_DEVICE", "").strip().lower()
    if env:
        return env
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        if torch.backends.mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"

INFERENCE_DEVICE = _resolve_device()
logger.info(f"Inference device: {INFERENCE_DEVICE}")

# Serialise all GPU calls — MPS and single-GPU CUDA do not support true
# concurrent inference from multiple threads.
_GPU_LOCK = threading.Lock()

# ── Model config ─────────────────────────────────────────────────────────────
MODEL_NAME   = os.environ.get("CROWDTRACK_MODEL", "yolo11x.pt")  # override via env
CONF_THRESH  = 0.30           # raised to eliminate low-confidence false positives in night CCTV
NMS_IOU      = 0.35           # relaxed IoU – prevents suppression of close-standing people
TILE_SIZE    = 640            # larger tiles → fewer tiles → fewer cross-tile seam duplicates
TILE_OVERLAP = 0.35           # 35 % overlap – better coverage of people near tile boundaries
HEAD_FRAC    = 0.40           # top 40 % of box for NMS; catches partial-view overlaps better
MIN_HEAD_PX  = 25             # lower minimum catches smaller/distant figures farther from camera

# ── Dense-mode config (targeting 99 % recall for high-density crowds) ─────────
# Strategy: small tiles (384 px) → fewer people per tile → YOLO detects more;
#           near-disabled per-tile NMS (iou=0.85) → adjacent people survive;
#           pure head-region dedup (HEAD_FRAC=0.12) → adjacent heads rarely overlap.
DENSE_CONF_THRESH  = 0.10   # aggressive – catches occluded / partially-visible people
DENSE_NMS_IOU      = 0.20   # tight cross-tile head NMS – heads of adjacent people rarely overlap
DENSE_TILE_SIZE    = 384    # small tiles → ~10-20 people per tile → YOLO detects each clearly
DENSE_TILE_OVERLAP = 0.60   # 60 % overlap – every person seen in 2-3 tiles for reliable dedup
DENSE_HEAD_FRAC    = 0.12   # top 12 % = pure head/hat crown – minimal inter-person overlap
DENSE_MIN_HEAD_PX  = 6      # catch smallest distant figures
DENSE_BOX_COLOR    = (0, 140, 255)   # orange-amber (BGR) – visually distinct from standard

# ── Visualisation config ──────────────────────────────────────────────────────
BOX_COLOR      = (0, 210, 180)   # teal-green matching UI palette (BGR)
PREVIEW_W      = 960             # max width of annotated preview JPEG
HEAD_DRAW_FRAC = 0.25            # top 25 % of body box drawn as head box (visualisation only)
HEAD_DRAW_MIN  = 35              # minimum head-box draw height in pixels


# ── Helpers ───────────────────────────────────────────────────────────────────

def format_time(seconds: int) -> str:
    h, rem = divmod(int(seconds), 3600)
    m, s = divmod(rem, 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def convert_to_mp4(video_path: str) -> Optional[str]:
    """Convert WMV/AVI/MKV → MP4 via ffmpeg for OpenCV compatibility."""
    mp4_path = str(Path(video_path).with_suffix(".mp4"))
    if mp4_path == video_path:
        return None
    try:
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", video_path,
             "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an",
             mp4_path],
            capture_output=True, timeout=600,
        )
        if result.returncode == 0 and Path(mp4_path).exists():
            logger.info(f"Converted {video_path} -> {mp4_path}")
            return mp4_path
        logger.warning(f"ffmpeg failed: {result.stderr.decode()[:200]}")
        return None
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        logger.warning(f"ffmpeg unavailable: {e}")
        return None


def _nms(boxes: np.ndarray, scores: np.ndarray, iou_thr: float) -> List[int]:
    """Pure-NumPy NMS.  boxes: (N,4) xyxy,  scores: (N,)"""
    if len(boxes) == 0:
        return []
    x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
    areas  = (x2 - x1) * (y2 - y1)
    order  = scores.argsort()[::-1]
    keep   = []
    while order.size:
        i = order[0]
        keep.append(int(i))
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        inter = np.maximum(0, xx2 - xx1) * np.maximum(0, yy2 - yy1)
        iou   = inter / (areas[i] + areas[order[1:]] - inter + 1e-6)
        order = order[1:][iou < iou_thr]
    return keep


def _annotate_frame(
    frame: np.ndarray,
    boxes: List[List[float]],
    count: int,
    window_label: str,
    box_color: tuple = BOX_COLOR,
) -> str:
    """
    Draw bounding boxes on frame.
    Adds a semi-transparent banner at the top with count & window label.
    Returns a base64-encoded JPEG string (max PREVIEW_W px wide).
    """
    vis = frame.copy()
    h, w = vis.shape[:2]

    # Scale down for web delivery
    if w > PREVIEW_W:
        scale = PREVIEW_W / w
        vis   = cv2.resize(vis, (PREVIEW_W, int(h * scale)))
        sx, sy = scale, scale
    else:
        sx, sy = 1.0, 1.0

    # Draw head-region box for each person detection
    for box in boxes:
        x1 = int(box[0] * sx);  y1 = int(box[1] * sy)
        x2 = int(box[2] * sx);  y2 = int(box[3] * sy)
        bh = y2 - y1
        hy2 = y1 + max(int(bh * HEAD_DRAW_FRAC), HEAD_DRAW_MIN)
        cv2.rectangle(vis, (x1, y1), (x2, hy2), box_color, 2)

    # Top banner overlay
    bw = vis.shape[1]
    banner_h = 46
    overlay = vis.copy()
    cv2.rectangle(overlay, (0, 0), (bw, banner_h), (7, 16, 31), -1)
    cv2.addWeighted(overlay, 0.80, vis, 0.20, 0, vis)
    # OpenCV putText only supports ASCII – strip/replace any Unicode chars
    banner_text = f"{count} people detected  |  {window_label}"
    banner_text = banner_text.replace("\u2013", "-").replace("\u00b7", "|")
    cv2.putText(
        vis,
        banner_text,
        (12, 31),
        cv2.FONT_HERSHEY_SIMPLEX, 0.78, box_color, 2, cv2.LINE_AA,
    )

    _, buf = cv2.imencode(".jpg", vis, [cv2.IMWRITE_JPEG_QUALITY, 82])
    return base64.b64encode(buf.tobytes()).decode("utf-8")


def _draw_for_video(
    frame: np.ndarray,
    boxes: List[List[float]],
    count: int,
    label: str,
    box_color: tuple = BOX_COLOR,
) -> np.ndarray:
    """
    Draw bounding boxes + headcount banner on a full-resolution frame
    for video output.  Modifies a copy; original is untouched.
    """
    vis = frame.copy()

    for box in boxes:
        x1 = int(box[0]); y1 = int(box[1])
        x2 = int(box[2]); y2 = int(box[3])
        bh = y2 - y1
        hy2 = y1 + max(int(bh * HEAD_DRAW_FRAC), HEAD_DRAW_MIN)
        cv2.rectangle(vis, (x1, y1), (x2, hy2), box_color, 2)

    bw = vis.shape[1]
    overlay = vis.copy()
    cv2.rectangle(overlay, (0, 0), (bw, 50), (7, 16, 31), -1)
    cv2.addWeighted(overlay, 0.80, vis, 0.20, 0, vis)
    cv2.putText(
        vis,
        f"{count} people  |  {label}",
        (14, 34),
        cv2.FONT_HERSHEY_SIMPLEX, 0.9, box_color, 2, cv2.LINE_AA,
    )
    return vis


def _count_people_tiled(
    model, frame: np.ndarray,
    tile_size: int, tile_overlap: float,
    conf_thresh: float, per_tile_iou: float,
    head_frac: float, min_head_px: int,
    head_nms_iou: float,
) -> Tuple[int, List[List[float]]]:
    """Parameterised tiled inference shared by standard and dense modes."""
    h, w = frame.shape[:2]
    stride = int(tile_size * (1 - tile_overlap))

    all_boxes:  List[List[float]] = []
    all_scores: List[float]       = []

    for y in range(0, h, stride):
        for x in range(0, w, stride):
            y2 = min(y + tile_size, h)
            x2 = min(x + tile_size, w)
            y1 = max(0, y2 - tile_size)
            x1 = max(0, x2 - tile_size)

            tile = frame[y1:y2, x1:x2]
            with _GPU_LOCK:
                results = model.predict(
                    tile,
                    classes=[0],
                    conf=conf_thresh,
                    iou=per_tile_iou,
                    verbose=False,
                    device=INFERENCE_DEVICE,
                )
            for box in results[0].boxes:
                bx1, by1, bx2, by2 = box.xyxy[0].tolist()
                all_boxes.append([x1 + bx1, y1 + by1, x1 + bx2, y1 + by2])
                all_scores.append(float(box.conf[0]))

    if not all_boxes:
        return 0, []

    head_boxes: List[List[float]] = [
        [bx1, by1, bx2, by1 + max((by2 - by1) * head_frac, min_head_px)]
        for bx1, by1, bx2, by2 in all_boxes
    ]
    keep = _nms(
        np.array(head_boxes, dtype=np.float32),
        np.array(all_scores, dtype=np.float32),
        head_nms_iou,
    )
    return len(keep), [all_boxes[i] for i in keep]


def count_people_tiled(model, frame: np.ndarray) -> Tuple[int, List[List[float]]]:
    """Standard-mode: balanced precision for low-to-medium density crowds."""
    return _count_people_tiled(
        model, frame,
        tile_size=TILE_SIZE, tile_overlap=TILE_OVERLAP,
        conf_thresh=CONF_THRESH, per_tile_iou=0.45,
        head_frac=HEAD_FRAC, min_head_px=MIN_HEAD_PX,
        head_nms_iou=NMS_IOU,
    )


def count_people_dense_tiled(model, frame: np.ndarray) -> Tuple[int, List[List[float]]]:
    """Dense-mode: 99 % recall target for high-density crowds."""
    return _count_people_tiled(
        model, frame,
        tile_size=DENSE_TILE_SIZE, tile_overlap=DENSE_TILE_OVERLAP,
        conf_thresh=DENSE_CONF_THRESH, per_tile_iou=0.85,
        head_frac=DENSE_HEAD_FRAC, min_head_px=DENSE_MIN_HEAD_PX,
        head_nms_iou=DENSE_NMS_IOU,
    )


def _fire_window_callback(
    callback: Callable,
    ws: int,
    window_size: int,
    counts_by_second: Dict[int, int],
    window_peaks: Dict[int, dict],
    box_color: tuple = BOX_COLOR,
) -> None:
    """Build a completed interval dict and pass it to window_callback."""
    we = ws + window_size
    label = f"{format_time(ws)} \u2013 {format_time(we)}"
    window_counts = [counts_by_second[s] for s in range(ws, we) if s in counts_by_second]
    if not window_counts:
        return
    interval: Dict = {
        "start":     ws,
        "end":       we,
        "label":     label,
        "min_count": min(window_counts),
        "avg_count": round(sum(window_counts) / len(window_counts), 1),
        "max_count": max(window_counts),
        "samples":   len(window_counts),
    }
    if ws in window_peaks:
        peak = window_peaks[ws]
        interval["preview_image"] = _annotate_frame(
            peak["frame"], peak["boxes"], peak["count"], label, box_color
        )
    callback(interval)


def process_video(
    video_path: str,
    progress_callback: Optional[Callable[[int], None]] = None,
    sample_every_n_seconds: float = 1.0,
    output_video_path: Optional[str] = None,
    frame_callback: Optional[Callable[[bytes], None]] = None,
    window_callback: Optional[Callable[[Dict], None]] = None,
    mode: str = 'standard',
) -> Dict:
    """
    Count people in a video and aggregate results into 30-second windows.

    mode='standard' – balanced accuracy / precision for low-to-medium density.
    mode='dense'    – 99 % recall target for high-density crowds; uses aggressive
                      confidence threshold and loose head-region NMS.

    output_video_path : writes the full annotated video as mp4.
    frame_callback    : called with JPEG bytes after each detection sample
                        (used for the MJPEG live preview stream).
    window_callback   : called with a completed interval dict as soon as a
                        30-second window finishes (used for live preview grid).
    """
    # --- Format conversion ---
    suffix = Path(video_path).suffix.lower()
    working_path   = video_path
    converted_path = None

    if suffix in {".wmv", ".avi", ".mkv", ".mov"}:
        converted = convert_to_mp4(video_path)
        if converted:
            working_path   = converted
            converted_path = converted

    # --- Open video ---
    cap = cv2.VideoCapture(working_path)
    if not cap.isOpened():
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0 or fps > 240:
        fps = 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration     = total_frames / fps if total_frames > 0 else 0
    vid_w        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    vid_h        = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    logger.info(
        f"Video: {Path(video_path).name} | fps={fps:.2f} | "
        f"frames={total_frames} | duration={duration:.1f}s | "
        f"resolution={vid_w}x{vid_h}"
    )

    # --- Set up output video writer ---
    out_writer         = None
    actual_output_path = None
    if output_video_path:
        fourcc     = cv2.VideoWriter_fourcc(*'mp4v')
        out_writer = cv2.VideoWriter(output_video_path, fourcc, fps, (vid_w, vid_h))
        if out_writer.isOpened():
            actual_output_path = output_video_path
            logger.info(f"Output video writer opened → {output_video_path}")
        else:
            logger.warning("VideoWriter failed to open; skipping video output")
            out_writer = None

    # --- Load YOLO11x ---
    from ultralytics import YOLO
    model = YOLO(MODEL_NAME)
    logger.info(f"Loaded model: {MODEL_NAME} | mode={mode}")

    # Box colour depends on mode (teal = standard, orange = dense)
    box_color = DENSE_BOX_COLOR if mode == 'dense' else BOX_COLOR

    # --- Frame sampling ---
    sample_interval  = max(1, int(fps * sample_every_n_seconds))
    window_size      = 30
    counts_by_second: Dict[int, int]  = {}
    window_peaks:     Dict[int, dict] = {}

    last_boxes: List[List[float]] = []
    last_count: int = 0
    last_reported_ws: Optional[int] = None   # tracks last window notified via window_callback

    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        current_second = frame_idx / fps
        ws = int(current_second // window_size) * window_size
        we = ws + window_size
        frame_label = f"{format_time(ws)}-{format_time(we)}"

        if frame_idx % sample_interval == 0:
            if mode == 'dense':
                count, boxes = count_people_dense_tiled(model, frame)
            else:
                count, boxes = count_people_tiled(model, frame)
            last_count     = count
            last_boxes     = boxes
            counts_by_second[int(current_second)] = count
            logger.info(f"  [{mode}] t={int(current_second)}s -> {count} people")

            peak_ws = (int(current_second) // window_size) * window_size
            if peak_ws not in window_peaks or count >= window_peaks[peak_ws]["count"]:
                window_peaks[peak_ws] = {
                    "count": count,
                    "frame": frame.copy(),
                    "boxes": boxes,
                }

            # Fire window_callback when we move into a new 30-s window
            if window_callback and last_reported_ws is not None and ws > last_reported_ws:
                _fire_window_callback(
                    window_callback, last_reported_ws, window_size,
                    counts_by_second, window_peaks, box_color,
                )
            if last_reported_ws is None or ws > last_reported_ws:
                last_reported_ws = ws

            # Push annotated frame for live MJPEG streaming
            if frame_callback:
                stream_frame = _draw_for_video(frame, last_boxes, last_count, frame_label, box_color)
                _, buf = cv2.imencode(".jpg", stream_frame, [cv2.IMWRITE_JPEG_QUALITY, 72])
                frame_callback(buf.tobytes())

            if progress_callback and total_frames > 0:
                progress_callback(min(97, int((frame_idx / total_frames) * 100)))

        # Write annotated frame to output video
        if out_writer is not None:
            annotated = _draw_for_video(frame, last_boxes, last_count, frame_label, box_color)
            out_writer.write(annotated)

        frame_idx += 1

    cap.release()
    if out_writer is not None:
        out_writer.release()
        logger.info(f"Output video saved → {actual_output_path}")

    if converted_path and os.path.exists(converted_path):
        os.remove(converted_path)

    # --- Aggregate into 30-second windows ---
    max_second = max(
        int(duration) + 1,
        (max(counts_by_second.keys()) + 1) if counts_by_second else 1,
    )

    intervals: List[Dict] = []
    for ws in range(0, max_second, window_size):
        we = min(ws + window_size, max_second)
        window_counts = [counts_by_second[s] for s in range(ws, we) if s in counts_by_second]
        if window_counts:
            label = f"{format_time(ws)} \u2013 {format_time(we)}"
            interval: Dict = {
                "start":     ws,
                "end":       we,
                "label":     label,
                "min_count": min(window_counts),
                "avg_count": round(sum(window_counts) / len(window_counts), 1),
                "max_count": max(window_counts),
                "samples":   len(window_counts),
            }
            if ws in window_peaks:
                peak = window_peaks[ws]
                interval["preview_image"] = _annotate_frame(
                    peak["frame"], peak["boxes"], peak["count"], label, box_color
                )
            intervals.append(interval)

    if progress_callback:
        progress_callback(100)

    overall_max = max((i["max_count"] for i in intervals), default=0)
    overall_avg = (
        round(sum(i["avg_count"] for i in intervals) / len(intervals), 1)
        if intervals else 0.0
    )

    return {
        "duration":     round(duration, 1),
        "fps":          round(fps, 2),
        "total_frames": total_frames,
        "overall_max":  overall_max,
        "overall_avg":  overall_avg,
        "intervals":    intervals,
        "video_path":   actual_output_path,
    }
