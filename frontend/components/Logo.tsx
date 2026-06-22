export function Logo({ size = 34 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
        <path
          d="M24 5 L43 39 L5 39 Z"
          stroke="var(--brand)"
          strokeWidth="1.8"
          fill="rgba(45,212,191,0.05)"
          strokeLinejoin="round"
        />
        <ellipse cx="24" cy="30" rx="11.5" ry="7" stroke="var(--brand)" strokeWidth="1.5" fill="none" />
        <circle cx="24" cy="30" r="3.3" fill="var(--brand)" />
        <circle cx="24" cy="30" r="6.6" stroke="var(--brand)" strokeWidth="0.9" opacity="0.45" fill="none" />
        <line x1="24" y1="13" x2="24" y2="20" stroke="var(--brand)" strokeWidth="1.4" opacity="0.7" />
      </svg>
      <div className="leading-none">
        <div className="font-display text-[19px] font-bold tracking-[0.24em] text-ink-bright">
          TRINETRA
        </div>
        <div className="label mt-[5px]">Compound-Risk Intelligence</div>
      </div>
    </div>
  );
}
