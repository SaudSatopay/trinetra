"use client";

import { useEffect, useState } from "react";
import { getJSON } from "@/lib/api";

interface Vision {
  persons: number;
  intruders: number;
  image_b64: string;
}

export function CCTVTile() {
  const [v, setV] = useState<Vision | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getJSON<Vision & { error?: string }>("/api/vision")
      .then((d) => {
        if (cancelled) return;
        if (d.error || !d.image_b64) setErr(true);
        else setV(d);
      })
      .catch(() => {
        if (!cancelled) setErr(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="hud-panel lift group relative flex h-full w-[300px] shrink-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3.5 pt-2.5">
        <span className="label">CCTV · YOLOv8</span>
        <span className="label !text-[8px]">sample feed</span>
      </div>
      <div className="relative mt-2 flex-1 overflow-hidden">
        {v ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${v.image_b64}`}
              alt="CCTV person detection"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/90 to-transparent px-3.5 pb-2.5 pt-7">
              <span className="max-h-0 overflow-hidden font-mono text-[8px] leading-none text-ink-dim opacity-0 transition-all duration-300 group-hover:max-h-5 group-hover:opacity-100">
                person + restricted-zone detection · pretrained YOLOv8n
              </span>
              <div className="flex items-center gap-2">
                <span className="tnum text-[15px] font-semibold text-ink-bright">{v.persons}</span>
                <span className="label !text-[8px]">workers</span>
                {v.intruders > 0 && (
                  <span className="ml-auto font-mono text-[9px]" style={{ color: "var(--lvl-elevated)" }}>
                    {v.intruders} in restricted zone
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="label">{err ? "vision offline" : "detecting…"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
