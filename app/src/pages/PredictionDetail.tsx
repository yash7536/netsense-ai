import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPrediction } from "../data/predictions";
import { getLink } from "../data/links";
import { getIncident } from "../data/incidents";
import { getEngineer } from "../data/engineers";
import { cityName } from "../data/cities";
import { linkDisplay } from "../lib/aggregate";
import { getTelemetry, ANOMALY_ATTENTION_THRESHOLD } from "../lib/derive";
import TelemetryTrendChart from "../components/charts/TelemetryTrendChart";
import RiskHorizonMini from "../components/charts/RiskHorizonMini";
import CountUp from "../components/motion/CountUp";
import { severityTone } from "../lib/status";
import { hoursAgoLabel } from "../lib/format";
import NotFound from "./NotFound";

const RISK_TONE: Record<string, string> = {
  critical: "text-[#C74646] font-medium",
  "at-risk": "text-[#B7791F] font-medium",
  nominal: "text-outline",
};

const RISK_LABEL: Record<string, string> = {
  critical: "Critical Path",
  "at-risk": "SLA At Risk",
  nominal: "Nominal",
};

type MetricKey = "latencyMs" | "lossPct" | "jitterMs" | "bandwidthPct";

const METRIC_META: Record<Exclude<MetricKey, "latencyMs">, { label: string; color: string; unit: string }> = {
  lossPct: { label: "Packet Loss", color: "#B7791F", unit: "%" },
  jitterMs: { label: "Jitter", color: "#747878", unit: "ms" },
  bandwidthPct: { label: "Bandwidth Utilisation", color: "#2850ce", unit: "%" },
};

export default function PredictionDetail() {
  const { predictionId } = useParams();
  const prediction = predictionId ? getPrediction(predictionId) : undefined;
  const [emphasizedKey, setEmphasizedKey] = useState<MetricKey | null>(null);
  if (!prediction) return <NotFound label="prediction" backTo="/predictions" backLabel="Back to Predictions" />;

  const link = getLink(prediction.linkId)!;
  const display = linkDisplay(link);
  const points = getTelemetry(link);
  const incident = prediction.relatedIncidentId ? getIncident(prediction.relatedIncidentId) : undefined;
  const engineer = incident ? getEngineer(incident.engineerId) : undefined;
  const tone = severityTone(prediction.severity);

  const inceptionT = -Math.min(11, prediction.predictedAtHoursAgo + 3);
  const inceptionPoint = points.find((p) => p.t === inceptionT) ?? points[0];
  const recentPoints = points.filter((p) => p.t >= -12);

  // Evidence → chart emphasis: selecting an evidence tile draws that metric
  // as the chart's secondary trace. Left untouched, this resolves to exactly
  // today's single-trace latency view — nothing changes until the operator clicks.
  const secondaryKey = emphasizedKey && emphasizedKey !== "latencyMs" ? emphasizedKey : undefined;
  const secondaryMeta = secondaryKey ? METRIC_META[secondaryKey] : undefined;
  const toggleMetric = (key: MetricKey) => setEmphasizedKey((cur) => (cur === key ? null : key));

  return (
    <div className="flex flex-col w-full">
      <div className="w-full pb-8 mb-10 border-b border-[#E3E1DC]">
        <Link to="/predictions" className="type-caption uppercase tracking-wider text-outline hover:text-primary transition-colors w-fit inline-block mb-6">
          ← All Predictions
        </Link>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-baseline">
          <div className="lg:col-span-8">
            <h1 className="type-headline-lg text-4xl md:text-5xl lg:text-[56px] font-black text-primary tracking-[-0.035em] leading-[1.05] mb-6">
              Something changed.
              <br className="hidden sm:inline" /> Here's why it matters.
            </h1>
            <p className="type-headline-md text-primary font-normal mt-3 tracking-tight">
              {prediction.faultLabel} on {link.name} <span className="type-telemetry-code text-outline font-normal">({prediction.id})</span>
            </p>
            <p className="type-body-lg text-on-surface-variant font-normal mt-3 max-w-2xl leading-relaxed">{prediction.narrative}</p>
          </div>
          <div className="lg:col-span-4 flex flex-col justify-end pt-2">
            <div className="space-y-2 type-telemetry-sm border-t border-[#E3E1DC]/60 lg:border-t-0 pt-3 lg:pt-0">
              <MetaRow label="Target Link">
                <Link to={`/links/${link.id}`} className="text-secondary hover:underline underline-offset-4 flex items-center gap-1 type-body-md">
                  <span className="font-medium">{link.name}</span>
                </Link>
              </MetaRow>
              <MetaRow label="Endpoints">
                <span className="text-primary type-telemetry-sm font-medium tracking-tight">
                  {cityName(link.endpoints.from)} ⇄ {cityName(link.endpoints.to)}
                </span>
              </MetaRow>
              <MetaRow label="Interface / Path">
                <span className="type-telemetry-code text-on-surface tracking-tight">{prediction.interfacePath}</span>
              </MetaRow>
              <MetaRow label="Confidence">
                <span className="text-primary type-telemetry-sm font-semibold tabular-nums">
                  <CountUp value={prediction.confidencePct} decimals={1} suffix="%" />
                </span>
              </MetaRow>
              <MetaRow label="Predicted">
                <span className="text-on-surface-variant type-telemetry-sm tabular-nums">{hoursAgoLabel(prediction.predictedAtHoursAgo)}</span>
              </MetaRow>
              <MetaRow label="Remediation Mode" last>
                <span className="type-telemetry-code text-on-surface-variant uppercase tracking-wider">{prediction.remediationMode}</span>
              </MetaRow>
            </div>
          </div>
        </div>
      </div>

      <section className="w-full mb-14">
        <div className="flex items-baseline justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="type-caption uppercase tracking-widest text-primary font-semibold">01 / Evidence</span>
            <span className="h-px w-8 bg-[#E3E1DC]" />
            <span className="type-telemetry-code text-outline uppercase">1000ms Probe Cycle</span>
          </div>
          <span className="type-caption text-outline uppercase tracking-wider">Status: {prediction.status === "monitored" ? "Monitored" : "Active Anomaly"}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 pt-5 border-t border-[#111111]">
          <Evidence label="Latency" value={display.now.latencyMs} unit="ms" delta={`${display.latencyDeltaPct >= 0 ? "+" : ""}${display.latencyDeltaPct.toFixed(1)}% vs baseline`} warn={display.latencyDeltaPct > 5} active={emphasizedKey === "latencyMs"} onSelect={() => toggleMetric("latencyMs")} />
          <Evidence label="Packet Loss" value={display.now.lossPct} decimals={2} unit="%" delta={`${(display.now.lossPct - link.baseline.lossPct >= 0 ? "+" : "")}${(display.now.lossPct - link.baseline.lossPct).toFixed(2)}% delta`} warn={display.now.lossPct > link.baseline.lossPct * 2} active={emphasizedKey === "lossPct"} onSelect={() => toggleMetric("lossPct")} />
          <Evidence label="Jitter" value={display.now.jitterMs} unit="ms" delta={display.jitterDeltaMs > 0.5 ? "Elevated variance" : "Nominal"} warn={display.jitterDeltaMs > 0.5} active={emphasizedKey === "jitterMs"} onSelect={() => toggleMetric("jitterMs")} />
          <Evidence label="Bandwidth Utilisation" value={display.now.bandwidthPct} unit="%" delta={display.now.bandwidthPct > 80 ? "Ingress heavy" : "Nominal"} neutral active={emphasizedKey === "bandwidthPct"} onSelect={() => toggleMetric("bandwidthPct")} />
          <Evidence label="Anomaly Score" value={display.anomalyScore} decimals={2} unit="" delta={`Threshold ${ANOMALY_ATTENTION_THRESHOLD.toFixed(2)}`} warn={display.anomalyScore >= ANOMALY_ATTENTION_THRESHOLD} accent />
          <Evidence label="Health Score" value={display.healthScore} unit="%" delta={display.healthScore < 95 ? "Below composite target" : "Nominal"} warn={display.healthScore < 95} />
        </div>

        <div className="mt-10 pt-6 border-t border-[#E3E1DC]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <span className="type-caption uppercase tracking-wider text-outline">Telemetry Trend</span>
              <p className="type-body-sm text-on-surface-variant mt-1">Observed latency drift over the past 12 hours against the projected horizon.</p>
            </div>
            <div className="flex items-center gap-6 type-caption uppercase">
              <LegendSwatch color="#666666" label={`Baseline (${link.baseline.latencyMs}ms)`} />
              <LegendSwatch color="#111111" label="Observed Latency" />
              <LegendSwatch color="#2850ce" label="Projected Drift" dashed />
              {secondaryMeta && <LegendSwatch color={secondaryMeta.color} label={secondaryMeta.label} />}
            </div>
          </div>
          <div className="w-full bg-surface pt-4 pb-2 border-b border-[#E3E1DC]">
            <TelemetryTrendChart
              points={recentPoints}
              primaryKey="latencyMs"
              primaryUnit="ms"
              baseline={{ value: link.baseline.latencyMs, label: `${link.baseline.latencyMs}ms baseline` }}
              annotation={{ t: inceptionT, value: inceptionPoint.latencyMs, label: "Inception Point", color: "#C74646" }}
              secondaryKey={secondaryKey}
              secondaryColor={secondaryMeta?.color}
              secondaryUnit={secondaryMeta?.unit}
              secondaryLabel={secondaryMeta?.label}
              xTickCount={7}
              height={200}
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-14">
        <section className="lg:col-span-7">
          <div className="flex items-center gap-3 mb-6 pb-2 border-b border-[#111111]">
            <span className="type-caption uppercase tracking-widest text-primary font-semibold">02 / Risk — Blast Radius</span>
          </div>
          <div className="space-y-6">
            <div>
              <div className="type-headline-md text-primary font-normal">{prediction.projectedRiskLabel} Degradation Risk</div>
              <p className="type-body-md text-on-surface-variant mt-2 leading-relaxed max-w-2xl">
                {prediction.faultDetail} is projected to escalate within <span className="text-primary type-telemetry-code font-medium">{prediction.horizonHours} hours</span> if unmitigated.
              </p>
            </div>
            <div className="pt-2">
              <div className="w-full h-12 mb-2">
                <RiskHorizonMini
                  horizonHours={prediction.horizonHours}
                  confidencePct={prediction.confidencePct}
                  thresholdLabel={`${prediction.projectedRiskLabel.toUpperCase()} THRESHOLD`}
                  color={tone === "critical" ? "#C74646" : "#B7791F"}
                />
              </div>
              <div className="type-caption uppercase text-outline mb-3">Downstream Affected Circuits ({prediction.impactRadiusCircuits} Total)</div>
              <div className="divide-y divide-[#E3E1DC]/60 type-telemetry-sm border-t border-b border-[#E3E1DC]/60">
                {prediction.affectedCircuits.map((c) => (
                  <div key={c.id} className="grid grid-cols-12 items-center py-2.5">
                    <span className="col-span-4 text-primary font-medium tracking-tight">{c.id}</span>
                    <span className="col-span-5 text-on-surface-variant type-body-sm truncate">{c.label}</span>
                    <span className={`col-span-3 text-right ${RISK_TONE[c.risk]}`}>{RISK_LABEL[c.risk]}</span>
                  </div>
                ))}
              </div>
              {prediction.impactRadiusCircuits > prediction.affectedCircuits.length && (
                <div className="pt-3 text-right">
                  <span className="type-caption text-outline uppercase">
                    +{prediction.impactRadiusCircuits - prediction.affectedCircuits.length} additional non-critical internal circuits
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
        <section className="lg:col-span-5">
          <div className="flex items-center gap-3 mb-6 pb-2 border-b border-[#111111]">
            <span className="type-caption uppercase tracking-widest text-primary font-semibold">Context &amp; Correlation</span>
          </div>
          <div className="space-y-6">
            {incident ? (
              <div className="pb-4 border-b border-[#E3E1DC]">
                <div className="flex items-center justify-between">
                  <span className="type-caption uppercase text-outline">Related Incident</span>
                  <span className="type-telemetry-code text-[#C74646]">{incident.status.toUpperCase()}</span>
                </div>
                <div className="mt-2 type-headline-md text-primary font-medium">
                  {incident.id} <span className="type-body-md text-on-surface-variant font-normal">— {incident.faultLabel}</span>
                </div>
                <p className="type-body-sm text-on-surface-variant mt-1.5 leading-relaxed">{incident.faultDetail}</p>
                <div className="mt-3 flex justify-between items-center">
                  <span className="type-telemetry-code text-outline">ASSIGNED SRE: {engineer?.name.toUpperCase()}</span>
                  <Link to={`/incidents/${incident.id}`} className="type-telemetry-sm text-secondary hover:underline underline-offset-4">
                    View Incident →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="pb-4 border-b border-[#E3E1DC]">
                <span className="type-caption uppercase text-outline">Related Incident</span>
                <p className="type-body-sm text-on-surface-variant mt-2 leading-relaxed">No incident has been opened from this signal yet.</p>
              </div>
            )}
            <div>
              <span className="type-caption uppercase text-outline block mb-2">Analysis Context</span>
              <p className="type-body-md text-on-surface-variant leading-relaxed">
                Synthesized from multi-point probe telemetry across link parameters. Automated changes are disabled for core backbone links; operator confirmation required.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="w-full pt-8 pb-12 border-t border-[#111111]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <span className="type-caption uppercase tracking-widest text-primary font-semibold block mb-1.5">03 / Action</span>
            <div className="type-headline-md text-primary font-normal">Recommended Intervention</div>
            <p className="type-body-sm text-on-surface-variant mt-0.5">Operator-directed diagnosis and escalation procedures.</p>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Link to={`/links/${link.id}`} className="text-primary hover:text-secondary font-medium flex items-center gap-1.5 underline underline-offset-4 transition-colors">
              <span>Review Telemetry</span>
              <span className="material-symbols-outlined text-[16px]">arrow_outward</span>
            </Link>
            {incident ? (
              <Link to={`/incidents/${incident.id}`} className="text-primary hover:text-secondary font-medium flex items-center gap-1.5 underline underline-offset-4 transition-colors">
                <span>Open Incident</span>
                <span className="material-symbols-outlined text-[16px]">arrow_outward</span>
              </Link>
            ) : null}
            <Link to={`/links/${link.id}`} className="text-on-surface-variant hover:text-primary type-body-md underline underline-offset-4 transition-colors">
              View Affected Link
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetaRow({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline py-1.5 ${last ? "" : "border-b border-[#E3E1DC]/60"}`}>
      <span className="type-caption text-outline uppercase tracking-wider">{label}</span>
      {children}
    </div>
  );
}

function LegendSwatch({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-4 h-[1.5px] inline-block" style={{ backgroundColor: dashed ? "transparent" : color, borderBottom: dashed ? `1.5px dashed ${color}` : undefined }} />
      <span className="text-outline">{label}</span>
    </div>
  );
}

function Evidence({
  label,
  value,
  decimals = 1,
  unit,
  delta,
  warn,
  neutral,
  accent,
  active,
  onSelect,
}: {
  label: string;
  value: number;
  decimals?: number;
  unit: string;
  delta: string;
  warn?: boolean;
  neutral?: boolean;
  accent?: boolean;
  active?: boolean;
  onSelect?: () => void;
}) {
  const deltaColor = neutral ? "text-on-surface-variant" : warn ? "text-[#C74646]" : "text-outline";
  const interactive = Boolean(onSelect);
  return (
    <div
      className={`group flex flex-col lg:border-r border-[#E3E1DC]/60 pr-4 last:border-r-0 ${interactive ? "cursor-pointer" : ""}`}
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
      <span
        className={`type-caption uppercase tracking-wider transition-colors ${
          active ? "text-primary font-semibold" : interactive ? "text-outline group-hover:text-primary" : "text-outline"
        }`}
      >
        {label}
      </span>
      <div className={`type-telemetry-hero mt-2 tracking-tight tabular-nums ${accent && warn ? "text-[#C74646]" : "text-primary"}`} style={{ fontSize: 36 }}>
        <CountUp value={value} decimals={decimals} />
        <span className="text-body-md type-body-md text-outline ml-1 font-normal">{unit}</span>
      </div>
      <div className={`type-telemetry-sm mt-1.5 font-medium tracking-tight ${deltaColor}`}>{delta}</div>
    </div>
  );
}
