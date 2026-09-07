import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getLink } from "../data/links";
import { linkDisplay } from "../lib/aggregate";
import { getTelemetry, ANOMALY_ATTENTION_THRESHOLD } from "../lib/derive";
import { historyOnly } from "../data/telemetry";
import { getEngineer } from "../data/engineers";
import { cityName } from "../data/cities";
import { PREDICTIONS, SEVERITY_RANK } from "../data/predictions";
import { INCIDENTS } from "../data/incidents";
import type { Incident, Prediction } from "../data/types";
import { severityTone, incidentStatusTone, TONE_BG, TONE_TEXT } from "../lib/status";
import TelemetryTrendChart from "../components/charts/TelemetryTrendChart";
import RouteTopology from "../components/charts/RouteTopology";
import Sparkline from "../components/charts/Sparkline";
import AnimatedBar from "../components/motion/AnimatedBar";
import CountUp from "../components/motion/CountUp";
import NotFound from "./NotFound";

type MetricKey = "latencyMs" | "lossPct" | "jitterMs" | "bandwidthPct";

const METRIC_META: Record<Exclude<MetricKey, "latencyMs">, { label: string; color: string; unit: string }> = {
  lossPct: { label: "Loss Rate", color: "#B7791F", unit: "%" },
  jitterMs: { label: "Jitter", color: "#747878", unit: "ms" },
  bandwidthPct: { label: "Bandwidth", color: "#2850ce", unit: "%" },
};

const INCIDENT_STATUS_RANK: Record<Incident["status"], number> = { investigating: 0, mitigated: 1, resolved: 2 };

export default function LinkDetail() {
  const { linkId } = useParams();
  const link = linkId ? getLink(linkId) : undefined;
  const [emphasizedKey, setEmphasizedKey] = useState<MetricKey | null>(null);
  if (!link) return <NotFound label="link" backTo="/links" backLabel="Back to Network Links" />;

  const display = linkDisplay(link);
  const points = getTelemetry(link);
  const history = historyOnly(points);
  const attention = display.displayStatus === "attention";
  const criticalIncident = display.openIncidents.find((i) => i.severity === "critical");

  // Every prediction/incident that has ever targeted this link — not just
  // the ones currently "active"/"open" — so a monitored signal or a
  // resolved incident still shows up here instead of vanishing entirely.
  const linkPredictions = PREDICTIONS.filter((p) => p.linkId === link.id).sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.predictedAtHoursAgo - b.predictedAtHoursAgo,
  );
  const linkIncidents = INCIDENTS.filter((i) => i.linkId === link.id).sort(
    (a, b) => INCIDENT_STATUS_RANK[a.status] - INCIDENT_STATUS_RANK[b.status] || a.createdHoursAgo - b.createdHoursAgo,
  );

  const headline = criticalIncident
    ? "Active drift. This corridor needs attention."
    : attention
      ? "Stable now. One signal is starting to move."
      : "All clear on this corridor.";

  const description = criticalIncident
    ? `${link.name} trunk corridor. 48-hour continuous trace reveals an active anomaly under investigation while composite health score holds at ${display.healthScore.toFixed(1)}%.`
    : attention
      ? `${link.name} trunk corridor. 48-hour continuous trace reveals early telemetry drift while composite health score holds at ${display.healthScore.toFixed(1)}%.`
      : `${link.name} trunk corridor. 48-hour continuous trace holds within nominal operating envelope at ${display.healthScore.toFixed(1)}% composite health.`;

  const spark14 = history.slice(-14);
  const spark14Times = spark14.map((p) => p.t);
  const healthSpark = spark14.map((p) => 100 - Math.max(0, (p.latencyMs - link.baseline.latencyMs) / link.baseline.latencyMs) * 40);
  const latencySpark = spark14.map((p) => p.latencyMs);
  const lossSpark = history.slice(-12).map((p) => p.lossPct);
  const jitterSpark = spark14.map((p) => p.jitterMs);

  const anomalyPct = Math.min(100, display.anomalyScore * 100);
  const anomalyExceeded = display.anomalyScore >= ANOMALY_ATTENTION_THRESHOLD;

  // Evidence → chart emphasis: clicking Latency/Loss/Jitter/Bandwidth swaps
  // which metric is drawn as the chart's secondary trace. Untouched, this
  // resolves to exactly today's default (Loss Rate) — nothing shifts unless
  // the operator interacts.
  const secondaryKey = emphasizedKey === "latencyMs" ? undefined : (emphasizedKey ?? "lossPct");
  const secondaryMeta = secondaryKey ? METRIC_META[secondaryKey] : undefined;
  const toggleMetric = (key: MetricKey) => setEmphasizedKey((cur) => (cur === key ? null : key));

  return (
    <div className="flex flex-col w-full">
      {/* BREADCRUMB & HEADER SECTION */}
      <section className="w-full mb-12">
        <div className="flex flex-col gap-6 pb-12 border-b border-primary">
          <Link to="/links" className="type-caption uppercase tracking-wider text-outline hover:text-primary transition-colors w-fit">
            ← All Network Links
          </Link>
          <h1 className="type-display-xl text-4xl md:text-5xl lg:text-[56px] leading-[1.05] text-primary max-w-5xl pt-2">{headline}</h1>
          <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-6 pt-2">
            <p className="type-body-lg text-on-surface-variant max-w-3xl">{description}</p>
            <div className="flex flex-wrap items-center gap-6 type-telemetry-code shrink-0">
              <MetaItem label="Circuit" value={link.circuitId} />
              <div className="h-8 w-px bg-outline-variant/60" />
              <MetaItem label="Sampling Rate" value={link.samplingRate} />
              <div className="h-8 w-px bg-outline-variant/60" />
              <MetaItem label="Model Engine" value={link.modelEngine} />
            </div>
          </div>
        </div>
      </section>

      {/* LIVE OPERATIONAL STATE */}
      <section className="w-full mb-16">
        <div className="py-2">
          <div className="flex items-baseline justify-between mb-8 pb-3 border-b border-outline-variant/60">
            <div className="flex items-baseline gap-3">
              <span className="type-caption uppercase tracking-wider text-primary font-medium">Live Operational State</span>
              <span className="type-telemetry-code text-outline">Synced 4s ago via gRPC streaming</span>
            </div>
            <span className="type-telemetry-code text-outline uppercase">Segment Telemetry Feed</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 lg:gap-8 pb-10 border-b border-outline-variant/60">
            <Stat label="Health Score" tag={attention ? "ATTENTION" : "NOMINAL"} value={display.healthScore} unit="%">
              <Sparkline data={healthSpark} times={spark14Times} color="#1c1b1a" className="w-full h-5" dot label="Health" formatValue={(v) => `${v.toFixed(1)}%`} />
              <div className="type-telemetry-code text-outline">Composite of latency, loss &amp; jitter</div>
            </Stat>
            <Stat
              label="RTT Latency"
              tag={`${display.latencyDeltaMs >= 0 ? "+" : ""}${display.latencyDeltaMs.toFixed(1)}ms`}
              tagColor={attention ? "#B7791F" : undefined}
              value={display.now.latencyMs}
              unit="ms"
              active={emphasizedKey === "latencyMs"}
              onSelect={() => toggleMetric("latencyMs")}
            >
              <Sparkline data={latencySpark} times={spark14Times} color={attention ? "#B7791F" : "#1c1b1a"} className="w-full h-5" dot label="RTT" formatValue={(v) => `${v.toFixed(1)}ms`} />
              <div className="type-telemetry-code" style={{ color: attention ? "#B7791F" : undefined }}>
                {attention ? "Drift vs. baseline" : "Within baseline"}
              </div>
            </Stat>
            <Stat
              label="Packet Loss"
              tag={`${link.baseline.lossPct.toFixed(2)}% Baseline`}
              value={display.now.lossPct}
              decimals={2}
              unit="%"
              active={emphasizedKey === "lossPct" || (emphasizedKey === null && secondaryKey === "lossPct")}
              onSelect={() => toggleMetric("lossPct")}
            >
              <div className="h-5 w-full my-1.5 flex items-center gap-1 opacity-70">
                {lossSpark.map((v, i) => (
                  <div key={i} className="w-1 bg-outline-variant/60" style={{ height: `${Math.max(6, Math.min(20, v * 40 + 6))}px`, backgroundColor: v > link.baseline.lossPct * 3 ? "#B7791F" : undefined }} />
                ))}
              </div>
              <div className="type-telemetry-code" style={{ color: display.now.lossPct > link.baseline.lossPct * 3 ? "#B7791F" : undefined }}>
                {display.now.lossPct > link.baseline.lossPct * 3 ? "Intermittent drops" : "Stable"}
              </div>
            </Stat>
            <Stat label="Transit Jitter" tag="P99 Peak" value={display.now.jitterMs} unit="ms" active={emphasizedKey === "jitterMs"} onSelect={() => toggleMetric("jitterMs")}>
              <Sparkline data={jitterSpark} times={spark14Times} color="#1c1b1a" className="w-full h-5" dot={false} label="Jitter" formatValue={(v) => `${v.toFixed(1)}ms`} />
              <div className="type-telemetry-code text-outline">{display.jitterDeltaMs > 0.8 ? "Elevated variance" : "Within envelope"}</div>
            </Stat>
            <Stat
              label="Bandwidth Util."
              tag={`${(link.baseline.bandwidthPct * 1.6).toFixed(0)} Gbps cap`}
              value={display.now.bandwidthPct}
              unit="%"
              active={emphasizedKey === "bandwidthPct"}
              onSelect={() => toggleMetric("bandwidthPct")}
            >
              <div className="h-5 w-full my-1.5 flex items-center">
                <div className="w-full h-1.5 bg-outline-variant/40 rounded-full overflow-hidden flex">
                  <AnimatedBar pct={display.now.bandwidthPct} className="h-full bg-primary" />
                </div>
              </div>
              <div className="type-telemetry-code text-outline">Capacity: {display.now.bandwidthPct.toFixed(1)}%</div>
            </Stat>
            <Stat label="Anomaly Index" tag={anomalyExceeded ? "ELEVATED" : "NORMAL"} tagColor={anomalyExceeded ? "#B7791F" : undefined} value={display.anomalyScore} decimals={2} unit="" valueColor={anomalyExceeded ? "#B7791F" : undefined}>
              <div className="h-5 w-full my-1.5 flex items-center relative">
                <div className="w-full h-1.5 bg-outline-variant/40 rounded-full overflow-hidden">
                  <AnimatedBar pct={anomalyPct} className="h-full" style={{ backgroundColor: anomalyExceeded ? "#B7791F" : "#1c1b1a" }} />
                </div>
                <div className="absolute top-0 bottom-0 w-0.5 bg-[#C74646]" style={{ left: `${ANOMALY_ATTENTION_THRESHOLD * 100}%` }} title={`Threshold ${ANOMALY_ATTENTION_THRESHOLD}`} />
              </div>
              <div className="type-telemetry-code" style={{ color: anomalyExceeded ? "#B7791F" : undefined }}>
                Threshold: {ANOMALY_ATTENTION_THRESHOLD.toFixed(2)} {anomalyExceeded ? "(Exceeded)" : "(Within envelope)"}
              </div>
            </Stat>
          </div>
        </div>
      </section>

      {/* TELEMETRY 48H MULTI-SIGNAL INSPECTOR */}
      <section className="w-full mb-16">
        <div className="pt-4 pb-3 flex flex-col md:flex-row md:items-baseline justify-between gap-4 border-t border-primary">
          <div className="flex items-baseline gap-4">
            <span className="type-caption uppercase tracking-wider text-primary font-medium">Telemetry Stream</span>
            <span className="type-telemetry-code text-outline">48h Dual-Trace Continuous</span>
          </div>
          <div className="flex items-center gap-6 type-telemetry-code text-outline">
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-primary" />
              <span className="text-on-surface">Latency RTT</span>
            </div>
            {secondaryMeta && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5" style={{ backgroundColor: secondaryMeta.color }} />
                <span className="text-on-surface">{secondaryMeta.label}</span>
              </div>
            )}
          </div>
        </div>
        <div className="pt-8">
          <TelemetryTrendChart
            points={points}
            primaryKey="latencyMs"
            primaryUnit="ms"
            primaryLabel="Latency RTT"
            secondaryKey={secondaryKey}
            secondaryColor={secondaryMeta?.color}
            secondaryUnit={secondaryMeta?.unit}
            secondaryLabel={secondaryMeta?.label}
            baseline={{ value: link.baseline.latencyMs, label: `${link.baseline.latencyMs}ms NOMINAL BASELINE` }}
            height={320}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pt-6 border-t border-outline-variant/60 type-body-sm text-on-surface-variant">
          <div className="pr-4">
            <span className="type-caption uppercase tracking-wider text-outline block mb-1.5">Physical Layer</span>
            <p className="leading-relaxed">{link.physicalLayerNote}</p>
          </div>
          <div className="pr-4 md:border-l md:border-outline-variant/60 md:pl-8">
            <span className="type-caption uppercase tracking-wider text-outline block mb-1.5">Buffer Dynamics</span>
            <p className="leading-relaxed">{link.bufferDynamicsNote}</p>
          </div>
          <div className="md:border-l md:border-outline-variant/60 md:pl-8">
            <span className="type-caption uppercase tracking-wider text-outline block mb-1.5">Model Inference</span>
            <p className="leading-relaxed">{link.modelInferenceNote}</p>
          </div>
        </div>
      </section>

      {/* ASYMMETRIC DUAL COLUMNS: PREDICTIONS & INCIDENTS */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 pt-6 border-t border-outline-variant/60">
        <div className="lg:col-span-7 flex flex-col pr-0 lg:pr-8">
          <div className="flex items-baseline justify-between mb-4 border-b border-primary pb-2">
            <div className="flex items-baseline gap-3">
              <span className="type-caption uppercase tracking-wider text-primary font-medium">Predictions</span>
              {linkPredictions.length === 1 && <span className="type-telemetry-code text-outline">{linkPredictions[0].id}</span>}
              {linkPredictions.length > 1 && <span className="type-telemetry-code text-outline">{linkPredictions.length} Signals</span>}
            </div>
            {linkPredictions.length === 1 && (
              <span className="type-telemetry-code uppercase font-medium" style={{ color: linkPredictions[0].severity === "high" ? "#B7791F" : "#747878" }}>
                {linkPredictions[0].severity} severity
              </span>
            )}
          </div>
          {linkPredictions.length === 0 && <EmptySignal text="No predictive signal has ever targeted this corridor." />}
          {linkPredictions.length === 1 && (() => {
            const prediction = linkPredictions[0];
            return (
              <div className="py-2 flex flex-col justify-between h-full">
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-4 mb-3">
                    <h2 className="type-headline-md text-primary">{prediction.headline}</h2>
                    <div className="flex items-baseline gap-2">
                      <span className="type-body-sm text-outline">Confidence</span>
                      <span className="type-telemetry-lg text-primary">
                        <CountUp value={prediction.confidencePct} suffix="%" />
                      </span>
                    </div>
                  </div>
                  <p className="type-body-md text-on-surface-variant mb-6 leading-relaxed">{prediction.narrative}</p>
                </div>
                <div className="pt-2">
                  <Link className="inline-flex items-center gap-2 type-body-md text-primary hover:text-secondary font-medium transition-colors" to={`/predictions/${prediction.id}`}>
                    <span>View Prediction Detail</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            );
          })()}
          {linkPredictions.length > 1 && (
            <div className="flex flex-col">
              {linkPredictions.map((p) => (
                <PredictionRow key={p.id} prediction={p} />
              ))}
            </div>
          )}
        </div>
        <div className="lg:col-span-5 flex flex-col lg:border-l lg:border-outline-variant/60 lg:pl-12">
          <div className="flex items-baseline justify-between mb-4 border-b border-primary pb-2">
            <div className="flex items-baseline gap-3">
              <span className="type-caption uppercase tracking-wider text-primary font-medium">Incidents</span>
              {linkIncidents.length === 1 && <span className="type-telemetry-code text-outline">{linkIncidents[0].id}</span>}
              {linkIncidents.length > 1 && <span className="type-telemetry-code text-outline">{linkIncidents.length} Logged</span>}
            </div>
            {linkIncidents.length === 1 && (
              <span className={`type-telemetry-code uppercase font-medium ${TONE_TEXT[incidentStatusTone(linkIncidents[0].status)]}`}>{linkIncidents[0].status}</span>
            )}
          </div>
          {linkIncidents.length === 0 && <EmptySignal text="No incident has ever been logged on this corridor." />}
          {linkIncidents.length === 1 && (() => {
            const incident = linkIncidents[0];
            return (
              <div className="py-2 flex flex-col justify-between h-full">
                <div>
                  <h2 className="type-headline-md text-primary mb-3">{incident.title}</h2>
                  <p className="type-body-md text-on-surface-variant mb-6 leading-relaxed">{incident.faultDetail}</p>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  <Link className="inline-flex items-center gap-2 type-body-md text-primary hover:text-secondary font-medium transition-colors" to={`/incidents/${incident.id}`}>
                    <span>View Incident Detail</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </Link>
                  <span className="type-caption uppercase tracking-wider text-outline">{getEngineer(incident.engineerId)?.name}</span>
                </div>
              </div>
            );
          })()}
          {linkIncidents.length > 1 && (
            <div className="flex flex-col">
              {linkIncidents.map((i) => (
                <IncidentRow key={i.id} incident={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* BOTTOM ROUTE TOPOLOGY METADATA */}
      <section className="w-full mt-16 pt-8 border-t border-primary">
        <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4 mb-6">
          <div className="flex items-baseline gap-3">
            <span className="type-caption uppercase tracking-wider text-primary font-medium">Physical Link Architecture</span>
            <span className="type-telemetry-code text-outline">
              {cityName(link.endpoints.from)}–{cityName(link.endpoints.to)} Corridor Route Trace
            </span>
          </div>
          <div className="type-telemetry-code text-outline">
            {link.route.distanceKm.toLocaleString()} km Optical Path • Cumulative Dispersion: {link.route.dispersionPsNm.toLocaleString()} ps/nm
          </div>
        </div>
        <div className="py-4 my-2 border-t border-outline-variant/60">
          <RouteTopology route={link.route} attention={attention} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 py-6 border-y border-outline-variant/60">
          <RouteNode label={`Ingress Node (${cityName(link.endpoints.from)})`} id={link.route.ingressNode.id} site={link.route.ingressNode.site} note={`TX Power: ${link.route.ingressNode.txPowerDbm} dBm`} />
          <RouteNode label="Intermediate Optical Amp" id={link.route.amp1.id} site={link.route.amp1.note} note={`Gain Tilt: +${link.route.amp1.gainTiltDb} dB`} noteColor={attention ? "#B7791F" : undefined} border />
          <RouteNode label="Intermediate Optical Amp" id={link.route.amp2.id} site={link.route.amp2.note} note={`OSNR: ${link.route.amp2.osnrDb} dB`} border />
          <RouteNode label={`Egress Node (${cityName(link.endpoints.to)})`} id={link.route.egressNode.id} site={link.route.egressNode.site} note={`RX Power: ${link.route.egressNode.rxPowerDbm} dBm`} border />
        </div>
      </section>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <span className="text-outline block type-caption uppercase tracking-wider">{label}</span>
      <span className="text-primary type-telemetry-code font-medium">{value}</span>
    </div>
  );
}

function PredictionRow({ prediction }: { prediction: Prediction }) {
  const tone = severityTone(prediction.severity);
  return (
    <Link
      to={`/predictions/${prediction.id}`}
      className="group flex items-center justify-between gap-4 py-3 border-b border-outline-variant/40 last:border-b-0 transition-colors hover:bg-surface-container-low/50"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_BG[tone]}`} />
        <span className="type-body-md text-primary font-medium truncate group-hover:text-secondary transition-colors">{prediction.faultLabel}</span>
        <span className="type-telemetry-code text-outline shrink-0">{prediction.id}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="type-telemetry-sm text-primary tabular-nums">{prediction.confidencePct}%</span>
        <span className="type-caption uppercase tracking-wider text-outline">{prediction.status}</span>
      </div>
    </Link>
  );
}

function IncidentRow({ incident }: { incident: Incident }) {
  const tone = severityTone(incident.severity === "critical" ? "critical" : incident.severity === "high" ? "high" : "medium");
  return (
    <Link
      to={`/incidents/${incident.id}`}
      className="group flex items-center justify-between gap-4 py-3 border-b border-outline-variant/40 last:border-b-0 transition-colors hover:bg-surface-container-low/50"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_BG[tone]}`} />
        <span className="type-body-md text-primary font-medium truncate group-hover:text-secondary transition-colors">{incident.faultLabel}</span>
        <span className="type-telemetry-code text-outline shrink-0">{incident.id}</span>
      </div>
      <span className="type-caption uppercase tracking-wider text-outline shrink-0">{incident.status}</span>
    </Link>
  );
}

function Stat({
  label,
  tag,
  tagColor,
  value,
  decimals = 1,
  unit,
  valueColor,
  active,
  onSelect,
  children,
}: {
  label: string;
  tag: string;
  tagColor?: string;
  value: number;
  decimals?: number;
  unit: string;
  valueColor?: string;
  active?: boolean;
  onSelect?: () => void;
  children: React.ReactNode;
}) {
  const interactive = Boolean(onSelect);
  return (
    <div
      className={`group flex flex-col lg:border-l lg:border-outline-variant/60 lg:pl-6 first:border-l-0 first:pl-0 ${interactive ? "cursor-pointer" : ""}`}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? "button" : undefined}
      aria-pressed={interactive ? active : undefined}
      onClick={onSelect}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={`type-body-sm transition-colors ${
            active ? "text-primary font-semibold" : interactive ? "text-on-surface-variant group-hover:text-primary" : "text-on-surface-variant"
          }`}
        >
          {label}
        </span>
        <span className="type-telemetry-code text-outline" style={{ color: tagColor }}>
          {tag}
        </span>
      </div>
      <div className="type-telemetry-hero text-primary tracking-tighter" style={{ color: valueColor, fontSize: 36 }}>
        <CountUp value={value} decimals={decimals} />
        <span className="type-body-md text-outline ml-1 font-normal">{unit}</span>
      </div>
      {children}
    </div>
  );
}

function RouteNode({
  label,
  id,
  site,
  note,
  noteColor,
  border,
}: {
  label: string;
  id: string;
  site: string;
  note: string;
  noteColor?: string;
  border?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 ${border ? "md:border-l md:border-outline-variant/60 md:pl-6" : ""}`}>
      <span className="type-caption uppercase text-outline">{label}</span>
      <span className="type-telemetry-md text-primary">{id}</span>
      <span className="type-body-sm text-on-surface-variant">{site}</span>
      <span className="type-telemetry-code mt-1" style={{ color: noteColor }}>
        {note}
      </span>
    </div>
  );
}

function EmptySignal({ text }: { text: string }) {
  return (
    <div className="py-8">
      <p className="type-body-md text-outline">{text}</p>
    </div>
  );
}
