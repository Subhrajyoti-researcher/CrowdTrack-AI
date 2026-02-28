import { crowdLevelText } from '../utils';

export default function ResultsTable({ intervals, peakMax, overallAvg, onViewFrame }) {
  const thresholdHigh   = Math.ceil(peakMax * 0.7);
  const thresholdMedium = Math.ceil(peakMax * 0.35);

  // Summary row computed values
  const overallMin   = intervals.length ? Math.min(...intervals.map(i => i.min_count)) : 0;
  const totalSamples = intervals.reduce((acc, i) => acc + i.samples, 0);
  const firstLabel   = intervals[0]?.label.split('–')[0]?.trim() ?? '0:00';
  const lastInterval = intervals[intervals.length - 1];
  const lastLabel    = lastInterval?.label.split('–')[1]?.trim() ?? '';
  const fullRange    = intervals.length > 1 ? `${firstLabel} – ${lastLabel}` : (intervals[0]?.label ?? '—');
  const summaryLevel = crowdLevelText(peakMax, thresholdHigh, thresholdMedium);

  return (
    <div className="card analytics-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>Analytics Summary</h3>
          <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.2rem' }}>
            {intervals.length} time window{intervals.length !== 1 ? 's' : ''} · 30-second intervals
          </p>
        </div>
      </div>

      <div className="table-wrap">
        <table className="results-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Time Window</th>
              <th>Min</th>
              <th>Avg</th>
              <th>Max</th>
              <th>Samples</th>
              <th>Crowd Level</th>
              <th>Frame</th>
            </tr>
          </thead>
          <tbody>
            {/* Pinned overall summary row */}
            <tr className="summary-row">
              <td className="summary-label">Overall</td>
              <td className="summary-val">{fullRange}</td>
              <td className="summary-val">{overallMin}</td>
              <td className="summary-val">{overallAvg}</td>
              <td className="summary-val">{peakMax}</td>
              <td className="summary-val">{totalSamples}</td>
              <td>
                <span className={`level-badge level-${summaryLevel.cls}`}>
                  {summaryLevel.label} (Peak)
                </span>
              </td>
              <td className="summary-label">—</td>
            </tr>

            {/* Per-window rows */}
            {intervals.map((row, idx) => {
              const level    = crowdLevelText(row.max_count, thresholdHigh, thresholdMedium);
              const hasFrame = !!row.preview_image;
              return (
                <tr key={idx}>
                  <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td><strong>{row.label}</strong></td>
                  <td>{row.min_count}</td>
                  <td><strong>{row.avg_count}</strong></td>
                  <td>{row.max_count}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{row.samples}</td>
                  <td>
                    <span className={`level-badge level-${level.cls}`}>{level.label}</span>
                  </td>
                  <td>
                    {hasFrame ? (
                      <button
                        className="btn-frame"
                        onClick={() => onViewFrame(idx)}
                        title={`View detection frame for window ${idx + 1}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
                          <circle cx="7.5" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M1 7.5C1 7.5 3.5 2.5 7.5 2.5S14 7.5 14 7.5 11.5 12.5 7.5 12.5 1 7.5 1 7.5Z"
                                stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
