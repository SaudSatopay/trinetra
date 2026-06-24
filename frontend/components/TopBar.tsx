import { Level } from "@/lib/types";
import { levelColor, levelLabel } from "@/lib/risk";
import { Logo } from "./Logo";
import { SafetyIntelligence } from "./SafetyIntelligence";
import { LiveIngest } from "./LiveIngest";

export function TopBar({
  tMin,
  topLevel,
  compound,
  scenario,
  zone,
  shiftHandover,
  onStory,
  storyOn,
  onJudgeMode,
  booth,
  muted,
  onBooth,
  onMute,
}: {
  tMin: number;
  topLevel: Level;
  compound: boolean;
  scenario: string;
  zone?: string;
  shiftHandover?: boolean;
  onStory?: () => void;
  storyOn?: boolean;
  onJudgeMode?: () => void;
  booth?: boolean;
  muted?: boolean;
  onBooth?: () => void;
  onMute?: () => void;
}) {
  const color = levelColor[topLevel];
  const elevated = topLevel === "critical" || topLevel === "high" || topLevel === "elevated";

  return (
    <header className="flex items-center justify-between px-5 py-3.5">
      <Logo />

      <div className="flex items-center gap-3.5">
        {shiftHandover && (
          <span
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-medium uppercase tracking-wider"
            style={{ color: "var(--lvl-watch)", background: "color-mix(in srgb, var(--lvl-watch) 12%, transparent)" }}
            title="A shift changeover is in progress — reduced supervision / permit-accountability gap"
          >
            <span className="h-1.5 w-1.5 rounded-full soft-pulse" style={{ background: "var(--lvl-watch)" }} />
            Shift handover
          </span>
        )}
        <SafetyIntelligence scenario={scenario} tMin={tMin} compound={compound} zone={zone} />
        <LiveIngest />
        {onStory && (
          <button
            onClick={onStory}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-wider tappable"
            style={
              storyOn
                ? { color: "var(--bg)", background: "var(--brand)", border: "1px solid var(--brand)" }
                : { color: "var(--brand)", border: "1px solid color-mix(in srgb, var(--brand) 32%, transparent)", background: "color-mix(in srgb, var(--brand) 8%, transparent)" }
            }
            title="Story mode — a narrated, captioned ~60-second walkthrough of the Vizag case, built for a first-time viewer"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M5 7h14 M5 12h14 M5 17h9" />
            </svg>
            Story
          </button>
        )}
        {onJudgeMode && (
          <button
            onClick={onJudgeMode}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-wider tappable"
            style={{
              color: "var(--brand)",
              border: "1px solid color-mix(in srgb, var(--brand) 32%, transparent)",
              background: "color-mix(in srgb, var(--brand) 8%, transparent)",
            }}
            title="Jump to the Vizag hero moment at 4× — one click for a clean demo"
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 5l12 7-12 7z" />
            </svg>
            Judge mode
          </button>
        )}
        {onBooth && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onBooth}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-wider tappable"
              style={
                booth
                  ? { color: "var(--bg)", background: "var(--brand)", border: "1px solid var(--brand)" }
                  : { color: "var(--lvl-normal)", border: "1px solid var(--line-2)", background: "transparent" }
              }
              title="Booth / attract mode — an unattended ~60-second loop with siren and spoken evacuation. Click to start; click again to stop."
            >
              {booth ? (
                <span className="h-1.5 w-1.5 rounded-full soft-pulse" style={{ background: "var(--bg)" }} />
              ) : (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              )}
              {booth ? "Attract" : "Booth"}
            </button>
            {booth && onMute && (
              <button
                onClick={onMute}
                className="grid h-7 w-7 place-items-center rounded-full tappable"
                style={{ color: muted ? "var(--text-dim)" : "var(--brand)", border: "1px solid var(--line-2)" }}
                title={muted ? "Audio muted — click to unmute the siren + evacuation voice" : "Audio on — click to mute"}
              >
                {muted ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5 6 9H3v6h3l5 4z" />
                    <line x1="22" y1="9" x2="16" y2="15" />
                    <line x1="16" y1="9" x2="22" y2="15" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5 6 9H3v6h3l5 4z" />
                    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  </svg>
                )}
              </button>
            )}
          </div>
        )}
        <div className="text-right">
          <div className="label !text-[8px]">Mission clock</div>
          <div className="tnum mt-1 text-[14px] text-ink-bright">
            T+{String(Math.floor(tMin)).padStart(2, "0")}:00
          </div>
        </div>

        <div
          className="flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{
            border: `1px solid ${elevated ? color : "var(--line-2)"}`,
            background: elevated ? `color-mix(in srgb, ${color} 10%, transparent)` : "transparent",
          }}
        >
          <span
            className={`h-2 w-2 rounded-full ${topLevel === "critical" ? "soft-pulse" : ""}`}
            style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          />
          <span className="font-display text-[13px] font-semibold tracking-[0.12em]" style={{ color }}>
            {compound ? "COMPOUND" : levelLabel[topLevel]}
          </span>
        </div>
      </div>
    </header>
  );
}
