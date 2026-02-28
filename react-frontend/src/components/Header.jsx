export default function Header({ section = 'upload', onHome }) {
  const breadcrumbMap = {
    upload:     'Upload',
    processing: 'Analysing Footage',
    results:    'Analysis Results',
  };
  const crumb = breadcrumbMap[section] ?? section;

  return (
    <header className="header">
      <div className="header-inner">

        {/* LEFT: Logo */}
        <div className="logo">
          <svg width="30" height="30" viewBox="0 0 34 34" fill="none" aria-hidden="true">
            <rect width="34" height="34" rx="8" fill="#1f2937"/>
            <rect x="5"  y="14" width="6" height="11" rx="2" fill="#c4614a"/>
            <rect x="14" y="9"  width="6" height="16" rx="2" fill="#e08060"/>
            <rect x="23" y="17" width="6" height="8"  rx="2" fill="#c4614a"/>
            <circle cx="8"  cy="10" r="3" fill="#e08060"/>
            <circle cx="17" cy="5"  r="3" fill="#f0a080"/>
            <circle cx="26" cy="13" r="3" fill="#e08060"/>
          </svg>
          <div>
            <span className="logo-name">CrowdTrack AI</span>
            <span className="logo-sub">Rail Station Analytics</span>
          </div>
        </div>

        {/* CENTER: Breadcrumb */}
        <nav className="header-breadcrumb" aria-label="Location">
          <span>CrowdTrack AI</span>
          {section !== 'upload' && (
            <>
              <span className="header-breadcrumb-sep" aria-hidden="true">/</span>
              <span className="header-breadcrumb-current">{crumb}</span>
            </>
          )}
        </nav>

        {/* RIGHT: Home button — only when not on upload */}
        {section !== 'upload' && (
          <button className="btn-home" onClick={onHome} aria-label="Return to upload">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 7L7 1l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2.5 5.5V12a.5.5 0 00.5.5h2.5V9h3v3.5H11a.5.5 0 00.5-.5V5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Home
          </button>
        )}

      </div>
    </header>
  );
}
