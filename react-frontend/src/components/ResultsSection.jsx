import { useRef } from 'react';
import StatsGrid from './StatsGrid';
import CrowdChart from './CrowdChart';
import ResultsTable from './ResultsTable';
import VideoPlayer from './VideoPlayer';
import FramesGallery from './FramesGallery';

export default function ResultsSection({ results, onReset, onOpenLightbox }) {
  const frameRefs = useRef({});

  function scrollToFrame(idx) {
    const el = frameRefs.current[idx];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('frame-highlight');
    setTimeout(() => el.classList.remove('frame-highlight'), 1800);
  }

  const { duration, overall_max, overall_avg, intervals, video_url, processing_time_s } = results;

  return (
    <section id="resultsSection">
      <StatsGrid
        duration={duration}
        peak={overall_max}
        avg={overall_avg}
        windows={intervals.length}
        procTime={processing_time_s}
      />

      <CrowdChart intervals={intervals} />

      <ResultsTable
        intervals={intervals}
        peakMax={overall_max}
        onViewFrame={scrollToFrame}
      />

      <VideoPlayer videoUrl={video_url} />

      <FramesGallery
        intervals={intervals}
        peakMax={overall_max}
        frameRefs={frameRefs}
        onOpenLightbox={onOpenLightbox}
      />

      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <button className="btn-secondary" id="resetBtn" onClick={onReset}>
          ↩ Upload Another Video
        </button>
      </div>
    </section>
  );
}
