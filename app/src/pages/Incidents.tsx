import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { INCIDENTS, INCIDENT_SEVERITY_RANK } from "../data/incidents";
import { incidentsStats } from "../lib/aggregate";
import { getLink } from "../data/links";
import { getEngineer } from "../data/engineers";
import { getTelemetry } from "../lib/derive";
import { historyOnly } from "../data/telemetry";
import { hoursAgoLabel, minutesAgoLabel } from "../lib/format";
import type { IncidentStatus } from "../data/types";
import { severityTone, TONE_BG, TONE_TEXT, incidentStatusTone } from "../lib/status";
import Sparkline from "../components/charts/Sparkline";
import AnimatedBar from "../components/motion/AnimatedBar";
import CountUp from "../components/motion/CountUp";
import HoverTip from "../components/motion/HoverTip";
import SortArrow from "../components/ui/SortArrow";
import { useSortState, sortByKey } from "../lib/sort";

type StatusFilter = "all" | IncidentStatus;
type SortKey = "severity" | "created" | "updated";

export default function Incidents() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const { sort, toggleSort } = useSortState<SortKey>();
  const stats = incidentsStats();

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const rows = INCIDENTS.filter((i) => {
      const link = getLink(i.linkId)!;
      const engineer = getEngineer(i.engineerId);
      const haystack = `${i.id} ${link.name} ${i.faultLabel} ${engineer?.name ?? ""}`.toLowerCase();
      const matchesStatus = status === "all" || i.status === status;
      const matchesQuery = !q || haystack.includes(q);
      return matchesStatus && matchesQuery;
    });
    return sortByKey(rows, sort, (i, key) => {
      switch (key as SortKey) {
        case "severity":
          return INCIDENT_SEVERITY_RANK[i.severity];
        case "created":
          return i.createdHoursAgo;
        case "updated":
          return i.updatedMinutesAgo;
        default:
          return 0;
      }
    });
  }, [status, query, sort]);

  const sevTotal = stats.total;
  const critPct = (stats.critical / sevTotal) * 100;
  const highPct = (stats.high / sevTotal) * 100;
  const medPct = (stats.medium / sevTotal) * 100;
  const invPct = (stats.investigating / sevTotal) * 100;
  const mitPct = (stats.mitigated / sevTotal) * 100;
  const resPct = (stats.resolved / sevTotal) * 100;

  return (
    <div className="flex flex-col w-full">
      <section className="flex flex-col gap-y-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-outline-variant/40">
          <div className="flex flex-col max-w-2xl">
            <h1 className="type-display-xl text-5xl md:text-6xl lg:text-[64px] leading-[1.02] text-primary mb-2">
              What needs
              <br className="hidden md:inline" /> a response.
            </h1>
            <p className="type-body-lg text-on-surface-variant max-w-2xl mt-3">
              Active triage, telemetry spikes, and critical mitigation tracking across Indian core corridors.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 py-3">
          <IncidentStat label="Total Incidents" value={stats.total} note="Recorded Fleetwide" border />
          <IncidentStat label="Critical Tier" value={stats.critical} note="Active Sev-1" color="text-error" border />
          <IncidentStat label="High Severity" value={stats.high} note="Sev-2 Degraded" color="text-status-warning" border />
          <IncidentStat label="Medium Severity" value={stats.medium} note="Sev-3 Under Watch" />
        </div>

        <div className="py-3 px-4 bg-surface-container-low border border-outline-variant/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 -mt-6">
          <div className="flex flex-col gap-1.5 flex-1 max-w-xl">
            <div className="flex items-center justify-between type-caption uppercase tracking-[0.08em]">
              <span className="text-outline font-medium">Severity Proportion</span>
              <span className="type-telemetry-code text-on-surface-variant font-normal">
                {stats.critical} CRIT · {stats.high} HIGH · {stats.medium} MED
              </span>
            </div>
            <div className="h-1.5 w-full flex bg-surface-container gap-0.5">
              <HoverTip label="Critical" value={`${stats.critical} · ${critPct.toFixed(0)}%`} align="start" style={{ flexBasis: `${critPct}%`, flexGrow: 0, flexShrink: 0 }}>
                <AnimatedBar pct={100} className="h-full bg-error" durationMs={700} />
              </HoverTip>
              <HoverTip label="High" value={`${stats.high} · ${highPct.toFixed(0)}%`} style={{ flexBasis: `${highPct}%`, flexGrow: 0, flexShrink: 0 }}>
                <AnimatedBar pct={100} className="h-full bg-status-warning" durationMs={700} />
              </HoverTip>
              <HoverTip label="Medium" value={`${stats.medium} · ${medPct.toFixed(0)}%`} align="end" style={{ flexBasis: `${medPct}%`, flexGrow: 0, flexShrink: 0 }}>
                <AnimatedBar pct={100} className="h-full bg-outline" durationMs={700} />
              </HoverTip>
            </div>
          </div>
          <div className="hidden md:block w-[1px] h-7 bg-outline-variant/50" />
          <div className="flex flex-col gap-1.5 flex-1 max-w-xl">
            <div className="flex items-center justify-between type-caption uppercase tracking-[0.08em]">
              <span className="text-outline font-medium">Fleet Resolution Pipeline</span>
              <span className="type-telemetry-code text-on-surface-variant font-normal">
                {stats.investigating} ACTIVE · {stats.mitigated} MITIGATED · {stats.resolved} RESOLVED
              </span>
            </div>
            <div className="h-1.5 w-full flex bg-surface-container gap-0.5">
              <HoverTip label="Investigating" value={`${stats.investigating} · ${invPct.toFixed(0)}%`} align="start" style={{ flexBasis: `${invPct}%`, flexGrow: 0, flexShrink: 0 }}>
                <AnimatedBar pct={100} className="h-full bg-primary" durationMs={700} />
              </HoverTip>
              <HoverTip label="Mitigated" value={`${stats.mitigated} · ${mitPct.toFixed(0)}%`} style={{ flexBasis: `${mitPct}%`, flexGrow: 0, flexShrink: 0 }}>
                <AnimatedBar pct={100} className="h-full bg-secondary" durationMs={700} />
              </HoverTip>
              <HoverTip label="Resolved" value={`${stats.resolved} · ${resPct.toFixed(0)}%`} align="end" style={{ flexBasis: `${resPct}%`, flexGrow: 0, flexShrink: 0 }}>
                <AnimatedBar pct={100} className="h-full bg-outline-variant" durationMs={700} />
              </HoverTip>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pt-2 border-b border-outline-variant/40 pb-0.5">
          <div className="flex items-center space-x-2 -mb-[1px] flex-wrap">
            {([
              ["all", "All", stats.total],
              ["investigating", "Investigating", stats.investigating],
              ["mitigated", "Mitigated", stats.mitigated],
              ["resolved", "Resolved", stats.resolved],
            ] as [StatusFilter, string, number][]).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatus(key)}
                className={`px-3 py-2 type-caption uppercase tracking-[0.08em] transition-colors cursor-pointer border-b-2 ${
                  status === key ? "text-primary border-primary" : "text-outline border-transparent hover:text-primary"
                }`}
              >
                {label} <span className="ml-1 type-telemetry-sm font-normal text-on-surface-variant">[{count}]</span>
              </button>
            ))}
          </div>
          <div className="relative min-w-[280px] lg:min-w-[340px] mb-2 md:mb-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px] select-none pointer-events-none">search</span>
            <input
              className="w-full pl-9 pr-4 py-2 bg-transparent border border-outline-variant/60 text-primary type-body-md placeholder:text-outline focus:outline-none focus:border-primary transition-colors rounded-none"
              placeholder="Filter by ID, corridor, or engineer..."
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="w-full overflow-x-auto -mt-6">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="border-b-2 border-primary h-11">
                <th className="type-caption text-primary uppercase tracking-[0.08em] font-semibold py-3.5 pr-4 w-32">Incident ID</th>
                <th className="type-caption text-primary uppercase tracking-[0.08em] font-semibold py-3.5 px-4 w-64">Affected Link</th>
                <th className="type-caption text-primary uppercase tracking-[0.08em] font-semibold py-3.5 px-4">Fault Profile</th>
                <th className="type-caption text-primary uppercase tracking-[0.08em] font-semibold py-3.5 px-4 w-36">
                  <button type="button" onClick={() => toggleSort("severity")} className="group inline-flex items-center gap-1 hover:text-secondary transition-colors">
                    <span>Severity</span>
                    <SortArrow dir={sort.key === "severity" ? sort.dir : null} />
                  </button>
                </th>
                <th className="type-caption text-primary uppercase tracking-[0.08em] font-semibold py-3.5 px-4 w-36">Status</th>
                <th className="type-caption text-primary uppercase tracking-[0.08em] font-semibold py-3.5 px-4 w-48">Assigned SRE</th>
                <th className="type-caption text-primary uppercase tracking-[0.08em] font-semibold py-3.5 px-4 text-right w-32">
                  <button type="button" onClick={() => toggleSort("created")} className="group inline-flex flex-row-reverse items-center gap-1 hover:text-secondary transition-colors">
                    <span>Created</span>
                    <SortArrow dir={sort.key === "created" ? sort.dir : null} />
                  </button>
                </th>
                <th className="type-caption text-primary uppercase tracking-[0.08em] font-semibold py-3.5 pl-4 text-right w-28">
                  <button type="button" onClick={() => toggleSort("updated")} className="group inline-flex flex-row-reverse items-center gap-1 hover:text-secondary transition-colors">
                    <span>Updated</span>
                    <SortArrow dir={sort.key === "updated" ? sort.dir : null} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inc) => {
                const link = getLink(inc.linkId)!;
                const engineer = getEngineer(inc.engineerId);
                const tone = severityTone(inc.severity === "critical" ? "critical" : inc.severity === "high" ? "high" : "medium");
                const statusTone = incidentStatusTone(inc.status);
                const points = historyOnly(getTelemetry(link)).slice(-12);
                const spark = points.map((p) => p.lossPct);
                const sparkTimes = points.map((p) => p.t);
                return (
                  <tr
                    key={inc.id}
                    className="group border-b border-[#EAE8E3] hover:bg-surface-container-lowest/90 focus-visible:bg-surface-container-lowest/90 focus-visible:outline-none transition-colors cursor-pointer duration-150"
                    tabIndex={0}
                    role="link"
                    aria-label={`Open incident ${inc.id}`}
                    onClick={() => navigate(`/incidents/${inc.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/incidents/${inc.id}`);
                      }
                    }}
                  >
                    <td className="py-5 pr-4 type-telemetry-md text-primary font-semibold tracking-tight">
                      <div className="flex items-center gap-3">
                        <span className="w-1 h-5 bg-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="tracking-normal">{inc.id}</span>
                      </div>
                    </td>
                    <td className="py-5 px-4 type-body-md text-[15px] text-primary font-medium tracking-tight">
                      {link.name}
                      <div className="type-telemetry-code text-outline mt-0.5 tracking-normal font-normal">{link.segmentId}</div>
                    </td>
                    <td className="py-5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <span className="type-body-md text-[14px] text-primary">{inc.faultLabel}</span>
                          <div className="type-telemetry-code text-outline mt-0.5">{inc.faultDetail}</div>
                        </div>
                        <Sparkline
                          data={spark}
                          times={sparkTimes}
                          color={tone === "critical" ? "#C74646" : tone === "warning" ? "#B7791F" : "#747878"}
                          className="w-16 h-6 shrink-0"
                          dot={false}
                          label="Loss"
                          formatValue={(v) => `${v.toFixed(2)}%`}
                        />
                      </div>
                    </td>
                    <td className="py-5 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 shrink-0 ${TONE_BG[tone]}`} />
                        <span className={`type-caption uppercase tracking-[0.08em] font-semibold ${TONE_TEXT[tone]}`}>
                          {inc.severity[0].toUpperCase() + inc.severity.slice(1)}
                        </span>
                      </div>
                    </td>
                    <td className="py-5 px-4">
                      <div className="flex flex-col gap-1.5">
                        <span className={`type-caption uppercase tracking-[0.08em] font-semibold ${TONE_TEXT[statusTone]}`}>
                          {inc.status[0].toUpperCase() + inc.status.slice(1)}
                        </span>
                        <div className="flex items-center gap-1 w-20">
                          {[0, 1, 2, 3].map((i) => (
                            <span key={i} className={`h-1 flex-1 ${i < (inc.status === "resolved" ? 4 : inc.status === "mitigated" ? 3 : 2) ? TONE_BG[statusTone] : "bg-outline-variant/40"}`} />
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-4 type-body-md text-primary font-medium">
                      {engineer ? (
                        <Link
                          to={`/engineers/${engineer.id}`}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="hover:text-secondary hover:underline underline-offset-2 transition-colors"
                        >
                          {engineer.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                      <span className="text-on-surface-variant font-normal text-[12px] ml-1">· {getEngineerBase(engineer?.city)}</span>
                    </td>
                    <td className="py-5 px-4 type-telemetry-sm text-outline text-right tabular-nums">{hoursAgoLabel(inc.createdHoursAgo)}</td>
                    <td className="py-5 pl-4 type-telemetry-sm text-primary text-right font-medium tabular-nums">{minutesAgoLabel(inc.updatedMinutesAgo)}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center type-caption uppercase tracking-wider text-outline">
                    No incidents matching the specified query
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function getEngineerBase(city?: string) {
  if (!city) return "";
  return `${city[0].toUpperCase()}${city.slice(1)} NOC`;
}

function IncidentStat({ label, value, note, color, border }: { label: string; value: number; note: string; color?: string; border?: boolean }) {
  return (
    <div className={`flex flex-col justify-between ${border ? "pr-4 md:border-r border-outline-variant/30" : ""}`}>
      <span className="type-caption uppercase tracking-[0.08em] text-outline mb-2 select-none">{label}</span>
      <div className="flex items-baseline gap-2.5">
        <span className={`type-telemetry-hero text-[44px] md:text-[48px] leading-none font-medium tracking-tight ${color ?? "text-primary"}`}>
          <CountUp value={value} padTo={2} />
        </span>
        <span className={`type-telemetry-sm tracking-normal ${color ?? "text-on-surface-variant"} ${color ? "font-medium" : "font-normal"}`}>{note}</span>
      </div>
    </div>
  );
}
