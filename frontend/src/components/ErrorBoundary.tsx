import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Top-level error boundary so a render-time crash shows a friendly panel
 * instead of a blank white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to the console for debugging; data stays local.
    console.error("Token Tank crashed:", error, info);
  }

  handleReload = (): void => {
    this.setState({ hasError: false, message: "" });
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="boundary-fallback">
          <div className="boundary-icon">⛽💥</div>
          <h2>Something went wrong.</h2>
          <p className="muted">{this.state.message || "An unexpected error occurred."}</p>
          <button className="btn-primary" onClick={this.handleReload}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
