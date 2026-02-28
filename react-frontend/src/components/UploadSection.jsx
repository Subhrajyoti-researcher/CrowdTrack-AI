import DropZone from './DropZone';

export default function UploadSection({ onFile, fileHint, onAnalyse, analyseDisabled }) {
  return (
    <section className="card upload-card" id="uploadSection">
      <h2 className="section-title">Upload CCTV Footage</h2>
      <DropZone onFile={onFile} fileHint={fileHint} />
      <button
        className="btn-analyze"
        id="analyzeBtn"
        disabled={analyseDisabled}
        onClick={onAnalyse}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M6.5 9.5L8.5 11.5L11.5 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Analyse Crowd
      </button>
    </section>
  );
}
