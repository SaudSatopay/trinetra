"use client";

import { useEffect, useState } from "react";
import { getJSON } from "@/lib/api";

interface FeedFrame {
  persons: number;
  intruders: number;
  image_b64: string;
}
interface VisionFeed {
  available: boolean;
  frames?: FeedFrame[];
}
interface VisionSingle {
  persons: number;
  intruders: number;
  image_b64: string;
  error?: string;
}

/** Control-room CCTV tile. Plays a REAL recorded clip as a looping feed (precomputed YOLOv8 person +
 *  restricted-zone detection), and falls back to the always-available single-frame sample when the
 *  recorded feed hasn't been fetched (scripts/fetch_cctv.py). */
export function CCTVTile() {
  const [frames, setFrames] = useState<FeedFrame[] | null>(null);
  const [single, setSingle] = useState<VisionSingle | null>(null);
  const [err, setErr] = useState(false);
  const [idx, setIdx] = useState(0);
  const [clock, setClock] = useState("");

  useEffect(() => {
    let cancelled = false;
    getJSON<VisionFeed>("/api/vision/feed")
      .then((d) => {
        if (cancelled) return;
        if (d.available && d.frames && d.frames.length) {
          setFrames(d.frames);
          return;
        }
        return getJSON<VisionSingle>("/api/vision").then((s) => {
          if (cancelled) return;
          if (s.error || !s.image_b64) setErr(true);
          else setSingle(s);
        });
      })
      .catch(() => {
        if (!cancelled) setErr(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // cycle the recorded feed like a live CCTV loop (its own clock, independent of the scenario timeline)
  useEffect(() => {
    if (!frames || frames.length < 2) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % frames.length);
      setClock(new Date().toTimeString().slice(0, 8));
    }, 150);
    return () => clearInterval(t);
  }, [frames]);

  const live = !!frames;
  const cur: FeedFrame | VisionSingle | null = frames ? frames[idx] : single;

  return (
    <div className="hud-panel lift group relative flex h-full w-[300px] shrink-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3.5 pt-2.5">
        <span className="label">CCTV · YOLOv8</span>
        <span className="label !text-[8px]">{live ? "recorded sample" : "sample frame"}</span>
      </div>
      <div className="relative mt-2 flex-1 overflow-hidden">
        {cur ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${cur.image_b64}`}
              alt="CCTV person detection"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
            {/* CCTV chrome */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-2.5 pt-2 font-mono text-[8px] tracking-wider">
              <span className="flex items-center gap-1.5 rounded bg-black/45 px-1.5 py-0.5 text-ink-bright">
                {live && <span className="soft-pulse h-1.5 w-1.5 rounded-full" style={{ background: "var(--lvl-critical)" }} />}
                {live ? "REC" : "STILL"} · CAM‑01 COB‑1
              </span>
              {live && <span className="rounded bg-black/45 px-1.5 py-0.5 text-ink-dim">{clock || "··:··:··"}</span>}
            </div>
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/90 to-transparent px-3.5 pb-2.5 pt-7">
              <span className="max-h-0 overflow-hidden font-mono text-[8px] leading-none text-ink-dim opacity-0 transition-all duration-300 group-hover:max-h-5 group-hover:opacity-100">
                {live ? "recorded clip · live YOLOv8n person + restricted-zone detection" : "person + restricted-zone detection · pretrained YOLOv8n"}
              </span>
              <div className="flex items-center gap-2">
                <span className="tnum text-[15px] font-semibold text-ink-bright">{cur.persons}</span>
                <span className="label !text-[8px]">workers</span>
                {cur.intruders > 0 && (
                  <span className="ml-auto font-mono text-[9px]" style={{ color: "var(--lvl-elevated)" }}>
                    {cur.intruders} in restricted zone
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
