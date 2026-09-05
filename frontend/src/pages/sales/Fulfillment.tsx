import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { getStockSummary } from "../../api/inventory";
import type { StockSummaryItem } from "../../types/sales";
import { NoAccessBlock } from "./NoAccessBlock";
import "./sales.css";

export function Fulfillment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDenied = user?.role === "FINANCE";
  const [items, setItems] = useState<StockSummaryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <table className="sales-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Total in Stock</th>
                <th>Reserved</th>
                <th>Available for Shipment</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
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
      </div>
    </div>
  );
}
