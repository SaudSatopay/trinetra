import { Level } from "@/lib/types";
import { levelColor, levelLabel } from "@/lib/risk";
import { AnimatedNumber } from "./AnimatedNumber";

export function RiskGauge({ score, level, size = 168 }: { score: number; level: Level; size?: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const SPAN = 0.75; // 270deg sweep
  const track = C * SPAN;
  const val = track * Math.min(1, Math.max(0, score / 100));
  const color = levelColor[level];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <g transform="rotate(135 60 60)">
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke="var(--line-2)"
            strokeWidth="9"
            strokeDasharray={`${track} ${C}`}
            strokeLinecap="round"
          />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeDasharray={`${val} ${C}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray .55s cubic-bezier(.4,0,.2,1), stroke .3s", filter: `drop-shadow(0 0 11px ${color})` }}
          />
        </g>
        {/* tick marks */}
        {Array.from({ length: 9 }).map((_, i) => {
          const a = (135 + (i * 270) / 8) * (Math.PI / 180);
          const x1 = 60 + Math.cos(a) * 44;
          const y1 = 60 + Math.sin(a) * 44;
          const x2 = 60 + Math.cos(a) * 40;
          const y2 = 60 + Math.sin(a) * 40;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--line-2)" strokeWidth="1" />;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedNumber
          value={score}
          className="tnum text-[42px] font-bold leading-none text-ink-bright"
          style={{ textShadow: `0 0 22px ${color}88` }}
        />
        <div className="mt-1 font-display text-[12px] font-bold tracking-[0.18em]" style={{ color }}>
          {levelLabel[level]}
        </div>
        <div className="label mt-0.5 !text-[8px]">risk index</div>
      </div>
    </div>
  );
}
