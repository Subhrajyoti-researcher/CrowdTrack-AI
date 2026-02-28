export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function crowdLevel(count, high, medium) {
  if (count >= high)   return { cls: 'high',   label: '🔴 High' };
  if (count >= medium) return { cls: 'medium', label: '🟡 Medium' };
  return                      { cls: 'low',    label: '🟢 Low' };
}
