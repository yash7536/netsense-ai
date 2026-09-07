import { useRef, useState } from "react";
import type { TelemetryPoint } from "../../data/types";
import AnimatedPath from "../motion/AnimatedPath";
import FadeIn from "../motion/FadeIn";
import TooltipCard from "../motion/TooltipCard";
import { usePrefersReducedMotion } from "../../lib/motion";

type MetricKey = "latencyMs" | "lossPct" | "jitterMs" | "bandwidthPct";

interface ThresholdLine {
  value: number;
  label: string;
  color?: string;
}

interface Annotation {
  t: number;
  value: number;
  label: string;
  color?: string;
  labelAbove?: boolean;
}

interface TelemetryTrendChartProps {
  points: TelemetryPoint[];
  /** Which telemetry field drives the primary (solid → dashed) trace. */
  primaryKey: MetricKey;
  primaryUnit: string;
  primaryColor?: string;
  /** Display name for the primary series in the hover tooltip. */
  primaryLabel?: string;
  secondaryKey?: MetricKey;
  secondaryColor?: string;
  secondaryUnit?: string;
  secondaryLabel?: string;
  threshold?: ThresholdLine;
  baseline?: ThresholdLine;
  annotation?: Annotation;
  /** When provided (non-null), drives the crosshair/tooltip from an external
   *  selection (e.g. an incident timeline entry) instead of hover/touch/keyboard.
   *  Pass null/undefined to return control to the chart's own interaction state. */
  externalActiveT?: number | null;
  height?: number;
  /** Number of evenly-spaced x-axis ticks across the data's real time domain
   *  (labels are derived from the actual hour offsets, so they can never
   *  drift out of sync with the plotted points). */
  xTickCount?: number;
  className?: string;
}

const DEFAULT_LABEL: Record<MetricKey, string> = {
  latencyMs: "Latency",
  lossPct: "Packet Loss",
  jitterMs: "Jitter",
  bandwidthPct: "Bandwidth",
};

function formatHourTick(t: number): string {
  const rounded = Math.round(t * 10) / 10;
  if (rounded === 0) return "NOW";
  const sign = rounded > 0 ? "+" : "-";
  return `${sign}${Math.abs(rounded)}h`;
}

function formatMetric(v: number, unit: string): string {
  const digits = unit === "%" && v < 1 ? 2 : unit === "" ? 2 : 1;
  return `${v.toFixed(digits)}${unit}`;
}

const VIEW_W = 1000;

function pathFrom(coords: [number, number][]): string {
  return coords.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
}

export default function TelemetryTrendChart({
  points,
  primaryKey,
  primaryUnit,
  primaryColor = "#1b1c1a",
  primaryLabel,
  secondaryKey,
  secondaryColor = "#2850ce",
  secondaryUnit = "%",
  secondaryLabel,
  threshold,
  baseline,
  annotation,
  externalActiveT = null,
  height = 300,
  xTickCount = 6,
  className = "",
}: TelemetryTrendChartProps) {
  const reduced = usePrefersReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const nearestIndexForT = (t: number): number => {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].t - t);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  };

  // An external selection (e.g. an incident timeline entry) takes over the
  // crosshair/tooltip; clearing it (externalActiveT back to null) returns
  // the chart to its own hover/touch/keyboard-driven state untouched.
  const effectiveIdx = externalActiveT != null ? nearestIndexForT(externalActiveT) : activeIdx;

  const marginLeft = 48;
  const marginRight = 20;
  const marginTop = 20;
  const marginBottom = 34;
  const plotW = VIEW_W - marginLeft - marginRight;
  const plotH = height - marginTop - marginBottom;

  const tMin = points[0].t;
  const tMax = points[points.length - 1].t;
  const xFor = (t: number) => marginLeft + ((t - tMin) / (tMax - tMin)) * plotW;

  const primaryValues = points.map((p) => p[primaryKey]);
  let yMin = Math.min(...primaryValues, threshold?.value ?? Infinity, baseline?.value ?? Infinity);
  let yMax = Math.max(...primaryValues, threshold?.value ?? -Infinity, baseline?.value ?? -Infinity);
  const yPad = (yMax - yMin) * 0.22 || 1;
  yMin = Math.max(0, yMin - yPad * 0.3);
  yMax = yMax + yPad;
  const yFor = (v: number) => marginTop + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  const nowIdx = points.findIndex((p) => p.t === 0);
  const nowX = xFor(0);

  const primaryCoords: [number, number][] = points.map((p) => [xFor(p.t), yFor(p[primaryKey])]);
  const observedCoords = primaryCoords.slice(0, nowIdx + 1);
  const projectedCoords = primaryCoords.slice(nowIdx);

  // Confidence band widening across the projected horizon.
  const bandCoords = projectedCoords.map(([x, y], i) => {
    const spread = (i / Math.max(1, projectedCoords.length - 1)) * plotH * 0.16;
    return { x, top: y - spread, bottom: y + spread };
  });
  const bandPath =
    bandCoords.length > 1
      ? `M ${bandCoords.map((c) => `${c.x.toFixed(1)} ${c.top.toFixed(1)}`).join(" L ")} L ${[...bandCoords]
          .reverse()
          .map((c) => `${c.x.toFixed(1)} ${c.bottom.toFixed(1)}`)
          .join(" L ")} Z`
      : "";

  let secCoords: [number, number][] | null = null;
  let secondaryObservedPath: string | null = null;
  let secondaryProjectedPath: string | null = null;
  if (secondaryKey) {
    const secValues = points.map((p) => p[secondaryKey!]);
    const sMin = Math.min(...secValues);
    const sMax = Math.max(...secValues);
    const sRange = sMax - sMin || 1;
    // Secondary trace hugs the lower band of the chart — an editorial shape,
    // not a literal shared axis (matches the approved Stitch chart).
    const bandTop = marginTop + plotH * 0.62;
    const bandBottom = marginTop + plotH * 0.98;
    secCoords = points.map((p) => [xFor(p.t), bandBottom - ((p[secondaryKey!] - sMin) / sRange) * (bandBottom - bandTop)]);
    secondaryObservedPath = pathFrom(secCoords.slice(0, nowIdx + 1));
    secondaryProjectedPath = pathFrom(secCoords.slice(nowIdx));
  }

  const yTicks = 5;
  const tickVals = Array.from({ length: yTicks }, (_, i) => yMax - (i * (yMax - yMin)) / (yTicks - 1));
  // Percent-scale metrics (packet loss) are often sub-1 — round to whatever
  // precision keeps ticks distinguishable instead of collapsing to "0%".
  const tickDigits = yMax - yMin < 1 ? 2 : yMax - yMin < 8 ? 1 : 0;
  const formatTick = (v: number) => v.toFixed(tickDigits);

  const annotationPoint = annotation ? ([xFor(annotation.t), yFor(annotation.value)] as const) : null;
  const xTickTs = Array.from({ length: xTickCount }, (_, i) => tMin + (i / (xTickCount - 1)) * (tMax - tMin));

  // ---- Hover / touch inspection -------------------------------------
  const indexFromClientX = (clientX: number): number | null => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const fracX = (clientX - rect.left) / rect.width;
    const viewX = fracX * VIEW_W;
    const t = tMin + ((viewX - marginLeft) / plotW) * (tMax - tMin);
    const step = (tMax - tMin) / (points.length - 1);
    let idx = Math.round((t - tMin) / step);
    idx = Math.max(0, Math.min(points.length - 1, idx));
    return idx;
  };

  const handleMove = (clientX: number) => {
    const idx = indexFromClientX(clientX);
    if (idx !== null) setActiveIdx(idx);
  };

  const clearActive = () => setActiveIdx(null);

  const stepActive = (delta: number) => {
    setActiveIdx((cur) => {
      const base = cur ?? nowIdx;
      return Math.max(0, Math.min(points.length - 1, base + delta));
    });
  };

  const active = effectiveIdx !== null ? points[effectiveIdx] : null;
  const activeIsProjected = effectiveIdx !== null && effectiveIdx > nowIdx;
  const activeXPct = effectiveIdx !== null ? (primaryCoords[effectiveIdx][0] / VIEW_W) * 100 : null;
  const activePrimaryY = effectiveIdx !== null ? primaryCoords[effectiveIdx][1] : null;
  const pLabel = primaryLabel ?? DEFAULT_LABEL[primaryKey];
  const sLabel = secondaryLabel ?? (secondaryKey ? DEFAULT_LABEL[secondaryKey] : "");

  let tooltipTransform = "-50%";
  if (activeXPct !== null) {
    if (activeXPct < 12) tooltipTransform = "0%";
    else if (activeXPct > 88) tooltipTransform = "-100%";
  }
  let tooltipTop = 0;
  if (activePrimaryY !== null) {
    const placeBelow = activePrimaryY < marginTop + plotH * 0.42;
    tooltipTop = placeBelow ? activePrimaryY + 16 : Math.max(marginTop, activePrimaryY - 78);
  }

  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <div
        ref={wrapRef}
        className="relative min-w-[720px] w-full select-none"
        tabIndex={0}
        role="img"
        aria-label={`${pLabel} trend chart. Use the arrow keys to inspect individual readings.`}
        onMouseMove={(e) => handleMove(e.clientX)}
        onMouseLeave={clearActive}
        onTouchStart={(e) => handleMove(e.touches[0].clientX)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchEnd={clearActive}
        onFocus={() => setActiveIdx((cur) => cur ?? nowIdx)}
        onBlur={clearActive}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            stepActive(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            stepActive(-1);
          } else if (e.key === "Home") {
            e.preventDefault();
            setActiveIdx(0);
          } else if (e.key === "End") {
            e.preventDefault();
            setActiveIdx(points.length - 1);
          } else if (e.key === "Escape") {
            clearActive();
          }
        }}
      >
        <svg className="w-full overflow-visible" viewBox={`0 0 ${VIEW_W} ${height}`} preserveAspectRatio="none" style={{ height }}>
          {/* gridlines */}
          {tickVals.map((v, i) => (
            <line key={i} x1={marginLeft} x2={VIEW_W - marginRight} y1={yFor(v)} y2={yFor(v)} stroke="#efeeea" strokeWidth={1} />
          ))}
          {xTickTs.map((t, i) => (
            <line key={i} x1={xFor(t)} x2={xFor(t)} y1={marginTop} y2={height - marginBottom} stroke="#f5f4f0" strokeWidth={1} />
          ))}

          {/* y axis labels */}
          {tickVals.map((v, i) => (
            <text key={i} x={marginLeft - 8} y={yFor(v) + 4} textAnchor="end" className="fill-outline" fontFamily="IBM Plex Mono" fontSize={11} fontWeight={500}>
              {formatTick(v)}
              {primaryUnit}
            </text>
          ))}

          {/* baseline reference */}
          {baseline && (
            <>
              <line x1={marginLeft} x2={VIEW_W - marginRight} y1={yFor(baseline.value)} y2={yFor(baseline.value)} stroke="#888884" strokeDasharray="4 4" strokeWidth={1.25} />
              <text x={marginLeft + 4} y={yFor(baseline.value) - 6} className="fill-outline" fontFamily="IBM Plex Mono" fontSize={10}>
                {baseline.label}
              </text>
            </>
          )}

          {/* threshold */}
          {threshold && (
            <>
              <line
                x1={marginLeft}
                x2={VIEW_W - marginRight}
                y1={yFor(threshold.value)}
                y2={yFor(threshold.value)}
                stroke={threshold.color ?? "#ba1a1a"}
                strokeDasharray="3 3"
                strokeOpacity={0.75}
                strokeWidth={1.2}
              />
              <text x={marginLeft + 4} y={yFor(threshold.value) - 6} className="uppercase tracking-wider font-medium" fill={threshold.color ?? "#ba1a1a"} fontFamily="IBM Plex Sans" fontSize={10}>
                {threshold.label}
              </text>
            </>
          )}

          {/* confidence band on the projected horizon */}
          {bandPath && (
            <FadeIn as="g" delayMs={650}>
              <path d={bandPath} fill="#e3e2df" fillOpacity={0.55} />
            </FadeIn>
          )}

          {/* secondary trace (loss / jitter residual) */}
          {secondaryObservedPath && (
            <AnimatedPath
              d={secondaryObservedPath}
              fill="none"
              stroke={secondaryColor}
              strokeWidth={effectiveIdx !== null ? 2.5 : 2}
              delayMs={120}
              style={{ transition: reduced ? undefined : "stroke-width 150ms ease" }}
            />
          )}
          {secondaryProjectedPath && (
            <FadeIn as="g" delayMs={650}>
              <path d={secondaryProjectedPath} fill="none" stroke={secondaryColor} strokeWidth={effectiveIdx !== null ? 2.25 : 1.75} strokeDasharray="3 3" />
            </FadeIn>
          )}

          {/* primary trace */}
          <AnimatedPath
            d={pathFrom(observedCoords)}
            fill="none"
            stroke={primaryColor}
            strokeWidth={effectiveIdx !== null ? 3 : 2.5}
            strokeLinejoin="round"
            style={{ transition: reduced ? undefined : "stroke-width 150ms ease" }}
          />
          <FadeIn as="g" delayMs={650}>
            <path d={pathFrom(projectedCoords)} fill="none" stroke={primaryColor} strokeWidth={effectiveIdx !== null ? 3 : 2.5} strokeDasharray="4 4" strokeLinejoin="round" />
          </FadeIn>

          {/* now marker */}
          <FadeIn as="g" delayMs={550}>
            <line x1={nowX} x2={nowX} y1={marginTop - 4} y2={height - marginBottom} stroke="#1b1c1a" strokeOpacity={0.35} strokeDasharray="2 3" strokeWidth={1} />
            <circle cx={nowX} cy={primaryCoords[nowIdx][1]} r={4} fill={primaryColor} />
          </FadeIn>

          {/* annotation marker */}
          {annotationPoint && (
            <FadeIn as="g" delayMs={750} rise={4}>
              <circle cx={annotationPoint[0]} cy={annotationPoint[1]} r={4.5} fill={annotation!.color ?? "#ba1a1a"} />
              <circle cx={annotationPoint[0]} cy={annotationPoint[1]} r={8} fill="none" stroke={annotation!.color ?? "#ba1a1a"} strokeOpacity={0.35} strokeWidth={4} />
              <text
                x={annotationPoint[0]}
                y={annotation!.labelAbove ? annotationPoint[1] - 14 : annotationPoint[1] + 22}
                textAnchor="middle"
                className="uppercase tracking-wider font-medium"
                fill={annotation!.color ?? "#ba1a1a"}
                fontFamily="IBM Plex Sans"
                fontSize={10}
              >
                {annotation!.label}
              </text>
            </FadeIn>
          )}

          {/* x axis */}
          <line x1={marginLeft} x2={VIEW_W - marginRight} y1={height - marginBottom} y2={height - marginBottom} stroke="#1b1c1a" strokeOpacity={0.2} strokeWidth={1} />
          {xTickTs.map((t, i) => {
            const label = formatHourTick(t);
            const isNow = label === "NOW";
            return (
              <text
                key={i}
                x={xFor(t)}
                y={height - marginBottom + 22}
                textAnchor={i === 0 ? "start" : i === xTickTs.length - 1 ? "end" : "middle"}
                className={isNow ? "font-medium" : ""}
                fill={isNow ? "#1b1c1a" : "#747878"}
                fontFamily="IBM Plex Mono"
                fontSize={11}
                fontWeight={isNow ? 600 : 400}
              >
                {label}
              </text>
            );
          })}

          {/* hover / touch / keyboard crosshair (or external selection, e.g. an incident timeline entry) */}
          {active && effectiveIdx !== null && (
            <g style={reduced ? undefined : { transition: "transform 100ms ease-out" }}>
              <line
                x1={primaryCoords[effectiveIdx][0]}
                x2={primaryCoords[effectiveIdx][0]}
                y1={marginTop}
                y2={height - marginBottom}
                stroke="#1b1c1a"
                strokeOpacity={0.28}
                strokeWidth={1}
              />
              <circle cx={primaryCoords[effectiveIdx][0]} cy={primaryCoords[effectiveIdx][1]} r={7} fill={primaryColor} fillOpacity={0.16} />
              <circle cx={primaryCoords[effectiveIdx][0]} cy={primaryCoords[effectiveIdx][1]} r={4} fill="#faf9f5" stroke={primaryColor} strokeWidth={2.25} />
              {secCoords && (
                <>
                  <circle cx={secCoords[effectiveIdx][0]} cy={secCoords[effectiveIdx][1]} r={6} fill={secondaryColor} fillOpacity={0.16} />
                  <circle cx={secCoords[effectiveIdx][0]} cy={secCoords[effectiveIdx][1]} r={3.5} fill="#faf9f5" stroke={secondaryColor} strokeWidth={2} />
                </>
              )}
            </g>
          )}
        </svg>

        {/* HTML tooltip overlay — real typography, clamped inside the chart */}
        {active && activeXPct !== null && (
          <TooltipCard
            className="min-w-[188px] whitespace-nowrap"
            style={{
              left: `${activeXPct}%`,
              top: tooltipTop,
              transform: `translateX(${tooltipTransform})`,
              transition: reduced ? undefined : "left 100ms ease-out, top 100ms ease-out",
            }}
          >
            <div className="px-3 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-4 type-caption uppercase tracking-wider text-outline">
                <span>{formatHourTick(active.t) === "NOW" ? "NOW" : `T${active.t >= 0 ? "+" : ""}${active.t}h`}</span>
                <span className={activeIsProjected ? "text-secondary" : ""}>{activeIsProjected ? "Projected" : active.t === 0 ? "Live" : "Observed"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 type-body-sm text-on-surface-variant">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: primaryColor }} />
                  {pLabel}
                </span>
                <span className="type-telemetry-md text-primary tabular-nums">{formatMetric(active[primaryKey], primaryUnit)}</span>
              </div>
              {secondaryKey && (
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 type-body-sm text-on-surface-variant">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: secondaryColor }} />
                    {sLabel}
                  </span>
                  <span className="type-telemetry-md text-primary tabular-nums">{formatMetric(active[secondaryKey], secondaryUnit)}</span>
                </div>
              )}
            </div>
          </TooltipCard>
        )}
      </div>
    </div>
  );
}
