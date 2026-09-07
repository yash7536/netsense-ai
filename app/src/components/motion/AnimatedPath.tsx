import { useMounted, usePrefersReducedMotion } from "../../lib/motion";

interface AnimatedPathProps extends React.SVGProps<SVGPathElement> {
  /** Extra delay before the draw-in starts, for staggering multiple lines. */
  delayMs?: number;
  durationMs?: number;
}

/** An SVG `<path>` that draws itself in from start to finish on mount,
 *  using the `pathLength` normalisation trick so it works regardless of the
 *  path's real geometry. Reserved for solid observed-data strokes — dashed
 *  projection segments fade in instead (see `FadeIn`), since a dash pattern
 *  and a reveal-dasharray can't share the same stroke-dasharray. */
export default function AnimatedPath({ delayMs = 0, durationMs = 900, style, ...rest }: AnimatedPathProps) {
  const mounted = useMounted();
  const reduced = usePrefersReducedMotion();
  if (reduced) return <path {...rest} style={style} />;
  return (
    <path
      {...rest}
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={mounted ? 0 : 1}
      style={{
        ...style,
        transition: [`stroke-dashoffset ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms`, style?.transition].filter(Boolean).join(", "),
      }}
    />
  );
}
