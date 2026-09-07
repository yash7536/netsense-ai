import { useMounted, usePrefersReducedMotion } from "../../lib/motion";

interface HealthRingProps {
  pct: number;
  color: string;
  size?: number;
}

export default function HealthRing({ pct, color, size = 16 }: HealthRingProps) {
  const mounted = useMounted();
  const reduced = usePrefersReducedMotion();
  const r = 7;
  const circumference = 2 * Math.PI * r;
  const target = circumference * (1 - Math.min(100, Math.max(0, pct)) / 100);
  const offset = reduced || mounted ? target : circumference;
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90" viewBox="0 0 20 20" style={{ width: size, height: size }}>
        <circle cx="10" cy="10" r={r} fill="none" stroke="#EAE8E3" strokeWidth={2} />
        <circle
          cx="10"
          cy="10"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={reduced ? undefined : { transition: "stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <span className="absolute rounded-full" style={{ width: size * 0.375, height: size * 0.375, backgroundColor: color }} />
    </div>
  );
}
