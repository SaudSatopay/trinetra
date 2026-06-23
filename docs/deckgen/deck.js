// Trinetra pitch deck generator (pptxgenjs). Output: ../Trinetra_Deck.pptx
const pptxgen = require("pptxgenjs");
const p = new pptxgen();
p.defineLayout({ name: "W", width: 13.333, height: 7.5 });
p.layout = "W";
p.author = "Saud Satopay";
p.title = "Trinetra";

// ---- palette ("Foundry": warm ink + molten-metal signature; matches the live UI) ----
const BG = "0b0908", PANEL = "15110d", PANEL2 = "100c09", LINE = "3b2e22",
  BRAND = "ff6a1a", RED = "ff2b4e", AMBER = "f5902b", WATCH = "efc23c", STEEL = "6b7886",
  TEXT = "c6b9a6", DIM = "7c6f5e", BRIGHT = "f7efe1", LEGACY = "5d5347";
// warm-tinted panel fills for accented cards
const PANEL_CRIT = "1f0f0b", PANEL_AMBER = "1d1206", PANEL_STEEL = "14130f";
const HEAD = "Trebuchet MS", MONO = "Consolas", BODY = "Calibri";
const W = 13.333;
const shadow = () => ({ type: "outer", color: "000000", blur: 9, offset: 3, angle: 90, opacity: 0.35 });

function S() { const s = p.addSlide(); s.background = { color: BG }; return s; }
function kicker(s, t, x = 0.7, y = 0.55) {
  s.addText(t, { x, y, w: 8, h: 0.3, fontFace: MONO, fontSize: 12, color: BRAND, charSpacing: 3, margin: 0 });
}
function title(s, t, x = 0.7, y = 0.92, w = 12, size = 34) {
  s.addText(t, { x, y, w, h: 0.9, fontFace: HEAD, fontSize: size, bold: true, color: BRIGHT, margin: 0 });
}
function panel(s, x, y, w, h, fill = PANEL, line = LINE, rad = 0.09) {
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: rad, fill: { color: fill }, line: { color: line, width: 1 } });
}
function dot(s, x, y, c, r = 0.09) { s.addShape(p.shapes.OVAL, { x, y, w: r * 2, h: r * 2, fill: { color: c }, line: { type: "none" } }); }
function mark(s, cx, cy, sc) { // triangle + eye
  const t = (a, b, c, d) => s.addShape(p.shapes.LINE, { x: a, y: b, w: c - a, h: d - b, line: { color: BRAND, width: 2 } });
  t(cx, cy - sc, cx + sc, cy + sc); t(cx + sc, cy + sc, cx - sc, cy + sc); t(cx - sc, cy + sc, cx, cy - sc);
  s.addShape(p.shapes.OVAL, { x: cx - sc * 0.42, y: cy + sc * 0.05, w: sc * 0.84, h: sc * 0.55, fill: { type: "none" }, line: { color: BRAND, width: 1.5 } });
  dot(s, cx - sc * 0.07, cy + sc * 0.22, BRAND, sc * 0.09);
}

// ============ S1 — TITLE ============
{
  const s = S();
  mark(s, 6.66, 1.95, 0.5);
  s.addText("TRINETRA", { x: 0, y: 2.4, w: W, h: 1.2, fontFace: HEAD, fontSize: 62, bold: true, color: BRIGHT, align: "center", charSpacing: 10, margin: 0 });
  s.addText("THE THIRD EYE THAT SEES THE DANGER NO SINGLE SENSOR CAN", { x: 0, y: 3.7, w: W, h: 0.4, fontFace: MONO, fontSize: 13, color: BRAND, align: "center", charSpacing: 2, margin: 0 });
  s.addText("AI compound-risk intelligence for zero-harm industrial operations", { x: 0, y: 4.15, w: W, h: 0.4, fontFace: BODY, fontSize: 16, color: DIM, align: "center", margin: 0 });
  s.addText([
    { text: "100% compound recall", options: { color: BRAND } }, { text: "    ·    ", options: { color: DIM } },
    { text: "0% false-positive", options: { color: BRAND } }, { text: "    ·    ", options: { color: DIM } },
    { text: "7.4 min mean early-warning", options: { color: BRAND } },
  ], { x: 0, y: 5.7, w: W, h: 0.4, fontFace: MONO, fontSize: 13, align: "center", bold: true, margin: 0 });
  s.addText("Saud Satopay   ·   ET AI Hackathon 2.0", { x: 0, y: 6.7, w: W, h: 0.3, fontFace: MONO, fontSize: 11, color: DIM, align: "center", margin: 0 });
}

// ============ S2 — PROBLEM ============
{
  const s = S();
  kicker(s, "THE PROBLEM");
  title(s, "Data present. Unacted upon.");
  s.addText([
    { text: "On 13 January 2025, eight workers died", options: { color: BRIGHT, bold: true, breakLine: true } },
    { text: "in a coke-oven-battery explosion at the Visakhapatnam Steel Plant.", options: { color: TEXT, breakLine: true } },
    { text: "", options: { breakLine: true } },
    { text: "The gas sensors had data. The permits were logged. SCADA was running.", options: { color: TEXT, breakLine: true } },
    { text: "No layer connected those signals in time.", options: { color: RED, bold: true } },
  ], { x: 0.7, y: 2.2, w: 6.7, h: 3, fontFace: BODY, fontSize: 18, lineSpacingMultiple: 1.25, margin: 0, valign: "top" });

  const cards = [["8", "workers killed at Vizag, Jan 2025", RED], ["3 / day", "deaths in India's registered factories (DGFASLI)", AMBER], ["0", "layers connected those signals in time", BRAND]];
  let y = 2.05;
  cards.forEach(([n, l, c]) => {
    panel(s, 7.9, y, 4.7, 1.42);
    s.addShape(p.shapes.RECTANGLE, { x: 7.9, y: y, w: 0.07, h: 1.42, fill: { color: c } });
    s.addText(n, { x: 8.2, y: y + 0.2, w: 1.85, h: 1, fontFace: HEAD, fontSize: 33, bold: true, color: c, margin: 0, valign: "middle" });
    s.addText(l, { x: 10.1, y: y + 0.2, w: 2.4, h: 1, fontFace: BODY, fontSize: 13, color: TEXT, margin: 0, valign: "middle" });
    y += 1.62;
  });
}

// ============ S3 — INSIGHT ============
{
  const s = S();
  kicker(s, "THE INSIGHT");
  title(s, "Compound risk");
  const items = [["Rising flammable gas", "still below its alarm", STEEL], ["Active hot-work permit", "an ignition source", STEEL], ["Personnel present", "inside a confined space", STEEL]];
  let x = 0.7;
  items.forEach(([t, sub, c]) => {
    panel(s, x, 2.5, 3.3, 1.7);
    dot(s, x + 0.25, 2.78, c, 0.1);
    s.addText(t, { x: x + 0.55, y: 2.7, w: 2.6, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: BRIGHT, margin: 0 });
    s.addText(sub, { x: x + 0.25, y: 3.35, w: 2.85, h: 0.7, fontFace: BODY, fontSize: 14, color: DIM, margin: 0 });
    s.addText("normal", { x: x + 0.25, y: 3.75, w: 2.85, h: 0.3, fontFace: MONO, fontSize: 10, color: STEEL, margin: 0 });
    x += 3.55;
  });
  s.addShape(p.shapes.RECTANGLE, { x: 6.5, y: 4.32, w: 0.33, h: 0.03, fill: { color: DIM } });
  panel(s, 0.7, 4.55, 11.93, 1.5, PANEL_CRIT, RED);
  s.addText("A lethal combination no single sensor flags", { x: 1.1, y: 4.75, w: 11, h: 0.5, fontFace: HEAD, fontSize: 24, bold: true, color: RED, margin: 0 });
  s.addText("Three green lights. One lethal combination — minutes before it becomes critical.", { x: 1.1, y: 5.35, w: 11, h: 0.5, fontFace: BODY, fontSize: 15, color: TEXT, margin: 0 });
}

// ============ S4 — DEMO MOMENT ============
{
  const s = S();
  kicker(s, "THE MOMENT");
  title(s, "Split reality at T + 8 min");
  // legacy
  panel(s, 0.7, 2.2, 5.0, 3.9, PANEL, LINE);
  s.addText("LEGACY SINGLE-SENSOR", { x: 1.0, y: 2.5, w: 4.4, h: 0.3, fontFace: MONO, fontSize: 12, color: DIM, charSpacing: 1, margin: 0 });
  dot(s, 1.0, 3.45, STEEL, 0.16);
  s.addText("ALL CLEAR", { x: 1.5, y: 3.25, w: 4, h: 0.6, fontFace: HEAD, fontSize: 30, bold: true, color: STEEL, margin: 0 });
  s.addText("Every gas reads below its setpoint.", { x: 1.0, y: 4.2, w: 4.4, h: 0.4, fontFace: BODY, fontSize: 15, color: TEXT, margin: 0 });
  s.addText("threshold detection only", { x: 1.0, y: 5.4, w: 4.4, h: 0.3, fontFace: MONO, fontSize: 11, color: DIM, margin: 0 });
  // center
  panel(s, 5.95, 3.25, 1.45, 1.8, PANEL2, BRAND);
  s.addText("+6", { x: 5.95, y: 3.45, w: 1.45, h: 0.8, fontFace: HEAD, fontSize: 38, bold: true, color: BRAND, align: "center", margin: 0 });
  s.addText("MIN", { x: 5.95, y: 4.25, w: 1.45, h: 0.3, fontFace: MONO, fontSize: 12, color: BRAND, align: "center", margin: 0 });
  s.addText("early", { x: 5.95, y: 4.6, w: 1.45, h: 0.3, fontFace: MONO, fontSize: 10, color: DIM, align: "center", margin: 0 });
  // trinetra
  panel(s, 7.63, 2.2, 5.0, 3.9, PANEL_CRIT, RED);
  s.addText("TRINETRA COMPOUND AI", { x: 7.93, y: 2.5, w: 4.4, h: 0.3, fontFace: MONO, fontSize: 12, color: BRAND, charSpacing: 1, margin: 0 });
  dot(s, 7.93, 3.45, RED, 0.16);
  s.addText("COMPOUND ALERT", { x: 8.43, y: 3.25, w: 4, h: 0.6, fontFace: HEAD, fontSize: 26, bold: true, color: RED, margin: 0 });
  s.addText([
    { text: "COB-1 critical · breach predicted ~36 min", options: { color: TEXT, breakLine: true } },
    { text: "rising CH4 + hot-work permit + 3 personnel", options: { color: DIM } },
  ], { x: 7.93, y: 4.2, w: 4.4, h: 0.8, fontFace: BODY, fontSize: 14, lineSpacingMultiple: 1.2, margin: 0 });
  s.addText("multi-signal fusion", { x: 7.93, y: 5.4, w: 4.4, h: 0.3, fontFace: MONO, fontSize: 11, color: DIM, margin: 0 });
  s.addText("Six minutes of warning — while every gas sensor still reads below its setpoint.", { x: 0.7, y: 6.45, w: 12, h: 0.4, fontFace: BODY, fontSize: 15, italic: true, color: DIM, margin: 0 });
}

// ============ S5 — ARCHITECTURE ============
{
  const s = S();
  kicker(s, "HOW IT WORKS");
  title(s, "One multi-modal brain");
  const pills = [
    ["Compound\nEngine", "fuses gas trend +\npermits + people", BRAND],
    ["Vision", "person & zone-intrusion\n(monitoring layer)", BRIGHT],
    ["Reasoning Graph", "LangGraph 6-stage\nauditable trace", BRIGHT],
    ["Disaster RAG", "Gemini precedent\nmatching", BRIGHT],
    ["Response", "report + multilingual\nalerts", RED],
  ];
  let x = 0.7; const w = 2.31, g = 0.18;
  pills.forEach(([t, d, c], i) => {
    panel(s, x, 2.4, w, 2.7);
    s.addShape(p.shapes.RECTANGLE, { x, y: 2.4, w, h: 0.07, fill: { color: c } });
    s.addText(t.replace(/\n/g, " "), { x: x + 0.18, y: 2.75, w: w - 0.36, h: 0.9, fontFace: HEAD, fontSize: 17, bold: true, color: BRIGHT, margin: 0, valign: "top" });
    s.addText(d.replace(/\n/g, " "), { x: x + 0.18, y: 3.75, w: w - 0.36, h: 1.1, fontFace: BODY, fontSize: 13, color: DIM, margin: 0, valign: "top" });
    x += w + g;
  });
  panel(s, 0.7, 5.5, 11.93, 1.0, PANEL2, BRAND);
  s.addText([
    { text: "Hybrid by design:  ", options: { color: BRAND, bold: true } },
    { text: "a transparent, deterministic backbone makes the life-safety decision — the LLM only explains, retrieves precedent, and drafts reports. No black box in the loop.", options: { color: TEXT } },
  ], { x: 1.0, y: 5.5, w: 11.3, h: 1.0, fontFace: BODY, fontSize: 15, valign: "middle", margin: 0 });
}

// ============ S6 — DISASTER MEMORY ============
{
  const s = S();
  kicker(s, "DIFFERENTIATOR");
  title(s, "We've seen this death before");
  panel(s, 0.7, 2.3, 4.0, 3.7, PANEL_CRIT, RED);
  s.addText("81", { x: 0.7, y: 2.85, w: 4.0, h: 1.3, fontFace: HEAD, fontSize: 96, bold: true, color: RED, align: "center", margin: 0 });
  s.addText("% MATCH", { x: 0.7, y: 4.15, w: 4.0, h: 0.4, fontFace: MONO, fontSize: 16, color: BRAND, align: "center", charSpacing: 2, margin: 0 });
  s.addText("Visakhapatnam coke-oven\nexplosion · 2025 · 8 killed".replace(/\n/g, "  "), { x: 0.9, y: 4.8, w: 3.6, h: 0.8, fontFace: BODY, fontSize: 14, color: TEXT, align: "center", margin: 0 });
  panel(s, 5.0, 2.3, 7.63, 2.55);
  s.addText("GROUNDED BRIEFING", { x: 5.3, y: 2.55, w: 7, h: 0.3, fontFace: MONO, fontSize: 11, color: DIM, charSpacing: 2, margin: 0 });
  s.addText("“The present condition echoes the Visakhapatnam coke-oven explosion — rising CH4 alongside an active ignition source mirrors the precedent's root cause of unacted-upon warnings. The single most important action is the immediate cessation of hot-work and evacuation of personnel.”", { x: 5.3, y: 3.0, w: 7.05, h: 1.7, fontFace: BODY, fontSize: 16, color: BRIGHT, italic: true, margin: 0, valign: "top" });
  // other precedents
  const others = [["73%", "Texas City refinery"], ["71%", "Hot-work ignition"], ["—", "Piper Alpha"]];
  let x = 5.0;
  others.forEach(([n, l]) => {
    panel(s, x, 5.05, 2.45, 0.95, PANEL2);
    s.addText(n, { x: x + 0.2, y: 5.2, w: 0.9, h: 0.65, fontFace: HEAD, fontSize: 22, bold: true, color: BRAND, margin: 0, valign: "middle" });
    s.addText(l, { x: x + 1.0, y: 5.2, w: 1.35, h: 0.65, fontFace: BODY, fontSize: 12, color: DIM, margin: 0, valign: "middle" });
    x += 2.59;
  });
  s.addText("Live conditions embedded with Gemini, matched against a corpus of real industrial disasters.", { x: 0.7, y: 6.3, w: 12, h: 0.4, fontFace: BODY, fontSize: 14, italic: true, color: DIM, margin: 0 });
}

// ============ PRE-MORTEM (proactive discovery) ============
{
  const s = S();
  kicker(s, "PROACTIVE, NOT REACTIVE");
  title(s, "Pre-mortem: the hazard that hasn't happened yet");
  const stats = [["228", "placements searched", BRAND], ["136", "compound hazards found", RED], ["124", "cross-zone (walkdowns miss)", AMBER], ["92", "correctly cleared", STEEL]];
  stats.forEach(([n, l, c], i) => {
    const x = 0.7 + i * 3.0;
    panel(s, x, 2.3, 2.85, 1.55);
    s.addText(n, { x: x + 0.2, y: 2.5, w: 2.45, h: 0.7, fontFace: HEAD, fontSize: 34, bold: true, color: c, margin: 0 });
    s.addText(l, { x: x + 0.2, y: 3.22, w: 2.5, h: 0.55, fontFace: BODY, fontSize: 11.5, color: DIM, valign: "top", margin: 0 });
  });
  panel(s, 0.7, 4.1, 11.93, 1.7, PANEL_CRIT, RED);
  s.addText("LARGEST-BLAST-RADIUS DISCOVERY", { x: 1.0, y: 4.3, w: 11, h: 0.3, fontFace: MONO, fontSize: 11, color: RED, charSpacing: 1, margin: 0 });
  s.addText("Rising methane in Coke Oven Battery #1, hot work in the bay, and the crew working next door in the Gas Cleaning Plant — compound CRITICAL by T+10. The blast radius spans the gas-cleaning plant, the confined sump and the maintenance bay. No single zone looks dangerous on its own.", { x: 1.0, y: 4.64, w: 11.3, h: 1.05, fontFace: BODY, fontSize: 15, color: BRIGHT, valign: "top", margin: 0 });
  s.addText("Trinetra runs its own deterministic engine as an oracle across the plant's blast-radius map — discovering the cross-zone compounds a zone-by-zone walkdown rates safe, before they occur.", { x: 0.7, y: 6.05, w: 12, h: 0.6, fontFace: BODY, fontSize: 13, italic: true, color: DIM, valign: "top", margin: 0 });
}

// ============ SHIFT-LEFT PERMIT GATE ============
{
  const s = S();
  kicker(s, "PREVENTION, NOT DETECTION");
  title(s, "Block the permit before it’s issued");
  // left — the verdict
  panel(s, 0.7, 2.2, 5.4, 4.35, PANEL_CRIT, RED);
  s.addText("PERMIT DESK · HOT-WORK REQUEST · COB-1", { x: 1.0, y: 2.45, w: 4.8, h: 0.3, fontFace: MONO, fontSize: 11, color: DIM, charSpacing: 1, margin: 0 });
  s.addText("BLOCKED", { x: 1.0, y: 2.82, w: 4.8, h: 0.9, fontFace: HEAD, fontSize: 46, bold: true, color: RED, margin: 0 });
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 1.0, y: 3.92, w: 1.55, h: 0.5, rectRadius: 0.05, fill: { color: PANEL2 }, line: { color: AMBER, width: 1 } });
  s.addText("HIGH 80", { x: 1.0, y: 3.92, w: 1.55, h: 0.5, fontFace: MONO, fontSize: 12, color: AMBER, align: "center", valign: "middle", margin: 0 });
  s.addText("→", { x: 2.55, y: 3.92, w: 0.5, h: 0.5, fontFace: HEAD, fontSize: 18, color: DIM, align: "center", valign: "middle", margin: 0 });
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 3.05, y: 3.92, w: 2.8, h: 0.5, rectRadius: 0.05, fill: { color: PANEL2 }, line: { color: RED, width: 1 } });
  s.addText("CRITICAL 100 · compound", { x: 3.05, y: 3.92, w: 2.8, h: 0.5, fontFace: MONO, fontSize: 11, color: RED, align: "center", valign: "middle", margin: 0 });
  s.addText("Issuing this hot-work permit completes the lethal compound pattern — flammable gas + ignition + personnel — minutes before any single sensor would alarm.", { x: 1.0, y: 4.6, w: 4.8, h: 1.8, fontFace: BODY, fontSize: 14.5, color: BRIGHT, valign: "top", lineSpacingMultiple: 1.2, margin: 0 });
  // right — conditions to issue safely
  panel(s, 6.4, 2.2, 6.23, 4.35);
  s.addText("CONDITIONS TO ISSUE SAFELY", { x: 6.7, y: 2.45, w: 5.6, h: 0.3, fontFace: MONO, fontSize: 11, color: BRAND, charSpacing: 1, margin: 0 });
  s.addText([
    { text: "Gas-free certificate — flammable gas below alarm and falling (OISD-STD-105)", options: { breakLine: true } },
    { text: "Force-ventilate / purge the zone and re-test the atmosphere", options: { breakLine: true } },
    { text: "No flammable release developing in this zone or any blast-radius neighbour", options: { breakLine: true } },
    { text: "No entry while an ignition source is active in the blast radius (Factory Act §36 / §37)", options: {} },
  ], { x: 6.7, y: 2.95, w: 5.65, h: 2.5, fontFace: BODY, fontSize: 14.5, color: TEXT, bullet: { code: "2192", indent: 18 }, lineSpacingMultiple: 1.35, margin: 0, valign: "top" });
  s.addText("The inverse of detection: simulate the plant WITH the proposed permit, and refuse it if issuing it would create — or add people to — a compound hazard.", { x: 6.7, y: 5.5, w: 5.65, h: 0.9, fontFace: BODY, fontSize: 12.5, italic: true, color: DIM, valign: "top", margin: 0 });
  s.addText("The Vizag hot-work permit, evaluated against that same rising atmosphere, is refused before the crew ever strikes an arc.", { x: 0.7, y: 6.75, w: 12, h: 0.4, fontFace: BODY, fontSize: 13, italic: true, color: DIM, margin: 0 });
}

// ============ S7 — RESPONSE ============
{
  const s = S();
  kicker(s, "AUTONOMOUS RESPONSE");
  title(s, "Detect → draft → alert");
  // report
  panel(s, 0.7, 2.3, 6.1, 4.4);
  s.addText("AUTO-DRAFTED INCIDENT REPORT", { x: 1.0, y: 2.55, w: 5.5, h: 0.3, fontFace: MONO, fontSize: 11, color: BRAND, charSpacing: 1, margin: 0 });
  s.addText([
    { text: "1. Summary  ·  2. Conditions Detected", options: { color: TEXT, breakLine: true } },
    { text: "3. Compound Risk Assessment", options: { color: TEXT, breakLine: true } },
    { text: "4. Immediate Actions", options: { color: TEXT, breakLine: true } },
    { text: "5. Regulatory References", options: { color: BRIGHT, bold: true, breakLine: true } },
    { text: "    Factory Act 1948 §36 / §37 / §38", options: { color: BRAND, breakLine: true } },
    { text: "    OISD-STD-105 (Work Permit System)", options: { color: BRAND, breakLine: true } },
    { text: "6. Corrective Actions", options: { color: TEXT } },
  ], { x: 1.0, y: 3.05, w: 5.5, h: 3.4, fontFace: BODY, fontSize: 15, lineSpacingMultiple: 1.3, margin: 0, valign: "top" });
  // alert + actions
  panel(s, 7.0, 2.3, 5.63, 2.05, PANEL_AMBER, AMBER);
  s.addText("EVACUATION ALERT", { x: 7.3, y: 2.5, w: 5, h: 0.3, fontFace: MONO, fontSize: 11, color: AMBER, charSpacing: 1, margin: 0 });
  s.addText("Compound hazard in COB-1. Evacuate now. Do not operate hot-work or electrical equipment.", { x: 7.3, y: 2.85, w: 5.0, h: 0.8, fontFace: BODY, fontSize: 14, color: BRIGHT, margin: 0, valign: "top" });
  ["English", "Telugu", "Hindi"].forEach((l, i) => {
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 7.3 + i * 1.35, y: 3.75, w: 1.2, h: 0.4, rectRadius: 0.05, fill: { color: PANEL2 }, line: { color: AMBER, width: 1 } });
    s.addText(l, { x: 7.3 + i * 1.35, y: 3.75, w: 1.2, h: 0.4, fontFace: MONO, fontSize: 11, color: AMBER, align: "center", valign: "middle", margin: 0 });
  });
  panel(s, 7.0, 4.55, 5.63, 2.15, PANEL2);
  s.addText("RESPONSE ACTIONS — PREPARED", { x: 7.3, y: 4.75, w: 5, h: 0.3, fontFace: MONO, fontSize: 11, color: DIM, charSpacing: 1, margin: 0 });
  s.addText([
    { text: "Suspend hot-work permit PTW-7741", options: { breakLine: true } },
    { text: "Evacuate & page response team", options: { breakLine: true } },
    { text: "Freeze sensor + CCTV evidence", options: { breakLine: true } },
    { text: "File preliminary incident report", options: {} },
  ], { x: 7.3, y: 5.15, w: 5.0, h: 1.4, fontFace: BODY, fontSize: 14, color: TEXT, bullet: { code: "2713", indent: 18 }, lineSpacingMultiple: 1.25, margin: 0 });
}

// ============ S8 — PROOF ============
{
  const s = S();
  kicker(s, "THE PROOF");
  title(s, "Measured, not claimed");
  const stats = [["100%", "compound recall", "14 / 14 hazards caught", BRAND], ["0%", "false-positive", "0 / 14 incl. inerted decoys", BRAND], ["7.4 min", "mean early-warning", "vs single-sensor baseline", AMBER]];
  let x = 0.7;
  stats.forEach(([n, l, sub, c]) => {
    panel(s, x, 2.3, 3.84, 2.2);
    s.addText(n, { x: x + 0.2, y: 2.55, w: 3.44, h: 1.0, fontFace: HEAD, fontSize: 50, bold: true, color: c, align: "center", margin: 0 });
    s.addText(l, { x: x + 0.2, y: 3.55, w: 3.44, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: BRIGHT, align: "center", margin: 0 });
    s.addText(sub, { x: x + 0.2, y: 3.95, w: 3.44, h: 0.4, fontFace: MONO, fontSize: 11, color: DIM, align: "center", margin: 0 });
    x += 4.04;
  });
  // vizag timeline
  panel(s, 0.7, 4.85, 11.93, 1.75, PANEL2);
  s.addText("VIZAG RECONSTRUCTION", { x: 1.0, y: 5.05, w: 5, h: 0.3, fontFace: MONO, fontSize: 11, color: DIM, charSpacing: 2, margin: 0 });
  s.addShape(p.shapes.LINE, { x: 1.2, y: 6.1, w: 11.0, h: 0, line: { color: LINE, width: 1.5 } });
  const tl = [[1.2, "t0", "normal", DIM], [4.4, "t8", "Trinetra: COMPOUND", BRAND], [9.6, "t14", "Legacy: gas alarm", RED]];
  tl.forEach(([px, t, l, c]) => {
    dot(s, px - 0.07, 6.03, c, 0.08);
    s.addText(t, { x: px - 0.4, y: 5.55, w: 0.8, h: 0.3, fontFace: MONO, fontSize: 12, bold: true, color: c, align: "center", margin: 0 });
    s.addText(l, { x: px - 1.0, y: 6.2, w: 2.4, h: 0.3, fontFace: BODY, fontSize: 12, color: TEXT, align: "center", margin: 0 });
  });
  s.addText("+6 min lead", { x: 5.4, y: 5.55, w: 3.0, h: 0.3, fontFace: MONO, fontSize: 12, bold: true, color: BRAND, align: "center", margin: 0 });
}

// ============ REAL-INCIDENT VALIDATION ============
{
  const s = S();
  kicker(s, "REPLAYED FROM TWO REAL INQUIRIES");
  title(s, "Would it catch a real one? Twice.");
  const cases = [
    ["BP Texas City refinery", "U.S. CSB · 2005", "+10 min", "before the documented vapour-cloud ignition (T+20). 15 killed.", "Report 2005-04-I-TX"],
    ["Indian Oil Jaipur depot", "MB Lal Committee · 2009", "+36 min", "before the documented ignition (T+48) of a long, undetected vapour build-up. 12 killed.", "MB Lal Committee report"],
  ];
  let cx = 0.7;
  cases.forEach(([name, src, lead, detail, cite]) => {
    panel(s, cx, 2.3, 5.96, 3.5, PANEL_CRIT, RED);
    s.addText(src.toUpperCase(), { x: cx + 0.35, y: 2.55, w: 5.3, h: 0.3, fontFace: MONO, fontSize: 11, color: DIM, charSpacing: 1, margin: 0 });
    s.addText(name, { x: cx + 0.35, y: 2.86, w: 5.3, h: 0.5, fontFace: HEAD, fontSize: 22, bold: true, color: BRIGHT, margin: 0 });
    s.addText(lead, { x: cx + 0.35, y: 3.5, w: 5.3, h: 0.9, fontFace: HEAD, fontSize: 52, bold: true, color: RED, margin: 0 });
    s.addText("earlier", { x: cx + 0.35, y: 4.45, w: 5.3, h: 0.3, fontFace: MONO, fontSize: 11, color: BRAND, charSpacing: 2, margin: 0 });
    s.addText(detail, { x: cx + 0.35, y: 4.82, w: 5.3, h: 0.7, fontFace: BODY, fontSize: 13, color: TEXT, valign: "top", margin: 0 });
    s.addText(cite, { x: cx + 0.35, y: 5.48, w: 5.3, h: 0.25, fontFace: MONO, fontSize: 9.5, color: DIM, margin: 0 });
    cx += 6.16;
  });
  panel(s, 0.7, 6.0, 11.93, 0.95, PANEL2, BRAND);
  s.addText([
    { text: "Same engine, reconstructed inputs.  ", options: { color: BRAND, bold: true } },
    { text: "Each inquiry's documented escalation is reconstructed into a SCADA feed and replayed through the live engine. Where the site had no gas detector (a finding in both), the documented vapour build-up is mapped to the flammable channel; the ignition and personnel are the inquiry's. In-app: connector → Texas City / Jaipur.", options: { color: TEXT } },
  ], { x: 1.0, y: 6.0, w: 11.3, h: 0.95, fontFace: BODY, fontSize: 11.5, valign: "middle", margin: 0 });
}

// ============ BUSINESS IMPACT (expected value) ============
{
  const s = S();
  kicker(s, "BUSINESS IMPACT");
  title(s, "The math a buyer underwrites");
  // left — per-incident avoided loss
  panel(s, 0.7, 2.2, 5.4, 4.2);
  s.addText("PER PREVENTED INCIDENT", { x: 1.0, y: 2.45, w: 4.8, h: 0.3, fontFace: MONO, fontSize: 11, color: DIM, charSpacing: 1, margin: 0 });
  s.addText("₹115.5 Cr", { x: 1.0, y: 2.8, w: 4.8, h: 0.95, fontFace: HEAD, fontSize: 46, bold: true, color: BRIGHT, margin: 0 });
  s.addText("avoided loss — Vizag-class event", { x: 1.0, y: 3.72, w: 4.8, h: 0.3, fontFace: BODY, fontSize: 13, color: DIM, margin: 0 });
  [["Lives protected", "₹7.5 Cr"], ["Asset damage", "₹40 Cr"], ["Downtime (21 d)", "₹63 Cr"], ["Regulatory penalty", "₹5 Cr"]].forEach(([k, v], i) => {
    const ly = 4.35 + i * 0.46;
    s.addText(k, { x: 1.0, y: ly, w: 3.2, h: 0.34, fontFace: BODY, fontSize: 13, color: TEXT, valign: "middle", margin: 0 });
    s.addText(v, { x: 4.0, y: ly, w: 1.8, h: 0.34, fontFace: MONO, fontSize: 13, color: BRAND, align: "right", valign: "middle", margin: 0 });
  });
  // right — expected-value ROI
  panel(s, 6.4, 2.2, 6.23, 2.75, PANEL2, BRAND);
  s.addText("EXPECTED ANNUAL RETURN", { x: 6.7, y: 2.42, w: 5.6, h: 0.3, fontFace: MONO, fontSize: 11, color: BRAND, charSpacing: 1, margin: 0 });
  s.addText("≈7.7×", { x: 6.7, y: 2.78, w: 1.7, h: 0.95, fontFace: HEAD, fontSize: 38, bold: true, color: BRIGHT, valign: "middle", margin: 0 });
  s.addText("expected annual return on the ₹1 Cr/plant/yr platform — even at a conservative 1-in-15-year event", { x: 8.45, y: 2.78, w: 3.95, h: 0.95, fontFace: BODY, fontSize: 13, color: TEXT, valign: "middle", margin: 0 });
  [["1-in-30 yr", "3.9×"], ["1-in-15 yr", "7.7×"], ["1-in-8 yr", "14.4×"]].forEach(([f, r], i) => {
    const sx = 6.7 + i * 2.0;
    panel(s, sx, 3.9, 1.9, 0.88, PANEL);
    s.addText(r, { x: sx, y: 4.0, w: 1.9, h: 0.45, fontFace: HEAD, fontSize: 20, bold: true, color: BRAND, align: "center", margin: 0 });
    s.addText(f, { x: sx, y: 4.46, w: 1.9, h: 0.25, fontFace: MONO, fontSize: 9.5, color: DIM, align: "center", margin: 0 });
  });
  // insurance lever
  panel(s, 6.4, 5.1, 6.23, 1.3, PANEL_STEEL, STEEL);
  s.addText("+ INSURANCE LEVER", { x: 6.7, y: 5.28, w: 5.6, h: 0.3, fontFace: MONO, fontSize: 11, color: STEEL, charSpacing: 1, margin: 0 });
  s.addText("Recurring premium reduction of ₹0.4–1.2 Cr/yr (5–15% for continuous monitoring) — it offsets the platform cost whether or not an incident ever occurs.", { x: 6.7, y: 5.58, w: 5.7, h: 0.78, fontFace: BODY, fontSize: 12.5, color: TEXT, valign: "top", margin: 0 });
  s.addText("Per-incident loss (lives + asset + downtime + penalty), every figure carries its basis, × a conservative event frequency — not a 116×-per-incident headline.", { x: 0.7, y: 6.6, w: 12, h: 0.3, fontFace: BODY, fontSize: 11, italic: true, color: DIM, margin: 0 });
}

// ============ GO TO MARKET ============
{
  const s = S();
  kicker(s, "GO TO MARKET");
  title(s, "A wedge, a buyer, a trigger");
  [
    ["Buyer", "Plant process-safety head / safety officer — owns permit-to-work and statutory compliance, carries the fatality risk.", BRAND],
    ["Wedge", "Permit-to-work intelligence — one discrete, fundable pain — then expand to full gas + permit + CCTV + shift fusion.", BRIGHT],
    ["Pricing", "~₹1 Cr / plant / yr — justified against a single downtime-day (~₹3 Cr) or one OISD / NGT penalty.", BRIGHT],
    ["Trigger", "Post-LG-Polymers / Vizag regulatory pressure — DGMS scrutiny and mandatory near-miss reporting.", AMBER],
  ].forEach(([k, v, c], i) => {
    const y = 2.3 + i * 1.04;
    panel(s, 0.7, y, 11.93, 0.92);
    s.addShape(p.shapes.RECTANGLE, { x: 0.7, y, w: 0.07, h: 0.92, fill: { color: c } });
    s.addText(k, { x: 1.0, y: y + 0.12, w: 2.0, h: 0.68, fontFace: HEAD, fontSize: 17, bold: true, color: c, valign: "middle", margin: 0 });
    s.addText(v, { x: 3.0, y: y + 0.12, w: 9.4, h: 0.68, fontFace: BODY, fontSize: 14, color: TEXT, valign: "middle", margin: 0 });
  });
  panel(s, 0.7, 6.5, 11.93, 0.7, PANEL2, BRAND);
  s.addText([
    { text: "The ask:  ", options: { color: BRAND, bold: true } },
    { text: "1–2 design partners (steel / refining) for a 90-day pilot on a live permit-to-work + gas feed.", options: { color: BRIGHT } },
  ], { x: 1.0, y: 6.5, w: 11.3, h: 0.7, fontFace: BODY, fontSize: 14, valign: "middle", margin: 0 });
}

// ============ COMPETITIVE MOAT ============
{
  const s = S();
  kicker(s, "WHY AN INCUMBENT CAN'T JUST SHIP IT");
  title(s, "The moat is the fusion, not the sensors");
  [
    ["Incumbents sell the silos", "Honeywell, Dräger, MSA, Hexagon sell gas detection, permit-to-work and CCTV as SEPARATE products. The danger lives in the seam BETWEEN them — exactly what no one owns end to end.", RED],
    ["A deterministic pattern library", "The compound rules — flammable × ignition × personnel × oxidizer × blast-radius, encoded to real OISD / Factory-Act thresholds — are domain IP, not a model cloned from a public dataset.", BRAND],
    ["A per-plant data moat", "Each plant's operator feedback tunes its own nuisance profile (the flywheel) — proprietary data that compounds per site and raises switching cost. An incumbent's fixed hardware doesn't learn.", BRAND],
    ["Audit-grade by construction", "A transparent, deterministic core a safety officer can defend in a statutory audit. A pure-LLM bolt-on can't make a life-safety call a regulator will accept.", AMBER],
  ].forEach(([k, v, c], i) => {
    const y = 2.3 + i * 1.05;
    panel(s, 0.7, y, 11.93, 0.93);
    s.addShape(p.shapes.RECTANGLE, { x: 0.7, y, w: 0.07, h: 0.93, fill: { color: c } });
    s.addText(k, { x: 1.0, y: y + 0.1, w: 3.5, h: 0.73, fontFace: HEAD, fontSize: 15.5, bold: true, color: c, valign: "middle", margin: 0 });
    s.addText(v, { x: 4.6, y: y + 0.1, w: 7.8, h: 0.73, fontFace: BODY, fontSize: 12.5, color: TEXT, valign: "middle", margin: 0 });
  });
  panel(s, 0.7, 6.55, 11.93, 0.65, PANEL2, BRAND);
  s.addText([
    { text: "The wedge:  ", options: { color: BRAND, bold: true } },
    { text: "land on permit-to-work intelligence — one fundable pain — then own the fused gas + permit + CCTV + shift layer the incumbents are structurally unable to assemble.", options: { color: BRIGHT } },
  ], { x: 1.0, y: 6.55, w: 11.3, h: 0.65, fontFace: BODY, fontSize: 12.5, valign: "middle", margin: 0 });
}

// ============ FLEET COMMAND (scalability) ============
{
  const s = S();
  kicker(s, "SCALES HORIZONTALLY");
  title(s, "One engine. Every plant.");
  const agg = [["6", "plants online", BRAND], ["7", "workers monitored", BRIGHT], ["2", "compound now", RED], ["5", "workers exposed", RED], ["+6m", "max lead", AMBER]];
  let ax = 0.7; const aw = 2.24, ag = 0.18;
  agg.forEach(([n, l, c]) => {
    panel(s, ax, 2.3, aw, 1.2);
    s.addText(n, { x: ax, y: 2.42, w: aw, h: 0.62, fontFace: HEAD, fontSize: 30, bold: true, color: c, align: "center", margin: 0 });
    s.addText(l, { x: ax, y: 3.06, w: aw, h: 0.32, fontFace: MONO, fontSize: 9.5, color: DIM, align: "center", margin: 0 });
    ax += aw + ag;
  });
  const sites = [
    ["Visakhapatnam Steel — Coke Ovens", "CRITICAL · COMPOUND", "+6m", RED, true],
    ["Paradip Refinery — Coker Unit", "HIGH · COMPOUND", "+4m", RED, true],
    ["Dahej Petrochemicals — Gas Cleaning", "HIGH · gas, no compound", "", AMBER, false],
    ["Ennore Terminal — Utilities", "WATCH · gas, no compound", "", WATCH, false],
    ["Bhilai Steel — Blast Furnace", "NORMAL · permits clear", "", STEEL, false],
    ["Haldia — Pump House", "NORMAL · transient cleared", "", STEEL, false],
  ];
  let sy = 3.58;
  sites.forEach(([name, status, lead, c, comp]) => {
    panel(s, 0.7, sy, 11.93, 0.44, comp ? PANEL_CRIT : PANEL2, comp ? RED : LINE);
    s.addShape(p.shapes.RECTANGLE, { x: 0.7, y: sy, w: 0.06, h: 0.44, fill: { color: c } });
    s.addText(name, { x: 0.95, y: sy, w: 6.3, h: 0.44, fontFace: HEAD, fontSize: 12.5, bold: true, color: BRIGHT, valign: "middle", margin: 0 });
    s.addText(status, { x: 7.3, y: sy, w: 3.9, h: 0.44, fontFace: MONO, fontSize: 10.5, color: c, valign: "middle", margin: 0 });
    if (lead) s.addText(lead + " lead", { x: 11.1, y: sy, w: 1.4, h: 0.44, fontFace: MONO, fontSize: 10.5, bold: true, color: BRAND, align: "right", valign: "middle", margin: 0 });
    sy += 0.49;
  });
  s.addText("One shared compound engine across every site — O(zones) per plant, horizontally shardable. Digital-twin sites stand in for live OPC-UA / MQTT feeds; ingesting real plant data is a connector, not a rewrite.", { x: 0.7, y: 6.75, w: 12, h: 0.5, fontFace: BODY, fontSize: 12.5, italic: true, color: DIM, valign: "top", margin: 0 });
}

// ============ ACTIVE-LEARNING FLYWHEEL ============
{
  const s = S();
  kicker(s, "IT EARNS ITS TRUST");
  title(s, "Every plant learns its own nuisance profile");
  const steps = ["Operator verdict", "Per-plant threshold", "Fewer nuisance pages", "Trust ↑ · faster action"];
  let fx = 0.7; const fw = 2.74, fg = 0.4;
  steps.forEach((t, i) => {
    panel(s, fx, 2.35, fw, 0.85, PANEL2);
    s.addText(t, { x: fx + 0.1, y: 2.35, w: fw - 0.2, h: 0.85, fontFace: HEAD, fontSize: 13.5, bold: true, color: BRIGHT, align: "center", valign: "middle", margin: 0 });
    if (i < 3) s.addText("→", { x: fx + fw, y: 2.35, w: fg, h: 0.85, fontFace: HEAD, fontSize: 18, color: BRAND, align: "center", valign: "middle", margin: 0 });
    fx += fw + fg;
  });
  // threshold bar
  panel(s, 0.7, 3.5, 11.93, 1.4);
  s.addText("NON-COMPOUND ALERT THRESHOLD · LEARNED PER PLANT", { x: 1.0, y: 3.68, w: 8, h: 0.3, fontFace: MONO, fontSize: 11, color: DIM, charSpacing: 1, margin: 0 });
  const tx = 1.0, tw = 7.0; // track represents score 40..60
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: tx, y: 4.1, w: tw, h: 0.6, rectRadius: 0.05, fill: { color: PANEL2 }, line: { color: LINE, width: 1 } });
  s.addShape(p.shapes.RECTANGLE, { x: tx, y: 4.1, w: tw * 0.3, h: 0.6, fill: { color: "2a2118" }, line: { type: "none" } }); // 40->46 auto-ack
  s.addShape(p.shapes.RECTANGLE, { x: tx + tw * 0.3 - 0.01, y: 4.1, w: 0.03, h: 0.6, fill: { color: BRAND }, line: { type: "none" } }); // marker
  s.addText("40 · auto-ack", { x: tx + 0.12, y: 4.1, w: 2.0, h: 0.6, fontFace: MONO, fontSize: 10, color: DIM, valign: "middle", margin: 0 });
  s.addText("46", { x: tx + tw * 0.3 - 0.45, y: 4.1, w: 0.9, h: 0.6, fontFace: MONO, fontSize: 13, bold: true, color: BRAND, align: "center", valign: "middle", margin: 0 });
  s.addText("pages →", { x: tx + tw - 1.3, y: 4.1, w: 1.2, h: 0.6, fontFace: MONO, fontSize: 10, color: DIM, align: "right", valign: "middle", margin: 0 });
  panel(s, 8.3, 4.1, 4.33, 0.6, PANEL_CRIT, RED);
  s.addText("≥60  HIGH / CRITICAL / COMPOUND — ALWAYS PAGES", { x: 8.3, y: 4.1, w: 4.33, h: 0.6, fontFace: MONO, fontSize: 10.5, bold: true, color: RED, align: "center", valign: "middle", margin: 0 });
  // bottom — guardrail + effect
  panel(s, 0.7, 5.1, 5.85, 1.45, PANEL2, RED);
  s.addText("RECALL GUARDRAIL", { x: 1.0, y: 5.28, w: 5.3, h: 0.3, fontFace: MONO, fontSize: 11, color: RED, charSpacing: 1, margin: 0 });
  s.addText("Compound, HIGH and CRITICAL alerts bypass the threshold entirely. Feedback can only ever damp non-compound nuisance pages — never reduce recall.", { x: 1.0, y: 5.62, w: 5.3, h: 0.85, fontFace: BODY, fontSize: 13, color: TEXT, valign: "top", margin: 0 });
  panel(s, 6.78, 5.1, 5.85, 1.45, PANEL2);
  s.addText("THE FLYWHEEL", { x: 7.08, y: 5.28, w: 5.3, h: 0.3, fontFace: MONO, fontSize: 11, color: BRAND, charSpacing: 1, margin: 0 });
  s.addText("A confirmed false alarm raises the threshold; a confirmed alert relaxes it. Each plant quietly auto-acknowledges its own routine excursions — fewer nuisance pages, faster action on the ones that matter.", { x: 7.08, y: 5.62, w: 5.3, h: 0.85, fontFace: BODY, fontSize: 13, color: TEXT, valign: "top", margin: 0 });
  s.addText("The default engine is untouched — the benchmark (100% recall / 0% false-positive) is byte-identical with or without feedback.", { x: 0.7, y: 6.7, w: 12, h: 0.4, fontFace: BODY, fontSize: 12, italic: true, color: DIM, margin: 0 });
}

// ============ S9 — SCALE ============
{
  const s = S();
  kicker(s, "SCALE & DEPLOY");
  title(s, "Sits over the sensors you already have");
  const pts = [["Standard formats", "Ingests SCADA / IoT / permit-to-work data as-is"], ["A connector, not a rewrite", "Digital twin → live plant swaps the data source, not the brain"], ["Auditable & hybrid", "Deterministic decisions a safety officer can defend in an audit"]];
  let y = 2.35;
  pts.forEach(([t, d]) => {
    panel(s, 0.7, y, 6.8, 1.25);
    dot(s, 1.0, y + 0.5, BRAND, 0.1);
    s.addText(t, { x: 1.4, y: y + 0.18, w: 5.9, h: 0.4, fontFace: HEAD, fontSize: 18, bold: true, color: BRIGHT, margin: 0 });
    s.addText(d, { x: 1.4, y: y + 0.62, w: 5.9, h: 0.5, fontFace: BODY, fontSize: 14, color: DIM, margin: 0 });
    y += 1.42;
  });
  panel(s, 7.9, 2.35, 4.73, 4.04, PANEL2, BRAND);
  s.addText("WHERE IT DEPLOYS", { x: 8.2, y: 2.6, w: 4, h: 0.3, fontFace: MONO, fontSize: 11, color: BRAND, charSpacing: 2, margin: 0 });
  [["Steel", "coke ovens, blast furnaces"], ["Refining & Petrochem", "OISD permit-to-work regimes"], ["Mining", "confined-space & gas hazards"], ["Power & Chemicals", "asset-intensive operations"]].forEach(([t, d], i) => {
    const yy = 3.1 + i * 0.82;
    s.addText(t, { x: 8.2, y: yy, w: 4.2, h: 0.35, fontFace: HEAD, fontSize: 16, bold: true, color: BRIGHT, margin: 0 });
    s.addText(d, { x: 8.2, y: yy + 0.34, w: 4.2, h: 0.35, fontFace: BODY, fontSize: 12, color: DIM, margin: 0 });
  });
}

// ============ REFERENCE ARCHITECTURE ============
{
  const s = S();
  kicker(s, "DEPLOYS OVER YOUR STACK");
  title(s, "A connector, not a rewrite");
  const stages = [
    ["Plant historian", "OPC-UA / MQTT / PI\npermits · CCTV"],
    ["Edge pre-filter", "debounce + normalise\nat the plant edge"],
    ["Compound engine", "deterministic, O(zones)\nthe safety decision"],
    ["Control-room HMI", "split-reality view +\nautonomous response"],
  ];
  const w = 2.74, g = 0.35;
  stages.forEach(([t, d], i) => {
    const x = 0.7 + i * (w + g);
    const hot = i === 2;
    panel(s, x, 2.6, w, 1.95, hot ? PANEL2 : PANEL, hot ? BRAND : LINE);
    s.addText(t, { x: x + 0.2, y: 2.82, w: w - 0.4, h: 0.5, fontFace: HEAD, fontSize: 15, bold: true, color: hot ? BRAND : BRIGHT, margin: 0 });
    s.addText(d, { x: x + 0.2, y: 3.38, w: w - 0.4, h: 1.0, fontFace: BODY, fontSize: 11.5, color: DIM, valign: "top", lineSpacingMultiple: 1.05, margin: 0 });
    if (i < 3) s.addText("→", { x: x + w, y: 2.6, w: g, h: 1.95, fontFace: HEAD, fontSize: 20, color: BRAND, align: "center", valign: "middle", margin: 0 });
  });
  // throughput
  panel(s, 0.7, 4.95, 5.9, 1.65, PANEL2, BRAND);
  s.addText("THROUGHPUT", { x: 1.0, y: 5.13, w: 5, h: 0.3, fontFace: MONO, fontSize: 11, color: BRAND, charSpacing: 2, margin: 0 });
  s.addText("~700k tags / sec", { x: 1.0, y: 5.45, w: 5.4, h: 0.5, fontFace: HEAD, fontSize: 24, bold: true, color: BRIGHT, margin: 0 });
  s.addText("measured — a 10,000-tag plant assesses in ~14 ms per 1 Hz frame, ~70x real-time on one core. O(zones), one instance per plant, no GPU in the life-safety path.", { x: 1.0, y: 5.98, w: 5.4, h: 0.6, fontFace: BODY, fontSize: 11, color: DIM, valign: "top", margin: 0 });
  // properties
  panel(s, 6.9, 4.95, 5.73, 1.65);
  [["Standard formats", "ingests SCADA / IoT / permit data as-is"],
   ["Edge or on-prem", "data never has to leave the plant"],
   ["Deterministic core", "an auditable decision a safety officer can defend"]].forEach(([t, d], i) => {
    const yy = 5.12 + i * 0.5;
    dot(s, 7.18, yy + 0.11, BRAND, 0.07);
    s.addText(t, { x: 7.45, y: yy, w: 5.0, h: 0.28, fontFace: HEAD, fontSize: 13, bold: true, color: BRIGHT, margin: 0 });
    s.addText(d, { x: 7.45, y: yy + 0.24, w: 5.0, h: 0.26, fontFace: BODY, fontSize: 10.5, color: DIM, margin: 0 });
  });
}

// ============ S10 — CLOSE ============
{
  const s = S();
  mark(s, 6.66, 1.65, 0.45);
  s.addText("Three workers a day.\nThe data already exists.".replace(/\n/g, "\n"), { x: 0, y: 2.6, w: W, h: 1.5, fontFace: HEAD, fontSize: 40, bold: true, color: BRIGHT, align: "center", lineSpacingMultiple: 1.05, margin: 0 });
  s.addText("Trinetra is the layer that acts — before, not after.", { x: 0, y: 4.5, w: W, h: 0.6, fontFace: HEAD, fontSize: 26, bold: true, color: BRAND, align: "center", margin: 0 });
  s.addText([
    { text: "100% recall", options: { color: BRAND } }, { text: "   ·   ", options: { color: DIM } },
    { text: "0% false-positive", options: { color: BRAND } }, { text: "   ·   ", options: { color: DIM } },
    { text: "7.4 min early-warning", options: { color: BRAND } },
  ], { x: 0, y: 5.7, w: W, h: 0.4, fontFace: MONO, fontSize: 14, bold: true, align: "center", margin: 0 });
  s.addText("TRINETRA   ·   Saud Satopay", { x: 0, y: 6.7, w: W, h: 0.3, fontFace: MONO, fontSize: 11, color: DIM, align: "center", charSpacing: 2, margin: 0 });
}

p.writeFile({ fileName: __dirname + "/../Trinetra_Deck.pptx" }).then(f => console.log("WROTE", f));
