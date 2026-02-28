import StatCard from './StatCard';
import { formatDuration } from '../utils';

export default function StatsGrid({ duration, peak, avg, windows, procTime }) {
  return (
    <div className="stats-grid">
      <StatCard icon="⏱" value={formatDuration(duration)} label="Duration" />
      <StatCard icon="👥" value={peak} label="Peak Count" highlight />
      <StatCard icon="📊" value={avg} label="Avg per Window" />
      <StatCard icon="🪟" value={windows} label="30-sec Windows" />
      <StatCard icon="⚡" value={procTime != null ? formatDuration(procTime) : '—'} label="Processing Time" />
    </div>
  );
}
