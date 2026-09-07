import { useMounted, usePrefersReducedMotion } from "../../lib/motion";

interface FadeInProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  delayMs?: number;
  durationMs?: number;
  /** Small upward drift alongside the fade — kept subtle (a few px). */
  rise?: number;
  as?: "div" | "g" | "article" | "li";
}

/** Restrained opacity(+drift) reveal for content that should announce itself
 *  once rather than snap in — dashed chart projections, timeline entries.
 *  Not for ordinary table rows/values. Any extra props (onClick, tabIndex,
 *  aria-*, ...) pass straight through to the rendered element. */
export default function FadeIn({ children, delayMs = 0, durationMs = 420, rise = 0, as = "div", style, ...rest }: FadeInProps) {
  const mounted = useMounted();
  const reduced = usePrefersReducedMotion();
  const Tag = as as "div";
  if (reduced) return (
    <Tag {...rest} style={style}>
      {children}
    </Tag>
  );
  return (
    <Tag
      {...rest}
      style={{
        ...style,
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : `translateY(${rise}px)`,
        transition: `opacity ${durationMs}ms ease-out ${delayMs}ms, transform ${durationMs}ms ease-out ${delayMs}ms`,
      }}
    >
      {children}
    </Tag>
  );
}
