import type { NetworkLink } from "../../data/types";
import AnimatedPath from "../motion/AnimatedPath";
import FadeIn from "../motion/FadeIn";

interface RouteTopologyProps {
  route: NetworkLink["route"];
  attention: boolean;
}

/** Physical link architecture trace: ingress → amp → amp → egress, positioned
 *  proportionally along the route's real distance. */
export default function RouteTopology({ route, attention }: RouteTopologyProps) {
  const w = 800;
  const y = 25;
  const x0 = 50;
  const x3 = 750;
  const span = x3 - x0;
  const shiftX = x0 + (route.shiftAtKm / route.distanceKm) * span;
  const midX = x0 + span * 0.72;
  const accent = attention ? "#B7791F" : "#1c1b1a";

  return (
    <svg className="w-full h-14" preserveAspectRatio="none" viewBox={`0 0 ${w} 50`}>
      <AnimatedPath d={`M ${x0},${y} L ${x3},${y}`} stroke="#c4c7c7" strokeWidth={2} durationMs={650} />
      <AnimatedPath d={`M ${x0},${y} L ${midX},${y}`} stroke="#1c1b1a" strokeWidth={2} durationMs={650} />
      <AnimatedPath d={`M ${shiftX},${y} L ${midX},${y}`} stroke={accent} strokeWidth={2.5} durationMs={650} delayMs={80} />
      <FadeIn as="g" delayMs={500}>
        <circle cx={x0} cy={y} r={6} fill="#1c1b1a" />
        <circle cx={shiftX} cy={y} r={5} fill={accent} />
        <circle cx={midX} cy={y} r={5} fill="#1c1b1a" />
        <circle cx={x3} cy={y} r={6} fill="#1c1b1a" />
        <text x={x0} y={45} fill="#1c1b1a" fontFamily="IBM Plex Mono" fontSize={9} textAnchor="middle">
          0 km
        </text>
        <text x={shiftX} y={45} fill={accent} fontFamily="IBM Plex Mono" fontSize={9} textAnchor="middle">
          {route.shiftAtKm} km {attention ? "(Shift)" : ""}
        </text>
        <text x={midX} y={45} fill="#1c1b1a" fontFamily="IBM Plex Mono" fontSize={9} textAnchor="middle">
          {Math.round(route.distanceKm * 0.72)} km
        </text>
        <text x={x3} y={45} fill="#1c1b1a" fontFamily="IBM Plex Mono" fontSize={9} textAnchor="middle">
          {route.distanceKm.toLocaleString()} km
        </text>
        <text x={x0} y={14} fill="#747878" fontFamily="IBM Plex Mono" fontSize={9} textAnchor="middle">
          {route.ingressNode.txPowerDbm} dBm
        </text>
        <text x={shiftX} y={14} fill={accent} fontFamily="IBM Plex Mono" fontSize={9} textAnchor="middle">
          +{route.amp1.gainTiltDb} dB Tilt
        </text>
        <text x={midX} y={14} fill="#747878" fontFamily="IBM Plex Mono" fontSize={9} textAnchor="middle">
          OSNR {route.amp2.osnrDb}dB
        </text>
        <text x={x3} y={14} fill="#747878" fontFamily="IBM Plex Mono" fontSize={9} textAnchor="middle">
          {route.egressNode.rxPowerDbm} dBm
        </text>
      </FadeIn>
    </svg>
  );
}
