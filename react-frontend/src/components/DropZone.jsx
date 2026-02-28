import { useState, useRef } from 'react';

export default function DropZone({ onFile, fileHint }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef(null);

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function handleChange(e) {
    if (e.target.files[0]) onFile(e.target.files[0]);
  }

  return (
    <div
      className={`drop-zone${isDragOver ? ' drag-over' : ''}`}
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        id="fileInput"
        accept=".mp4,.avi,.mkv,.mov,.wmv,.m4v"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <svg className="upload-icon" width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="22" cy="22" r="21" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
        <path d="M22 28V16M16 22l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <p className="drop-label">Drag &amp; drop your video here</p>
      <p className="drop-sub">or click to browse</p>
      {fileHint && <p className="file-hint" id="fileHint">{fileHint}</p>}
      <p className="drop-formats">WMV · MP4 · AVI · MKV · MOV &nbsp;·&nbsp; max 2 GB</p>
    </div>
  );
}
