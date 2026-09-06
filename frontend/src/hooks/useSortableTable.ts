import { useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";

/**
 * Generic click-to-sort for a table. getValue extracts whatever sortable
 * value a given column key represents from one row - numbers sort
 * numerically, everything else falls back to locale string comparison.
 * null/undefined always sort to the end regardless of direction, so an
 * unknown/missing value never jumps to the top on a descending sort.
 */
export function useSortableTable<T>(
  data: T[],
  getValue: (item: T, key: string) => string | number | null | undefined,
  initialKey?: string,
  initialDirection: SortDirection = "asc"
) {
  const [sortKey, setSortKey] = useState<string | undefined>(initialKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialDirection);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const dir = sortDirection === "asc" ? 1 : -1;
    const withValue = data.map((item) => ({ item, value: getValue(item, sortKey) }));
    withValue.sort((a, b) => {
      if (a.value == null && b.value == null) return 0;
      if (a.value == null) return 1;
      if (b.value == null) return -1;
      if (typeof a.value === "number" && typeof b.value === "number") return dir * (a.value - b.value);
      return dir * String(a.value).localeCompare(String(b.value));
    });
    return withValue.map((w) => w.item);
  }, [data, sortKey, sortDirection, getValue]);

  return { sorted, sortKey, sortDirection, toggleSort };
}
