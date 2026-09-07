import { useRef, useState } from "react";
import AnimatedPath from "../motion/AnimatedPath";
import TooltipCard from "../motion/TooltipCard";
import { useMounted, usePrefersReducedMotion } from "../../lib/motion";

interface SparklineProps {
  data: number[];
  /** Real time offsets (hours from now) matching `data`, 1:1 — shown in the
   *  hover tooltip when provided. Optional: some call sites only have the
   *  trailing values, not their timestamps. */
  times?: number[];
  color?: string;
  className?: string;
  strokeWidth?: number;
  dot?: boolean;
  viewW?: number;
  viewH?: number;
  /** How each value is written in the tooltip, e.g. v => `${v.toFixed(1)}ms`. */
  formatValue?: (v: number) => string;
  /** Label for the value row, e.g. "Latency". */
  label?: string;
}

/** Small inline trend line used inside tables and list rows. Genuinely
 *  data-driven (path is computed from `data`) and responsive: the SVG scales
 *  to whatever box Tailwind gives it via `className`. Draws itself in on
 *  mount, and — where it's practical for something this small — responds to
 *  hover/touch by highlighting the nearest point and showing its value. */
export default function Sparkline({
  data,
  times,
  color = "#747878",
  className = "w-12 h-3.5",
  strokeWidth = 1.5,
  dot = true,
  viewW = 100,
  viewH = 28,
  formatValue,
  label,
}: SparklineProps) {
  const mounted = useMounted();
  const reduced = usePrefersReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = viewH * 0.15;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * viewW;
    const y = viewH - pad - ((v - min) / range) * (viewH - pad * 2);
    return [x, y] as const;
  });
  const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = points[points.length - 1];

  const updateFromClientX = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setActiveIdx(Math.round(frac * (data.length - 1)));
  };

  const active = activeIdx !== null ? points[activeIdx] : null;

  return (
    <div ref={wrapRef} className={`relative ${className} shrink-0`}>
      <svg
        className="w-full h-full overflow-visible select-none"
        viewBox={`0 0 ${viewW} ${viewH}`}
        fill="none"
        preserveAspectRatio="none"
        onMouseMove={(e) => updateFromClientX(e.clientX)}
        onMouseLeave={() => setActiveIdx(null)}
        onTouchStart={(e) => updateFromClientX(e.touches[0].clientX)}
        onTouchMove={(e) => updateFromClientX(e.touches[0].clientX)}
        onTouchEnd={() => setActiveIdx(null)}
      >
        <AnimatedPath d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" durationMs={550} />
        {dot && <circle cx={lx} cy={ly} r={2.4} fill={color} style={reduced ? undefined : { opacity: mounted ? 1 : 0, transition: "opacity 200ms ease-out 500ms" }} />}
        {active && (
          <>
            <circle cx={active[0]} cy={active[1]} r={4} fill={color} fillOpacity={0.18} />
            <circle cx={active[0]} cy={active[1]} r={2} fill="#faf9f5" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {active && activeIdx !== null && (
        <TooltipCard
          className="whitespace-nowrap px-2 py-1"
          style={{
            left: `${(active[0] / viewW) * 100}%`,
            top: -6,
            transform: `translate(${active[0] / viewW < 0.25 ? "0%" : active[0] / viewW > 0.75 ? "-100%" : "-50%"}, -100%)`,
          }}
        >
          <div className="flex items-baseline gap-2 type-telemetry-code">
            {times && <span className="text-outline">{times[activeIdx] === 0 ? "NOW" : `${times[activeIdx] > 0 ? "+" : ""}${times[activeIdx]}h`}</span>}
            {label && <span className="text-outline">{label}</span>}
            <span className="text-primary font-medium">{formatValue ? formatValue(data[activeIdx]) : data[activeIdx]}</span>
          </div>
        </TooltipCard>
      )}
    </div>
  );
}
