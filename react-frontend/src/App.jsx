import { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import UploadSection from './components/UploadSection';
import ProcessingSection from './components/ProcessingSection';
import ResultsSection from './components/ResultsSection';
import Lightbox from './components/Lightbox';
import { uploadVideo, fetchStatus } from './api';

const POLL_MS = 1500;

export default function App() {
  const [section,      setSection]      = useState('upload');   // 'upload' | 'processing' | 'results'
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileHint,     setFileHint]     = useState('');
  const [jobId,        setJobId]        = useState(null);
  const [progress,     setProgress]     = useState(0);
  const [results,          setResults]          = useState(null);
  const [partialIntervals, setPartialIntervals] = useState([]);
  const [lightbox,         setLightbox]         = useState(null); // { src, caption } | null
  const [error,            setError]            = useState(null);

  // ---- File selection ----
  function handleFile(file) {
    setSelectedFile(file);
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    setFileHint(`${file.name}  (${mb} MB)`);
  }

  // ---- Start analysis ----
  async function handleAnalyse() {
    if (!selectedFile) return;
    setSection('processing');
    setProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const { job_id } = await uploadVideo(formData);
      setJobId(job_id);
    } catch (err) {
      setError(err.message);
      setSection('upload');
    }
  }

  // ---- Status polling ----
  useEffect(() => {
    if (!jobId || section !== 'processing') return;

    const timer = setInterval(async () => {
      try {
        const data = await fetchStatus(jobId);
        if (!data) return;

        setProgress(data.progress ?? 0);
        if (data.partial_intervals?.length) {
          setPartialIntervals(data.partial_intervals);
        }

        if (data.status === 'completed') {
          clearInterval(timer);
          setProgress(100);
          setTimeout(() => {
            setResults(data.results);
            setSection('results');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 400);
        } else if (data.status === 'error') {
          clearInterval(timer);
          setError(data.error || 'Processing failed');
          setSection('upload');
        }
      } catch (_) { /* network hiccup — retry next tick */ }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [jobId, section]);

  // ---- Reset ----
  function handleReset() {
    setSelectedFile(null);
    setFileHint('');
    setJobId(null);
    setProgress(0);
    setResults(null);
    setPartialIntervals([]);
    setLightbox(null);
    setError(null);
    setSection('upload');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

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
            onFile={handleFile}
            fileHint={fileHint}
            onAnalyse={handleAnalyse}
            analyseDisabled={!selectedFile}
          />
        )}

        {section === 'processing' && (
          <ProcessingSection
            progress={progress}
            jobId={jobId}
            partialIntervals={partialIntervals}
            onOpenLightbox={(src, caption) => setLightbox({ src, caption })}
          />
        )}

        {section === 'results' && results && (
          <ResultsSection
            results={results}
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
