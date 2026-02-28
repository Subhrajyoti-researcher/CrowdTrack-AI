export default function Header() {
  return (
    <header className="header">
      <div className="logo">
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect width="34" height="34" rx="8" fill="#3d2c22"/>
          <rect x="5" y="14" width="6" height="11" rx="2" fill="#c4614a"/>
          <rect x="14" y="9"  width="6" height="16" rx="2" fill="#e08060"/>
          <rect x="23" y="17" width="6" height="8"  rx="2" fill="#c4614a"/>
          <circle cx="8"  cy="10" r="3" fill="#e08060"/>
          <circle cx="17" cy="5"  r="3" fill="#f0a080"/>
          <circle cx="26" cy="13" r="3" fill="#e08060"/>
        </svg>
        <div>
          <span className="logo-name">CrowdTrack AI</span>
          <span className="logo-sub">Rail Station CCTV Analytics</span>
        </div>
      </div>
      <div className="live-badge">
        <span className="live-dot" aria-hidden="true" />
        Live Detection
      </div>
    </header>
  );
}
