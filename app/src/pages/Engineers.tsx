import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ENGINEERS } from "../data/engineers";
import { engineersStats } from "../lib/aggregate";
import { getLink } from "../data/links";
import { cityName } from "../data/cities";
import { dutyStatusTone, TONE_BG } from "../lib/status";
import type { CityId, DutyStatus } from "../data/types";
import AnimatedBar from "../components/motion/AnimatedBar";
import CountUp from "../components/motion/CountUp";
import HoverTip from "../components/motion/HoverTip";
import SortArrow from "../components/ui/SortArrow";
import { useSortState, sortByKey } from "../lib/sort";

type Filter = "all" | DutyStatus;
type SortKey = "workload" | "assigned";

const WORKLOAD_COLOR: Record<string, string> = {
  High: "#C74646",
  Moderate: "#111111",
  Active: "#111111",
  Available: "#747878",
  "—": "#747878",
};

// Facet values are derived from the roster itself — never hardcoded — so a
// future engineer with a new city/specialisation shows up automatically.
const REGIONS = Array.from(new Set(ENGINEERS.map((e) => e.city))) as CityId[];
const SPECIALISATIONS = Array.from(new Set(ENGINEERS.map((e) => e.specialisation))).sort();

export default function Engineers() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [regionFilter, setRegionFilter] = useState<CityId | "all">("all");
  const [specFilter, setSpecFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const { sort, toggleSort } = useSortState<SortKey>();
  const stats = engineersStats();

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const rows = ENGINEERS.filter((e) => {
      const haystack = `${e.name} ${e.badge} ${cityName(e.city)} ${e.nodeCode} ${e.specialisation}`.toLowerCase();
      const matchesFilter = filter === "all" || e.status === filter;
      const matchesRegion = regionFilter === "all" || e.city === regionFilter;
      const matchesSpec = specFilter === "all" || e.specialisation === specFilter;
      const matchesQuery = !q || haystack.includes(q);
      return matchesFilter && matchesRegion && matchesSpec && matchesQuery;
    });
    return sortByKey(rows, sort, (e, key) => {
      switch (key as SortKey) {
        case "workload":
          return e.workloadPct;
        case "assigned":
          return e.assignedIncidentId ? 1 : 0;
        default:
          return 0;
      }
    });
  }, [filter, regionFilter, specFilter, query, sort]);

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col gap-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-8 border-b border-surface-container-high">
          <div className="max-w-2xl">
            <h1 className="type-display-xl text-5xl md:text-6xl lg:text-[64px] leading-[1.02] text-primary mb-4">Who's on it.</h1>
            <p className="type-body-lg text-on-surface-variant mt-3 tracking-tight max-w-2xl font-normal">
              Real-time telemetric roster, corridor duty mapping, and active incident mitigation teams across core topology nodes.
            </p>
          </div>
          <div className="flex items-baseline gap-8 lg:gap-12 pt-2 lg:pt-0">
            <div className="flex flex-col">
              <div className="type-caption text-outline uppercase tracking-[0.1em] mb-1.5">On-Duty Network Staff</div>
              <div className="flex items-baseline gap-2">
                <span className="type-telemetry-hero text-[42px] leading-none text-primary tracking-[-0.03em]">
                  <CountUp value={stats.onShift} padTo={2} />
                </span>
                <span className="type-telemetry-sm text-on-surface-variant">Active Eng</span>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                <div className="flex items-center gap-1 w-32 h-1.5 bg-surface-container">
                  <HoverTip
                    label="On Shift"
                    value={`${stats.onShift}`}
                    align="start"
                    style={{ flexBasis: `${(stats.onShift / stats.total) * 100}%`, flexGrow: 0, flexShrink: 0 }}
                  >
                    <AnimatedBar pct={100} className="h-full bg-status-success" />
                  </HoverTip>
                  <HoverTip
                    label="Standby"
                    value={`${stats.standby}`}
                    style={{ flexBasis: `${(stats.standby / stats.total) * 100}%`, flexGrow: 0, flexShrink: 0 }}
                  >
                    <AnimatedBar pct={100} className="h-full bg-status-warning" />
                  </HoverTip>
                </div>
                <div className="type-telemetry-code text-outline">
                  {stats.onShift} On Shift • {stats.standby} Standby • {stats.offShift} Off
                </div>
              </div>
            </div>
            <div className="w-px h-12 bg-surface-variant self-center" />
            <div className="flex flex-col">
              <div className="type-caption text-outline uppercase tracking-[0.1em] mb-1.5">Corridor Engagements</div>
              <div className="flex items-baseline gap-2">
                <span className="type-telemetry-hero text-[42px] leading-none text-secondary tracking-[-0.03em]">
                  <CountUp value={stats.linkedIssues} padTo={2} />
                </span>
                <span className="type-telemetry-sm text-on-surface-variant">Linked Issues</span>
              </div>
              <div className="type-telemetry-code text-outline mt-1.5">
                {stats.escalated} Escalated • {stats.mitigating} Mitigating
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 py-3 border-b border-surface-container-high">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-3 flex-1 max-w-lg">
              <span className="material-symbols-outlined text-outline text-[18px]">search</span>
              <input
                className="w-full bg-transparent border-none type-body-md text-primary placeholder:text-outline focus:outline-none p-0 tracking-tight"
                placeholder="Filter by name, ID (#8042), node, or specialization..."
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1 sm:gap-3 self-end sm:self-auto flex-wrap">
              <span className="type-caption text-outline uppercase tracking-[0.08em] mr-1 hidden sm:inline">Duty Status:</span>
              {([
                ["all", "All"],
                ["on-shift", "On Shift"],
                ["standby", "Standby"],
                ["off-shift", "Off Shift"],
              ] as [Filter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1 type-caption uppercase tracking-[0.08em] transition-colors ${
                    filter === key ? "bg-primary text-on-primary font-medium" : "text-on-surface-variant hover:text-primary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1 sm:gap-3">
            <span className="type-caption text-outline uppercase tracking-[0.08em] mr-1">Region:</span>
            <button
              type="button"
              onClick={() => setRegionFilter("all")}
              className={`px-3 py-1 type-caption uppercase tracking-[0.08em] transition-colors ${
                regionFilter === "all" ? "bg-primary text-on-primary font-medium" : "text-on-surface-variant hover:text-primary"
              }`}
            >
              All
            </button>
            {REGIONS.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setRegionFilter(city)}
                className={`px-3 py-1 type-caption uppercase tracking-[0.08em] transition-colors ${
                  regionFilter === city ? "bg-primary text-on-primary font-medium" : "text-on-surface-variant hover:text-primary"
                }`}
              >
                {cityName(city)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1 sm:gap-3">
            <span className="type-caption text-outline uppercase tracking-[0.08em] mr-1">Specialisation:</span>
            <button
              type="button"
              onClick={() => setSpecFilter("all")}
              className={`px-3 py-1 type-caption uppercase tracking-[0.08em] transition-colors ${
                specFilter === "all" ? "bg-primary text-on-primary font-medium" : "text-on-surface-variant hover:text-primary"
              }`}
            >
              All
            </button>
            {SPECIALISATIONS.map((spec) => (
              <button
                key={spec}
                type="button"
                onClick={() => setSpecFilter(spec)}
                className={`px-3 py-1 type-caption uppercase tracking-[0.08em] transition-colors ${
                  specFilter === spec ? "bg-primary text-on-primary font-medium" : "text-on-surface-variant hover:text-primary"
                }`}
              >
                {spec}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full overflow-x-auto -mt-4">
          <table className="w-full text-left border-collapse min-w-[880px]">
            <thead>
              <tr className="h-10 text-on-surface-variant border-b border-surface-container-high">
                <th className="type-caption uppercase tracking-[0.08em] py-3 px-4 pl-4 font-medium text-outline">Engineer</th>
                <th className="type-caption uppercase tracking-[0.08em] py-3 px-4 font-medium text-outline">Region</th>
                <th className="type-caption uppercase tracking-[0.08em] py-3 px-4 font-medium text-outline">Specialisation</th>
                <th className="type-caption uppercase tracking-[0.08em] py-3 px-4 font-medium text-outline">Availability</th>
                <th className="type-caption uppercase tracking-[0.08em] py-3 px-4 font-medium text-outline">
                  <button type="button" onClick={() => toggleSort("workload")} className="group inline-flex items-center gap-1 hover:text-primary transition-colors">
                    <span>Current Workload</span>
                    <SortArrow dir={sort.key === "workload" ? sort.dir : null} />
                  </button>
                </th>
                <th className="type-caption uppercase tracking-[0.08em] py-3 px-4 pr-4 font-medium text-right text-outline">
                  <button type="button" onClick={() => toggleSort("assigned")} className="group inline-flex flex-row-reverse items-center gap-1 hover:text-primary transition-colors">
                    <span>Assigned Incidents</span>
                    <SortArrow dir={sort.key === "assigned" ? sort.dir : null} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high type-body-md">
              {filtered.map((e) => {
                const tone = dutyStatusTone(e.status);
                const link = e.assignedLinkId ? getLink(e.assignedLinkId) : undefined;
                return (
                  <tr
                    key={e.id}
                    className="group hover:bg-surface-container-lowest focus-visible:bg-surface-container-lowest focus-visible:outline-none transition-colors cursor-pointer h-16"
                    tabIndex={0}
                    role="link"
                    aria-label={`Open ${e.name} engineer detail`}
                    onClick={() => navigate(`/engineers/${e.id}`)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        navigate(`/engineers/${e.id}`);
                      }
                    }}
                  >
                    <td className="py-4 px-4 pl-4 text-primary">
                      <div className="flex items-center gap-2">
                        <span className="w-1 h-4 bg-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="type-body-md font-medium tracking-tight text-primary">{e.name}</span>
                        <span className="type-telemetry-code text-outline ml-1">{e.badge}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="inline-flex items-center gap-1.5 type-telemetry-code">
                        <span className="text-primary font-medium">{cityName(e.city)}</span>
                        <span className="text-outline">/</span>
                        <span className="px-1.5 py-0.5 bg-surface-container-high text-on-surface font-medium">{e.nodeCode}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-on-surface-variant type-body-md">{e.specialisation}</td>
                    <td className="py-4 px-4">
                      <div className="inline-flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${TONE_BG[tone]}`} />
                        <span className="type-caption uppercase tracking-[0.08em] text-primary font-medium">
                          {e.status === "on-shift" ? "On Shift" : e.status === "standby" ? "Standby" : "Off Shift"}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <HoverTip label="Workload" value={`${e.workloadPct}%`} className="w-12 h-1 shrink-0">
                          <div className="w-full h-full bg-surface-container overflow-hidden">
                            <AnimatedBar pct={e.workloadPct} className="h-full" style={{ backgroundColor: WORKLOAD_COLOR[e.workloadLabel] }} />
                          </div>
                        </HoverTip>
                        <div className="flex items-center gap-2">
                          <span className="type-telemetry-sm font-medium" style={{ color: WORKLOAD_COLOR[e.workloadLabel] }}>
                            {e.workloadLabel}
                          </span>
                          {link && (
                            <>
                              <span className="text-outline type-telemetry-code">—</span>
                              <span className="type-telemetry-sm text-primary tracking-tight">{link.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 pr-4 text-right">
                      {e.assignedIncidentId ? (
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" title="Active Correlation" />
                          <Link
                            to={`/incidents/${e.assignedIncidentId}`}
                            onClick={(ev) => ev.stopPropagation()}
                            onKeyDown={(ev) => ev.stopPropagation()}
                            className="type-telemetry-code px-2 py-1 bg-surface-container text-primary hover:bg-primary hover:text-on-primary transition-colors"
                          >
                            {e.assignedIncidentId}
                          </Link>
                        </div>
                      ) : (
                        <span className="type-telemetry-code text-outline">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center type-caption uppercase tracking-wider text-outline">
                    No engineers matching the specified query
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <footer className="w-full mt-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full border-t border-surface-container-high pt-6 gap-4">
          <div className="flex items-center gap-6 flex-wrap">
            <span className="type-caption uppercase tracking-[0.08em] text-outline">
              Next Shift Rotation: <strong className="text-primary type-telemetry-code font-normal">14:00 IST (UTC+05:30)</strong>
            </span>
            <span className="text-surface-container-high hidden sm:inline">•</span>
            <span className="type-caption uppercase tracking-[0.08em] text-outline">
              Rotation Lead: <strong className="text-primary type-telemetry-code font-normal">A. Sharma #8042</strong>
            </span>
          </div>
          <div className="type-telemetry-code text-outline">Operational Roster sync: 42s ago</div>
        </div>
      </footer>
    </div>
  );
}
