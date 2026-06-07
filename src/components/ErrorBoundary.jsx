import React, { Component } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

const isChunkError = (err) => {
  const msg = (err && (err.message || String(err))) || '';
  return /dynamically imported module|Loading chunk|Failed to fetch|ChunkLoadError|importing a module script failed/i.test(msg);
};

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      const chunk = isChunkError(this.state.error);
      return (
        <div className="app-error-screen animate-fade-in">
          <div className="app-error-card card">
            <div className="app-error-icon">{chunk ? <RefreshCw size={40} strokeWidth={2} /> : <AlertTriangle size={40} strokeWidth={2} />}</div>
            <h2>{chunk ? 'A new version is available' : 'Something went wrong'}</h2>
            <p>
              {chunk
                ? 'The app was updated while you were away. Reload to get the latest version.'
                : (this.state.error?.message || 'An unexpected error occurred.')}
            </p>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
