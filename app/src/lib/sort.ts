import { useState } from "react";

export type SortDir = "asc" | "desc";

export interface SortState<K extends string> {
  key: K | null;
  dir: SortDir;
}

/** Shared column-sort behaviour for the four list tables: click a header to
 *  sort ascending, click the same header again to flip to descending, click
 *  a different header to start that column fresh at ascending. */
export function useSortState<K extends string>() {
  const [sort, setSort] = useState<SortState<K>>({ key: null, dir: "asc" });

  const toggleSort = (key: K) => {
    setSort((cur) => {
      if (cur.key !== key) return { key, dir: "asc" };
      return { key, dir: cur.dir === "asc" ? "desc" : "asc" };
    });
  };

  return { sort, toggleSort };
}

export function sortByKey<T>(items: T[], sort: SortState<string>, valueOf: (item: T, key: string) => number | string): T[] {
  if (!sort.key) return items;
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const va = valueOf(a, sort.key!);
    const vb = valueOf(b, sort.key!);
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });
}
