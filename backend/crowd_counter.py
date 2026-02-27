import cv2
import subprocess
import os
import base64
import logging
import numpy as np
from pathlib import Path
from typing import Callable, Optional, Dict, List, Tuple

logger = logging.getLogger(__name__)

# ── Model config ─────────────────────────────────────────────────────────────
MODEL_NAME   = "yolo11x.pt"   # extra-large model – highest accuracy
CONF_THRESH  = 0.25           # high threshold – removes partial-body / reflection false positives
NMS_IOU      = 0.25           # tight IoU for cross-tile dedup NMS
TILE_SIZE    = 640            # larger tiles → fewer tiles → fewer cross-tile seam duplicates
TILE_OVERLAP = 0.25           # 25 % overlap – enough to catch edge persons, fewer redundant tiles
HEAD_FRAC    = 0.40           # top 40 % of box for NMS; catches partial-view overlaps better
MIN_HEAD_PX  = 40             # minimum upper-body region height for short/seated-person boxes

# ── Visualisation config ──────────────────────────────────────────────────────
BOX_COLOR   = (0, 210, 180)   # teal-green matching UI palette (BGR)
HEAD_DOT_R  = 4               # radius of filled dot drawn at top-centre of each box
PREVIEW_W   = 960             # max width of annotated preview JPEG


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
) -> str:
    """
    Draw teal bounding boxes + head dots on frame.
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

    # Draw each person detection
    for box in boxes:
        x1 = int(box[0] * sx);  y1 = int(box[1] * sy)
        x2 = int(box[2] * sx);  y2 = int(box[3] * sy)
        cv2.rectangle(vis, (x1, y1), (x2, y2), BOX_COLOR, 2)
        cx = (x1 + x2) // 2
        cv2.circle(vis, (cx, y1), HEAD_DOT_R, BOX_COLOR, -1)

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
        cv2.FONT_HERSHEY_SIMPLEX, 0.78, BOX_COLOR, 2, cv2.LINE_AA,
    )

    _, buf = cv2.imencode(".jpg", vis, [cv2.IMWRITE_JPEG_QUALITY, 82])
    return base64.b64encode(buf.tobytes()).decode("utf-8")


def _draw_for_video(
    frame: np.ndarray,
    boxes: List[List[float]],
    count: int,
    label: str,
) -> np.ndarray:
    """
    Draw bounding boxes + headcount banner on a full-resolution frame
    for video output.  Modifies a copy; original is untouched.
    """
    vis = frame.copy()

    for box in boxes:
        x1 = int(box[0]); y1 = int(box[1])
        x2 = int(box[2]); y2 = int(box[3])
        cv2.rectangle(vis, (x1, y1), (x2, y2), BOX_COLOR, 2)
        cx = (x1 + x2) // 2
        cv2.circle(vis, (cx, y1), HEAD_DOT_R, BOX_COLOR, -1)

    bw = vis.shape[1]
    overlay = vis.copy()
    cv2.rectangle(overlay, (0, 0), (bw, 50), (7, 16, 31), -1)
    cv2.addWeighted(overlay, 0.80, vis, 0.20, 0, vis)
    cv2.putText(
        vis,
        f"{count} people  |  {label}",
        (14, 34),
        cv2.FONT_HERSHEY_SIMPLEX, 0.9, BOX_COLOR, 2, cv2.LINE_AA,
    )
    return vis


def count_people_tiled(
    model, frame: np.ndarray
) -> Tuple[int, List[List[float]]]:
    """
    Sliding-window tiled inference for dense crowds.

    Splits the frame into overlapping TILE_SIZE x TILE_SIZE patches,
    runs YOLO11x on each, converts box coords back to full-frame space,
    then removes cross-tile duplicates using HEAD-REGION NMS.

    Head-region NMS key insight:
      Full-body boxes of adjacent people in a dense crowd can share
      60-80% IoU, causing standard NMS to suppress real people.
      By running NMS only on the top HEAD_FRAC of each box (the head /
      shoulder area), neighboring heads rarely overlap, so each real
      person survives deduplication.

    Returns (count, kept_full_boxes_xyxy).
    """
    h, w = frame.shape[:2]
    stride = int(TILE_SIZE * (1 - TILE_OVERLAP))

    all_boxes:  List[List[float]] = []
    all_scores: List[float]       = []

    ys = list(range(0, h, stride))
    xs = list(range(0, w, stride))

    for y in ys:
        for x in xs:
            # Clamp tile so it never exceeds frame boundary
            y2 = min(y + TILE_SIZE, h)
            x2 = min(x + TILE_SIZE, w)
            y1 = max(0, y2 - TILE_SIZE)
            x1 = max(0, x2 - TILE_SIZE)

            tile    = frame[y1:y2, x1:x2]
            results = model.predict(
                tile,
                classes=[0],          # person only
                conf=CONF_THRESH,
                iou=0.40,             # tightened per-tile NMS – reduce duplicate detections
                verbose=False,
                device="mps",
            )
            for box in results[0].boxes:
                bx1, by1, bx2, by2 = box.xyxy[0].tolist()
                all_boxes.append([x1 + bx1, y1 + by1, x1 + bx2, y1 + by2])
                all_scores.append(float(box.conf[0]))

    if not all_boxes:
        return 0, []

    head_boxes: List[List[float]] = []
    for b in all_boxes:
        bx1, by1, bx2, by2 = b
        bh = by2 - by1
        head_h = max(bh * HEAD_FRAC, MIN_HEAD_PX)  # ensure meaningful head region even for short boxes
        head_boxes.append([bx1, by1, bx2, by1 + head_h])

    keep = _nms(
        np.array(head_boxes,  dtype=np.float32),
        np.array(all_scores,  dtype=np.float32),
        NMS_IOU,
    )
    kept_boxes = [all_boxes[i] for i in keep]
    return len(keep), kept_boxes


# ── Main entry point ──────────────────────────────────────────────────────────

def process_video(
    video_path: str,
    progress_callback: Optional[Callable[[int], None]] = None,
    sample_every_n_seconds: float = 2.0,
    output_video_path: Optional[str] = None,
    frame_callback: Optional[Callable[[bytes], None]] = None,
) -> Dict:
    """
    Count people in a video and aggregate results into 30-second windows.
    Uses tiled YOLO11x inference for dense-crowd accuracy.
    Each interval includes a base64 JPEG preview of the peak detection frame.

    output_video_path : writes the full annotated video as mp4.
    frame_callback    : called with JPEG bytes after each detection sample
                        (used for the MJPEG live preview stream).
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
    logger.info(f"Loaded model: {MODEL_NAME}")

    # --- Frame sampling ---
    sample_interval  = max(1, int(fps * sample_every_n_seconds))
    window_size      = 30
    counts_by_second: Dict[int, int]  = {}
    window_peaks:     Dict[int, dict] = {}

    last_boxes: List[List[float]] = []
    last_count: int = 0

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
            count, boxes   = count_people_tiled(model, frame)
            last_count     = count
            last_boxes     = boxes
            counts_by_second[int(current_second)] = count
            logger.info(f"  t={int(current_second)}s -> {count} people")

            peak_ws = (int(current_second) // window_size) * window_size
            if peak_ws not in window_peaks or count >= window_peaks[peak_ws]["count"]:
                window_peaks[peak_ws] = {
                    "count": count,
                    "frame": frame.copy(),
                    "boxes": boxes,
                }

            # Push annotated frame for live MJPEG streaming
            if frame_callback:
                stream_frame = _draw_for_video(frame, last_boxes, last_count, frame_label)
                _, buf = cv2.imencode(".jpg", stream_frame, [cv2.IMWRITE_JPEG_QUALITY, 72])
                frame_callback(buf.tobytes())

            if progress_callback and total_frames > 0:
                progress_callback(min(97, int((frame_idx / total_frames) * 100)))

        # Write annotated frame to output video
        if out_writer is not None:
            annotated = _draw_for_video(frame, last_boxes, last_count, frame_label)
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
                    peak["frame"], peak["boxes"], peak["count"], label
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
