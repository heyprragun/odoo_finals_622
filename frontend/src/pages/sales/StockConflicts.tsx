import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { dismissStockConflict, listStockConflicts, releaseStockConflict } from "../../api/stockConflicts";
import { useSortableTable } from "../../hooks/useSortableTable";
import { useTableFilter } from "../../hooks/useTableFilter";
import { SortableHeader } from "../../components/SortableHeader";
import type { StockPriorityConflict } from "../../types/sales";
import { NoAccessBlock } from "./NoAccessBlock";
import "./sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function formatMargin(value: number | null) {
  return value !== null ? `${value.toFixed(1)}%` : "—";
}

function getSortValue(row: StockPriorityConflict, key: string): string | number | null {
  switch (key) {
    case "product":
      return row.product.name;
    case "warehouse":
      return row.warehouse.name;
    case "requester":
      return row.requestingCustomerName;
    case "requestingTier":
      return row.requestingTier;
    case "blocker":
      return row.blockingQuote.quoteNumber;
    case "blockingTier":
      return row.blockingTier;
    case "quantity":
      return row.quantityNeeded;
    case "createdAt":
      return new Date(row.createdAt).getTime();
    default:
      return null;
  }
}

export function StockConflicts() {
  const { user } = useAuth();
  const isDenied = user?.role !== "MANAGER" && user?.role !== "ADMIN";

  const [conflicts, setConflicts] = useState<StockPriorityConflict[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const { filtered, filterText, setFilterText } = useTableFilter(
    conflicts ?? [],
    (row) => `${row.product.name} ${row.warehouse.name} ${row.requestingCustomerName} ${row.blockingQuote.quoteNumber}`
  );
  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(filtered, getSortValue, "createdAt", "desc");

  function load() {
    listStockConflicts(true)
      .then(setConflicts)
      .catch((err) => setLoadError(errorMessage(err, "Failed to load stock priority conflicts.")));
  }

  useEffect(() => {
    if (isDenied) return;
    load();
  }, [isDenied]);

  async function handleRelease(id: string) {
    setActionError(null);
    setActingId(id);
    try {
      setConflicts(await releaseStockConflict(id));
    } catch (err) {
      setActionError(errorMessage(err, "Failed to release this stock."));
    } finally {
      setActingId(null);
    }
  }

  async function handleDismiss(id: string) {
    setActionError(null);
    setActingId(id);
    try {
      setConflicts(await dismissStockConflict(id));
    } catch (err) {
      setActionError(errorMessage(err, "Failed to dismiss this conflict."));
    } finally {
      setActingId(null);
    }
  }

  if (isDenied) {
    return <NoAccessBlock title="Stock Priority Conflicts" />;
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>Stock Priority Conflicts</h1>
          <p className="page-subtitle">
            A higher-priority order (better customer tier, then margin) couldn't get stock because a
            lower-priority order is holding it. Release reassigns that stock; Dismiss leaves it as is.
          </p>
        </div>
      </div>

      {loadError && <div className="banner-error">{loadError}</div>}
      {actionError && <div className="banner-error">{actionError}</div>}

      <div className="sales-card">
        <h2>Pending Conflicts</h2>
        {conflicts === null && !loadError && <p className="sales-empty">Loading...</p>}
        {conflicts !== null && conflicts.length === 0 && (
          <p className="sales-empty">No pending stock priority conflicts right now.</p>
        )}
        {conflicts !== null && conflicts.length > 0 && (
          <>
            <div className="table-toolbar">
              <input
                type="text"
                placeholder="Filter by product, warehouse, customer, or deal..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>
            {sorted.length === 0 ? (
              <p className="sales-empty">No conflicts match this filter.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="sales-table">
                  <thead>
                    <tr>
                      <SortableHeader label="Product" sortKey="product" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                      <SortableHeader label="Warehouse" sortKey="warehouse" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                      <SortableHeader label="Qty Needed" sortKey="quantity" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                      <SortableHeader label="Requesting Order" sortKey="requester" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                      <SortableHeader label="Blocking Order" sortKey="blocker" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                      <SortableHeader label="Flagged" sortKey="createdAt" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {row.product.name} <span className="tier-badge">{row.product.sku}</span>
                        </td>
                        <td>
                          {row.warehouse.name}
                          <div className="warehouse-line">{row.warehouse.location}</div>
                        </td>
                        <td>{row.quantityNeeded}</td>
                        <td>
                          {row.requestingCustomerName} <span className="tier-badge">{row.requestingTier}</span>
                          <div className="warehouse-line">Margin {formatMargin(row.requestingMarginPercentage)}</div>
                        </td>
                        <td>
                          <Link to={`/sales/quotes/${row.blockingQuote.id}`}>{row.blockingQuote.quoteNumber}</Link>{" "}
                          <span className="tier-badge">{row.blockingTier}</span>
                          <div className="warehouse-line">
                            {row.blockingQuote.customerName} · holding {row.blockingQuantity} unit(s) · margin{" "}
                            {formatMargin(row.blockingMarginPercentage)}
                          </div>
                        </td>
                        <td>{new Date(row.createdAt).toLocaleString()}</td>
                        <td>
                          <div className="sales-actions">
                            <button
                              className="sales-btn sales-btn-primary"
                              onClick={() => handleRelease(row.id)}
                              disabled={actingId === row.id}
                            >
                              Release
                            </button>
                            <button
                              className="sales-btn"
                              onClick={() => handleDismiss(row.id)}
                              disabled={actingId === row.id}
                            >
                              Dismiss
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
