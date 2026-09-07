import AnimatedPath from "../motion/AnimatedPath";
import FadeIn from "../motion/FadeIn";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

interface RiskHorizonMiniProps {
  /** Hours until the predicted trip/breach point — shorter horizons bend the curve sooner and steeper. */
  horizonHours: number;
  /** Model confidence 0-100 — higher confidence steepens and advances the projection. */
  confidencePct: number;
  thresholdLabel: string;
  color?: string;
  className?: string;
}

/** Compact "projected risk horizon" curve used on Prediction Detail: a
 *  short observed run that inflects into a dashed rising projection toward a
 *  labelled trip threshold. The inflection point's position is derived from
 *  the prediction's actual horizon + confidence, so a near-term, high-confidence
 *  prediction visibly bends sooner and steeper than a distant, low-confidence one. */
export default function RiskHorizonMini({ horizonHours, confidencePct, thresholdLabel, color = "#C74646", className = "w-full h-12" }: RiskHorizonMiniProps) {
  const w = 400;
  const h = 48;
  // Shorter horizon + higher confidence => higher severity => the inflection
  // point moves earlier (smaller nowX) and higher (smaller nowY), so the
  // projected leg reads as a steeper, more urgent climb.
  const urgency = clamp01(1 - (horizonHours - 4) / 8);
  const confidenceFactor = clamp01((confidencePct - 70) / 25);
  const severity = (urgency + confidenceFactor) / 2;
  const nowX = w * (0.34 - severity * 0.14);
  const nowY = h * (0.78 - severity * 0.3);
  const startY = h * 0.82;
  const endY = h * 0.1;

  const observed = `M 0,${startY.toFixed(1)} L ${(nowX * 0.5).toFixed(1)},${(startY - 2).toFixed(1)} L ${nowX.toFixed(1)},${nowY.toFixed(1)}`;
  const projected = `M ${nowX.toFixed(1)},${nowY.toFixed(1)} L ${(nowX + (w - nowX) * 0.4).toFixed(1)},${(nowY - (nowY - endY) * 0.55).toFixed(1)} L ${w - 6},${endY.toFixed(1)}`;

  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" fill="none">
      <line x1={0} y1={h * 0.2} x2={w} y2={h * 0.2} stroke="#747878" strokeDasharray="2 2" strokeWidth={0.75} />
      <text x={5} y={h * 0.2 - 3} fill="#747878" fontFamily="IBM Plex Mono" fontSize={9}>
        {thresholdLabel}
      </text>
      <AnimatedPath d={observed} stroke="#1c1b1a" strokeWidth={2} fill="none" durationMs={500} />
      <FadeIn as="g" delayMs={420}>
        <path d={projected} stroke={color} strokeWidth={2} strokeDasharray="4 3" fill="none" />
        <circle cx={w - 6} cy={endY} r={4} fill={color} />
        <line x1={w - 6} y1={0} x2={w - 6} y2={h} stroke={color} strokeWidth={1} />
      </FadeIn>
      <FadeIn as="g" delayMs={420}>
        <circle cx={nowX} cy={nowY} r={3.5} fill="#1c1b1a" />
      </FadeIn>
    </svg>
  );
}
