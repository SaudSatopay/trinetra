import { Level } from "@/lib/types";
import { levelColor, levelLabel } from "@/lib/risk";
import { Logo } from "./Logo";
import { SafetyIntelligence } from "./SafetyIntelligence";

export function TopBar({
  tMin,
  topLevel,
  compound,
  scenario,
  zone,
  shiftHandover,
  onJudgeMode,
}: {
  tMin: number;
  topLevel: Level;
  compound: boolean;
  scenario: string;
  zone?: string;
  shiftHandover?: boolean;
  onJudgeMode?: () => void;
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
        {onJudgeMode && (
          <button
            onClick={onJudgeMode}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-wider transition-colors hover:brightness-125"
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
