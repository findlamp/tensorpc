import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Component render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              border: "1px solid #d32f2f",
              borderRadius: 4,
              padding: 12,
              margin: 4,
              backgroundColor: "#fff5f5",
              fontSize: 12,
              fontFamily: "monospace",
            }}
          >
            <div style={{ fontWeight: 600, color: "#d32f2f", marginBottom: 4 }}>
              Render Error
            </div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {this.state.error?.message ?? "Unknown error"}
            </pre>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
