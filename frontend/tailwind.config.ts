import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-2": "var(--bg-2)",
        panel: "var(--panel)",
        "panel-2": "var(--panel-2)",
        line: "var(--line)",
        "line-2": "var(--line-2)",
        ink: "var(--text)",
        "ink-dim": "var(--text-dim)",
        "ink-bright": "var(--text-bright)",
        brand: "var(--brand)",
        normal: "var(--lvl-normal)",
        watch: "var(--lvl-watch)",
        elevated: "var(--lvl-elevated)",
        high: "var(--lvl-high)",
        critical: "var(--lvl-critical)",
        legacy: "var(--legacy)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "pulse-crit": { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.5" } },
        flare: {
          "0%": { transform: "scale(0.7)", opacity: "0.7" },
          "100%": { transform: "scale(2.6)", opacity: "0" },
        },
        sweep: { "0%": { transform: "translateY(-110%)" }, "100%": { transform: "translateY(110%)" } },
        blink: { "0%,49%": { opacity: "1" }, "50%,100%": { opacity: "0.25" } },
        "rise-in": {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "pulse-crit": "pulse-crit 1.1s ease-in-out infinite",
        flare: "flare 1.7s ease-out infinite",
        sweep: "sweep 7s linear infinite",
        blink: "blink 1.05s step-end infinite",
        "rise-in": "rise-in 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
