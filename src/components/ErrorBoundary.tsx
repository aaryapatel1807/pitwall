import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

interface Props {
  children: ReactNode;
  label?: string;
}
interface State {
  hasError: boolean;
}

/** Wraps a page section so a render error shows a branded retry card. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[PitWall][error-boundary]", error, info);
    reportLovableError(error, { boundary: this.props.label ?? "page_error_boundary" });
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-md px-4 py-16">
          <div className="rounded-xl border-2 border-[#E8002D]/40 bg-[#E8002D]/5 p-8 text-center">
            <h2 className="text-lg font-extrabold uppercase tracking-tight text-[#15151E]">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm text-[#6B6B6B]">
              This section failed to load. Try again in a moment.
            </p>
            <button
              onClick={this.reset}
              className="mt-6 rounded-md bg-[#E8002D] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#CC0027]"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
