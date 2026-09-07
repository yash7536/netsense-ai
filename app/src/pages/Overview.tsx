import { useState } from "react";
import { Link } from "react-router-dom";
import { overviewStats, allLinkDisplays } from "../lib/aggregate";
import { getLink } from "../data/links";
import { getEngineer } from "../data/engineers";
import { INCIDENTS } from "../data/incidents";
import { getTelemetry } from "../lib/derive";
import { historyOnly } from "../data/telemetry";
import { hoursAgoLabel } from "../lib/format";
import { severityTone, incidentStatusTone, TONE_TEXT, TONE_BG } from "../lib/status";
import TelemetryTrendChart from "../components/charts/TelemetryTrendChart";
import Sparkline from "../components/charts/Sparkline";
import CountUp from "../components/motion/CountUp";
import HoverTip from "../components/motion/HoverTip";
import type { LinkDisplay } from "../lib/aggregate";
import type { TelemetryPoint } from "../data/types";

/** Finds the point of largest latency deviation from baseline within the
 *  observed (t<=0) window — a generic stand-in for "where did this corridor
 *  drift" that works for any selected link instead of one hardcoded moment,
 *  and naturally yields no annotation for a genuinely stable corridor. */
function findDriftAnnotation(featured: LinkDisplay, points: TelemetryPoint[]) {
  const baseline = featured.link.baseline.latencyMs;
  const observed = points.filter((p) => p.t <= 0);
  let worst: TelemetryPoint | null = null;
  let worstDeviation = 0;
  for (const p of observed) {
    const deviation = Math.abs(p.latencyMs - baseline) / baseline;
    if (deviation > worstDeviation) {
      worstDeviation = deviation;
      worst = p;
    }
  }
  if (!worst || worstDeviation < 0.08) return undefined;
  return { t: worst.t, value: worst.latencyMs, label: `${featured.link.name} drift`, labelAbove: true };
}

export default function Overview() {
  const stats = overviewStats();
  const displays = allLinkDisplays();

  const [selectedLinkId, setSelectedLinkId] = useState("mumbai-delhi-core");
  const featured = displays.find((d) => d.link.id === selectedLinkId) ?? displays[0];
  const featuredPoints = getTelemetry(featured.link);
  const driftAnnotation = findDriftAnnotation(featured, featuredPoints);

  return (
    <div className="flex flex-col w-full">
      {/* Operational Header Anchor */}
      <section className="w-full pt-6 pb-16 border-b border-surface-container-highest">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          <div className="lg:col-span-7 flex flex-col justify-between">
            <h1 className="type-display-xl text-5xl md:text-6xl lg:text-[68px] leading-[1.02] text-primary mb-6">
              Know what needs
              <br className="hidden sm:inline" /> attention.
            </h1>
            <p className="type-body-lg text-on-surface-variant mt-6 max-w-2xl">
              Real-time telemetry and predictive drift detection across core transit corridors.
            </p>
          </div>
          <div className="lg:col-span-5 grid grid-cols-2 gap-x-10 gap-y-12 pt-2 lg:pt-0">
            <div className="flex flex-col border-l border-surface-container-highest pl-6">
              <span className="type-telemetry-hero text-[48px] leading-none text-primary tracking-[-0.035em]">
                <CountUp value={stats.networkBaselinePct} decimals={1} suffix="%" />
              </span>
              <span className="type-caption uppercase tracking-wider text-outline mt-3">Network baseline</span>
            </div>
            <div className="flex flex-col border-l border-surface-container-highest pl-6">
              <span className="type-telemetry-hero text-[48px] leading-none text-primary tracking-[-0.035em]">
                <CountUp value={stats.activeSignals} padTo={2} />
              </span>
              <span className="type-caption uppercase tracking-wider text-outline mt-3">Active signals</span>
            </div>
            <div className="flex flex-col border-l border-surface-container-highest pl-6">
              <span className="type-telemetry-hero text-[48px] leading-none text-primary tracking-[-0.035em]">
                <CountUp value={stats.openIncidents} padTo={2} />
              </span>
              <span className="type-caption uppercase tracking-wider text-outline mt-3">Open incidents</span>
            </div>
            <div className="flex flex-col border-l border-surface-container-highest pl-6">
              <div className="type-telemetry-hero text-[48px] leading-none text-primary tracking-[-0.035em] flex items-baseline gap-1.5">
                <CountUp value={stats.corridorsFlagged} />
                <span className="text-outline font-normal type-telemetry-lg text-[22px]">/ {stats.corridorsTotal}</span>
              </div>
              <div className="flex items-center gap-1 mt-2.5">
                {displays.map((d) => {
                  const hasCritical = d.openIncidents.some((i) => i.severity === "critical");
                  const color = hasCritical ? "bg-error" : d.displayStatus === "attention" ? "bg-secondary" : "bg-primary/20";
                  const isSelected = d.link.id === selectedLinkId;
                  return (
                    <HoverTip
                      key={d.link.id}
                      label={d.link.name}
                      value={d.displayStatus === "attention" ? "Needs review" : "Nominal"}
                      onClick={() => setSelectedLinkId(d.link.id)}
                      selected={isSelected}
                      className="group"
                    >
                      <span
                        className={`block w-4 rounded-full transition-all ${color} ${
                          isSelected ? "h-1.5 ring-1 ring-primary ring-offset-1 ring-offset-surface" : "h-1 group-hover:h-1.5"
                        }`}
                      />
                    </HoverTip>
                  );
                })}
              </div>
              <span className="type-caption uppercase tracking-wider text-outline mt-2">Corridors needing review</span>
            </div>
          </div>
        </div>
      </section>

      {/* Primary Visual: 48-Hour Telemetry Behaviour Trendline */}
      <section className="w-full py-14 border-b border-surface-container-highest">
        <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-6 pb-8 border-b border-surface-container-highest">
          <div className="space-y-1.5">
            <div className="type-caption uppercase tracking-wider text-outline flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-error shrink-0" />
              TELEMETRY &amp; FORECAST SIGNAL
            </div>
            <h2 className="type-headline-md text-primary tracking-tight">Latency &amp; Anomaly Variance (48h Transit Horizon)</h2>
          </div>
          <div className="flex flex-wrap items-center gap-6 type-telemetry-sm text-on-surface-variant">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-0.5 bg-primary" />
              <span>Core Transit Latency (Observed)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-0.5 border-b border-dashed border-primary" />
              <span>Predicted Horizon (+12h)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-0.5 bg-[#2850ce]" />
              <span>Packet Loss Residual</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-[#e3e2df]/60 border border-outline-variant" />
              <span>95% Confidence Interval</span>
            </div>
          </div>
        </div>
        <div className="pt-8">
          <TelemetryTrendChart
            points={featuredPoints}
            primaryKey="latencyMs"
            primaryUnit="ms"
            primaryLabel="Core Transit Latency"
            secondaryKey="lossPct"
            secondaryUnit="%"
            secondaryLabel="Packet Loss Residual"
            threshold={{ value: featured.link.baseline.latencyMs * 1.8, label: `Nominal Operating Ceiling (${Math.round(featured.link.baseline.latencyMs * 1.8)}ms)` }}
            annotation={driftAnnotation}
            height={300}
          />
        </div>
      </section>

      {/* Open Operational Focus Sections */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 py-14">
        <div className="lg:col-span-7 flex flex-col">
          <div className="flex items-baseline justify-between pb-4 border-b border-surface-container-highest">
            <div className="flex items-baseline gap-3">
              <h3 className="type-headline-md text-primary tracking-tight">Pending Drift Signals</h3>
              <span className="type-telemetry-sm text-outline">{String(stats.topSignals.length).padStart(2, "0")} Active Corridors</span>
            </div>
            <Link className="type-caption uppercase tracking-wider text-outline hover:text-primary transition-colors duration-150 flex items-center gap-1 group" to="/predictions">
              Inspect Matrix
              <span className="material-symbols-outlined text-[14px] group-hover:text-primary transition-colors">arrow_forward</span>
            </Link>
          </div>
          <div className="divide-y divide-surface-container-highest">
            {stats.topSignals.map((sig) => {
              const link = getLink(sig.linkId)!;
              const recentPoints = historyOnly(getTelemetry(link)).slice(-10);
              const spark = recentPoints.map((p) => p.latencyMs);
              const sparkTimes = recentPoints.map((p) => p.t);
              const tone = severityTone(sig.severity);
              const engineer = sig.relatedIncidentId ? getEngineer(displaysEngineerFor(sig.relatedIncidentId)) : undefined;
              return (
                <Link key={sig.id} to={`/predictions/${sig.id}`} className="group block cursor-pointer py-7 transition-colors duration-150">
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_BG[tone]}`} />
                        <h4 className="type-body-lg text-primary font-medium group-hover:text-secondary transition-colors duration-150 tracking-tight">
                          {link.name}
                        </h4>
                        <span className="type-telemetry-sm text-outline">{link.regionLabel}</span>
                      </div>
                      <p className="type-body-md text-on-surface-variant mt-2 max-w-xl leading-relaxed">{sig.narrative}</p>
                      <div className="flex items-center gap-4 mt-3 type-telemetry-sm text-outline">
                        <span>Forecast: {sig.faultDetail}</span>
                        <span>·</span>
                        <span>Assigned: {engineer ? engineer.name : "NetSense Model Agent"}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-4">
                      <div className="flex items-center gap-3">
                        <Sparkline
                          data={spark}
                          times={sparkTimes}
                          color={tone === "critical" ? "#ba1a1a" : tone === "warning" ? "#2850ce" : "#747878"}
                          className="w-16 h-8 hidden sm:block"
                          label="Latency"
                          formatValue={(v) => `${v.toFixed(1)}ms`}
                        />
                        <div>
                          <div className="type-telemetry-hero text-[40px] leading-none text-primary">
                            <CountUp value={sig.confidencePct} suffix="%" />
                          </div>
                          <span className="type-caption uppercase tracking-wider text-outline mt-1 block">Confidence</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
        <div className="lg:col-span-5 flex flex-col">
          <div className="flex items-baseline justify-between pb-4 border-b border-surface-container-highest">
            <div className="flex items-baseline gap-3">
              <h3 className="type-headline-md text-primary tracking-tight">Active Incidents</h3>
              <span className="type-telemetry-sm text-outline">{String(stats.topIncidents.length).padStart(2, "0")} Logged</span>
            </div>
            <Link className="type-caption uppercase tracking-wider text-outline hover:text-primary transition-colors duration-150 flex items-center gap-1 group" to="/incidents">
              Incident Log
              <span className="material-symbols-outlined text-[14px] group-hover:text-primary transition-colors">arrow_forward</span>
            </Link>
          </div>
          <div className="divide-y divide-surface-container-highest">
            {stats.topIncidents.map((inc) => {
              const link = getLink(inc.linkId)!;
              const engineer = getEngineer(inc.engineerId);
              const tone = severityTone(inc.severity === "critical" ? "critical" : inc.severity === "high" ? "high" : "medium");
              const statusTone = incidentStatusTone(inc.status);
              const stageSteps = inc.status === "resolved" ? 4 : inc.status === "mitigated" ? 3 : 2;
              return (
                <Link key={inc.id} to={`/incidents/${inc.id}`} className="group block cursor-pointer py-6 transition-colors duration-150">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_BG[tone]}`} />
                      <h4 className="type-body-md text-primary font-medium group-hover:text-secondary transition-colors duration-150 tracking-tight">
                        {link.name} {inc.faultLabel}
                      </h4>
                    </div>
                    <span className="type-telemetry-code text-outline">{hoursAgoLabel(inc.createdHoursAgo)}</span>
                  </div>
                  <div className="flex items-center justify-between text-body-sm type-body-sm text-on-surface-variant mt-2 pl-4">
                    <span>
                      {inc.severity === "critical" ? "P1 Critical" : inc.severity === "high" ? "P2 Major" : "P3 Minor"} · {engineer?.name}
                    </span>
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <span key={i} className={`w-2 h-1 rounded-full ${i < stageSteps ? TONE_BG[tone] : "bg-primary/20"}`} />
                        ))}
                      </div>
                      <span className={`type-caption font-medium uppercase tracking-wider ${TONE_TEXT[statusTone]}`}>{inc.status}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function displaysEngineerFor(incidentId?: string): string {
  if (!incidentId) return "";
  const inc = INCIDENTS.find((i) => i.id === incidentId);
  return inc?.engineerId ?? "";
}
