export default function VideoPlayer({ videoUrl }) {
  if (!videoUrl) return null;

  return (
    <div className="card video-card" id="videoCard">
      <h3 className="section-title" style={{ marginBottom: '1rem' }}>Annotated Video</h3>
      <video
        id="outputVideo"
        className="video-player"
        src={videoUrl}
        controls
        preload="metadata"
      />
      <a
        id="videoDownloadBtn"
        className="btn-secondary video-dl-btn"
        href={videoUrl}
        download
      >
        ⬇ Download Video
      </a>
    </div>
  );
}
