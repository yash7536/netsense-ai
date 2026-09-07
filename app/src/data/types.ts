// Core domain types for the NetSense AI dataset.
// The dataset is intentionally small and India-focused — see data/links.ts,
// data/predictions.ts, data/incidents.ts and data/engineers.ts.

export type CityId = "mumbai" | "delhi" | "bengaluru" | "hyderabad" | "chennai" | "pune";

export type Region = "North" | "South" | "West";

export interface City {
  id: CityId;
  name: string;
  region: Region;
}

export type LinkStatus = "healthy" | "attention";

export interface LinkEndpoints {
  from: CityId;
  to: CityId;
}

/** Static (non-derived) metadata for a network link, as captured in the Stitch export. */
export interface NetworkLink {
  id: string;
  name: string;
  asn: string;
  segmentId: string;
  circuitId: string;
  regionLabel: string;
  endpoints: LinkEndpoints;
  /** Nominal (undisturbed) baseline telemetry, used to derive drift/anomaly. */
  baseline: {
    latencyMs: number;
    lossPct: number;
    jitterMs: number;
    bandwidthPct: number;
  };
  /** Physical route metadata for the "Physical Link Architecture" trace. */
  route: {
    distanceKm: number;
    dispersionPsNm: number;
    ingressNode: { id: string; site: string; txPowerDbm: number };
    amp1: { id: string; note: string; gainTiltDb: number };
    amp2: { id: string; note: string; osnrDb: number };
    egressNode: { id: string; site: string; rxPowerDbm: number };
    shiftAtKm: number;
  };
  physicalLayerNote: string;
  bufferDynamicsNote: string;
  modelInferenceNote: string;
  deviceChassis: string;
  ingressInterface: string;
  samplingRate: string;
  modelEngine: string;
}

export type Severity = "critical" | "high" | "medium" | "low";

export type PredictionStatus = "active" | "investigating" | "monitored";

export interface Prediction {
  id: string; // PRD-104
  signalId: string; // SIG-9082
  linkId: string;
  faultLabel: string;
  faultDetail: string;
  severity: Severity;
  confidencePct: number;
  predictedAtHoursAgo: number;
  status: PredictionStatus;
  relatedIncidentId?: string;
  headline: string;
  narrative: string;
  horizonHours: number; // time-to-trip / breach
  impactRadiusCircuits: number;
  projectedRiskLabel: string;
  affectedCircuits: { id: string; label: string; risk: "critical" | "at-risk" | "nominal" }[];
  interfacePath: string;
  remediationMode: string;
}

export type IncidentSeverity = "critical" | "high" | "medium";
export type IncidentStatus = "investigating" | "mitigated" | "resolved";

export interface IncidentTimelineEntry {
  time: string; // "06:15 UTC"
  label: string;
  body: string;
  tag: string;
  kind: "current" | "investigating" | "open" | "predicted";
}

export interface Incident {
  id: string; // INC-402
  linkId: string;
  title: string;
  faultLabel: string;
  faultDetail: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  engineerId: string;
  createdHoursAgo: number;
  updatedMinutesAgo: number;
  detectionTime: string;
  breachTime: string;
  elapsed: string;
  originatingPredictionId?: string;
  diagnosticNote: string[];
  inceptionTelemetry: {
    packetLossPct: number;
    packetLossBaselinePct: number;
    rttMs: number;
    rttBaselineMs: number;
    ingressInterface: string;
    deviceChassis: string;
  };
  timeline: IncidentTimelineEntry[];
}

export type DutyStatus = "on-shift" | "standby" | "off-shift";

export interface Engineer {
  id: string;
  badge: string; // #8042
  name: string;
  city: CityId;
  nodeCode: string; // BOM-01
  specialisation: string;
  status: DutyStatus;
  workloadLabel: "High" | "Moderate" | "Active" | "Available" | "—";
  workloadPct: number;
  assignedLinkId?: string;
  assignedIncidentId?: string;
}

export interface TelemetryPoint {
  /** Hours relative to "now": -48 .. +12 */
  t: number;
  latencyMs: number;
  lossPct: number;
  jitterMs: number;
  bandwidthPct: number;
}
