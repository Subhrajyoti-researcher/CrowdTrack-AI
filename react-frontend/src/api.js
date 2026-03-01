export async function uploadVideo(formData) {
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || res.statusText || `Upload failed (${res.status})`);
  }
  return res.json();
}

export async function uploadVideoDense(formData) {
  const res = await fetch('/api/upload-dense', { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || res.statusText || `Dense upload failed (${res.status})`);
  }
  return res.json();
}


export async function fetchStatus(jobId) {
  const res = await fetch(`/api/status/${jobId}`);
  if (!res.ok) return null;
  return res.json();
}

export async function downloadExcel(stdJobId, denseJobId) {
  const params = new URLSearchParams();
  if (stdJobId)   params.set('std_job_id',   stdJobId);
  if (denseJobId) params.set('dense_job_id', denseJobId);
  const res = await fetch(`/api/export-excel?${params}`);
  if (!res.ok) throw new Error('Excel export failed');
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'crowdtrack_results.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}
