// Trinetra pitch deck generator (pptxgenjs). Output: ../Trinetra_Deck.pptx
// Design: "Foundry" — an industrial, editorial, type-forward system. DIN display (Bahnschrift),
// humanist grotesque body (Segoe UI), engineering mono (Cascadia Mono). Bold hero numerals, hairline
// rules, generous negative space. Every number is engine-derived and matches the live system + docs.
const pptxgen = require("pptxgenjs");
const p = new pptxgen();
p.defineLayout({ name: "W", width: 13.333, height: 7.5 });
p.layout = "W";
p.author = "Saud Satopay";
p.title = "Trinetra";

// ---- palette ----------------------------------------------------------------
const BG = "0B0908", PANEL = "151009", PANEL2 = "1C140C", CARD = "120D08",
  LINE = "2A2118", LINE2 = "473726",
  BRAND = "FF6A1A", BRAND2 = "FF8A3D", RED = "FF2B4E", GREEN = "3FC77D",
  AMBER = "F5902B", STEEL = "7C8B9A", WHITE = "FBF6EC", T2 = "C6B9A6", T3 = "8A7B68";

// ---- type (all installed on Windows 10/11 + the user's PowerPoint) ----------
const DISP = "Bahnschrift SemiBold";   // hero / headlines — DIN, industrial, modern
const DISPL = "Bahnschrift Light";     // large, elegant
const SUB = "Bahnschrift";             // subheads
const BODY = "Segoe UI";               // body
const BODYL = "Segoe UI Light";        // large body
const MONO = "Cascadia Mono";          // labels / telemetry / data
const W = 13.333, H = 7.5, MX = 0.85, CW = W - 2 * MX, TOTAL = 16;

let pageNo = 0;
function S() { const s = p.addSlide(); s.background = { color: BG }; pageNo++; return s; }
function rect(s, x, y, w, h, fill, line, lw) {
  s.addShape(p.shapes.RECTANGLE, { x, y, w, h, fill: fill ? { color: fill } : { type: "none" },
    line: line ? { color: line, width: lw || 1 } : { type: "none" } });
}
function hline(s, x, y, w, color, width) { s.addShape(p.shapes.LINE, { x, y, w, h: 0, line: { color: color || LINE, width: width || 1 } }); }
function vline(s, x, y, h, color, width) { s.addShape(p.shapes.LINE, { x, y, w: 0, h, line: { color: color || LINE, width: width || 1 } }); }
function dot(s, x, y, c, r) { r = r || 0.06; s.addShape(p.shapes.OVAL, { x: x - r, y: y - r, w: r * 2, h: r * 2, fill: { color: c }, line: { type: "none" } }); }
function tx(s, t, o) { s.addText(t, Object.assign({ margin: 0, valign: "top" }, o)); }

// the brand mark: triangle + eye, drawn with non-negative line extents (valid OOXML)
function mark(s, cx, cy, sc, color) {
  color = color || BRAND;
  const seg = (a, b, c, d) => s.addShape(p.shapes.LINE, {
    x: Math.min(a, c), y: Math.min(b, d), w: Math.abs(c - a), h: Math.abs(d - b),
    flipH: (c - a) * (d - b) < 0, line: { color, width: 2.25 },
  });
  seg(cx, cy - sc, cx + sc, cy + sc); seg(cx + sc, cy + sc, cx - sc, cy + sc); seg(cx - sc, cy + sc, cx, cy - sc);
  s.addShape(p.shapes.OVAL, { x: cx - sc * 0.42, y: cy + sc * 0.06, w: sc * 0.84, h: sc * 0.52, fill: { type: "none" }, line: { color, width: 1.75 } });
  dot(s, cx, cy + sc * 0.32, color, sc * 0.085);
}

// consistent chrome: hairlines top+bottom, wordmark, page index
function chrome(s) {
  hline(s, MX, 0.52, CW, LINE, 1);
  hline(s, MX, H - 0.52, CW, LINE, 1);
  tx(s, "TRINETRA", { x: MX, y: H - 0.49, w: 3, h: 0.3, fontFace: MONO, fontSize: 8, color: T3, charSpacing: 4, valign: "middle" });
  tx(s, String(pageNo).padStart(2, "0") + " / " + TOTAL, { x: W - MX - 2, y: H - 0.49, w: 2, h: 0.3, fontFace: MONO, fontSize: 8, color: T3, align: "right", charSpacing: 1, valign: "middle" });
}
function kicker(s, t, y) {
  y = y == null ? 0.78 : y;
  rect(s, MX, y + 0.04, 0.30, 0.035, BRAND);
  tx(s, t, { x: MX + 0.44, y: y - 0.10, w: 11, h: 0.32, fontFace: MONO, fontSize: 10.5, color: BRAND, charSpacing: 3 });
}
function headline(s, t, o) {
  o = o || {};
  tx(s, t, { x: MX, y: o.y == null ? 1.06 : o.y, w: o.w || CW, h: o.h || 1.0, fontFace: o.face || DISP,
    fontSize: o.size || 33, color: o.color || WHITE, charSpacing: o.cs || 0, lineSpacingMultiple: o.ls || 1.0, align: o.align || "left" });
}
function footnote(s, t) { tx(s, t, { x: MX, y: H - 1.02, w: CW, h: 0.4, fontFace: BODY, fontSize: 11, italic: true, color: T3, lineSpacingMultiple: 1.1 }); }
// a labelled box for the architecture diagram
function dbox(s, x, y, w, h, title, lines, o) {
  o = o || {};
  rect(s, x, y, w, h, o.fill || CARD, o.line || LINE, o.lw || 1);
  if (o.topbar) rect(s, x, y, w, 0.05, o.topbar);
  tx(s, title, { x: x + 0.16, y: y + 0.15, w: w - 0.3, h: 0.32, fontFace: SUB, fontSize: o.tsize || 12.5, color: o.tcolor || WHITE });
  tx(s, lines, { x: x + 0.16, y: y + 0.56, w: w - 0.3, h: h - 0.66, fontFace: o.lface || BODY, fontSize: o.lsize || 9.5, color: o.lcolor || T2, lineSpacingMultiple: 1.22 });
}
function arrow(s, x, y, h) { tx(s, "→", { x, y, w: 0.3, h, fontFace: SUB, fontSize: 17, color: BRAND, align: "center", valign: "middle" }); }

// =====================================================================
// 01 — TITLE
// =====================================================================
{
  const s = S();
  mark(s, W / 2, 1.78, 0.52);
  tx(s, "TRINETRA", { x: 0, y: 2.55, w: W, h: 1.25, fontFace: DISP, fontSize: 82, color: WHITE, align: "center", charSpacing: 8 });
  rect(s, W / 2 - 1.1, 3.92, 2.2, 0.03, BRAND);
  tx(s, "THE THIRD EYE THAT SEES THE DANGER NO SINGLE SENSOR CAN", { x: 0, y: 4.18, w: W, h: 0.35, fontFace: MONO, fontSize: 12, color: BRAND, align: "center", charSpacing: 2 });
  tx(s, "AI compound-risk intelligence for zero-harm industrial operations", { x: 0, y: 4.66, w: W, h: 0.4, fontFace: BODYL, fontSize: 17, color: T2, align: "center" });
  tx(s, [
    { text: "100%", options: { fontFace: DISP, color: BRAND } }, { text: " compound recall", options: { fontFace: MONO, color: T2 } },
    { text: "      0%", options: { fontFace: DISP, color: BRAND } }, { text: " false-positive", options: { fontFace: MONO, color: T2 } },
    { text: "      7.4", options: { fontFace: DISP, color: BRAND } }, { text: " min mean lead", options: { fontFace: MONO, color: T2 } },
  ], { x: 0, y: 5.95, w: W, h: 0.4, fontSize: 14, align: "center" });
  tx(s, "SAUD SATOPAY   ·   ET AI HACKATHON 2026", { x: 0, y: 6.95, w: W, h: 0.3, fontFace: MONO, fontSize: 9.5, color: T3, align: "center", charSpacing: 2 });
}

// =====================================================================
// 02 — PROBLEM
// =====================================================================
{
  const s = S(); chrome(s); kicker(s, "THE PROBLEM");
  headline(s, "Data present.\nUnacted upon.", { size: 40, ls: 1.02, h: 1.8, w: 6.6 });
  tx(s, [
    { text: "On 13 January 2025, eight workers died", options: { color: WHITE, bold: true, breakLine: true } },
    { text: "in a coke-oven-battery explosion at the Visakhapatnam Steel Plant.", options: { color: T2, breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 8 } },
    { text: "The gas sensors had data. The permits were logged. SCADA was running.", options: { color: T2, breakLine: true } },
    { text: "No layer connected those signals in time.", options: { color: RED, bold: true } },
  ], { x: MX, y: 3.35, w: 6.5, h: 2.6, fontFace: BODY, fontSize: 17, lineSpacingMultiple: 1.3 });

  const items = [["8", "workers killed at Vizag · Jan 2025", RED], ["~3 / day", "deaths in India's registered factories (DGFASLI)", AMBER], ["0", "layers connected those signals in time", BRAND]];
  let y = 1.95; const bx = 7.95;
  items.forEach(([n, l, c]) => {
    hline(s, bx, y, CW - (bx - MX), LINE);
    tx(s, n, { x: bx, y: y + 0.14, w: 2.5, h: 0.95, fontFace: DISP, fontSize: 42, color: c });
    tx(s, l, { x: bx + 2.55, y: y + 0.2, w: CW - (bx - MX) - 2.55, h: 0.85, fontFace: BODY, fontSize: 12.5, color: T2, valign: "middle", lineSpacingMultiple: 1.1 });
    y += 1.52;
  });
  hline(s, bx, y, CW - (bx - MX), LINE);
}

// =====================================================================
// 03 — FIELD VALIDATION
// =====================================================================
{
  const s = S(); chrome(s); kicker(s, "VALIDATED BY THE FIELD");
  headline(s, "The pattern, in a veteran's words", { size: 31 });
  vline(s, MX + 0.02, 2.15, 2.5, BRAND, 3);
  tx(s, "“In more than 30 years in gas and heavy industry, the worst incidents were never one single failure. They were usually three or four small things lining up at the same time, each looking acceptable on its own. Most of the time, nothing actually flagged that combination before it became a serious event.”",
    { x: MX + 0.4, y: 2.18, w: CW - 0.4, h: 2.0, fontFace: DISPL, fontSize: 22, color: WHITE, lineSpacingMultiple: 1.16 });
  tx(s, "NISHAT MULLA   ·   PLANT MANAGER   ·   30+ YEARS ACROSS GAS & HEAVY INDUSTRY", { x: MX + 0.4, y: 4.32, w: CW - 0.4, h: 0.3, fontFace: MONO, fontSize: 11, color: BRAND, charSpacing: 1 });

  rect(s, MX, 4.86, CW, 1.4, PANEL, LINE);
  rect(s, MX, 4.86, 0.05, 1.4, BRAND);
  tx(s, "TRINETRA — OUR RESPONSE", { x: MX + 0.35, y: 5.04, w: 8, h: 0.3, fontFace: MONO, fontSize: 10, color: T3, charSpacing: 2 });
  tx(s, [
    { text: "Trinetra is that experience, encoded", options: { color: BRAND, bold: true } },
    { text: " — it watches every zone 24/7 and flags the combination the moment it forms, so the catch never depends on the right person paying attention at 3 a.m. We enforce safety culture consistently across every shift and handover.", options: { color: T2 } },
  ], { x: MX + 0.35, y: 5.40, w: CW - 0.7, h: 0.8, fontFace: BODY, fontSize: 13, lineSpacingMultiple: 1.18 });
  tx(s, "Independent field validation of the problem — a practitioner, in his own words.", { x: MX, y: 6.52, w: CW, h: 0.3, fontFace: BODY, fontSize: 10.5, italic: true, color: T3 });
}

// =====================================================================
// 04 — INSIGHT
// =====================================================================
{
  const s = S(); chrome(s); kicker(s, "THE INSIGHT");
  tx(s, [
    { text: "Three green lights.", options: { color: GREEN, breakLine: true } },
    { text: "One lethal combination.", options: { color: RED } },
  ], { x: MX, y: 1.4, w: CW, h: 2.0, fontFace: DISP, fontSize: 46, lineSpacingMultiple: 1.04 });

  const items = [["RISING FLAMMABLE GAS", "still below its alarm"], ["ACTIVE HOT-WORK PERMIT", "an ignition source"], ["PERSONNEL PRESENT", "inside a confined space"]];
  const cw = (CW - 0.8) / 3; let x = MX;
  items.forEach(([t, sub]) => {
    hline(s, x, 4.05, cw, LINE2);
    dot(s, x + 0.12, 4.4, STEEL, 0.07);
    tx(s, t, { x: x + 0.3, y: 4.25, w: cw - 0.3, h: 0.55, fontFace: SUB, fontSize: 14.5, color: WHITE, lineSpacingMultiple: 1.0 });
    tx(s, sub, { x: x + 0.3, y: 4.85, w: cw - 0.3, h: 0.4, fontFace: BODY, fontSize: 12.5, color: T2 });
    tx(s, "reads NORMAL", { x: x + 0.3, y: 5.25, w: cw - 0.3, h: 0.3, fontFace: MONO, fontSize: 9.5, color: STEEL, charSpacing: 1 });
    x += cw + 0.4;
  });
  rect(s, MX, 5.95, CW, 0.62, CARD, RED);
  tx(s, [
    { text: "A lethal combination no single sensor flags  ", options: { color: RED, bold: true, fontFace: SUB } },
    { text: "— detected minutes before it becomes critical.", options: { color: T2, fontFace: BODY } },
  ], { x: MX + 0.35, y: 5.95, w: CW - 0.7, h: 0.62, fontSize: 15, valign: "middle" });
}

// =====================================================================
// 05 — THE MOMENT (split reality)
// =====================================================================
{
  const s = S(); chrome(s); kicker(s, "THE MOMENT");
  headline(s, "Split reality at T + 8 min", { size: 33 });
  // legacy (cold) | center | trinetra (hot)
  tx(s, "LEGACY SINGLE-SENSOR", { x: MX, y: 2.5, w: 5, h: 0.3, fontFace: MONO, fontSize: 11, color: STEEL, charSpacing: 1 });
  dot(s, MX + 0.13, 3.55, STEEL, 0.13);
  tx(s, "ALL CLEAR", { x: MX + 0.42, y: 3.12, w: 4.6, h: 0.8, fontFace: DISP, fontSize: 38, color: STEEL });
  tx(s, "Every gas reads below its setpoint.", { x: MX, y: 4.25, w: 4.8, h: 0.4, fontFace: BODY, fontSize: 14, color: T2 });
  tx(s, "threshold detection only", { x: MX, y: 5.5, w: 4.8, h: 0.3, fontFace: MONO, fontSize: 10, color: T3 });

  vline(s, W / 2 - 0.95, 2.55, 3.5, LINE);
  tx(s, "+6", { x: W / 2 - 1.0, y: 3.0, w: 2.0, h: 1.1, fontFace: DISP, fontSize: 80, color: BRAND, align: "center" });
  tx(s, "MIN EARLY", { x: W / 2 - 1.0, y: 4.18, w: 2.0, h: 0.3, fontFace: MONO, fontSize: 11, color: BRAND, align: "center", charSpacing: 2 });
  vline(s, W / 2 + 0.95, 2.55, 3.5, LINE);

  const rx = W / 2 + 1.45;
  rect(s, rx - 0.35, 2.3, W - MX - rx + 0.35, 3.6, CARD, null);
  tx(s, "TRINETRA COMPOUND AI", { x: rx, y: 2.5, w: 5, h: 0.3, fontFace: MONO, fontSize: 11, color: BRAND, charSpacing: 1 });
  dot(s, rx + 0.13, 3.55, RED, 0.13);
  tx(s, "COMPOUND ALERT", { x: rx + 0.42, y: 3.18, w: 4.9, h: 0.7, fontFace: DISP, fontSize: 27, color: RED });
  tx(s, [
    { text: "COB-1 critical · breach predicted ~36 min", options: { color: WHITE, breakLine: true } },
    { text: "rising CH4 + hot-work permit + 3 personnel", options: { color: T2 } },
  ], { x: rx, y: 4.2, w: W - MX - rx, h: 0.8, fontFace: BODY, fontSize: 13.5, lineSpacingMultiple: 1.25 });
  tx(s, "multi-signal fusion", { x: rx, y: 5.5, w: 4.8, h: 0.3, fontFace: MONO, fontSize: 10, color: T3 });
  footnote(s, "Six minutes of warning — while every gas sensor still reads below its setpoint.");
}

// =====================================================================
// 06 — ARCHITECTURE
// =====================================================================
{
  const s = S(); chrome(s); kicker(s, "ARCHITECTURE");
  headline(s, "How it works", { size: 33 });

  // intelligence layer (top band) — LLM-assisted, explains/retrieves/drafts, never decides
  rect(s, MX, 2.12, CW, 0.74, PANEL, LINE2);
  tx(s, "INTELLIGENCE LAYER · LLM-ASSISTED", { x: MX + 0.25, y: 2.24, w: 8, h: 0.25, fontFace: MONO, fontSize: 9, color: BRAND, charSpacing: 1 });
  tx(s, "Vision (YOLOv8) · Disaster-Memory RAG (Gemini) · 6-stage reasoning graph · Compliance & permit-gate · Pre-mortem · Knowledge graph",
    { x: MX + 0.25, y: 2.49, w: CW - 0.5, h: 0.3, fontFace: BODY, fontSize: 11, color: T2 });

  // the fused pipeline — data flows left to right; the deterministic engine is the core
  const fy = 3.62, fh = 1.82;
  dbox(s, 0.85, fy, 2.02, fh, "DATA SOURCES", "Gas sensors\nPermit-to-work\nCCTV · shift logs\nSCADA / historian");
  arrow(s, 2.87, fy, fh);
  dbox(s, 3.15, fy, 1.88, fh, "INGEST", "OPC-UA · MQTT\nCSV connector\nEdge pre-filter\n→ digital twin");
  arrow(s, 5.03, fy, fh);
  dbox(s, 5.31, fy, 2.72, fh, "COMPOUND ENGINE", "gas level + trend\n+ ignition + personnel\n+ blast-radius · O2 gate\n→ verdict · lead · actions",
    { fill: PANEL2, line: BRAND, lw: 2, topbar: BRAND, tcolor: BRAND, tsize: 13.5 });
  arrow(s, 8.03, fy, fh);
  dbox(s, 8.31, fy, 1.96, fh, "RESPONSE", "Incident report\nMultilingual alert\nMulti-channel dispatch\nEvidence freeze");
  arrow(s, 10.27, fy, fh);
  dbox(s, 10.54, fy, 1.94, fh, "CONTROL ROOM", "Next.js split-reality\nHMI · plant · fleet\nFastAPI REST + WS");

  // intelligence band feeds the engine (explains its verdict)
  s.addShape(p.shapes.LINE, { x: 6.67, y: 2.86, w: 0, h: 0.76, line: { color: LINE2, width: 1, dashType: "dash" } });
  tx(s, "DETERMINISTIC · AUDITABLE · NO LLM IN THE DECISION", { x: 5.31, y: fy + fh + 0.08, w: 2.72, h: 0.25, fontFace: MONO, fontSize: 7.5, color: BRAND, align: "center", charSpacing: 0.5 });

  footnote(s, "Hybrid by design — the deterministic engine makes every life-safety call; the LLM layer only explains it, retrieves precedent, and drafts reports.");
}

// =====================================================================
// 07 — DISASTER MEMORY
// =====================================================================
{
  const s = S(); chrome(s); kicker(s, "DIFFERENTIATOR");
  headline(s, "We've seen this death before", { size: 33 });
  tx(s, "81", { x: MX, y: 2.2, w: 4.0, h: 2.0, fontFace: DISP, fontSize: 150, color: RED });
  tx(s, "% MATCH", { x: MX + 0.1, y: 4.35, w: 4.0, h: 0.4, fontFace: MONO, fontSize: 15, color: BRAND, charSpacing: 2 });
  tx(s, "Visakhapatnam coke-oven explosion · 2025 · 8 killed", { x: MX, y: 4.78, w: 4.3, h: 0.6, fontFace: BODY, fontSize: 13, color: T2, lineSpacingMultiple: 1.15 });

  vline(s, 5.7, 2.25, 2.95, LINE);
  tx(s, "GROUNDED BRIEFING", { x: 6.05, y: 2.3, w: 6.5, h: 0.3, fontFace: MONO, fontSize: 10, color: T3, charSpacing: 2 });
  tx(s, "“The present condition echoes the Visakhapatnam coke-oven explosion — rising CH4 alongside an active ignition source mirrors the precedent's root cause of unacted-upon warnings. The single most important action is the immediate cessation of hot-work and evacuation of personnel.”",
    { x: 6.05, y: 2.72, w: CW - (6.05 - MX), h: 2.1, fontFace: BODYL, fontSize: 16, color: WHITE, lineSpacingMultiple: 1.22 });
  const others = [["73%", "Texas City refinery"], ["71%", "Hot-work ignition"], ["—", "Piper Alpha"]];
  let x = 6.05;
  others.forEach(([n, l]) => {
    tx(s, n, { x, y: 5.45, w: 1.1, h: 0.5, fontFace: DISP, fontSize: 24, color: BRAND });
    tx(s, l, { x, y: 5.98, w: 2.2, h: 0.3, fontFace: MONO, fontSize: 9.5, color: T3 });
    x += 2.35;
  });
  footnote(s, "Live conditions embedded with Gemini, matched against a corpus of real industrial disasters.");
}

// =====================================================================
// 08 — PREVENTION (pre-mortem + shift-left permit gate, merged)
// =====================================================================
{
  const s = S(); chrome(s); kicker(s, "PROACTIVE — PREVENT, DON'T JUST DETECT");
  headline(s, "Find it early. Block it at the desk.", { size: 31 });

  // LEFT — pre-mortem: the engine as an oracle over the blast-radius map
  tx(s, "PRE-MORTEM · HAZARDS THAT HAVEN'T HAPPENED YET", { x: MX, y: 2.32, w: 5.6, h: 0.3, fontFace: MONO, fontSize: 9.5, color: BRAND, charSpacing: 1 });
  const pm = [["228", "placements searched", T2], ["136", "compound hazards found", RED], ["124", "cross-zone · walkdowns miss", AMBER], ["92", "correctly cleared", STEEL]];
  const pcw = 2.75;
  pm.forEach(([n, l, c], i) => {
    const cx = MX + (i % 2) * pcw, cy = 2.78 + Math.floor(i / 2) * 1.16;
    tx(s, n, { x: cx, y: cy, w: pcw - 0.2, h: 0.7, fontFace: DISP, fontSize: 38, color: c });
    tx(s, l, { x: cx, y: cy + 0.7, w: pcw - 0.15, h: 0.4, fontFace: BODY, fontSize: 11, color: T2, lineSpacingMultiple: 1.05 });
  });
  tx(s, "The engine runs as an oracle across the plant's blast-radius map — surfacing the cross-zone compounds a zone-by-zone walkdown rates safe, before they occur.",
    { x: MX, y: 5.35, w: 5.5, h: 1.0, fontFace: BODY, fontSize: 12.5, color: T2, lineSpacingMultiple: 1.18 });

  // RIGHT — shift-left permit gate: refuse the permit that would complete the pattern
  vline(s, 6.75, 2.3, 3.95, LINE);
  const rx = 7.1;
  tx(s, "SHIFT-LEFT PERMIT GATE · HOT-WORK · COB-1", { x: rx, y: 2.32, w: 5.4, h: 0.3, fontFace: MONO, fontSize: 9.5, color: BRAND, charSpacing: 1 });
  tx(s, "BLOCKED", { x: rx - 0.03, y: 2.7, w: 5.4, h: 1.0, fontFace: DISP, fontSize: 58, color: RED });
  rect(s, rx, 3.92, 1.4, 0.5, CARD, AMBER); tx(s, "HIGH 80", { x: rx, y: 3.92, w: 1.4, h: 0.5, fontFace: MONO, fontSize: 11, color: AMBER, align: "center", valign: "middle" });
  tx(s, "→", { x: rx + 1.45, y: 3.92, w: 0.45, h: 0.5, fontFace: SUB, fontSize: 17, color: T3, align: "center", valign: "middle" });
  rect(s, rx + 1.95, 3.92, 2.95, 0.5, CARD, RED); tx(s, "CRITICAL 100 · compound", { x: rx + 1.95, y: 3.92, w: 2.95, h: 0.5, fontFace: MONO, fontSize: 10.5, color: RED, align: "center", valign: "middle" });
  tx(s, "Simulate the plant WITH the proposed permit; refuse it if issuing it would create — or add people to — a compound hazard. The Vizag hot-work permit, against that atmosphere → BLOCKED.",
    { x: rx, y: 4.72, w: 5.45, h: 1.5, fontFace: BODY, fontSize: 12.5, color: WHITE, lineSpacingMultiple: 1.2 });

  footnote(s, "Two ways to act before the alarm — discover the compound that hasn't formed yet, and refuse the permit that would complete it.");
}

// =====================================================================
// 10 — RESPONSE
// =====================================================================
{
  const s = S(); chrome(s); kicker(s, "AUTONOMOUS RESPONSE");
  headline(s, "Detect → draft → alert", { size: 33 });
  tx(s, "AUTO-DRAFTED INCIDENT REPORT", { x: MX, y: 2.5, w: 6, h: 0.3, fontFace: MONO, fontSize: 10, color: BRAND, charSpacing: 1 });
  tx(s, [
    { text: "1   Summary", options: { color: T2, breakLine: true } },
    { text: "2   Conditions Detected", options: { color: T2, breakLine: true } },
    { text: "3   Compound Risk Assessment", options: { color: T2, breakLine: true } },
    { text: "4   Immediate Actions", options: { color: T2, breakLine: true } },
    { text: "5   Regulatory References", options: { color: WHITE, bold: true, breakLine: true } },
    { text: "      Factory Act 1948 §36 / §37 / §38", options: { color: BRAND, breakLine: true, fontFace: MONO, fontSize: 12 } },
    { text: "      OISD-STD-105 (Work Permit System)", options: { color: BRAND, breakLine: true, fontFace: MONO, fontSize: 12 } },
    { text: "6   Corrective Actions", options: { color: T2 } },
  ], { x: MX, y: 2.95, w: 5.6, h: 3.4, fontFace: SUB, fontSize: 15.5, lineSpacingMultiple: 1.42 });

  vline(s, 6.9, 2.4, 3.95, LINE);
  tx(s, "EVACUATION ALERT", { x: 7.25, y: 2.5, w: 5, h: 0.3, fontFace: MONO, fontSize: 10, color: AMBER, charSpacing: 1 });
  tx(s, "Compound hazard in COB-1. Evacuate now. Do not operate hot-work or electrical equipment.", { x: 7.25, y: 2.85, w: CW - (7.25 - MX), h: 0.8, fontFace: BODY, fontSize: 14, color: WHITE, lineSpacingMultiple: 1.2 });
  ["ENGLISH", "TELUGU", "HINDI"].forEach((l, i) => {
    rect(s, 7.25 + i * 1.55, 3.75, 1.4, 0.42, CARD, AMBER);
    tx(s, l, { x: 7.25 + i * 1.55, y: 3.75, w: 1.4, h: 0.42, fontFace: MONO, fontSize: 10, color: AMBER, align: "center", valign: "middle", charSpacing: 1 });
  });
  tx(s, "RESPONSE ACTIONS — PREPARED", { x: 7.25, y: 4.55, w: 5, h: 0.3, fontFace: MONO, fontSize: 10, color: T3, charSpacing: 1 });
  tx(s, [
    { text: "Suspend hot-work permit PTW-7741", options: { breakLine: true } },
    { text: "Evacuate & page response team", options: { breakLine: true } },
    { text: "Freeze sensor + CCTV evidence", options: { breakLine: true } },
    { text: "File preliminary incident report", options: {} },
  ], { x: 7.25, y: 4.95, w: CW - (7.25 - MX), h: 1.3, fontFace: BODY, fontSize: 13.5, color: T2, bullet: { code: "2713", indent: 16 }, lineSpacingMultiple: 1.3 });
}

// =====================================================================
// 11 — PROOF
// =====================================================================
{
  const s = S(); chrome(s); kicker(s, "THE PROOF");
  headline(s, "Measured, not claimed", { size: 33 });
  const stats = [["100%", "compound recall", "14 / 14 hazards caught", BRAND], ["0%", "false-positive", "0 / 15 incl. inerted + O2 decoys", BRAND], ["7.4", "min mean lead", "median 6 · max 12 · vs baseline", AMBER]];
  const cw = CW / 3; let x = MX;
  stats.forEach(([n, l, sub, c]) => {
    tx(s, n, { x, y: 2.35, w: cw - 0.3, h: 1.15, fontFace: DISP, fontSize: 70, color: c });
    tx(s, l, { x, y: 3.62, w: cw - 0.3, h: 0.35, fontFace: SUB, fontSize: 16, color: WHITE });
    tx(s, sub, { x, y: 4.02, w: cw - 0.3, h: 0.4, fontFace: MONO, fontSize: 10, color: T3 });
    x += cw;
  });
  // vizag timeline
  hline(s, MX, 5.2, CW, LINE2);
  tx(s, "VIZAG RECONSTRUCTION", { x: MX, y: 4.7, w: 5, h: 0.3, fontFace: MONO, fontSize: 10, color: T3, charSpacing: 2 });
  const tl = [[MX + 0.1, "t0", "normal", STEEL], [MX + 3.6, "t8", "TRINETRA: COMPOUND", BRAND], [MX + 8.5, "t14", "LEGACY: gas alarm", RED]];
  tl.forEach(([px, t, l, c]) => {
    dot(s, px, 5.2, c, 0.075);
    tx(s, t, { x: px - 0.4, y: 5.34, w: 1.4, h: 0.3, fontFace: MONO, fontSize: 12, color: c, bold: true });
    tx(s, l, { x: px - 0.4, y: 5.62, w: 3.0, h: 0.3, fontFace: BODY, fontSize: 11.5, color: T2 });
  });
  tx(s, "+6 MIN LEAD", { x: MX + 4.4, y: 4.78, w: 3.6, h: 0.35, fontFace: DISP, fontSize: 16, color: BRAND, charSpacing: 1 });
  footnote(s, "Deterministic (seed=42) · held-out: 100% recall / 3.3% FP over 240 unseen-seed scenarios · property-tested.");
}

// =====================================================================
// 12 — REAL-INCIDENT VALIDATION
// =====================================================================
{
  const s = S(); chrome(s); kicker(s, "REPLAYED FROM TWO REAL INQUIRIES");
  headline(s, "Would it catch a real one? Twice.", { size: 31 });
  const cases = [
    ["BP TEXAS CITY REFINERY", "U.S. CSB · 2005 · Report 2005-04-I-TX", "+10", "min before the documented vapour-cloud ignition (T+20). 15 killed."],
    ["INDIAN OIL JAIPUR DEPOT", "MB Lal Committee · 2009", "+36", "min before the documented ignition (T+48) of a long, undetected vapour build-up. 12 killed."],
  ];
  let x = MX; const cw = (CW - 0.6) / 2;
  cases.forEach(([name, src, lead, detail]) => {
    hline(s, x, 2.35, cw, LINE2);
    tx(s, src, { x, y: 2.5, w: cw, h: 0.3, fontFace: MONO, fontSize: 10, color: T3 });
    tx(s, name, { x, y: 2.82, w: cw, h: 0.5, fontFace: SUB, fontSize: 19, color: WHITE });
    tx(s, [{ text: lead, options: { fontFace: DISP, fontSize: 72, color: RED } }, { text: "  earlier", options: { fontFace: MONO, fontSize: 13, color: BRAND } }],
      { x, y: 3.45, w: cw, h: 1.1, valign: "bottom" });
    tx(s, detail, { x, y: 4.7, w: cw - 0.2, h: 0.9, fontFace: BODY, fontSize: 13, color: T2, lineSpacingMultiple: 1.2 });
    x += cw + 0.6;
  });
  rect(s, MX, 5.95, CW, 0.65, PANEL, LINE);
  tx(s, [
    { text: "Same engine, reconstructed inputs.  ", options: { color: BRAND, bold: true, fontFace: SUB } },
    { text: "Each inquiry's documented escalation is replayed through the live engine; where a site had no gas detector (a finding in both), the vapour build-up maps to the flammable channel — ignition and personnel are the inquiry's.", options: { color: T2, fontFace: BODY } },
  ], { x: MX + 0.35, y: 5.95, w: CW - 0.7, h: 0.65, fontSize: 11, valign: "middle", lineSpacingMultiple: 1.12 });
}

// =====================================================================
// 13 — BUSINESS IMPACT
// =====================================================================
{
  const s = S(); chrome(s); kicker(s, "BUSINESS IMPACT");
  headline(s, "The math a buyer underwrites", { size: 31 });
  tx(s, "PER PREVENTED INCIDENT", { x: MX, y: 2.45, w: 5, h: 0.3, fontFace: MONO, fontSize: 10, color: T3, charSpacing: 1 });
  tx(s, "₹115.5 Cr", { x: MX - 0.03, y: 2.75, w: 6, h: 1.15, fontFace: DISP, fontSize: 62, color: WHITE });
  tx(s, "avoided loss — a Vizag-class event", { x: MX, y: 3.92, w: 5.5, h: 0.3, fontFace: BODY, fontSize: 13, color: T2 });
  [["Lives protected", "₹7.5 Cr"], ["Asset damage", "₹40 Cr"], ["Downtime (21 d)", "₹63 Cr"], ["Regulatory penalty", "₹5 Cr"]].forEach(([k, v], i) => {
    const ly = 4.55 + i * 0.44;
    tx(s, k, { x: MX, y: ly, w: 3.4, h: 0.34, fontFace: BODY, fontSize: 13, color: T2, valign: "middle" });
    tx(s, v, { x: MX + 3.4, y: ly, w: 1.8, h: 0.34, fontFace: MONO, fontSize: 13, color: BRAND, align: "right", valign: "middle" });
  });

  vline(s, 7.0, 2.4, 3.95, LINE);
  tx(s, "EXPECTED ANNUAL RETURN", { x: 7.35, y: 2.5, w: 5.6, h: 0.3, fontFace: MONO, fontSize: 10, color: BRAND, charSpacing: 1 });
  tx(s, "≈ 7.7×", { x: 7.32, y: 2.78, w: 5, h: 1.0, fontFace: DISP, fontSize: 52, color: WHITE });
  tx(s, "on the ₹1 Cr / plant / yr platform — even at a conservative 1-in-15-year event", { x: 7.35, y: 3.85, w: CW - (7.35 - MX), h: 0.5, fontFace: BODY, fontSize: 12.5, color: T2, lineSpacingMultiple: 1.15 });
  [["1-in-30 yr", "3.9×"], ["1-in-15 yr", "7.7×"], ["1-in-8 yr", "14.4×"]].forEach(([f, r], i) => {
    const sx = 7.35 + i * 1.85;
    tx(s, r, { x: sx, y: 4.55, w: 1.7, h: 0.5, fontFace: DISP, fontSize: 22, color: BRAND });
    tx(s, f, { x: sx, y: 5.08, w: 1.7, h: 0.3, fontFace: MONO, fontSize: 9.5, color: T3 });
  });
  hline(s, 7.35, 5.65, CW - (7.35 - MX), LINE);
  tx(s, "+ insurance lever: a recurring ₹0.4–1.2 Cr/yr premium reduction (5–15% for continuous monitoring) offsets the platform cost whether or not an incident ever occurs.",
    { x: 7.35, y: 5.78, w: CW - (7.35 - MX), h: 0.7, fontFace: BODY, fontSize: 11.5, color: T2, lineSpacingMultiple: 1.15 });
}

// =====================================================================
// BUSINESS — GO-TO-MARKET + MOAT (merged)
// =====================================================================
{
  const s = S(); chrome(s); kicker(s, "GO TO MARKET");
  headline(s, "A wedge, a buyer, a moat.", { size: 33 });

  // LEFT — the play (go to market)
  tx(s, "THE PLAY", { x: MX, y: 2.18, w: 5, h: 0.3, fontFace: MONO, fontSize: 9.5, color: T3, charSpacing: 2 });
  [
    ["BUYER", "Plant process-safety head — owns permit-to-work + statutory compliance, carries the fatality risk.", BRAND],
    ["WEDGE", "Permit-to-work intelligence — one fundable pain — then expand to full gas + permit + CCTV fusion.", WHITE],
    ["PRICING", "~₹1 Cr / plant / yr — vs a single downtime-day (~₹3 Cr) or one OISD / NGT penalty.", WHITE],
    ["TRIGGER", "Post-Vizag / LG-Polymers pressure — DGMS scrutiny + mandatory near-miss reporting.", AMBER],
  ].forEach(([k, v, c], i) => {
    const y = 2.6 + i * 0.82;
    hline(s, MX, y, 5.7, LINE);
    tx(s, k, { x: MX, y: y + 0.11, w: 5.7, h: 0.3, fontFace: SUB, fontSize: 13, color: c });
    tx(s, v, { x: MX, y: y + 0.40, w: 5.7, h: 0.42, fontFace: BODY, fontSize: 11, color: T2, lineSpacingMultiple: 1.08 });
  });

  // RIGHT — the moat
  vline(s, 6.95, 2.2, 3.7, LINE);
  const rx = 7.3;
  tx(s, "WHY AN INCUMBENT CAN'T JUST SHIP IT", { x: rx, y: 2.18, w: 5.4, h: 0.3, fontFace: MONO, fontSize: 9.5, color: BRAND, charSpacing: 1 });
  [
    ["Incumbents sell silos", "Honeywell / Dräger / MSA sell gas, permits and CCTV SEPARATELY. The danger lives in the seam no one owns.", RED],
    ["Deterministic & audit-grade", "Compound rules to real OISD / Factory-Act thresholds — domain IP a safety officer can defend in an audit, not a clonable model.", BRAND],
    ["A per-plant data moat", "Operator feedback tunes each site's nuisance profile — proprietary data that compounds per site and raises switching cost.", BRAND],
  ].forEach(([k, v, c], i) => {
    const y = 2.62 + i * 1.06;
    rect(s, rx, y + 0.03, 0.05, 0.8, c);
    tx(s, k, { x: rx + 0.2, y: y, w: 5.2, h: 0.32, fontFace: SUB, fontSize: 13, color: c });
    tx(s, v, { x: rx + 0.2, y: y + 0.32, w: 5.2, h: 0.72, fontFace: BODY, fontSize: 11, color: T2, lineSpacingMultiple: 1.1 });
  });

  // THE ASK
  rect(s, MX, 6.05, CW, 0.6, BRAND);
  tx(s, [
    { text: "THE ASK    ", options: { color: BG, bold: true, fontFace: MONO, fontSize: 11 } },
    { text: "1–2 design partners (steel / refining) for a 90-day pilot on a live permit-to-work + gas feed.", options: { color: BG, fontFace: SUB, fontSize: 15 } },
  ], { x: MX + 0.35, y: 6.05, w: CW - 0.7, h: 0.6, valign: "middle" });
}

// =====================================================================
// SCALE & DEPLOY — fleet economics + reference architecture (merged)
// =====================================================================
{
  const s = S(); chrome(s); kicker(s, "SCALES HORIZONTALLY · DEPLOYS OVER YOUR STACK");
  headline(s, "One engine. Every plant. Measured.", { size: 31 });

  // measured economics — the hero numbers
  const stats = [["100", "plants · one engine", WHITE], ["$0.30", "per plant / month", GREEN], ["~5,000", "plants per core", WHITE], ["~0.7M", "sensor-tags / sec", BRAND]];
  const cw = CW / 4; let x = MX;
  stats.forEach(([n, l, c]) => {
    hline(s, x, 2.05, cw - 0.3, LINE2);
    tx(s, n, { x, y: 2.2, w: cw - 0.2, h: 0.7, fontFace: DISP, fontSize: n.length > 5 ? 32 : 44, color: c, valign: "middle" });
    tx(s, l, { x, y: 3.0, w: cw - 0.3, h: 0.4, fontFace: BODY, fontSize: 11.5, color: T2, lineSpacingMultiple: 1.05 });
    x += cw;
  });

  // cost curve — $/plant/month falls with scale
  tx(s, "MEASURED $/PLANT/MONTH — FALLS WITH SCALE", { x: MX, y: 3.62, w: 8, h: 0.3, fontFace: MONO, fontSize: 9.5, color: BRAND, charSpacing: 1 });
  [["10 plants", "$3.00"], ["100 plants", "$0.30"], ["1,000 plants", "$0.03"], ["10,000 plants", "< $0.01"]].forEach(([k, v], i) => {
    const sx = MX + i * 3.0;
    tx(s, v, { x: sx, y: 3.92, w: 2.7, h: 0.5, fontFace: DISP, fontSize: 23, color: WHITE });
    tx(s, k, { x: sx, y: 4.45, w: 2.7, h: 0.3, fontFace: MONO, fontSize: 9.5, color: T3 });
    if (i < 3) tx(s, "›", { x: sx + 2.5, y: 3.92, w: 0.4, h: 0.5, fontFace: SUB, fontSize: 18, color: BRAND, align: "center" });
  });

  // deployment pipeline — a connector, not a rewrite
  hline(s, MX, 5.02, CW, LINE);
  tx(s, "A CONNECTOR, NOT A REWRITE", { x: MX, y: 5.12, w: 6, h: 0.3, fontFace: MONO, fontSize: 9.5, color: BRAND, charSpacing: 1 });
  const stages = [
    ["Historian", "OPC-UA / MQTT / PI"],
    ["Edge pre-filter", "debounce + normalise"],
    ["Connector", "ingest · OPC-UA"],
    ["Compound engine", "deterministic · O(zones)"],
    ["Control room", "split-reality HMI"],
  ];
  const pgap = 0.32, pw = (CW - 4 * pgap) / 5; let px = MX;
  stages.forEach(([t, d], i) => {
    const hot = i === 3;
    rect(s, px, 5.5, pw, 0.82, hot ? PANEL2 : PANEL, hot ? BRAND : LINE);
    if (hot) rect(s, px, 5.5, pw, 0.04, BRAND);
    tx(s, t, { x: px + 0.1, y: 5.59, w: pw - 0.2, h: 0.3, fontFace: SUB, fontSize: 11, color: hot ? BRAND : WHITE });
    tx(s, d, { x: px + 0.1, y: 5.89, w: pw - 0.2, h: 0.38, fontFace: BODY, fontSize: 8.5, color: T2, lineSpacingMultiple: 1.02 });
    if (i < 4) tx(s, "→", { x: px + pw, y: 5.5, w: pgap, h: 0.82, fontFace: SUB, fontSize: 14, color: BRAND, align: "center", valign: "middle" });
    px += pw + pgap;
  });
  footnote(s, "Stateless shards — no shared state, no per-site model; the engine is O(zones), so the fleet scales by adding plain workers. Deploys over steel · refining · petrochem · mining · power.");
}

// =====================================================================
// 17 — ACTIVE-LEARNING FLYWHEEL
// =====================================================================
{
  const s = S(); chrome(s); kicker(s, "IT EARNS ITS TRUST");
  headline(s, "Every plant learns its own nuisance profile", { size: 28 });
  const steps = ["Operator verdict", "Per-plant threshold", "Fewer nuisance pages", "Trust ↑ · faster action"];
  const cw = (CW - 1.2) / 4; let x = MX;
  steps.forEach((t, i) => {
    rect(s, x, 2.45, cw, 0.8, PANEL, LINE);
    tx(s, t, { x: x + 0.12, y: 2.45, w: cw - 0.24, h: 0.8, fontFace: SUB, fontSize: 13, color: WHITE, align: "center", valign: "middle", lineSpacingMultiple: 1.0 });
    if (i < 3) tx(s, "→", { x: x + cw, y: 2.45, w: 0.4, h: 0.8, fontFace: SUB, fontSize: 18, color: BRAND, align: "center", valign: "middle" });
    x += cw + 0.4;
  });
  rect(s, MX, 3.65, 5.85, 2.0, PANEL, RED); rect(s, MX, 3.65, 0.05, 2.0, RED);
  tx(s, "RECALL GUARDRAIL", { x: MX + 0.35, y: 3.85, w: 5.3, h: 0.3, fontFace: MONO, fontSize: 10, color: RED, charSpacing: 1 });
  tx(s, "Compound, HIGH and CRITICAL alerts bypass the threshold entirely. Feedback can only ever damp non-compound nuisance pages — never reduce recall.", { x: MX + 0.35, y: 4.2, w: 5.25, h: 1.3, fontFace: BODY, fontSize: 13.5, color: T2, lineSpacingMultiple: 1.22 });
  rect(s, MX + 6.05, 3.65, CW - 6.05, 2.0, PANEL, LINE); rect(s, MX + 6.05, 3.65, 0.05, 2.0, BRAND);
  tx(s, "THE FLYWHEEL", { x: MX + 6.4, y: 3.85, w: 5, h: 0.3, fontFace: MONO, fontSize: 10, color: BRAND, charSpacing: 1 });
  tx(s, "A confirmed false alarm raises the threshold; a confirmed alert relaxes it. Each plant quietly auto-acknowledges its own routine excursions — fewer nuisance pages, faster action on the ones that matter.", { x: MX + 6.4, y: 4.2, w: CW - 6.4, h: 1.3, fontFace: BODY, fontSize: 13.5, color: T2, lineSpacingMultiple: 1.22 });
  footnote(s, "The default engine is untouched — the benchmark (100% recall / 0% false-positive) is byte-identical with or without feedback.");
}

// =====================================================================
// 20 — CLOSE
// =====================================================================
{
  const s = S();
  mark(s, W / 2, 1.5, 0.46);
  tx(s, [
    { text: "Three workers a day.", options: { color: WHITE, breakLine: true } },
    { text: "The data already exists.", options: { color: WHITE } },
  ], { x: 0, y: 2.5, w: W, h: 1.7, fontFace: DISP, fontSize: 42, align: "center", lineSpacingMultiple: 1.06 });
  rect(s, W / 2 - 1.1, 4.35, 2.2, 0.03, BRAND);
  tx(s, "Trinetra is the layer that acts — before, not after.", { x: 0, y: 4.62, w: W, h: 0.6, fontFace: DISPL, fontSize: 26, color: BRAND, align: "center" });
  tx(s, [
    { text: "100%", options: { fontFace: DISP, color: BRAND } }, { text: " recall", options: { fontFace: MONO, color: T2 } },
    { text: "      0%", options: { fontFace: DISP, color: BRAND } }, { text: " false-positive", options: { fontFace: MONO, color: T2 } },
    { text: "      7.4", options: { fontFace: DISP, color: BRAND } }, { text: " min lead", options: { fontFace: MONO, color: T2 } },
  ], { x: 0, y: 5.75, w: W, h: 0.4, fontSize: 14, align: "center" });
  tx(s, "TRINETRA   ·   SAUD SATOPAY", { x: 0, y: 6.85, w: W, h: 0.3, fontFace: MONO, fontSize: 9.5, color: T3, align: "center", charSpacing: 2 });
}

p.writeFile({ fileName: __dirname + "/../Trinetra_Deck.pptx" }).then(f => console.log("WROTE", f));
