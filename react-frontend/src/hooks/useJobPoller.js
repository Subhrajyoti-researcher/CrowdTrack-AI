import { useEffect } from 'react';
import { fetchStatus } from '../api';

const POLL_MS = 1500;

export default function useJobPoller(jobId, section, { onProgress, onPartialIntervals, onComplete, onError }) {
  useEffect(() => {
    if (!jobId || section !== 'processing') return;
    const timer = setInterval(async () => {
      try {
        const data = await fetchStatus(jobId);
        if (!data) return;
        onProgress(data.progress ?? 0);
        if (data.partial_intervals?.length) onPartialIntervals(data.partial_intervals);
        if (data.status === 'completed') {
          clearInterval(timer);
          onComplete(data.results);
        } else if (data.status === 'error') {
          clearInterval(timer);
          onError(data.error);
        }
      } catch (_) {}
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [jobId, section]);
}
