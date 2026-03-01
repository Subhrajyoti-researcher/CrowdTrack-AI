import FrameItem from './FrameItem';

export default function FramesGallery({ intervals, peakMax, frameRefs, onOpenLightbox, label = 'Detection Frames' }) {
  const frames = intervals.flatMap((row, idx) =>
    row.preview_image
      ? [<FrameItem key={idx} idx={idx} row={row} peakMax={peakMax} frameRefs={frameRefs} onOpenLightbox={onOpenLightbox} />]
      : []
  );
  if (!frames.length) return null;

  return (
    <div className="card frames-card" id="framesCard">
      <h3 className="section-title" style={{ marginBottom: '1rem' }}>{label}</h3>
      <div className="frames-grid" id="framesGrid">
        {frames}
      </div>
    </div>
  );
}
