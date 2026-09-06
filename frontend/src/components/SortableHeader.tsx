import type { SortDirection } from "../hooks/useSortableTable";

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  activeKey: string | undefined;
  direction: SortDirection;
  onSort: (key: string) => void;
}

// A <th> that toggles ascending/descending on click - used by every list
// table in the app (see useSortableTable) so the affordance/indicator looks
// and behaves identically everywhere.
export function SortableHeader({ label, sortKey, activeKey, direction, onSort }: SortableHeaderProps) {
  const isActive = activeKey === sortKey;
  const ariaSort = isActive ? (direction === "asc" ? "ascending" : "descending") : "none";
  return (
    <th className="sortable-th" onClick={() => onSort(sortKey)} aria-sort={ariaSort}>
      {label}
      <span className={`sort-indicator${isActive ? " active" : ""}`}>
        {isActive ? (direction === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </th>
  );
}
