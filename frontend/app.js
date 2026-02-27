/* =========================================================
   CrowdTrack AI – Frontend
   ========================================================= */

const API_BASE = '';          // same origin as the page
const POLL_MS  = 1500;        // status poll interval

let selectedFile = null;
let pollTimer    = null;
let crowdChart   = null;

// ---- Element refs ----
const dropZone          = document.getElementById('dropZone');
const fileInput         = document.getElementById('fileInput');
const fileHint          = document.getElementById('fileHint');
const analyzeBtn        = document.getElementById('analyzeBtn');
const uploadSection     = document.getElementById('uploadSection');
const processingSection = document.getElementById('processingSection');
const resultsSection    = document.getElementById('resultsSection');
const progressBar       = document.getElementById('progressBar');
const progressLabel     = document.getElementById('progressLabel');
const resetBtn          = document.getElementById('resetBtn');
const framesCard            = document.getElementById('framesCard');
const framesGrid            = document.getElementById('framesGrid');
const videoCard             = document.getElementById('videoCard');
const outputVideo           = document.getElementById('outputVideo');
const videoDownloadBtn      = document.getElementById('videoDownloadBtn');
const liveStream            = document.getElementById('liveStream');
const liveStreamPlaceholder = document.getElementById('liveStreamPlaceholder');
const lightbox              = document.getElementById('lightbox');
const lightboxClose     = document.getElementById('lightboxClose');
const lightboxImg       = document.getElementById('lightboxImg');
const lightboxCaption   = document.getElementById('lightboxCaption');

// ---- Drag & drop ----
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

function setFile(file) {
  selectedFile = file;
  const mb = (file.size / (1024 * 1024)).toFixed(1);
  fileHint.textContent = `📎 ${file.name}  (${mb} MB)`;
  analyzeBtn.disabled = false;
}

// ---- Analyse button ----
analyzeBtn.addEventListener('click', startAnalysis);

async function startAnalysis() {
  if (!selectedFile) return;

  analyzeBtn.disabled = true;
  showSection('processing');
  setProgress(0);

  const formData = new FormData();
  formData.append('file', selectedFile);

  try {
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Upload failed');
    }
    const { job_id } = await res.json();
    startLiveStream(job_id);
    pollStatus(job_id);
  } catch (err) {
    alert(`Upload error: ${err.message}`);
    showSection('upload');
    analyzeBtn.disabled = false;
  }
}

// ---- Live MJPEG stream ----
function startLiveStream(jobId) {
  liveStreamPlaceholder.classList.remove('hidden');
  liveStream.classList.add('hidden');
  liveStream.onload = () => {
    liveStreamPlaceholder.classList.add('hidden');
    liveStream.classList.remove('hidden');
  };
  liveStream.src = `${API_BASE}/api/stream/${jobId}`;
}

function stopLiveStream() {
  liveStream.src = '';
  liveStream.onload = null;
  liveStream.classList.add('hidden');
  liveStreamPlaceholder.classList.remove('hidden');
}

// ---- Polling ----
function pollStatus(jobId) {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/status/${jobId}`);
      if (!res.ok) return;
      const data = await res.json();

      setProgress(data.progress || 0);

      if (data.status === 'completed') {
        clearInterval(pollTimer);
        setProgress(100);
        setTimeout(() => renderResults(data.results), 400);
      } else if (data.status === 'error') {
        clearInterval(pollTimer);
        alert(`Processing error: ${data.error}`);
        showSection('upload');
        analyzeBtn.disabled = false;
      }
    } catch (_) { /* network hiccup – retry next tick */ }
  }, POLL_MS);
}

function setProgress(pct) {
  progressBar.style.width = `${pct}%`;
  progressLabel.textContent = `${pct}%`;
}

// ---- Render results ----
function renderResults(data) {
  stopLiveStream();
  const { duration, overall_max, overall_avg, intervals, video_url, processing_time_s } = data;

  // Summary cards
  setText('statDuration',  formatDuration(duration));
  setText('statPeak',      overall_max);
  setText('statAvg',       overall_avg);
  setText('statWindows',   intervals.length);
  setText('statProcTime',  processing_time_s != null ? formatDuration(processing_time_s) : '—');

  // Chart
  buildChart(intervals);

  // Table
  buildTable(intervals, overall_max);

  // Annotated video player
  if (video_url) {
    outputVideo.src       = video_url;
    videoDownloadBtn.href = video_url;
    videoCard.classList.remove('hidden');
  } else {
    videoCard.classList.add('hidden');
  }

  // Detection frame previews
  buildFrames(intervals, overall_max);

  showSection('results');
}

function buildChart(intervals) {
  if (crowdChart) crowdChart.destroy();

  const labels  = intervals.map(i => i.label);
  const avgs    = intervals.map(i => i.avg_count);
  const maxes   = intervals.map(i => i.max_count);

  const ctx = document.getElementById('crowdChart').getContext('2d');
  crowdChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Avg Count',
          data: avgs,
          backgroundColor: 'rgba(196,97,74,0.55)',
          borderColor: 'rgba(196,97,74,0.9)',
          borderWidth: 1.5,
          borderRadius: 4,
          order: 2,
        },
        {
          label: 'Max Count',
          data: maxes,
          type: 'line',
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
    },
    options: {
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
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} people`,
          },
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
    },
  });
}

function buildTable(intervals, peakMax) {
  const tbody = document.getElementById('resultsTableBody');
  tbody.innerHTML = '';

  const thresholdHigh   = Math.ceil(peakMax * 0.7);
  const thresholdMedium = Math.ceil(peakMax * 0.35);

  intervals.forEach((row, idx) => {
    const level = crowdLevel(row.max_count, thresholdHigh, thresholdMedium);
    const hasFrame = !!row.preview_image;
    const tr = document.createElement('tr');
    tr.dataset.frameIdx = idx;
    tr.innerHTML = `
      <td style="color:var(--text-muted)">${idx + 1}</td>
      <td><strong>${row.label}</strong></td>
      <td>${row.min_count}</td>
      <td><strong>${row.avg_count}</strong></td>
      <td>${row.max_count}</td>
      <td style="color:var(--text-muted)">${row.samples}</td>
      <td><span class="level-badge level-${level.cls}">${level.label}</span></td>
      <td>${hasFrame
        ? `<button class="btn-frame" data-idx="${idx}" title="View detection frame">
             <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
               <circle cx="7.5" cy="7.5" r="3" stroke="currentColor" stroke-width="1.5"/>
               <path d="M1 7.5C1 7.5 3.5 2.5 7.5 2.5S14 7.5 14 7.5 11.5 12.5 7.5 12.5 1 7.5 1 7.5Z"
                     stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
             </svg>
           </button>`
        : '<span style="color:var(--text-muted);font-size:.75rem">—</span>'
      }</td>
    `;
    tbody.appendChild(tr);
  });

  // "View frame" button clicks
  tbody.querySelectorAll('.btn-frame').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      scrollToFrame(idx);
    });
  });
}

// ---- Detection frames gallery ----
function buildFrames(intervals, peakMax) {
  framesGrid.innerHTML = '';
  const hasAny = intervals.some(i => i.preview_image);
  framesCard.classList.toggle('hidden', !hasAny);
  if (!hasAny) return;

  const thresholdHigh   = Math.ceil(peakMax * 0.7);
  const thresholdMedium = Math.ceil(peakMax * 0.35);

  intervals.forEach((row, idx) => {
    if (!row.preview_image) return;

    const level = crowdLevel(row.max_count, thresholdHigh, thresholdMedium);
    const src   = `data:image/jpeg;base64,${row.preview_image}`;

    const div = document.createElement('div');
    div.className = 'frame-item';
    div.id = `frame-${idx}`;
    div.innerHTML = `
      <div class="frame-img-wrap">
        <img src="${src}" alt="Window ${idx + 1}" class="frame-img" loading="lazy" />
        <div class="frame-overlay">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <circle cx="13" cy="13" r="12" fill="rgba(0,0,0,.5)"/>
            <circle cx="13" cy="13" r="5" stroke="white" stroke-width="1.8"/>
            <path d="M4 13C4 13 7.5 6 13 6s9 7 9 7-3.5 7-9 7-9-7-9-7Z"
                  stroke="white" stroke-width="1.8" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
      <div class="frame-meta">
        <span class="frame-label">${row.label}</span>
        <span class="level-badge level-${level.cls}">${level.label}</span>
      </div>
      <div class="frame-stats">
        <span>Peak <strong>${row.max_count}</strong></span>
        <span class="frame-stat-sep">·</span>
        <span>Avg <strong>${row.avg_count}</strong></span>
        <span class="frame-stat-sep">·</span>
        <span>${row.samples} samples</span>
      </div>
    `;

    div.querySelector('.frame-img-wrap').addEventListener('click', () => {
      openLightbox(src, `${row.label}  ·  ${row.max_count} people (peak)`);
    });

    framesGrid.appendChild(div);
  });
}

function scrollToFrame(idx) {
  const el = document.getElementById(`frame-${idx}`);
  if (!el) return;
  framesCard.classList.remove('hidden');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('frame-highlight');
  setTimeout(() => el.classList.remove('frame-highlight'), 1800);
}

// ---- Lightbox ----
function openLightbox(src, caption) {
  lightboxImg.src     = src;
  lightboxCaption.textContent = caption;
  lightbox.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.add('hidden');
  document.body.style.overflow = '';
  lightboxImg.src = '';
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

// ---- Reset ----
resetBtn.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  fileHint.textContent = '';
  analyzeBtn.disabled = true;
  clearInterval(pollTimer);
  stopLiveStream();
  framesGrid.innerHTML = '';
  framesCard.classList.add('hidden');
  outputVideo.src = '';
  videoCard.classList.add('hidden');
  showSection('upload');
});

// ---- UI helpers ----
function showSection(name) {
  uploadSection.classList.toggle('hidden',     name !== 'upload');
  processingSection.classList.toggle('hidden', name !== 'processing');
  resultsSection.classList.toggle('hidden',    name !== 'results');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setText(id, val) {
  document.getElementById(id).textContent = val;
}

function crowdLevel(count, high, medium) {
  if (count >= high)   return { cls: 'high',   label: '🔴 High' };
  if (count >= medium) return { cls: 'medium', label: '🟡 Medium' };
  return                      { cls: 'low',    label: '🟢 Low' };
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
