import { crowdLevel } from '../utils';

export default function FrameItem({ row, idx, peakMax, frameRefs, onOpenLightbox }) {
  const thresholdHigh   = Math.ceil(peakMax * 0.7);
  const thresholdMedium = Math.ceil(peakMax * 0.35);
  const level = crowdLevel(row.max_count, thresholdHigh, thresholdMedium);
  const src   = `data:image/jpeg;base64,${row.preview_image}`;

  return (
    <div
      className="frame-item"
      id={`frame-${idx}`}
      ref={el => { if (frameRefs) frameRefs.current[idx] = el; }}
    >
      <div className="frame-img-wrap" onClick={() => onOpenLightbox(src, `${row.label}  ·  ${row.max_count} people (peak)`)}>
        <img src={src} alt={`Window ${idx + 1}`} className="frame-img" loading="lazy" />
        <div className="frame-overlay">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <circle cx="13" cy="13" r="12" fill="rgba(0,0,0,.5)"/>
            <circle cx="13" cy="13" r="5" stroke="white" strokeWidth="1.8"/>
            <path d="M4 13C4 13 7.5 6 13 6s9 7 9 7-3.5 7-9 7-9-7-9-7Z"
                  stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      <div className="frame-meta">
        <span className="frame-label">{row.label}</span>
        <span className={`level-badge level-${level.cls}`}>{level.label}</span>
      </div>
      <div className="frame-stats">
        <span>Peak <strong>{row.max_count}</strong></span>
        <span className="frame-stat-sep">·</span>
        <span>Avg <strong>{row.avg_count}</strong></span>
        <span className="frame-stat-sep">·</span>
        <span>{row.samples} samples</span>
      </div>
    </div>
  );
}
