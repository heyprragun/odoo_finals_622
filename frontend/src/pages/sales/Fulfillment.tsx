import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { getStockSummary } from "../../api/inventory";
import { useSortableTable } from "../../hooks/useSortableTable";
import { useTableFilter } from "../../hooks/useTableFilter";
import { SortableHeader } from "../../components/SortableHeader";
import type { StockSummaryItem } from "../../types/sales";
import { NoAccessBlock } from "./NoAccessBlock";
import "./sales.css";

function getSortValue(item: StockSummaryItem, key: string): string | number | null {
  switch (key) {
    case "product":
      return item.productName;
    case "sku":
      return item.sku;
    case "category":
      return item.category;
    case "onHand":
      return item.totalOnHand;
    case "reserved":
      return item.totalReserved;
    case "available":
      return item.totalAvailable;
    default:
      return null;
  }
}

export function Fulfillment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDenied = user?.role === "FINANCE";
  const [items, setItems] = useState<StockSummaryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { filtered, filterText, setFilterText } = useTableFilter(
    items ?? [],
    (item) => `${item.productName} ${item.sku} ${item.category}`
  );
  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(filtered, getSortValue, "product");

  useEffect(() => {
    if (isDenied) return;
    getStockSummary()
      .then(setItems)
      .catch((err) => {
        setError(
          axios.isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : "Failed to load stock."
        );
      });
  }, [isDenied]);

  if (isDenied) {
    return <NoAccessBlock title="Fulfillment" />;
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>Fulfillment</h1>
          <p className="page-subtitle">
            Live warehouse stock across every product - click a row to see the per-warehouse split
          </p>
        </div>
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="sales-card">
        {items === null && !error && <p className="sales-empty">Loading...</p>}
        {items !== null && items.length === 0 && <p className="sales-empty">No products found.</p>}
        {items !== null && items.length > 0 && (
          <>
            <div className="table-toolbar">
              <input
                type="text"
                placeholder="Filter by product, SKU, or category..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>
            {sorted.length === 0 ? (
              <p className="sales-empty">No products match this filter.</p>
            ) : (
              <table className="sales-table">
                <thead>
                  <tr>
                    <SortableHeader label="Product" sortKey="product" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="SKU" sortKey="sku" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Category" sortKey="category" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Total in Stock" sortKey="onHand" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Reserved" sortKey="reserved" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Available for Shipment" sortKey="available" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item) => (
                    <tr
                      key={item.productId}
                      className="clickable-row"
                      onClick={() => navigate(`/sales/fulfillment/${item.productId}`)}
                    >
                      <td>{item.productName}</td>
                      <td>{item.sku}</td>
                      <td>{item.category}</td>
                      <td>{item.totalOnHand}</td>
                      <td>{item.totalReserved}</td>
                      <td>
                        <strong>{item.totalAvailable}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
