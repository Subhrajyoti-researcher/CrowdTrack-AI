import { useState, useRef } from 'react';
import StatsGrid from './StatsGrid';
import CrowdChart from './CrowdChart';
import ResultsTable from './ResultsTable';
import VideoPlayer from './VideoPlayer';
import FramesGallery from './FramesGallery';

export default function ResultsSection({ resultsStd, resultsDense, onOpenLightbox }) {
  const frameRefsStd   = useRef({});
  const frameRefsDense = useRef({});
  const [activeTab, setActiveTab] = useState(resultsDense ? 'dense' : 'std');

  const hasBoth = resultsStd && resultsDense;
  const results = activeTab === 'dense' ? resultsDense : resultsStd;
  if (!results) return null;

  const { duration, overall_max, overall_avg, intervals, processing_time_s } = results;
  const isDense = activeTab === 'dense';

  function scrollToFrame(idx) {
    const refs = isDense ? frameRefsDense : frameRefsStd;
    const el = refs.current[idx];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('frame-highlight');
    setTimeout(() => el.classList.remove('frame-highlight'), 1800);
  }

  return (
    <section id="resultsSection">
      {/* Tabs for analytics (stats / chart / table) */}
      {hasBoth && (
        <div className="results-tabs">
          <button
            className={`tab-btn${activeTab === 'std' ? ' tab-btn--active' : ''}`}
            onClick={() => setActiveTab('std')}
          >
            Standard Analysis
          </button>
          <button
            className={`tab-btn${activeTab === 'dense' ? ' tab-btn--active tab-btn--dense' : ''}`}
            onClick={() => setActiveTab('dense')}
          >
            Dense Analysis&nbsp;<span className="dense-mode-badge">High Density</span>
          </button>
        </div>
      )}

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
        overallAvg={overall_avg}
        onViewFrame={scrollToFrame}
      />

      {/* Videos — side-by-side when both available */}
      {hasBoth ? (
        <div className="dual-video-row">
          {resultsStd.video_url && (
            <VideoPlayer
              videoUrl={resultsStd.video_url}
              label="Standard Mode"
              subtitle="Teal boxes — balanced precision"
            />
          )}
          {resultsDense.video_url && (
            <VideoPlayer
              videoUrl={resultsDense.video_url}
              label="Dense Mode"
              subtitle="Orange boxes — 99% recall target"
            />
          )}
        </div>
      ) : (
        results.video_url && (
          <VideoPlayer
            videoUrl={results.video_url}
            label={isDense ? 'Dense Mode' : 'Standard Mode'}
            subtitle={isDense ? 'Orange boxes — 99% recall target' : 'Teal boxes — balanced precision'}
          />
        )
      )}

      {/* Frame galleries — both when available */}
      {hasBoth ? (
        <>
          <FramesGallery
            intervals={resultsStd.intervals}
            peakMax={resultsStd.overall_max}
            frameRefs={frameRefsStd}
            onOpenLightbox={onOpenLightbox}
            label="Standard Mode — Detection Frames"
          />
          <FramesGallery
            intervals={resultsDense.intervals}
            peakMax={resultsDense.overall_max}
            frameRefs={frameRefsDense}
            onOpenLightbox={onOpenLightbox}
            label="Dense Mode — Detection Frames"
          />
        </>
      ) : (
        <FramesGallery
          intervals={intervals}
          peakMax={overall_max}
          frameRefs={isDense ? frameRefsDense : frameRefsStd}
          onOpenLightbox={onOpenLightbox}
        />
      )}
    </section>
  );
}
