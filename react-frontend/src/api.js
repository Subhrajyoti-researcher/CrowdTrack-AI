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
