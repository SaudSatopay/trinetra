import { FleetOverview, FleetScale, Frame, Plant, ScenarioInfo } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

// Fetch JSON with a few quick retries — survives the backend being slow to warm on first load,
// so a one-shot panel doesn't go permanently blank if its initial request races startup.
export async function getJSON<T>(path: string, retries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let retryable = true;
    try {
      const r = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
      if (r.ok) return (await r.json()) as T;
      retryable = r.status >= 500; // a client error (4xx) won't change on retry — fail fast
      throw new Error(`${path} -> ${r.status}`);
    } catch (e) {
      if (!retryable || attempt >= retries) throw e;
      await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
    }
  }
}

const j = getJSON;

// Like fetch but retries transient failures (slow startup / 5xx); returns the Response so callers
// keep their existing r.json() handling. Path is relative to API_BASE.
export async function retryFetch(path: string, init?: RequestInit, retries = 2): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(`${API_BASE}${path}`, { cache: "no-store", ...init });
      if (!r.ok && r.status >= 500 && attempt < retries) {
        await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
        continue;
      }
      return r;
    } catch (e) {
      lastErr = e;
      if (attempt >= retries) throw e;
      await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export const getPlant = () => j<Plant>("/api/plant");
export const getScenarios = () => j<ScenarioInfo[]>("/api/scenarios");
export const getFleet = () => j<FleetOverview>("/api/fleet");
export const getFleetScale = () => j<FleetScale>("/api/fleet/scale");

export async function getFrames(scenario: string, minutes = 50): Promise<Frame[]> {
  const data = await j<{ frames: Frame[] }>(`/api/frames/${scenario}?minutes=${minutes}`);
  return data.frames ?? [];
}

export interface SimConfig {
  zone: string;
  gas: string;
  leak: boolean;
  ignition: boolean;
  adjacent: boolean;
  workers: number;
}

export async function getSimulate(c: SimConfig, minutes = 50): Promise<Frame[]> {
  const q = new URLSearchParams({
    zone: c.zone, gas: c.gas, leak: String(c.leak), ignition: String(c.ignition),
    adjacent: String(c.adjacent), workers: String(c.workers), minutes: String(minutes),
  });
  const data = await j<{ frames: Frame[] }>(`/api/simulate?${q.toString()}`);
  return data.frames;
}

export async function ingestCsv(text: string): Promise<{ frames: Frame[]; summary: string }> {
  const r = await fetch(`${API_BASE}/api/ingest`, {
    method: "POST", headers: { "Content-Type": "text/csv" }, body: text,
  });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error || `ingest -> ${r.status}`);
  return { frames: d.frames as Frame[], summary: `${d.rows} rows · ${d.minutes} min` };
}

export interface IncidentReplay {
  frames: Frame[];
  key: string;
  incident: string;
  date: string;
  source: string;
  zone: string;
  documented_event_min: number;
  event_label: string;
  trinetra_alert_min: number | null;
  single_sensor_min: number | null;
  lead_min: number | null;
}

export async function getIncident(name: string): Promise<IncidentReplay> {
  return j<IncidentReplay>(`/api/incident/${name}`);
}

// A REAL, third-party measured dataset replayed through the same connector + engine. Distinct
// from IncidentReplay (which reconstructs an inquiry's sequence): here the gas DYNAMICS are
// measured data, not authored — the direct answer to "your eval is self-authored".
export interface ExternalReplay {
  frames: Frame[];
  key: string;
  zone: string;
  provenance: string;
  dataset: string;
  citation: string;
  source: string;
  channel: string;
  window: string;
  real: string;
  overlaid: string;
  trinetra_alert_min: number | null;
  single_sensor_min: number | null;
  lead_min: number | null;
  peak: number | null;
  peak_unit: string;
  peak_co_ppm: number | null;
  samples: number;
  shipped_scale: number | null;   // null for a fixed-conversion source (e.g. ALOHA ppm->%LEL) — no scale to sweep
  pending?: boolean;
  lead_by_scale: { scale: number; compound_min: number | null; single_sensor_min: number | null; lead_min: number | null }[];
}

export async function getExternal(key: string): Promise<ExternalReplay> {
  return j<ExternalReplay>(`/api/external/${key}`);
}
