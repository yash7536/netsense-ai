import { useEffect, useRef, useState } from "react";

/** Tracks the user's `prefers-reduced-motion` setting live. Every animation
 *  hook/component in this app checks this before doing anything nonessential. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);

/** Animates a number counting up from 0 to `value` once, on mount / whenever
 *  `value` changes. Used for prominent hero/telemetry figures — never for
 *  ordinary table cells. Reduced-motion users see the final value directly. */
export function useCountUp(value: number, durationMs = 700): number {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setDisplay(from + (value - from) * EASE_OUT(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs, reduced]);

  return display;
}

/** True once the surrounding component has completed its first mount tick —
 *  used to flip a CSS value (0 → target width, full → 0 dash-offset) so the
 *  transition actually animates instead of starting at its end state. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return mounted;
}
