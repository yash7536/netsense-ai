import { TONE_BG, TONE_TEXT, type Tone } from "../../lib/status";

interface StatusTagProps {
  tone: Tone;
  children: React.ReactNode;
  dotShape?: "dash" | "dot";
  className?: string;
}

/** The micro-dash + uppercase caption status treatment from DESIGN.md
 *  ("Status Indicators & Badges") — no pill backgrounds, no chips. */
export default function StatusTag({ tone, children, dotShape = "dash", className = "" }: StatusTagProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`shrink-0 ${TONE_BG[tone]} ${dotShape === "dash" ? "w-1.5 h-0.5" : "w-1.5 h-1.5 rounded-full"}`} />
      <span className={`type-caption uppercase tracking-wider font-medium ${TONE_TEXT[tone]}`}>{children}</span>
    </span>
  );
}
