import { crowdLevel } from '../utils';

export default function ResultsTable({ intervals, peakMax, onViewFrame }) {
  const thresholdHigh   = Math.ceil(peakMax * 0.7);
  const thresholdMedium = Math.ceil(peakMax * 0.35);

  return (
    <div className="card table-card">
      <h3 className="section-title" style={{ marginBottom: '1rem' }}>Window Breakdown</h3>
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
          <tbody id="resultsTableBody">
            {intervals.map((row, idx) => {
              const level    = crowdLevel(row.max_count, thresholdHigh, thresholdMedium);
              const hasFrame = !!row.preview_image;
              return (
                <tr key={idx} data-frame-idx={idx}>
                  <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td><strong>{row.label}</strong></td>
                  <td>{row.min_count}</td>
                  <td><strong>{row.avg_count}</strong></td>
                  <td>{row.max_count}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{row.samples}</td>
                  <td><span className={`level-badge level-${level.cls}`}>{level.label}</span></td>
                  <td>
                    {hasFrame ? (
                      <button className="btn-frame" onClick={() => onViewFrame(idx)} title="View detection frame">
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                          <circle cx="7.5" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M1 7.5C1 7.5 3.5 2.5 7.5 2.5S14 7.5 14 7.5 11.5 12.5 7.5 12.5 1 7.5 1 7.5Z"
                                stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>—</span>
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
