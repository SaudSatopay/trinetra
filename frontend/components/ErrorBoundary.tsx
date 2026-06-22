"use client";

import { Component, ReactNode } from "react";

/**
 * Keeps one failing panel from taking down the whole control room during a live
 * demo. On a render error it shows a small, calm fallback (with a retry) instead
 * of a white screen; the rest of the room stays live. When there is no error it
 * is a pure passthrough — no extra DOM, so layout is unaffected.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; label?: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch() {
    // swallow — keeping the room up matters more than surfacing the stack here
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex h-full min-h-[160px] w-full flex-col items-center justify-center rounded-2xl p-6 text-center"
          style={{
            border: "1px solid var(--line-2)",
            background: "color-mix(in srgb, var(--lvl-critical) 5%, transparent)",
          }}
        >
          <div className="font-display text-[13px] text-critical">
            {this.props.label ?? "This panel hit an error"}
          </div>
          <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-ink-dim">
            The rest of the control room is still live. Use retry, or reload to restore it.
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-3 rounded-md px-3 py-1.5 text-[11px] transition-colors hover:brightness-125"
            style={{ color: "var(--brand)", border: "1px solid color-mix(in srgb, var(--brand) 32%, transparent)" }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
