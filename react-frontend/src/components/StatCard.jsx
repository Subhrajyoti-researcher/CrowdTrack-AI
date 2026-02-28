export default function StatCard({ icon, value, label, highlight }) {
  return (
    <div className={`stat-card${highlight ? ' highlight' : ''}`}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-value">{value ?? '—'}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
