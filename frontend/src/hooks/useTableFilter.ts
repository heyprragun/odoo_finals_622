import { useMemo, useState } from "react";

/**
 * Free-text filter for a table - matches getSearchableText(row) against the
 * typed query, case-insensitively, as a substring anywhere in that text.
 * Callers build getSearchableText from whichever fields make sense to
 * search for that table (name, number, status, etc.).
 */
export function useTableFilter<T>(data: T[], getSearchableText: (item: T) => string) {
  const [filterText, setFilterText] = useState("");

  const filtered = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    if (!query) return data;
    return data.filter((item) => getSearchableText(item).toLowerCase().includes(query));
  }, [data, filterText, getSearchableText]);

  return { filtered, filterText, setFilterText };
}
