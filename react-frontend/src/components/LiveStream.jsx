import { useState, useEffect } from 'react';

export default function LiveStream({ jobId }) {
  const [loaded, setLoaded] = useState(false);

  // Reset when a new job starts
  useEffect(() => { setLoaded(false); }, [jobId]);

  const streamUrl = jobId ? `/api/stream/${jobId}` : '';

  return (
    <div className="live-stream-wrap" id="liveStreamWrap">
      {!loaded && (
        <div className="live-stream-placeholder" id="liveStreamPlaceholder">
          <div className="spinner" style={{ margin: '0 auto .75rem', width: 28, height: 28, borderWidth: '2.5px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '.82rem', margin: 0 }}>
            Waiting for first detection…
          </p>
        </div>
      )}
      {streamUrl && (
        <img
          src={streamUrl}
          alt="Live detection stream"
          className="live-stream-img"
          style={{ display: loaded ? 'block' : 'none' }}
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}
