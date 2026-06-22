export type Level = "normal" | "watch" | "elevated" | "high" | "critical";
export type Stage = "" | "low" | "high" | "danger";

export interface Gas {
  species: string;
  value: number;
  unit: string;
  stage: Stage;
  frac: number;
}

export interface Intervention {
  action: string;
  resulting_level: Level;
  delta: number;
}

export interface ZoneRisk {
  score: number;
  level: Level;
  compound: boolean;
  factors: string[];
  time_to_threshold_min: number | null;
  ignition_ref: string;
  interventions: Intervention[];
}

export interface Permit {
  id: string;
  type: string;
  description: string;
}

export interface Zone {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  gases: Record<string, Gas>;
  temperature: number;
  pressure: number;
  workers: string[];
  permits: Permit[];
  risk: ZoneRisk;
}

export interface Summary {
  top_zone: string | null;
  top_score: number;
  top_level: Level;
  compound_alert: boolean;
  baseline_alarm: boolean;
}

export interface Frame {
  t_min: number;
  scenario: string;
  zones: Zone[];
  summary: Summary;
}

export interface PlantZoneSpec {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  neighbours: string[];
}

export interface Threshold {
  unit: string;
  low: number;
  high: number;
  danger: number;
  direction: string;
  flammable: boolean;
}

export interface Plant {
  name: string;
  zones: PlantZoneSpec[];
  thresholds: Record<string, Threshold>;
}

export interface ScenarioInfo {
  name: string;
  title: string;
  description: string;
  expected_compound: boolean;
  hazard_zone: string;
}
