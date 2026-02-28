import LiveStream from './LiveStream';

export default function ProcessingSection({ progress, jobId }) {
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
    </section>
  );
}
