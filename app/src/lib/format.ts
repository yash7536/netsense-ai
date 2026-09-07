export function hoursAgoLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
  }
  const d = Math.floor(hours / 24);
  return `${d}d ago`;
}

export function minutesAgoLabel(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
}

export function pct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

export function ms(n: number, digits = 1): string {
  return `${n.toFixed(digits)} ms`;
}

export function signed(n: number, digits = 1, unit = ""): string {
  const sign = n > 0 ? "+" : n < 0 ? "" : "±";
  return `${sign}${n.toFixed(digits)}${unit}`;
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
