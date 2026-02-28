import LiveStream from './LiveStream';
import { crowdLevel } from '../utils';

export default function ProcessingSection({ progress, jobId, partialIntervals = [], onOpenLightbox }) {
  const peakMax = partialIntervals.length
    ? Math.max(...partialIntervals.map(i => i.max_count))
    : 1;
  const thHigh   = Math.ceil(peakMax * 0.7);
  const thMedium = Math.ceil(peakMax * 0.35);

  return (
    <section className="card processing-card" id="processingSection">
      <div className="processing-header">
        <div className="spinner" aria-hidden="true" />
        <h2 className="section-title" style={{ margin: 0 }}>Analysing Footage…</h2>
        <span className="live-badge" style={{ marginLeft: 'auto' }}>
          <span className="live-dot" aria-hidden="true" />
          Live
        </span>
      </div>

      <div className="progress-wrap" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
        <div className="progress-bar" id="progressBar" style={{ width: `${progress}%` }} />
      </div>
      <p className="progress-label" id="progressLabel">{progress}%</p>

      <LiveStream jobId={jobId} />

      {/* Progressive window thumbnails */}
      {partialIntervals.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginBottom: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Completed Windows ({partialIntervals.length})
          </p>
          <div className="frames-grid">
            {partialIntervals.map((row, idx) => {
              const level = crowdLevel(row.max_count, thHigh, thMedium);
              const src   = row.preview_image ? `data:image/jpeg;base64,${row.preview_image}` : null;
              return (
                <div key={idx} className="frame-item">
                  {src ? (
                    <div className="frame-img-wrap" style={{ cursor: 'pointer' }}
                         onClick={() => onOpenLightbox && onOpenLightbox(src, `${row.label}  ·  ${row.max_count} people (peak)`)}>
                      <img src={src} alt={row.label} className="frame-img" loading="lazy" />
                      <div className="frame-overlay">
                        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                          <circle cx="13" cy="13" r="12" fill="rgba(0,0,0,.5)"/>
                          <circle cx="13" cy="13" r="5" stroke="white" strokeWidth="1.8"/>
                          <path d="M4 13C4 13 7.5 6 13 6s9 7 9 7-3.5 7-9 7-9-7-9-7Z"
                                stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <div className="frame-img-wrap" style={{ background: 'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', minHeight: 140 }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>No preview</span>
                    </div>
                  )}
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
            })}
          </div>
        </div>
      )}
    </section>
  );
}
