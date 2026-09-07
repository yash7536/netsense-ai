import { useState } from "react";
import TooltipCard from "./TooltipCard";

interface HoverTipProps {
  children: React.ReactNode;
  label: string;
  value: string;
  /** Where the tooltip anchors relative to its trigger — use "start"/"end"
   *  for elements near the edge of a composed bar so it doesn't overflow. */
  align?: "start" | "center" | "end";
  className?: string;
  /** Passed straight through to the wrapper — e.g. `flexBasis` for a
   *  segment inside a composed proportion bar, so the segment keeps its
   *  correct share of the track while still being independently hoverable. */
  style?: React.CSSProperties;
  /** Optional: makes the trigger clickable/selectable (e.g. an indicator
   *  dot that also picks which link the chart above it displays), reusing
   *  the same hover/focus tooltip — no separate control is introduced. */
  onClick?: () => void;
  selected?: boolean;
}

/** Wraps a bar/segment/track so hovering, focusing, or touching it reveals
 *  its exact value in the shared tooltip chrome — for decorative progress
 *  indicators that don't otherwise expose their number. Lightweight: no
 *  chart-style crosshair, just "what is this worth". */
export default function HoverTip({ children, label, value, align = "center", className = "", style, onClick, selected }: HoverTipProps) {
  const [active, setActive] = useState(false);
  const alignClass = align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2";
  const transform = align === "center" ? "translate(-50%, -100%)" : "translateY(-100%)";
  const interactive = Boolean(onClick);

  return (
    <div
      className={`relative ${interactive ? "cursor-pointer" : ""} ${className}`}
      style={style}
      tabIndex={0}
      role={interactive ? "button" : undefined}
      aria-pressed={interactive ? selected : undefined}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      onTouchStart={() => setActive(true)}
      onTouchEnd={() => setActive(false)}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {children}
      {active && (
        <TooltipCard className={`${alignClass} -top-1.5 px-2 py-1 whitespace-nowrap`} style={{ transform }}>
          <span className="type-telemetry-code">
            <span className="text-outline uppercase tracking-wider">{label}</span> <span className="text-primary font-medium">{value}</span>
          </span>
        </TooltipCard>
      )}
    </div>
  );
}
