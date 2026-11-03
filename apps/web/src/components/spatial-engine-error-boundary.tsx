"use client";

import { Children, cloneElement, Component, type ErrorInfo, type ReactElement, type ReactNode } from "react";
import { resetSpatialEngine } from "@/lib/spatial-engine-client";

type State = { error: Error | null; cameraEpoch: number };
type Props = { children: ReactNode };

/**
 * Contains renderer failures to a single map viewport. The one automatic
 * recovery clears worker-held spatial data and remounts the map at its safe
 * initial center; repeat failures leave a retryable local fallback.
 */
export class SpatialEngineErrorBoundary extends Component<Props, State> {
  state: State = { error: null, cameraEpoch: 0 };
  private host: HTMLDivElement | null = null;
  private recoveryAttempts = 0;
  private recoveryTimer: number | null = null;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidMount() {
    this.host?.addEventListener("webglcontextlost", this.onContextLost, true);
    this.host?.addEventListener("webglcontextrestored", this.onContextRestored, true);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Tirkha spatial viewport failed", { error, componentStack: info.componentStack });
    if (this.recoveryAttempts > 0) return;
    this.recoveryAttempts++;
    this.recoveryTimer = window.setTimeout(() => {
      this.recoveryTimer = null;
      resetSpatialEngine();
      this.setState((current) => ({ error: null, cameraEpoch: current.cameraEpoch + 1 }));
    }, 0);
  }

  componentWillUnmount() {
    this.host?.removeEventListener("webglcontextlost", this.onContextLost, true);
    this.host?.removeEventListener("webglcontextrestored", this.onContextRestored, true);
    if (this.recoveryTimer !== null) window.clearTimeout(this.recoveryTimer);
  }

  private onContextLost = (event: Event) => {
    // WebGL restoration is browser-managed. Preventing the default loss
    // behavior opts in to restoration; it does not reload the document.
    event.preventDefault();
    this.host?.setAttribute("data-webgl-context", "lost");
    const canvas = event.target;
    if (canvas instanceof HTMLCanvasElement) {
      try {
        const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        context?.getExtension("WEBGL_lose_context")?.restoreContext();
      } catch {
        // If the browser has already discarded the context, it still owns the
        // restoration attempt and will emit webglcontextrestored when ready.
      }
    }
  };

  private onContextRestored = () => {
    this.host?.removeAttribute("data-webgl-context");
  };

  private retry = () => {
    this.recoveryAttempts = 0;
    resetSpatialEngine();
    this.setState((current) => ({ error: null, cameraEpoch: current.cameraEpoch + 1 }));
  };

  render() {
    const child = Children.only(this.props.children) as ReactElement<{ key?: string }>;
    return <div ref={(node) => { this.host = node; }} style={{ display: "contents" }}>
      {this.state.error ? <section className="grid min-h-48 place-items-center rounded-xl border border-amber-200 bg-amber-50 p-5 text-center text-slate-800" role="alert">
        <div><p className="font-semibold">The map needs to recover</p><p className="mt-1 max-w-md text-sm text-slate-600">Map data was reset. Your booking and selected location are unchanged.</p><button className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={this.retry}>Reload map view</button></div>
      </section> : cloneElement(child, { key: String(this.state.cameraEpoch) })}
    </div>;
  }
}
