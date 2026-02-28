import { formatDuration } from '../utils';

export default function StatsGrid({ duration, peak, avg, windows, procTime }) {
  const kpis = [
    { label: 'Video Duration',   value: formatDuration(duration),                         accent: false },
    { label: 'Peak Count',       value: peak,                                             accent: true  },
    { label: 'Avg per Window',   value: avg,                                              accent: false },
    { label: '30-sec Windows',   value: windows,                                          accent: false },
    { label: 'Processing Time',  value: procTime != null ? formatDuration(procTime) : '—', accent: false },
  ];

  return (
    <div className="kpi-bar" role="list" aria-label="Key performance indicators">
      {kpis.map(({ label, value, accent }) => (
        <div
          key={label}
          className={`kpi-item${accent ? ' kpi-accent' : ''}`}
          role="listitem"
        >
          <span className="kpi-value">{value ?? '—'}</span>
          <span className="kpi-label">{label}</span>
        </div>
      ))}
    </div>
  );
}
