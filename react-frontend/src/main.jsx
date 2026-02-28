// build: 20260301
import { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import App from './App.jsx';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'monospace', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, margin: '2rem' }}>
          <strong>React Error:</strong> {String(this.state.error)}
          <pre style={{ marginTop: '1rem', fontSize: '.75rem', overflow: 'auto' }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
