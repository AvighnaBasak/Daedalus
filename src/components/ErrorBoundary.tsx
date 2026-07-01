import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Translates render crashes into a calm, on-brand panel instead of a white screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg p-8 text-text">
        <div className="w-[440px] rounded-[var(--r-3)] border border-border bg-surface p-6">
          <div className="flex items-center gap-2">
            <span className="text-accent">◆</span>
            <span className="mono-label !text-text-secondary">DAEDALUS</span>
          </div>
          <h1 className="mt-3 text-[16px] text-text-emphasis">Something broke in the interface</h1>
          <p className="mt-1 text-[13px] text-text-muted">
            The rest of your session is safe. Reload to recover.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-[var(--r-2)] border border-border bg-bg p-3 font-mono text-[11px] text-text-disabled">
            {error.message}
          </pre>
          <button
            onClick={() => location.reload()}
            className="mt-4 h-9 rounded-[var(--r-2)] bg-accent px-4 text-[13px] text-white hover:bg-accent-hover"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
