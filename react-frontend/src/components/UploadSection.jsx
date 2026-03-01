import DropZone from './DropZone';

export default function UploadSection({
  onFileStd,   fileHintStd,
  onFileDense, fileHintDense,
  onAnalyse,   analyseDisabled,
}) {
  const bothSelected = fileHintStd && fileHintDense;
  const btnLabel = bothSelected
    ? 'Analyse Both'
    : fileHintStd
      ? 'Analyse (Standard)'
      : fileHintDense
        ? 'Analyse (Dense)'
        : 'Analyse';

  return (
    <section className="card upload-card" id="uploadSection">
      <h2 className="section-title">Upload CCTV Footage</h2>
      <p className="section-sub">Upload one or both videos — they will process simultaneously.</p>

      <div className="dual-upload-grid">
        {/* Standard drop zone */}
        <div className="upload-zone-wrap">
          <div className="upload-zone-header">
            <span className="upload-zone-title">Standard Analysis</span>
            <span className="upload-zone-desc">Low to medium density crowds</span>
          </div>
          <DropZone onFile={onFileStd} fileHint={fileHintStd} />
        </div>

        {/* Dense drop zone */}
        <div className="upload-zone-wrap upload-zone-wrap--dense">
          <div className="upload-zone-header">
            <span className="upload-zone-title">
              Dense Analysis&nbsp;<span className="dense-mode-badge">High Density</span>
            </span>
            <span className="upload-zone-desc">High density crowds — 99% recall target</span>
          </div>
          <DropZone onFile={onFileDense} fileHint={fileHintDense} />
        </div>
      </div>

      <button
        className="btn-analyze"
        id="analyzeBtn"
        disabled={analyseDisabled}
        onClick={onAnalyse}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M6.5 9.5L8.5 11.5L11.5 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {btnLabel}
      </button>
    </section>
  );
}
