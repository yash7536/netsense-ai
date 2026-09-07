import { useMounted, usePrefersReducedMotion } from "../../lib/motion";

interface AnimatedBarProps {
  /** 0–100 */
  pct: number;
  className?: string;
  style?: React.CSSProperties;
  durationMs?: number;
}

/** A fill bar that animates from empty to its real value on mount instead of
 *  snapping straight to it — used for load/workload/severity/pipeline bars
 *  throughout the app. Ordinary width-transition, no keyframes needed. Wrap
 *  it (or its track) in `HoverTip` where the exact value is worth surfacing
 *  on hover/touch. */
export default function AnimatedBar({ pct, className = "", style, durationMs = 600 }: AnimatedBarProps) {
  const mounted = useMounted();
  const reduced = usePrefersReducedMotion();
  const width = reduced || mounted ? `${Math.max(0, Math.min(100, pct))}%` : "0%";
  return (
    <div
      className={className}
      style={{
        ...style,
        width,
        transition: reduced ? undefined : `width ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      }}
    />
  );
}
