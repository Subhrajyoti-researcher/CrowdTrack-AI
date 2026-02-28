export default function VideoPlayer({ videoUrl }) {
  if (!videoUrl) return null;

  return (
    <div className="card video-card" id="videoCard">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '.75rem' }}>
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>Annotated Video</h3>
          <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.2rem' }}>
            YOLO11x detections overlaid on original footage
          </p>
        </div>
        <a
          id="videoDownloadBtn"
          className="btn-download"
          href={videoUrl}
          download
          aria-label="Download annotated video file"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 1v9M4.5 6.5 8 10l3.5-3.5M2 13h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Download Video
        </a>
      </div>
      <video
        id="outputVideo"
        className="video-player"
        src={videoUrl}
        controls
        preload="metadata"
      />
    </div>
  );
}
