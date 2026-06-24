"use client";

/** A styled phone-lockscreen mockup of the evacuation push the on-shift safety officer
 *  receives. A presentation mockup, not a live push — it visualizes the "worker mobile-app
 *  push" dispatch channel so the alert is shown reaching a person, not just a server. */
export function PhonePush({
  zoneName,
  message,
  time = "02:14",
  date = "Mon 13 Jan",
}: {
  zoneName: string;
  message: string;
  time?: string;
  date?: string;
}) {
  return (
    <div
      className="relative w-[208px] shrink-0 rounded-[26px] p-2"
      style={{
        background: "linear-gradient(160deg, #1a140f, #0b0908)",
        border: "1px solid var(--line-2)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.4)",
      }}
    >
      {/* screen */}
      <div
        className="relative overflow-hidden rounded-[20px] px-3 pb-4 pt-2.5"
        style={{
          background:
            "radial-gradient(150px 120px at 50% 0%, rgba(255,43,78,0.16), transparent 70%), var(--bg)",
          minHeight: 320,
        }}
      >
        {/* notch */}
        <div className="mx-auto mb-2 h-1.5 w-16 rounded-full" style={{ background: "var(--line-2)" }} />

        {/* status row */}
        <div className="flex items-center justify-between font-mono text-[8px] text-ink-dim">
          <span>{time}</span>
          <span className="flex items-center gap-1">
            <span>5G</span>
            <span className="inline-block h-2 w-3 rounded-[2px]" style={{ border: "1px solid var(--text-dim)" }} />
          </span>
        </div>

        {/* lockscreen clock */}
        <div className="mb-3 mt-2 text-center">
          <div className="font-display text-[34px] font-semibold leading-none text-ink-bright">{time}</div>
          <div className="mt-0.5 font-mono text-[9px] text-ink-dim">{date}</div>
        </div>

        {/* the notification */}
        <div
          className="rise-in rounded-2xl p-3"
          style={{
            background: "color-mix(in srgb, var(--lvl-critical) 13%, rgba(20,16,12,0.9))",
            border: "1px solid color-mix(in srgb, var(--lvl-critical) 45%, transparent)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="grid h-5 w-5 place-items-center rounded-md font-display text-[11px] font-bold"
              style={{ background: "var(--brand)", color: "var(--bg)" }}
            >
              ◬
            </span>
            <span className="font-display text-[10px] font-semibold tracking-wide text-ink-bright">TRINETRA</span>
            <span className="ml-auto font-mono text-[8px] text-ink-dim">now</span>
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full soft-pulse" style={{ background: "var(--lvl-critical)" }} />
            <span className="font-display text-[12px] font-bold tracking-wide" style={{ color: "var(--lvl-critical)" }}>
              COMPOUND HAZARD
            </span>
          </div>
          <div className="mt-1 text-[11px] font-semibold leading-tight text-ink-bright">{zoneName}</div>
          <div
            className="mt-1 text-[10px] leading-snug text-ink"
            style={{ display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {message}
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            <span
              className="rounded-lg py-1 text-center font-mono text-[8.5px] uppercase tracking-wider"
              style={{ background: "var(--lvl-critical)", color: "var(--bg)" }}
            >
              Acknowledge
            </span>
            <span
              className="rounded-lg py-1 text-center font-mono text-[8.5px] uppercase tracking-wider text-ink"
              style={{ border: "1px solid var(--line-2)" }}
            >
              Call ERT
            </span>
          </div>
        </div>

        <div className="mt-2 text-center font-mono text-[7.5px] text-ink-dim">on-shift safety officer · slide to respond</div>
      </div>
    </div>
  );
}
