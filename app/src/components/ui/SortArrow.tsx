interface SortArrowProps {
  /** null = column isn't the active sort key (arrow stays faint/neutral). */
  dir: "asc" | "desc" | null;
  className?: string;
}

/** The one sort-direction glyph used by every sortable table header — reuses
 *  the same Material Symbols icon set already used throughout the app. */
export default function SortArrow({ dir, className = "" }: SortArrowProps) {
  return (
    <span
      className={`material-symbols-outlined text-[14px] leading-none transition-opacity ${dir ? "opacity-100" : "opacity-30 group-hover:opacity-60"} ${className}`}
    >
      {dir === "desc" ? "arrow_downward" : "arrow_upward"}
    </span>
  );
}
