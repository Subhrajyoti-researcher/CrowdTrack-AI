import { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import UploadSection from './components/UploadSection';
import ProcessingSection from './components/ProcessingSection';
import ResultsSection from './components/ResultsSection';
import Lightbox from './components/Lightbox';
import { uploadVideo, uploadVideoDense } from './api';
import useJobPoller from './hooks/useJobPoller';

export default function App() {
  const [section,  setSection]  = useState('upload');
  const [lightbox, setLightbox] = useState(null);
  const [error,    setError]    = useState(null);

  // ── Standard job ─────────────────────────────────────────────────────────
  const [selectedFileStd,     setSelectedFileStd]     = useState(null);
  const [fileHintStd,         setFileHintStd]         = useState('');
  const [jobIdStd,            setJobIdStd]            = useState(null);
  const [progressStd,         setProgressStd]         = useState(0);
  const [resultsStd,          setResultsStd]          = useState(null);
  const [partialIntervalsStd, setPartialIntervalsStd] = useState([]);
  const [errorStd,            setErrorStd]            = useState(null);

  // ── Dense job ─────────────────────────────────────────────────────────────
  const [selectedFileDense,     setSelectedFileDense]     = useState(null);
  const [fileHintDense,         setFileHintDense]         = useState('');
  const [jobIdDense,            setJobIdDense]            = useState(null);
  const [progressDense,         setProgressDense]         = useState(0);
  const [resultsDense,          setResultsDense]          = useState(null);
  const [partialIntervalsDense, setPartialIntervalsDense] = useState([]);
  const [errorDense,            setErrorDense]            = useState(null);

  // ---- File selection ----
  function handleFileStd(file) {
    setSelectedFileStd(file);
    setFileHintStd(`${file.name}  (${(file.size / 1048576).toFixed(1)} MB)`);
  }
  function handleFileDense(file) {
    setSelectedFileDense(file);
    setFileHintDense(`${file.name}  (${(file.size / 1048576).toFixed(1)} MB)`);
  }

  // ---- Start analysis (upload whichever files are selected) ----
  async function handleAnalyse() {
    if (!selectedFileStd && !selectedFileDense) return;
    setSection('processing');
    setProgressStd(0);
    setProgressDense(0);
    setResultsStd(null);
    setResultsDense(null);
    setPartialIntervalsStd([]);
    setPartialIntervalsDense([]);
    setErrorStd(null);
    setErrorDense(null);
    setError(null);

    const uploads = [];
    if (selectedFileStd) {
      const fd = new FormData();
      fd.append('file', selectedFileStd);
      uploads.push(uploadVideo(fd).then(r => setJobIdStd(r.job_id)).catch(err => setErrorStd(err.message)));
    }
    if (selectedFileDense) {
      const fd = new FormData();
      fd.append('file', selectedFileDense);
      uploads.push(uploadVideoDense(fd).then(r => setJobIdDense(r.job_id)).catch(err => setErrorDense(err.message)));
    }
    await Promise.all(uploads);
  }

  // ---- Poll jobs ----
  useJobPoller(jobIdStd, section, {
    onProgress: setProgressStd,
    onPartialIntervals: setPartialIntervalsStd,
    onComplete: setResultsStd,
    onError: setErrorStd,
  });
  useJobPoller(jobIdDense, section, {
    onProgress: setProgressDense,
    onPartialIntervals: setPartialIntervalsDense,
    onComplete: setResultsDense,
    onError: setErrorDense,
  });

  // ---- Transition to results when all active jobs finish ----
  useEffect(() => {
    if (section !== 'processing') return;

    // Guard: wait until at least one upload has resolved (success → jobId set,
    // or failure → errorStd/errorDense set). Without this guard the effect fires
    // the instant section becomes 'processing', before any fetch has returned,
    // and incorrectly concludes "no active jobs = failed".
    const anyStarted = jobIdStd !== null || jobIdDense !== null ||
                       errorStd !== null  || errorDense !== null;
    if (!anyStarted) return;

    const stdActive  = jobIdStd   !== null;
    const denseActive = jobIdDense !== null;
    const stdDone    = !stdActive   || resultsStd   !== null || errorStd   !== null;
    const denseDone  = !denseActive || resultsDense !== null || errorDense !== null;
    if (!stdDone || !denseDone) return;

    if (!resultsStd && !resultsDense) {
      setError(`Processing failed — ${errorStd || errorDense || 'unknown error'}`);
      setSection('upload');
      return;
    }
    setTimeout(() => {
      setSection('results');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 400);
  }, [resultsStd, resultsDense, errorStd, errorDense, jobIdStd, jobIdDense, section]);

  // ---- Reset ----
  function handleReset() {
    setSelectedFileStd(null);   setFileHintStd('');
    setSelectedFileDense(null); setFileHintDense('');
    setJobIdStd(null);   setProgressStd(0);   setResultsStd(null);   setPartialIntervalsStd([]);   setErrorStd(null);
    setJobIdDense(null); setProgressDense(0); setResultsDense(null); setPartialIntervalsDense([]); setErrorDense(null);
    setLightbox(null);
    setError(null);
    setSection('upload');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const analyseDisabled = !selectedFileStd && !selectedFileDense;

  return (
    <>
      <Header section={section} onHome={handleReset} />
      <main className="main">
        {error && (
          <div className="error-banner">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}

        {section === 'upload' && (
          <UploadSection
            onFileStd={handleFileStd}     fileHintStd={fileHintStd}
            onFileDense={handleFileDense} fileHintDense={fileHintDense}
            onAnalyse={handleAnalyse}
            analyseDisabled={analyseDisabled}
          />
        )}

        {section === 'processing' && (
          <ProcessingSection
            progressStd={progressStd}
            progressDense={progressDense}
            jobIdStd={jobIdStd}
            jobIdDense={jobIdDense}
            partialIntervalsStd={partialIntervalsStd}
            partialIntervalsDense={partialIntervalsDense}
            dualMode={!!(selectedFileStd && selectedFileDense)}
            onOpenLightbox={(src, caption) => setLightbox({ src, caption })}
          />
        )}

        {section === 'results' && (
          <ResultsSection
            resultsStd={resultsStd}
            resultsDense={resultsDense}
            jobIdStd={jobIdStd}
            jobIdDense={jobIdDense}
            onReset={handleReset}
            onOpenLightbox={(src, caption) => setLightbox({ src, caption })}
          />
        )}
      </main>
      <Footer />

      {lightbox && (
        <Lightbox
          src={lightbox.src}
          caption={lightbox.caption}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
