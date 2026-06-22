"use client";

import { SimConfig } from "@/lib/api";

const GASES = ["CH4", "CO", "H2S"];

export function ScenarioEditor({
  config,
  onChange,
  compoundNow,
}: {
  config: SimConfig;
  onChange: (c: SimConfig) => void;
  compoundNow: boolean;
}) {
  const set = (patch: Partial<SimConfig>) => onChange({ ...config, ...patch });

  return (
    <div className="hud-panel flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5">
      <span className="label shrink-0">Scenario editor · COB-1</span>

      {/* gas selector */}
      <div className="flex items-center gap-1">
        <span className="mr-1 font-mono text-[9px] uppercase tracking-wider text-ink-dim">gas</span>
        {GASES.map((g) => {
          const on = config.gas === g;
          return (
            <button
              key={g}
              onClick={() => set({ gas: g })}
              className="rounded px-2 py-1 font-mono text-[10px] transition-colors"
              style={{
                color: on ? "var(--brand)" : "var(--text-dim)",
                background: on ? "color-mix(in srgb, var(--brand) 12%, transparent)" : "transparent",
              }}
            >
              {g}
            </button>
          );
        })}
      </div>

      <Toggle label="Gas leak" on={config.leak} onClick={() => set({ leak: !config.leak })} />
      <Toggle label="Ignition (hot work)" on={config.ignition} onClick={() => set({ ignition: !config.ignition })} />
      <Toggle
        label="Adjacent-zone ignition"
        on={config.adjacent}
        onClick={() => set({ adjacent: !config.adjacent })}
      />

      {/* personnel stepper */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink-dim">personnel</span>
        <Step sign="−" onClick={() => set({ workers: Math.max(0, config.workers - 1) })} />
        <span className="tnum w-3 text-center text-[12px] text-ink-bright">{config.workers}</span>
        <Step sign="+" onClick={() => set({ workers: Math.min(6, config.workers + 1) })} />
      </div>

      {/* live verdict */}
      <div className="ml-auto flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink-dim">engine</span>
        <span
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider"
          style={{
            color: compoundNow ? "var(--lvl-critical)" : "var(--brand)",
            background: compoundNow
              ? "color-mix(in srgb, var(--lvl-critical) 13%, transparent)"
              : "color-mix(in srgb, var(--brand) 11%, transparent)",
          }}
        >
          {compoundNow && (
            <span className="h-1.5 w-1.5 rounded-full soft-pulse" style={{ background: "var(--lvl-critical)" }} />
          )}
          {compoundNow ? "Compound hazard" : "No compound"}
        </span>
      </div>
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] transition-colors"
      style={{
        color: on ? "var(--text-bright)" : "var(--text-dim)",
        background: on ? "color-mix(in srgb, var(--brand) 10%, transparent)" : "transparent",
        border: `1px solid ${on ? "color-mix(in srgb, var(--brand) 32%, transparent)" : "var(--line-2)"}`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: on ? "var(--brand)" : "var(--line-2)" }}
      />
      {label}
    </button>
  );
}

function Step({ sign, onClick }: { sign: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="grid h-5 w-5 place-items-center rounded font-mono text-[12px] text-ink-dim transition-colors hover:text-ink"
      style={{ border: "1px solid var(--line-2)" }}
    >
      {sign}
    </button>
  );
}
