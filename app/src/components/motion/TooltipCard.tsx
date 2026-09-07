interface TooltipCardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

/** The one tooltip chrome used everywhere a chart/bar/sparkline surfaces an
 *  exact value on hover or touch — flat surface, 1px hairline border, zero
 *  shadow, zero radius, matching DESIGN.md's "Active / Focus Ground" spec.
 *  Never a native browser title tooltip. Positioning/clamping is the
 *  caller's job; this just renders the box. */
export default function TooltipCard({ children, style, className = "" }: TooltipCardProps) {
  return (
    <div
      role="tooltip"
      className={`pointer-events-none absolute z-30 bg-surface-container-lowest border border-outline-variant shadow-none ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
