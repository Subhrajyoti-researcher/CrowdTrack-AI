import FrameItem from './FrameItem';

export default function FramesGallery({ intervals, peakMax, frameRefs, onOpenLightbox }) {
  const withFrames = intervals.filter(i => i.preview_image);
  if (!withFrames.length) return null;

  return (
    <div className="card frames-card" id="framesCard">
      <h3 className="section-title" style={{ marginBottom: '1rem' }}>Detection Frames</h3>
      <div className="frames-grid" id="framesGrid">
        {intervals.map((row, idx) =>
          row.preview_image ? (
            <FrameItem
              key={idx}
              idx={idx}
              row={row}
              peakMax={peakMax}
              frameRefs={frameRefs}
              onOpenLightbox={onOpenLightbox}
            />
          ) : null
        )}
      </div>
    </div>
  );
}
