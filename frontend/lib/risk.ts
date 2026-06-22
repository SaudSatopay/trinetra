import { Level } from "./types";

export const LEVELS: Level[] = ["normal", "watch", "elevated", "high", "critical"];

export const levelColor: Record<Level, string> = {
  normal: "var(--lvl-normal)",
  watch: "var(--lvl-watch)",
  elevated: "var(--lvl-elevated)",
  high: "var(--lvl-high)",
  critical: "var(--lvl-critical)",
};

export const levelLabel: Record<Level, string> = {
  normal: "NORMAL",
  watch: "WATCH",
  elevated: "ELEVATED",
  high: "HIGH",
  critical: "CRITICAL",
};

export const levelRank = (l: Level): number => LEVELS.indexOf(l);

/** Gas display order + nice labels. */
export const GAS_ORDER = ["CH4", "CO", "H2S", "O2"];
