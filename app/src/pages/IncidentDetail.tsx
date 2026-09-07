import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getIncident } from "../data/incidents";
import { getLink } from "../data/links";
import { getEngineer } from "../data/engineers";
import { getPrediction } from "../data/predictions";
import { getTelemetry } from "../lib/derive";
import TelemetryTrendChart from "../components/charts/TelemetryTrendChart";
import CountUp from "../components/motion/CountUp";
import FadeIn from "../components/motion/FadeIn";
import { severityTone, TONE_TEXT } from "../lib/status";
import NotFound from "./NotFound";
import type { IncidentTimelineEntry } from "../data/types";

const STAGE_META = [
  { key: "predicted", title: "Predicted", icon: "check_circle" },
  { key: "open", title: "Open", icon: "warning" },
  { key: "investigating", title: "Investigating", icon: "sync" },
  { key: "resolved", title: "Resolved", icon: "hourglass_empty" },
] as const;

export default function IncidentDetail() {
  const { incidentId } = useParams();
  const incident = incidentId ? getIncident(incidentId) : undefined;

  // Hooks must run unconditionally, before the not-found early return below.
  const [notes, setNotes] = useState<{ time: string; body: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [selectedTimelineKey, setSelectedTimelineKey] = useState<string | null>(null);

  if (!incident) return <NotFound label="incident" backTo="/incidents" backLabel="Back to Incidents" />;

  const link = getLink(incident.linkId)!;
  const engineer = getEngineer(incident.engineerId);
  const prediction = incident.originatingPredictionId ? getPrediction(incident.originatingPredictionId) : undefined;
  const points = getTelemetry(link);
  const recentPoints = points.filter((p) => p.t >= -12);
  const tone = severityTone(incident.severity);

  const currentStageIdx = incident.status === "resolved" ? 3 : 2;
  const lossThreshold = Math.max(0.1, link.baseline.lossPct * 10);

  // Incident Timeline → Telemetry chart: selecting a timeline entry moves the
  // chart's crosshair to the nearest corresponding telemetry timestamp.
  // Entries render reverse-chronological (operator notes, newest first, then
  // incident.timeline), so position within that combined order interpolates
  // linearly between "now" (last update) and the incident's inception.
  const totalTimelineEntries = notes.length + incident.timeline.length;
  const selectedTimelineT = (() => {
    if (selectedTimelineKey == null) return null;
    const noteIdx = notes.findIndex((_, i) => `note-${i}` === selectedTimelineKey);
    if (noteIdx !== -1) return timelineEntryT(incident, noteIdx, totalTimelineEntries);
    const entryIdx = incident.timeline.findIndex((entry, i) => entry.time + i === selectedTimelineKey);
    if (entryIdx !== -1) return timelineEntryT(incident, notes.length + entryIdx, totalTimelineEntries);
    return null;
  })();

  return (
    <div className="flex flex-col w-full">
      <Link to="/incidents" className="type-caption uppercase tracking-wider text-outline hover:text-primary transition-colors w-fit inline-block mb-6">
        ← All Incidents
      </Link>

      <div className="pb-8 pt-2 border-b border-outline-variant/40 flex flex-col gap-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-1">
          <div className="space-y-1.5">
            <h1 className="type-display-xl text-4xl md:text-5xl lg:text-[58px] leading-[1.04] text-primary mb-3">Here's what happened.</h1>
            <div className="type-body-lg text-on-surface-variant max-w-2xl font-normal pt-1">{incident.title}</div>
          </div>
          <div className="flex flex-col items-start md:items-end type-telemetry-code text-outline gap-1 pb-1">
            <div className="flex items-center gap-2">
              <span className="text-on-surface-variant uppercase">Detection:</span>
              <span className="text-primary font-medium">{incident.detectionTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-on-surface-variant uppercase">Breached:</span>
              <span className="text-error font-medium">{incident.breachTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-on-surface-variant uppercase">Elapsed:</span>
              <span className="text-secondary font-medium">{incident.elapsed}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pb-10 pt-6 border-b border-outline-variant/40">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-outline">route</span>
            <span className="type-caption uppercase tracking-wider text-outline font-medium">Resolution Stage Progress</span>
          </div>
          <span className="type-telemetry-code text-outline tracking-wider">SEQUENCE: 01 → 02 → 03 → 04</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pt-5">
          {STAGE_META.map((stage, idx) => {
            const done = idx < currentStageIdx;
            const active = idx === currentStageIdx;
            const pending = idx > currentStageIdx;
            // The "Open" stage keeps its error tone even once complete — it
            // marks the moment the SLA breach tripped, which stays notable.
            const isBreachStage = idx === 1;
            const barColor = isBreachStage ? "bg-error" : done ? "bg-primary" : active ? "bg-secondary" : "bg-outline-variant/40";
            const textColor = isBreachStage ? "text-error" : active ? "text-secondary" : pending ? "text-outline" : "text-primary";
            return (
              <FadeIn key={stage.key} delayMs={idx * 90} rise={6}>
                <div
                  className={`relative flex flex-col justify-between p-4 bg-surface-container-lowest transition-colors duration-150 hover:bg-surface-container-low ${
                    active ? "border-2 border-secondary" : "border border-outline-variant/40"
                  } ${pending ? "opacity-75" : ""}`}
                >
                  <div className={`h-1 w-full mb-3 ${barColor}`} />
                  <div className={`flex items-center justify-between type-telemetry-sm ${textColor}`}>
                    <span className="font-medium tracking-wide flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">{stage.icon}</span>
                      {String(idx + 1).padStart(2, "0")}. {stage.title.toUpperCase()}
                    </span>
                    <span className="type-telemetry-code text-outline">{pending ? "PENDING" : done || active ? stageTime(incident, idx) : ""}</span>
                  </div>
                  <div className="mt-2 type-headline-md text-[16px] text-primary font-medium tracking-tight">{stageHeadline(idx, incident)}</div>
                  <p className="mt-1 type-body-sm text-on-surface-variant leading-normal">{stageBody(idx, incident, prediction)}</p>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pt-4">
        <div className="lg:col-span-7 flex flex-col gap-12">
          <section className="pt-4">
            <div className="flex items-baseline justify-between pb-3 border-b border-outline-variant/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-outline">query_stats</span>
                <h2 className="type-caption uppercase tracking-wider text-outline font-medium">Telemetry at Inception</h2>
              </div>
              <span className="type-telemetry-code text-outline">SAMPLING: 2000MS INTERVAL</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4 border-b border-outline-variant/30 divide-x divide-outline-variant/30">
              <div className="pr-4">
                <div className="flex items-center justify-between">
                  <span className="type-caption uppercase tracking-wider text-outline block">Packet Loss</span>
                  <span className={`text-[10px] type-telemetry-code border px-1 py-0.5 font-medium uppercase ${TONE_TEXT[tone]} border-current`}>Critical Breach</span>
                </div>
                <div className={`mt-1 type-telemetry-hero font-medium tracking-tight ${TONE_TEXT[tone]}`}>
                  <CountUp value={incident.inceptionTelemetry.packetLossPct} decimals={2} suffix="%" />
                </div>
                <div className={`mt-2 type-telemetry-sm flex items-center gap-1.5 ${TONE_TEXT[tone]}`}>
                  <span className="font-medium">+{(incident.inceptionTelemetry.packetLossPct - incident.inceptionTelemetry.packetLossBaselinePct).toFixed(2)}%</span>
                  <span className="text-outline type-body-sm">(baseline {incident.inceptionTelemetry.packetLossBaselinePct.toFixed(2)}%)</span>
                </div>
              </div>
              <div className="pl-4 pr-4">
                <div className="flex items-center justify-between">
                  <span className="type-caption uppercase tracking-wider text-outline block">Round Trip Time</span>
                  <span className="text-[10px] type-telemetry-code text-secondary border border-secondary/30 px-1 py-0.5 font-medium uppercase">Elevated</span>
                </div>
                <div className="mt-1 type-telemetry-hero text-primary font-medium tracking-tight">
                  <CountUp value={incident.inceptionTelemetry.rttMs} decimals={1} />
                  <span className="type-headline-md font-normal text-outline ml-0.5">ms</span>
                </div>
                <div className="mt-2 type-telemetry-sm text-error flex items-center gap-1.5">
                  <span className="font-medium">+{(incident.inceptionTelemetry.rttMs - incident.inceptionTelemetry.rttBaselineMs).toFixed(1)}ms</span>
                  <span className="text-outline type-body-sm">(baseline {incident.inceptionTelemetry.rttBaselineMs}ms)</span>
                </div>
              </div>
              <div className="pl-4 pr-4">
                <div className="flex items-center justify-between">
                  <span className="type-caption uppercase tracking-wider text-outline block">Ingress Interface</span>
                  <span className="text-[10px] type-telemetry-code text-outline border border-outline-variant/40 px-1 py-0.5 uppercase">100 Gbps</span>
                </div>
                <div className="mt-2 type-telemetry-lg text-primary font-medium tracking-tight">{incident.inceptionTelemetry.ingressInterface}</div>
                <div className="mt-2 type-telemetry-code text-outline uppercase">100GBASE-LR4 / OPTICAL</div>
              </div>
              <div className="pl-4">
                <div className="flex items-center justify-between">
                  <span className="type-caption uppercase tracking-wider text-outline block">Device Chassis</span>
                  <span className="text-[10px] type-telemetry-code text-outline border border-outline-variant/40 px-1 py-0.5 uppercase">CORE SW</span>
                </div>
                <div className="mt-2 type-telemetry-lg text-primary font-medium tracking-tight">{incident.inceptionTelemetry.deviceChassis}</div>
                <div className="mt-2 type-telemetry-code text-outline">{link.asn} BORDER ROUTER</div>
              </div>
            </div>
          </section>

          <section className="border-t border-outline-variant/40 pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4">
              <div>
                <h3 className="type-caption uppercase tracking-wider text-outline font-medium">Impact Assessment</h3>
                <div className="type-headline-md text-primary mt-1 tracking-tight">Ingress Loss Ratio &amp; Predicted Deviation</div>
              </div>
              <div className="flex items-center gap-5 pt-1 sm:pt-0">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-primary inline-block" />
                  <span className="type-caption uppercase tracking-wider text-outline">Observed</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 border-b border-dashed border-secondary inline-block" />
                  <span className="type-caption uppercase tracking-wider text-secondary font-medium">Predicted Horizon</span>
                </div>
              </div>
            </div>
            <TelemetryTrendChart
              points={recentPoints}
              primaryKey="lossPct"
              primaryUnit="%"
              threshold={{ value: lossThreshold, label: `SLA CEILING: ${lossThreshold.toFixed(2)}%` }}
              baseline={{ value: link.baseline.lossPct, label: `${link.baseline.lossPct.toFixed(2)}% (BASELINE)` }}
              externalActiveT={selectedTimelineT}
              xTickCount={5}
              height={200}
            />
          </section>

          <section className="border-t border-outline-variant/40 pt-6">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline text-[18px]">terminal</span>
                <h3 className="type-caption uppercase tracking-wider text-outline">Staff Engineering Diagnostic Note</h3>
              </div>
              <span className="type-telemetry-code text-outline">REF: LOG-{incident.id}</span>
            </div>
            <div className="pt-4 space-y-4">
              <div className="type-telemetry-sm text-primary font-medium">AUTHOR: {engineer?.name} ({engineer?.specialisation})</div>
              {incident.diagnosticNote.map((p, i) => (
                <p key={i} className="type-body-md text-primary leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </section>

          <section className="border-t border-outline-variant/40 pt-6 pb-8">
            <h3 className="type-caption uppercase tracking-wider text-outline pb-4">Topology &amp; Correlated Entities</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link to={`/links/${link.id}`} className="group py-3 border-t border-outline-variant/40 flex flex-col justify-between transition-colors">
                <span className="type-caption uppercase text-outline">Network Link</span>
                <div className="mt-1 type-headline-md text-primary group-hover:text-secondary transition-colors">{link.name}</div>
                <div className="mt-2 flex items-center gap-2 type-telemetry-code text-outline group-hover:text-primary">
                  <span>{link.asn}</span>
                  <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
                </div>
              </Link>
              {prediction && (
                <Link to={`/predictions/${prediction.id}`} className="group py-3 border-t border-outline-variant/40 flex flex-col justify-between transition-colors">
                  <span className="type-caption uppercase text-outline">Originating Prediction</span>
                  <div className="mt-1 type-headline-md text-primary group-hover:text-secondary transition-colors">
                    {prediction.id} ({prediction.confidencePct}%)
                  </div>
                  <div className="mt-2 flex items-center gap-2 type-telemetry-code text-outline group-hover:text-primary">
                    <span>{prediction.faultLabel}</span>
                    <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
                  </div>
                </Link>
              )}
              {engineer && (
                <Link to={`/engineers/${engineer.id}`} className="group py-3 border-t border-outline-variant/40 flex flex-col justify-between transition-colors">
                  <span className="type-caption uppercase text-outline">Incident Commander</span>
                  <div className="mt-1 type-headline-md text-primary group-hover:text-secondary transition-colors">{engineer.name}</div>
                  <div className="mt-2 flex items-center gap-2 type-telemetry-code text-outline group-hover:text-primary">
                    <span>{engineer.specialisation}</span>
                    <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
                  </div>
                </Link>
              )}
            </div>
          </section>
        </div>

        <div className="lg:col-span-5 flex flex-col border-t lg:border-t-0 lg:border-l border-outline-variant/40 lg:pl-10">
          <div className="flex items-center justify-between pb-3 border-b border-primary">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-primary">history</span>
              <h2 className="type-caption uppercase tracking-wider text-primary font-medium">Incident Timeline</h2>
            </div>
            <span className="type-telemetry-code text-outline">REVERSE_CHRONOLOGICAL</span>
          </div>
          <div className="relative pl-6 space-y-6 pt-5">
            <div className="absolute left-2.5 top-8 bottom-8 w-0.5 bg-outline-variant/40" />
            {notes.map((n, i) => {
              const key = `note-${i}`;
              return (
                <TimelineEntry
                  key={key}
                  entry={{ time: n.time, label: "Operator Note", body: n.body, tag: "OPERATOR_NOTE", kind: "current" }}
                  selected={selectedTimelineKey === key}
                  onToggle={() => setSelectedTimelineKey((cur) => (cur === key ? null : key))}
                />
              );
            })}
            {incident.timeline.map((entry, i) => {
              const key = entry.time + i;
              return (
                <TimelineEntry
                  key={key}
                  entry={entry}
                  demoteCurrent={notes.length > 0}
                  delayMs={i * 90}
                  selected={selectedTimelineKey === key}
                  onToggle={() => setSelectedTimelineKey((cur) => (cur === key ? null : key))}
                />
              );
            })}
          </div>
          <div className="mt-8 pt-6 border-t border-outline-variant/40">
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-outline">edit_note</span>
                <span className="type-caption uppercase tracking-wider text-outline font-medium">Append SRE Operator Note</span>
              </div>
              <span className="type-telemetry-code text-outline">KEY: CMD+ENTER</span>
            </div>
            <div className="flex flex-col gap-2">
              <textarea
                className="w-full bg-surface-container-lowest border border-outline-variant/80 p-3 type-body-md text-primary placeholder:text-outline focus:outline-none focus:border-primary resize-none transition-colors"
                placeholder="Document corrective actions, attenuation figures, or fiber vendor ticket references..."
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") postNote();
                }}
              />
              <div className="flex items-center justify-end pt-2">
                <button className="px-4 py-1.5 bg-primary text-on-primary type-body-md font-medium hover:bg-secondary transition-colors disabled:opacity-40" type="button" onClick={postNote} disabled={!draft.trim()}>
                  Post Update
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  function postNote() {
    if (!draft.trim()) return;
    setNotes((prev) => [{ time: "Just now", body: draft.trim() }, ...prev]);
    setDraft("");
  }
}

function TimelineEntry({
  entry,
  demoteCurrent,
  delayMs = 0,
  selected = false,
  onToggle,
}: {
  entry: IncidentTimelineEntry;
  demoteCurrent?: boolean;
  delayMs?: number;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const isCurrent = entry.kind === "current" && !demoteCurrent;
  const dotColor = isCurrent ? "bg-secondary" : entry.kind === "open" ? "bg-error" : entry.kind === "predicted" ? "bg-outline" : "bg-primary";
  return (
    <FadeIn
      as="article"
      delayMs={delayMs}
      rise={6}
      className={`relative group pl-3 pb-2 pr-2 cursor-pointer transition-colors duration-150 hover:bg-surface-container-low/70 focus-visible:bg-surface-container-low/70 ${
        selected ? "bg-surface-container-low" : ""
      }`}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle?.();
        }
      }}
    >
      <span
        className={`absolute -left-[19px] top-1.5 w-3 h-3 rounded-full border-2 border-surface flex items-center justify-center transition-transform duration-150 ${dotColor} ${
          selected ? "scale-125 ring-2 ring-secondary/40" : ""
        }`}
      >
        {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-surface" />}
      </span>
      <div className="flex items-baseline justify-between">
        <span className={`type-telemetry-md font-medium tracking-wide ${isCurrent ? "text-secondary" : entry.kind === "open" ? "text-error" : "text-outline"}`}>{entry.time}</span>
        {isCurrent ? (
          <span className="type-caption uppercase text-secondary font-medium tracking-wider px-1.5 py-0.5 border border-secondary/30 bg-secondary/5">Current Update</span>
        ) : entry.kind === "open" ? (
          <span className="type-caption uppercase text-error font-medium tracking-wider px-1.5 py-0.5 border border-error/30 bg-error-container/20">Incident Open</span>
        ) : (
          <span className="type-caption uppercase text-outline tracking-wider">{entry.kind}</span>
        )}
      </div>
      <div className="mt-2 type-body-lg text-primary font-medium tracking-tight">{entry.label}</div>
      <p className="mt-2 type-body-md text-on-surface-variant leading-relaxed">{entry.body}</p>
      <div className="mt-3 flex items-center gap-3 type-telemetry-code text-outline flex-wrap">
        <span className="uppercase">TAG: {entry.tag}</span>
      </div>
    </FadeIn>
  );
}

/** Interpolates a telemetry timestamp for a timeline entry at `idx` within a
 *  reverse-chronological list of `total` entries — idx 0 (newest) lands at
 *  the incident's last update, idx `total-1` (oldest) lands near its inception. */
function timelineEntryT(incident: NonNullable<ReturnType<typeof getIncident>>, idx: number, total: number): number {
  const latestT = -(incident.updatedMinutesAgo / 60);
  const earliestT = -(incident.createdHoursAgo + 2);
  if (total <= 1) return latestT;
  const frac = idx / (total - 1);
  return latestT + frac * (earliestT - latestT);
}

function stageTime(incident: ReturnType<typeof getIncident>, idx: number): string {
  if (!incident) return "";
  if (idx === 0) return incident.detectionTime;
  if (idx === 1) return incident.breachTime;
  return "";
}

function stageHeadline(idx: number, incident: NonNullable<ReturnType<typeof getIncident>>): string {
  switch (idx) {
    case 0:
      return "Jitter Anomaly Detected";
    case 1:
      return "SLA Breach Tripped";
    case 2:
      return incident.status === "investigating" ? "Telemetry Triage Active" : "Mitigation Applied";
    default:
      return incident.status === "resolved" ? "Recovery Confirmed" : "Recovery Pending";
  }
}

function stageBody(idx: number, incident: NonNullable<ReturnType<typeof getIncident>>, prediction: ReturnType<typeof getPrediction>): string {
  switch (idx) {
    case 0:
      return prediction ? `${prediction.id} flagged ${prediction.faultLabel.toLowerCase()} ahead of threshold.` : "Predictive telemetry flagged an early deviation.";
    case 1:
      return `Deterministic threshold breach recorded at ${incident.breachTime}.`;
    case 2:
      return incident.status === "investigating" ? "Border switch micro-telemetry capture in progress." : "Mitigation steps applied; verifying recovery window.";
    default:
      return incident.status === "resolved" ? "48-hour post-incident watch closed with residual loss at baseline." : "Awaiting contiguous nominal window post-mitigation.";
  }
}
