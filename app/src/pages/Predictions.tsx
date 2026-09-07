import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PREDICTIONS, SEVERITY_RANK } from "../data/predictions";
import { predictionsStats } from "../lib/aggregate";
import { getLink } from "../data/links";
import { getTelemetry } from "../lib/derive";
import { historyOnly } from "../data/telemetry";
import { hoursAgoLabel } from "../lib/format";
import { severityTone, TONE_TEXT, TONE_BG } from "../lib/status";
import Sparkline from "../components/charts/Sparkline";
import AnimatedBar from "../components/motion/AnimatedBar";
import CountUp from "../components/motion/CountUp";
import HoverTip from "../components/motion/HoverTip";
import SortArrow from "../components/ui/SortArrow";
import { useSortState, sortByKey } from "../lib/sort";

type SeverityFilter = "all" | "high" | "medium" | "low";
type SortKey = "severity" | "confidence" | "predictedAt";

export default function Predictions() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<SeverityFilter>("all");
  const [query, setQuery] = useState("");
  const { sort, toggleSort } = useSortState<SortKey>();
  const stats = predictionsStats();

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const rows = PREDICTIONS.filter((p) => {
      const link = getLink(p.linkId)!;
      const haystack = `${p.id} ${link.name} ${p.faultLabel} ${p.faultDetail}`.toLowerCase();
      const matchesSeverity = filter === "all" || p.severity === filter;
      const matchesQuery = !q || haystack.includes(q);
      return matchesSeverity && matchesQuery;
    });
    return sortByKey(rows, sort, (p, key) => {
      switch (key as SortKey) {
        case "severity":
          return SEVERITY_RANK[p.severity];
        case "confidence":
          return p.confidencePct;
        case "predictedAt":
          return p.predictedAtHoursAgo;
        default:
          return 0;
      }
    });
  }, [filter, query, sort]);

  const critical = stats.high; // "Critical Attention" tier maps to the High severity tier
  const total = stats.total;
  const criticalPct = (critical / total) * 100;
  const warnPct = (stats.medium / total) * 100;
  const basePct = (stats.low / total) * 100;

  return (
    <div className="flex flex-col w-full">
      <section className="flex flex-col space-y-12 pb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-[#EAE8E3]">
          <div className="space-y-3 max-w-4xl">
            <h1 className="type-display-xl text-5xl md:text-6xl lg:text-[64px] leading-[1.02] text-primary mb-4">Signals worth watching.</h1>
            <p className="type-body-lg text-on-surface-variant max-w-2xl">
              Surfaced anomalies and structural deviations across key trans-regional optical corridors.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-start md:items-end">
              <span className="type-caption uppercase tracking-[0.08em] text-outline font-medium">Model Status</span>
              <span className="type-telemetry-code text-primary font-medium tracking-tight">v4.8-telemetry · LIVE</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 pt-2">
          <SummaryStat label="Active signals" value={total} note={`across ${new Set(PREDICTIONS.map((p) => p.linkId)).size} corridors`} />
          <SummaryStat label="Critical Attention" value={stats.high} note="immediate triage" color="text-error" border />
          <SummaryStat label="Warnings" value={stats.medium} note="deviating trends" color="text-status-warning" border />
          <SummaryStat label="Observational" value={stats.low} note="stable baseline" border />
        </div>
        <div className="pt-4 flex flex-col space-y-2">
          <div className="flex items-center justify-between type-caption uppercase tracking-[0.08em] text-outline font-medium">
            <span>Corridor Threat Composition</span>
            <span>
              {stats.high} Critical · {stats.medium} Warnings · {stats.low} Baseline (100% Monitored)
            </span>
          </div>
          <div className="h-2 w-full bg-surface-container flex">
            <HoverTip label="Critical" value={`${stats.high} · ${criticalPct.toFixed(0)}%`} align="start" style={{ flexBasis: `${criticalPct}%`, flexGrow: 0, flexShrink: 0 }}>
              <AnimatedBar pct={100} className="bg-error h-full" durationMs={700} />
            </HoverTip>
            <HoverTip label="Warnings" value={`${stats.medium} · ${warnPct.toFixed(0)}%`} style={{ flexBasis: `${warnPct}%`, flexGrow: 0, flexShrink: 0 }}>
              <AnimatedBar pct={100} className="bg-status-warning h-full" durationMs={700} />
            </HoverTip>
            <HoverTip label="Baseline" value={`${stats.low} · ${basePct.toFixed(0)}%`} align="end" style={{ flexBasis: `${basePct}%`, flexGrow: 0, flexShrink: 0 }}>
              <AnimatedBar pct={100} className="bg-status-success h-full" durationMs={700} />
            </HoverTip>
          </div>
          <div className="flex items-center gap-6 pt-1 type-telemetry-code">
            <span className="flex items-center gap-1.5 text-error">
              <span className="w-1.5 h-1.5 bg-error" />
              {criticalPct.toFixed(0)}% Critical Risk
            </span>
            <span className="flex items-center gap-1.5 text-status-warning">
              <span className="w-1.5 h-1.5 bg-status-warning" />
              {warnPct.toFixed(0)}% Elevated Variance
            </span>
            <span className="flex items-center gap-1.5 text-status-success">
              <span className="w-1.5 h-1.5 bg-status-success" />
              {basePct.toFixed(0)}% Baseline Stable
            </span>
          </div>
        </div>
      </section>

      <section className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b border-[#EAE8E3]">
        <div className="flex items-center gap-8 flex-wrap">
          {([
            ["all", `All signals [${total}]`],
            ["high", `Critical [${stats.high}]`],
            ["medium", `Warnings [${stats.medium}]`],
            ["low", `Observational [${stats.low}]`],
          ] as [SeverityFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`pb-1 type-caption uppercase tracking-[0.08em] border-b-2 transition-colors duration-150 ${
                filter === key ? "text-primary border-primary font-semibold" : "text-on-surface-variant border-transparent hover:text-primary font-medium"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
            <input
              className="w-full pl-9 pr-4 py-2 bg-surface-container-low type-body-sm text-on-surface placeholder:text-outline border-b border-transparent focus:border-primary focus:bg-surface-container-lowest focus:outline-none transition-all duration-150"
              placeholder="Filter corridor, fault, or signal..."
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="w-full overflow-x-auto pb-space-2xl">
        <table className="w-full text-left min-w-[980px]">
          <thead>
            <tr className="h-10 bg-surface-container-low text-on-surface-variant border-b border-[#EAE8E3]">
              <th className="type-caption uppercase tracking-[0.08em] px-4 py-2 w-[170px] font-medium">Prediction</th>
              <th className="type-caption uppercase tracking-[0.08em] px-4 py-2 font-medium">Affected Link</th>
              <th className="type-caption uppercase tracking-[0.08em] px-4 py-2 font-medium">Predicted Fault</th>
              <th className="type-caption uppercase tracking-[0.08em] px-4 py-2 w-[140px] font-medium">
                <button type="button" onClick={() => toggleSort("severity")} className="group inline-flex items-center gap-1 hover:text-primary transition-colors">
                  <span>Severity</span>
                  <SortArrow dir={sort.key === "severity" ? sort.dir : null} />
                </button>
              </th>
              <th className="type-caption uppercase tracking-[0.08em] px-4 py-2 text-right w-[120px] font-medium">
                <button type="button" onClick={() => toggleSort("confidence")} className="group inline-flex flex-row-reverse items-center gap-1 hover:text-primary transition-colors">
                  <span>Confidence</span>
                  <SortArrow dir={sort.key === "confidence" ? sort.dir : null} />
                </button>
              </th>
              <th className="type-caption uppercase tracking-[0.08em] px-4 py-2 text-right w-[130px] font-medium">
                <button type="button" onClick={() => toggleSort("predictedAt")} className="group inline-flex flex-row-reverse items-center gap-1 hover:text-primary transition-colors">
                  <span>Predicted At</span>
                  <SortArrow dir={sort.key === "predictedAt" ? sort.dir : null} />
                </button>
              </th>
              <th className="type-caption uppercase tracking-[0.08em] px-4 py-2 w-[170px] font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const link = getLink(p.linkId)!;
              const tone = severityTone(p.severity);
              const points = historyOnly(getTelemetry(link)).slice(-10);
              const spark = points.map((pt) => pt.latencyMs);
              const sparkTimes = points.map((pt) => pt.t);
              return (
                <tr
                  key={p.id}
                  className="group relative h-20 hover:bg-surface-container-lowest focus-visible:bg-surface-container-lowest focus-visible:outline-none cursor-pointer transition-colors duration-100 border-b border-[#EAE8E3]"
                  tabIndex={0}
                  role="link"
                  aria-label={`Open prediction ${p.id}`}
                  onClick={() => navigate(`/predictions/${p.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/predictions/${p.id}`);
                    }
                  }}
                >
                  <td className="px-4 py-4 align-middle">
                    <div className="flex flex-col space-y-1">
                      <span className="type-telemetry-md font-medium text-primary group-hover:text-secondary transition-colors">{p.id}</span>
                      <span className="type-telemetry-code text-outline tracking-tight">{p.signalId}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <div className="flex flex-col">
                      <span className="type-body-md text-[15px] text-on-surface font-semibold tracking-[-0.01em]">{link.name}</span>
                      <span className="type-telemetry-code text-outline tracking-tight">{link.regionLabel}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="type-body-md text-[14px] text-on-surface font-medium">{p.faultLabel}</span>
                        <span className={`type-telemetry-code font-medium ${TONE_TEXT[tone]}`}>{p.faultDetail}</span>
                      </div>
                      <Sparkline
                        data={spark}
                        times={sparkTimes}
                        color={tone === "critical" ? "#ba1a1a" : tone === "warning" ? "#B7791F" : "#3D7A55"}
                        className="w-14 h-3 shrink-0"
                        dot={false}
                        label="Latency"
                        formatValue={(v) => `${v.toFixed(1)}ms`}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 shrink-0 ${TONE_BG[tone]}`} />
                      <span className={`type-caption uppercase tracking-[0.06em] font-semibold ${TONE_TEXT[tone]}`}>
                        {p.severity === "high" ? "High" : p.severity === "medium" ? "Medium" : "Low"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-middle text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="type-telemetry-hero text-[22px] text-primary tabular-nums leading-none">{p.confidencePct}%</span>
                      <div className="w-20 bg-surface-container h-1.5 overflow-hidden flex justify-end">
                        <AnimatedBar pct={p.confidencePct} className={`h-full ${TONE_BG[tone]}`} />
                      </div>
                      <span className="type-telemetry-code text-outline">p &gt; {(p.confidencePct / 100 - 0.05).toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-middle text-right">
                    <span className="type-telemetry-md text-on-surface-variant tabular-nums">{hoursAgoLabel(p.predictedAtHoursAgo)}</span>
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 shrink-0 ${TONE_BG[tone]} ${p.status === "active" ? "animate-pulse" : ""}`} />
                      <span className="type-caption uppercase tracking-[0.06em] text-primary font-semibold">{p.status}</span>
                      {p.relatedIncidentId && (
                        <Link
                          to={`/incidents/${p.relatedIncidentId}`}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="type-telemetry-code text-secondary font-semibold hover:underline underline-offset-2"
                        >
                          {p.relatedIncidentId}
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-space-2xl text-center">
            <span className="type-caption uppercase tracking-wider text-outline">No predictive signals matching the specified query</span>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryStat({ label, value, note, color, border }: { label: string; value: number; note: string; color?: string; border?: boolean }) {
  return (
    <div className={`flex flex-col space-y-1 ${border ? "md:border-l md:border-[#EAE8E3] md:pl-8" : ""}`}>
      <span className={`type-caption uppercase tracking-[0.08em] font-medium ${color ?? "text-outline"}`}>{label}</span>
      <span className={`type-telemetry-hero text-[40px] md:text-[44px] leading-none tracking-[-0.03em] tabular-nums ${color ?? "text-primary"}`}>
        <CountUp value={value} padTo={2} />
      </span>
      <span className={`type-telemetry-code tracking-tight ${color ?? "text-outline"}`}>{note}</span>
    </div>
  );
}
