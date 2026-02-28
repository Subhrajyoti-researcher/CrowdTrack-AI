import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Filler,
  Title,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Filler, Title);

export default function CrowdChart({ intervals }) {
  const labels = intervals.map(i => i.label);
  const avgs   = intervals.map(i => i.avg_count);
  const maxes  = intervals.map(i => i.max_count);

  const data = {
    labels,
    datasets: [
      {
        label: 'Avg Count',
        type: 'bar',
        data: avgs,
        backgroundColor: 'rgba(196,97,74,0.55)',
        borderColor: 'rgba(196,97,74,0.9)',
        borderWidth: 1.5,
        borderRadius: 4,
        order: 2,
      },
      {
        label: 'Max Count',
        type: 'line',
        data: maxes,
        borderColor: '#1a1a1a',
        backgroundColor: 'rgba(26,26,26,0.05)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: '#1a1a1a',
        tension: 0.3,
        fill: true,
        order: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#ffffff',
        borderColor: '#e4dfd8',
        borderWidth: 1,
        titleColor: '#1a1a1a',
        bodyColor: '#717171',
        callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} people` },
      },
    },
    scales: {
      x: {
        ticks: { color: '#717171', maxRotation: 45, font: { size: 11 } },
        grid:  { color: 'rgba(0,0,0,0.06)' },
      },
      y: {
        ticks: { color: '#717171', stepSize: 1 },
        grid:  { color: 'rgba(0,0,0,0.06)' },
        title: { display: true, text: 'People', color: '#717171' },
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="card chart-card">
      <div className="chart-header">
        <h3 className="chart-title">Headcount per 30-Second Window</h3>
        <div className="legend">
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: 'rgba(196,97,74,0.7)' }} />
            Avg
          </span>
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: '#1a1a1a' }} />
            Max
          </span>
        </div>
      </div>
      <div className="chart-wrap">
        <Chart type="bar" data={data} options={options} />
      </div>
    </div>
  );
}
