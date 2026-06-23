// Booth / attract mode — an unattended kiosk loop for the exhibition floor.
//
// Two pieces:
//   1. BOOTH_STEPS — the auto-cycling narrative beats (detect → real incident →
//      scale → cross-zone → "it doesn't cry wolf"), each pinned to a scenario,
//      a main view, a dwell, and whether it plays the alarm cue.
//   2. boothAudio — a WebAudio emergency-wail siren + a spoken evacuation
//      announcement (Web Speech API). No audio assets, no network, works offline.
//
// Everything is wrapped so a muted / headless / unsupported environment can never
// throw — the visuals must keep running even if the host has no audio device.

import { MainView } from "./types";

export interface BoothStep {
  scenario: string; // a built-in scenario name, or "texas-city" (incident replay)
  view: MainView; // which main panel to show during this beat
  dwellMs: number; // how long to hold this beat before advancing
  audio: boolean; // play the siren + spoken evacuation when this beat goes compound
  label: string; // the caption shown under the room while this beat runs
}

// ~60 seconds end to end. The hard-negative finale is deliberately silent.
export const BOOTH_STEPS: BoothStep[] = [
  {
    scenario: "vizag",
    view: "plant",
    dwellMs: 16000,
    audio: true,
    label:
      "Visakhapatnam coke-oven — rising methane, an open hot-work permit, and a crew in the confined space below. Compound CRITICAL while every gas sensor still reads green.",
  },
  {
    scenario: "texas-city",
    view: "plant",
    dwellMs: 15000,
    audio: true,
    label:
      "BP Texas City refinery, 2005 — the U.S. CSB's own documented sequence, replayed. The compound alert fires ten minutes before the vapour-cloud ignition the inquiry recorded.",
  },
  {
    scenario: "vizag",
    view: "fleet",
    dwellMs: 9000,
    audio: false,
    label:
      "One engine, every plant — sites triaged compound-first across the fleet. Scaling out is a connector, not a rewrite.",
  },
  {
    scenario: "cross_zone",
    view: "plant",
    dwellMs: 12000,
    audio: true,
    label:
      "Cross-zone blast radius — the people at risk are working next door, not in the leaking bay. A zone-by-zone walkdown misses them; the adjacency graph does not.",
  },
  {
    scenario: "gas_no_ignition",
    view: "plant",
    dwellMs: 10000,
    audio: false,
    label:
      "A hard negative — flammable gas, but no ignition source and no personnel present. Trinetra stays silent. It does not cry wolf.",
  },
];

// The spoken announcement. Short, calm-but-urgent, the way a real PA call reads.
export const EVAC_LINE =
  "Compound hazard detected. Evacuate the area immediately. Do not operate hot work or electrical equipment.";

class BoothAudio {
  private ctx: AudioContext | null = null;
  private muted = false;
  private osc: OscillatorNode | null = null;
  private lfo: OscillatorNode | null = null;
  private speakTimer: number | null = null;

  /** Create / resume the AudioContext. MUST be called from a user gesture
   *  (the Booth toggle click) — browsers block audio until then. */
  unlock() {
    if (typeof window === "undefined") return;
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      // prime the speech-synthesis voice list while we have the gesture
      if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
    } catch {
      /* no audio device — visuals carry on */
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (m) this.stop();
  }
  isMuted() {
    return this.muted;
  }

  /** An emergency two-tone wail (~durMs), then silence. Safe to call repeatedly. */
  private siren(durMs = 2400) {
    if (this.muted || !this.ctx) return;
    try {
      this.stopOsc();
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const end = now + durMs / 1000;

      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 760;

      // an LFO sweeps the carrier up and down → the classic rising/falling wail
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 1.15; // a little over one wail per second
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 230; // ±230 Hz around 760 → ~530..990 Hz
      lfo.connect(lfoGain).connect(osc.frequency);

      // tame the sawtooth buzz so it cuts through without being shrill
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2400;
      lp.Q.value = 0.9;

      // amplitude envelope — quick attack, hold, gentle release
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.13, now + 0.08);
      gain.gain.setValueAtTime(0.13, end - 0.3);
      gain.gain.linearRampToValueAtTime(0, end);

      osc.connect(lp).connect(gain).connect(ctx.destination);
      osc.start(now);
      lfo.start(now);
      osc.stop(end);
      lfo.stop(end);
      this.osc = osc;
      this.lfo = lfo;
    } catch {
      /* ignore */
    }
  }

  /** Speak an evacuation line via the Web Speech API. Cancels anything in flight. */
  private speak(text: string, lang = "en-IN") {
    if (this.muted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      const synth = window.speechSynthesis;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = 0.96;
      u.pitch = 1;
      u.volume = 1;
      const voices = synth.getVoices();
      const base = lang.split("-")[0];
      const v =
        voices.find((x) => x.lang === lang) ||
        voices.find((x) => x.lang && x.lang.startsWith(base));
      if (v) u.voice = v;
      synth.cancel();
      synth.speak(u);
    } catch {
      /* ignore */
    }
  }

  /** The full alarm cue: siren now, spoken evacuation as the siren tails off. */
  alarm(text: string) {
    if (this.muted) return;
    this.siren(2400);
    if (this.speakTimer) window.clearTimeout(this.speakTimer);
    this.speakTimer = window.setTimeout(() => this.speak(text), 2200);
  }

  private stopOsc() {
    try {
      this.osc?.stop();
    } catch {
      /* already stopped */
    }
    try {
      this.lfo?.stop();
    } catch {
      /* already stopped */
    }
    this.osc = null;
    this.lfo = null;
  }

  /** Stop everything — the siren and any queued / in-flight speech. */
  stop() {
    if (this.speakTimer) {
      window.clearTimeout(this.speakTimer);
      this.speakTimer = null;
    }
    this.stopOsc();
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window)
        window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

// A single shared instance. The constructor touches no browser APIs, so importing
// this module is safe during SSR; every method guards window access itself.
export const boothAudio = new BoothAudio();
