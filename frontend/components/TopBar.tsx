import { Level } from "@/lib/types";
import { levelColor, levelLabel } from "@/lib/risk";
import { Logo } from "./Logo";

export function TopBar({
  tMin,
  topLevel,
  compound,
}: {
  tMin: number;
  topLevel: Level;
  compound: boolean;
}) {
  const color = levelColor[topLevel];
  const elevated = topLevel === "critical" || topLevel === "high" || topLevel === "elevated";

  return (
    <header className="flex items-center justify-between px-7 py-4">
      <Logo />

      <div className="flex items-center gap-7">
        <div className="text-right">
          <div className="label !text-[8px]">Mission clock</div>
          <div className="tnum mt-1 text-[14px] text-ink-bright">
            T+{String(Math.floor(tMin)).padStart(2, "0")}:00
          </div>
        </div>

        <div
          className="flex items-center gap-2.5 rounded-full px-4 py-2"
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
