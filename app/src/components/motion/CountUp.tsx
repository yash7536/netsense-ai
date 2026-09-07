import { useCountUp } from "../../lib/motion";

interface CountUpProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  padTo?: number;
  durationMs?: number;
  className?: string;
}

/** Animates a prominent numeric readout counting up to its real value once,
 *  on mount / when the value changes. Reserved for hero/telemetry figures —
 *  never wrap ordinary table cells in this. */
export default function CountUp({ value, decimals = 0, prefix = "", suffix = "", padTo, durationMs, className }: CountUpProps) {
  const animated = useCountUp(value, durationMs);
  let text = animated.toFixed(decimals);
  if (padTo && text.length < padTo && !text.includes("-")) text = text.padStart(padTo, "0");
  return (
    <span className={className}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}
