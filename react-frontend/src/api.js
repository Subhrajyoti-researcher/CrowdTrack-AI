export async function uploadVideo(formData) {
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

export async function fetchStatus(jobId) {
  const res = await fetch(`/api/status/${jobId}`);
  if (!res.ok) return null;
  return res.json();
}
