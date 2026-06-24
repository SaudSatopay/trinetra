// Story mode — a narrated, captioned ~60-second walkthrough of the Vizag hero case,
// for a non-technical judge/VC. Unlike Judge mode (one click to the money shot) and Booth
// mode (an unattended multi-scenario loop), Story mode steps a single scenario through its
// arc with a caption per beat: normal -> gas rises -> still green -> escalate -> precedent
// -> response -> the alert reaches a phone.
//
// Frames are one per simulated minute (dt = 1), so a step's `t` is also its frame index.

export interface StoryStep {
  t: number; // frame minute to hold on (index == minute)
  dwellMs: number; // how long to narrate this beat
  title: string;
  caption: string;
  focus?: "precedent" | "action" | "phone"; // optional spotlight for this beat
}

// ~63s end to end.
export const STORY_STEPS: StoryStep[] = [
  {
    t: 1,
    dwellMs: 9000,
    title: "Normal operations",
    caption:
      "Coke Oven Battery #1. A welding permit and a confined-space entry are open — routine work. Every gas sensor reads green.",
  },
  {
    t: 6,
    dwellMs: 10000,
    title: "Gas begins to rise",
    caption:
      "Methane starts climbing in the battery — but stays below its alarm setpoint. A single-sensor system sees nothing wrong.",
  },
  {
    t: 10,
    dwellMs: 11000,
    title: "Three green lights, one lethal combination",
    caption:
      "Every gas sensor still reads normal — yet Trinetra escalates to CRITICAL: rising gas, an active ignition source, and people in the blast radius.",
  },
  {
    t: 10,
    dwellMs: 10000,
    title: "Seen before",
    focus: "precedent",
    caption:
      "These exact conditions match the January-2025 Visakhapatnam coke-oven explosion that killed eight people.",
  },
  {
    t: 10,
    dwellMs: 12000,
    title: "Response prepared",
    focus: "action",
    caption:
      "Trinetra stages the response — suspend the hot-work permit, evacuate, notify the safety officer — six minutes before the legacy alarm would fire.",
  },
  {
    t: 10,
    dwellMs: 11000,
    title: "The alert reaches the floor",
    focus: "phone",
    caption:
      "The on-shift safety officer gets the evacuation push on their phone — while there is still time to clear the zone.",
  },
];

export const STORY_TOTAL_MS = STORY_STEPS.reduce((a, s) => a + s.dwellMs, 0);
