import { Level } from "@/lib/types";
import { levelColor, levelLabel } from "@/lib/risk";
import { Logo } from "./Logo";

export function TopBar({
  plantName,
  tMin,
  scenarioName,
  topLevel,
  compound,
}: {
  plantName: string;
  tMin: number;
  scenarioName: string;
  topLevel: Level;
  compound: boolean;
}) {
  const color = levelColor[topLevel];
  const critical = topLevel === "critical" || topLevel === "high";
  return (
    <header className="relative flex items-stretch border-b border-line bg-panel-2/80">
      <div className="absolute inset-x-0 top-0 h-[3px] caution-stripes opacity-60" />
      <div className="flex items-center px-5 py-3">
        <Logo />
      </div>

      <div className="flex flex-1 items-center justify-center gap-8 border-x border-line px-6">
        <div className="text-center">
          <div className="label">Facility</div>
          <div className="mt-1 font-display text-[13px] tracking-wide text-ink">{plantName}</div>
        </div>
        <div className="h-8 w-px bg-line" />
        <div className="text-center">
          <div className="label">Mission Clock</div>
          <div className="mt-1 tnum text-[15px] text-ink-bright">
            T+{String(Math.floor(tMin)).padStart(2, "0")}:00
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 px-5">
        <div className="text-right">
          <div className="label">Scenario</div>
          <div className="mt-1 font-mono text-[12px] uppercase tracking-wider text-ink">
            {scenarioName}
          </div>
        </div>
        <div
          className={`flex items-center gap-2.5 border px-3.5 py-2 ${critical ? "animate-pulse-crit" : ""}`}
          style={{ borderColor: color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: color, boxShadow: `0 0 10px ${color}` }}
          />
          <span className="font-display text-[15px] font-bold tracking-[0.16em]" style={{ color }}>
            {compound ? "COMPOUND" : levelLabel[topLevel]}
          </span>
        </div>
      </div>
    </header>
  );
}
