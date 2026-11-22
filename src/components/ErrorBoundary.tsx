import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage) as {
          error?: string;
          operationType?: string;
          path?: string;
        };
        if (parsed.error && parsed.operationType) {
          friendly = `Database access error during ${parsed.operationType} on ${
            parsed.path || 'record'
          }: ${parsed.error}`;
        }
      } catch {
        // Use raw message
      }

      return (
        <div className="min-h-screen bg-[#071422] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-8 shadow-lg">
            <div className="w-11 h-11 rounded-lg bg-red-950/70 text-red-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">
              Unable to Load Workspace Data
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              {friendly}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
