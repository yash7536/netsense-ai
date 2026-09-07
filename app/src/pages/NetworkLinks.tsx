import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { allLinkDisplays } from "../lib/aggregate";
import { getTelemetry } from "../lib/derive";
import { historyOnly } from "../data/telemetry";
import Sparkline from "../components/charts/Sparkline";
import HealthRing from "../components/charts/HealthRing";
import AnimatedBar from "../components/motion/AnimatedBar";
import HoverTip from "../components/motion/HoverTip";
import SortArrow from "../components/ui/SortArrow";
import { useSortState, sortByKey } from "../lib/sort";
import type { SortState } from "../lib/sort";

type Filter = "all" | "attention" | "healthy";
type SortKey = "health" | "latency" | "loss" | "load" | "jitter";

const HEALTH_COLOR = { healthy: "#2E7D32", attention: "#B7791F" } as const;

export default function NetworkLinks() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const { sort, toggleSort } = useSortState<SortKey>();
  const displays = allLinkDisplays();

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const rows = displays.filter((d) => {
      const matchesQuery = !q || d.link.name.toLowerCase().includes(q) || d.link.regionLabel.toLowerCase().includes(q);
      const matchesFilter = filter === "all" || d.displayStatus === filter;
      return matchesQuery && matchesFilter;
    });
    return sortByKey(rows, sort, (d, key) => {
      switch (key as SortKey) {
        case "health":
          return d.healthScore;
        case "latency":
          return d.now.latencyMs;
        case "loss":
          return d.now.lossPct;
        case "load":
          return d.now.bandwidthPct;
        case "jitter":
          return d.now.jitterMs;
        default:
          return 0;
      }
    });
  }, [displays, query, filter, sort]);

  return (
    <div className="flex flex-col w-full">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[#E3E1DC]">
        <div className="flex flex-col space-y-2 max-w-2xl">
          <h1 className="type-display-xl text-5xl md:text-6xl lg:text-[64px] leading-[1.02] text-primary mb-5">
            Every link, at a glance.
          </h1>
          <p className="type-body-lg text-on-surface-variant max-w-2xl">
            Real-time transit corridors, latency margins, and packet integrity across regions.
          </p>
        </div>
      </section>

      <section className="mt-12 mb-2 flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-[#EAE8E3]">
        <div className="flex flex-1 items-center max-w-md bg-transparent pb-2 border-b border-[#D6D4CF] focus-within:border-primary transition-colors">
          <span className="material-symbols-outlined text-[#76746F] text-[18px] mr-3 select-none">search</span>
          <input
            className="w-full bg-transparent type-body-md text-primary placeholder:text-[#9A9893] focus:outline-none tracking-normal"
            placeholder="Search link name, segment ID, or region..."
            type="text"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-1">
          {([
            ["all", "All Links"],
            ["attention", "Attention Needed"],
            ["healthy", "Healthy"],
          ] as [Filter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`pb-2 type-caption uppercase tracking-[0.08em] transition-all border-b-2 mr-6 last:mr-0 focus:outline-none ${
                filter === key ? "border-primary text-primary font-medium" : "border-transparent text-[#76746F] hover:text-primary"
              }`}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[980px]">
          <thead>
            <tr className="h-10 border-b border-primary text-[#76746F]">
              <th className="text-xs uppercase text-neutral-500 tracking-[0.08em] font-semibold pl-4 pr-4 pb-3 pt-4 text-left select-none border-b border-primary">
                Network Link
              </th>
              <th className="text-xs uppercase text-neutral-500 tracking-[0.08em] font-semibold px-4 pb-3 pt-4 text-left select-none border-b border-primary">
                Region
              </th>
              <SortableHeader label="Health" sortKey="health" align="left" sort={sort} onSort={toggleSort} />
              <SortableHeader label="RTT Latency" sortKey="latency" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Loss" sortKey="loss" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Load" sortKey="load" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Jitter" sortKey="jitter" sort={sort} onSort={toggleSort} />
              <th className="text-xs uppercase text-neutral-500 tracking-[0.08em] font-semibold pl-4 pr-4 pb-3 pt-4 text-right select-none border-b border-primary">
                Sync
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAE8E3]">
            {filtered.map((d) => {
              const color = HEALTH_COLOR[d.displayStatus];
              const points = historyOnly(getTelemetry(d.link)).slice(-10);
              const sparkTimes = points.map((p) => p.t);
              const latencySpark = points.map((p) => p.latencyMs);
              const jitterSpark = points.map((p) => p.jitterMs);
              const hasPrediction = d.activePredictions.length > 0;
              const hasIncident = d.openIncidents.length > 0;
              return (
                <tr
                  key={d.link.id}
                  className="group hover:bg-white/70 transition-colors cursor-pointer border-l-2 border-l-transparent hover:border-l-secondary focus-visible:bg-white/70 focus-visible:outline-none"
                  tabIndex={0}
                  role="link"
                  aria-label={`Open ${d.link.name} link detail`}
                  onClick={() => navigate(`/links/${d.link.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/links/${d.link.id}`);
                    }
                  }}
                >
                  <td className="pl-3 pr-4 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-medium text-primary tracking-tight group-hover:text-secondary transition-colors">
                          {d.link.name}
                        </span>
                        {(hasPrediction || hasIncident) && (
                          <span className="flex items-center gap-1">
                            {hasIncident && (
                              <HoverTip label="Open Incident" value={d.openIncidents[0].id}>
                                <span className="block w-1.5 h-1.5 rounded-full bg-error" />
                              </HoverTip>
                            )}
                            {hasPrediction && (
                              <HoverTip label="Active Prediction" value={d.activePredictions[0].id}>
                                <span className="block w-1.5 h-1.5 rounded-full bg-secondary" />
                              </HoverTip>
                            )}
                          </span>
                        )}
                      </div>
                      <span className="type-telemetry-code text-[#76746F] tracking-normal mt-0.5">
                        {d.link.asn} / {d.link.segmentId}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[13px] text-[#5F605D]">{d.link.regionLabel}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2.5">
                      <HealthRing pct={d.healthScore} color={color} />
                      <span className="type-telemetry-md text-[13px] tabular-nums font-medium" style={{ color }}>
                        {d.healthScore.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2.5">
                      <Sparkline
                        data={latencySpark}
                        times={sparkTimes}
                        color={color}
                        className="w-12 h-3.5"
                        dot={false}
                        strokeWidth={1.5}
                        label="RTT"
                        formatValue={(v) => `${v.toFixed(1)}ms`}
                      />
                      <span className="type-telemetry-md text-[13px] text-primary tabular-nums">{d.now.latencyMs.toFixed(1)} ms</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="type-telemetry-md text-[13px] tabular-nums" style={{ color: d.now.lossPct > 0.1 ? color : undefined }}>
                      {d.now.lossPct.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2.5">
                      <div className="w-16 h-1.5 bg-[#EAE8E3] rounded-full overflow-hidden">
                        <AnimatedBar pct={d.now.bandwidthPct} className="h-full rounded-full" style={{ backgroundColor: color }} />
                      </div>
                      <span className="type-telemetry-md text-[13px] text-primary tabular-nums w-8 text-right">{Math.round(d.now.bandwidthPct)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Sparkline
                        data={jitterSpark}
                        times={sparkTimes}
                        color="#76746F"
                        className="w-8 h-3"
                        dot={false}
                        strokeWidth={1.2}
                        label="Jitter"
                        formatValue={(v) => `${v.toFixed(1)}ms`}
                      />
                      <span className="type-telemetry-md text-[13px] text-[#5F605D] tabular-nums">{d.now.jitterMs.toFixed(1)} ms</span>
                    </div>
                  </td>
                  <td className="pl-4 pr-3 py-4 type-telemetry-code text-right text-[#9A9893]">just now</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center type-caption uppercase tracking-wider text-outline">
                  No links matching the specified query
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const SORT_HEADER_CLASS = "text-xs uppercase text-neutral-500 tracking-[0.08em] font-semibold px-4 pb-3 pt-4 select-none border-b border-primary";

function SortableHeader({
  label,
  sortKey,
  align = "right",
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  align?: "left" | "right";
  sort: SortState<SortKey>;
  onSort: (key: SortKey) => void;
}) {
  return (
    <th className={`${SORT_HEADER_CLASS} ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`group inline-flex items-center gap-1 hover:text-primary transition-colors ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        <span>{label}</span>
        <SortArrow dir={sort.key === sortKey ? sort.dir : null} />
      </button>
    </th>
  );
}
