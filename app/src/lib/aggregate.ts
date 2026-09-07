import { LINKS } from "../data/links";
import { PREDICTIONS, SEVERITY_RANK } from "../data/predictions";
import { INCIDENTS, INCIDENT_SEVERITY_RANK } from "../data/incidents";
import { ENGINEERS } from "../data/engineers";
import { computeVitals, type LinkVitals } from "./derive";
import type { Incident, NetworkLink, Prediction } from "../data/types";

export interface LinkDisplay extends LinkVitals {
  activePredictions: Prediction[];
  openIncidents: Incident[];
  displayStatus: "healthy" | "attention";
}

/** A link's displayed status is the worse of its telemetry-derived state and
 *  any non-resolved incident / active prediction pointed at it — so the
 *  Network Links table always agrees with Predictions and Incidents. */
export function linkDisplay(link: NetworkLink): LinkDisplay {
  const vitals = computeVitals(link);
  const activePredictions = PREDICTIONS.filter((p) => p.linkId === link.id && p.status !== "monitored");
  const openIncidents = INCIDENTS.filter((i) => i.linkId === link.id && i.status !== "resolved");
  const hasSevereSignal =
    activePredictions.some((p) => p.severity === "high" || p.severity === "critical") ||
    openIncidents.some((i) => i.severity === "high" || i.severity === "critical");
  return {
    ...vitals,
    activePredictions,
    openIncidents,
    displayStatus: vitals.status === "attention" || hasSevereSignal ? "attention" : "healthy",
  };
}

export function allLinkDisplays(): LinkDisplay[] {
  return LINKS.map(linkDisplay);
}

export interface OverviewStats {
  networkBaselinePct: number;
  activeSignals: number;
  openIncidents: number;
  corridorsFlagged: number;
  corridorsTotal: number;
  topSignals: Prediction[];
  topIncidents: Incident[];
}

export function overviewStats(): OverviewStats {
  const displays = allLinkDisplays();
  const avgHealth = displays.reduce((s, d) => s + d.healthScore, 0) / displays.length;

  const topSignals = [...PREDICTIONS]
    .filter((p) => p.status !== "monitored")
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.confidencePct - a.confidencePct)
    .slice(0, 3);

  const topIncidents = [...INCIDENTS]
    .sort(
      (a, b) =>
        INCIDENT_SEVERITY_RANK[b.severity] - INCIDENT_SEVERITY_RANK[a.severity] || a.createdHoursAgo - b.createdHoursAgo,
    )
    .slice(0, 4);

  return {
    networkBaselinePct: Math.round(avgHealth * 10) / 10,
    activeSignals: PREDICTIONS.length,
    openIncidents: INCIDENTS.filter((i) => i.status !== "resolved").length,
    corridorsFlagged: displays.filter((d) => d.displayStatus === "attention").length,
    corridorsTotal: displays.length,
    topSignals,
    topIncidents,
  };
}

export interface PredictionsStats {
  total: number;
  high: number;
  medium: number;
  low: number;
}

export function predictionsStats(): PredictionsStats {
  return {
    total: PREDICTIONS.length,
    high: PREDICTIONS.filter((p) => p.severity === "high").length,
    medium: PREDICTIONS.filter((p) => p.severity === "medium").length,
    low: PREDICTIONS.filter((p) => p.severity === "low").length,
  };
}

export interface IncidentsStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  investigating: number;
  mitigated: number;
  resolved: number;
}

export function incidentsStats(): IncidentsStats {
  return {
    total: INCIDENTS.length,
    critical: INCIDENTS.filter((i) => i.severity === "critical").length,
    high: INCIDENTS.filter((i) => i.severity === "high").length,
    medium: INCIDENTS.filter((i) => i.severity === "medium").length,
    investigating: INCIDENTS.filter((i) => i.status === "investigating").length,
    mitigated: INCIDENTS.filter((i) => i.status === "mitigated").length,
    resolved: INCIDENTS.filter((i) => i.status === "resolved").length,
  };
}

export interface EngineersStats {
  total: number;
  onShift: number;
  standby: number;
  offShift: number;
  linkedIssues: number;
  escalated: number;
  mitigating: number;
}

export function engineersStats(): EngineersStats {
  const onShift = ENGINEERS.filter((e) => e.status === "on-shift").length;
  const standby = ENGINEERS.filter((e) => e.status === "standby").length;
  const offShift = ENGINEERS.filter((e) => e.status === "off-shift").length;
  const assigned = ENGINEERS.filter((e) => e.assignedIncidentId);
  const escalated = assigned.filter((e) => {
    const inc = INCIDENTS.find((i) => i.id === e.assignedIncidentId);
    return inc && (inc.severity === "critical" || inc.severity === "high");
  }).length;
  return {
    total: ENGINEERS.length,
    onShift,
    standby,
    offShift,
    linkedIssues: assigned.length,
    escalated,
    mitigating: assigned.length - escalated,
  };
}
