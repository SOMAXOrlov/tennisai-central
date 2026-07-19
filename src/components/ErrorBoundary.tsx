import React from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Catches render-time errors anywhere below it and shows a recoverable
 * fallback instead of a blank white screen.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface for local debugging; a real deployment would forward to Sentry etc.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            An unexpected error interrupted this page. You can try again, or head back to your dashboard.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={this.handleReset} variant="default">
            Try again
          </Button>
          <Button onClick={() => window.location.assign("/")} variant="outline">
            Go home
          </Button>
        </div>
      </div>
    );
  }
}
