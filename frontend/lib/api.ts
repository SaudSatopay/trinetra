import { Frame, Plant, ScenarioInfo } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

async function j<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json() as Promise<T>;
}

export const getPlant = () => j<Plant>("/api/plant");
export const getScenarios = () => j<ScenarioInfo[]>("/api/scenarios");

export async function getFrames(scenario: string, minutes = 50): Promise<Frame[]> {
  const data = await j<{ frames: Frame[] }>(`/api/frames/${scenario}?minutes=${minutes}`);
  return data.frames;
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
