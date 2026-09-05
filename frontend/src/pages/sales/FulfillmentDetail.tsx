import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { getProductAvailability, getStockSummary } from "../../api/inventory";
import type { StockSummaryItem, WarehouseAvailability } from "../../types/sales";
import { NoAccessBlock } from "./NoAccessBlock";
import "./sales.css";

export function FulfillmentDetail() {
  const { productId } = useParams<{ productId: string }>();
  const { user } = useAuth();
  const isDenied = user?.role === "FINANCE";
  const [warehouses, setWarehouses] = useState<WarehouseAvailability[] | null>(null);
  const [product, setProduct] = useState<StockSummaryItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId || isDenied) return;
    Promise.all([getProductAvailability(productId), getStockSummary()])
      .then(([availability, summary]) => {
        setWarehouses(availability);
        setProduct(summary.find((p) => p.productId === productId) ?? null);
      })
      .catch((err) => {
        setError(
          axios.isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : "Failed to load warehouse split."
        );
      });
  }, [productId, isDenied]);

  if (isDenied) {
    return <NoAccessBlock title="Fulfillment" />;
  }

  if (error) {
    return (
      <div className="sales-page">
        <div className="banner-error">{error}</div>
        <Link className="sales-back-link" to="/sales/fulfillment">
          ← Back to Fulfillment
        </Link>
      </div>
    );
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>{product ? product.productName : "Warehouse Split"}</h1>
          {product && <p className="page-subtitle">SKU: {product.sku}</p>}
        </div>
        <Link className="sales-back-link" to="/sales/fulfillment">
          ← Back to Fulfillment
        </Link>
      </div>

      {product && (
        <div className="sales-summary-grid">
          <div className="sales-stat">
            <div className="value">{product.totalOnHand}</div>
            <div className="label">Total in Stock</div>
          </div>
          <div className="sales-stat">
            <div className="value">{product.totalReserved}</div>
            <div className="label">Reserved</div>
          </div>
          <div className="sales-stat">
            <div className="value">{product.totalAvailable}</div>
            <div className="label">Available for Shipment</div>
          </div>
        </div>
      )}

      <div className="sales-card">
        <h2>Warehouse Split</h2>
        {warehouses === null && <p className="sales-empty">Loading...</p>}
        {warehouses !== null && warehouses.length === 0 && (
          <p className="sales-empty">No warehouse stock configured for this product.</p>
        )}
        {warehouses !== null && warehouses.length > 0 && (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>Location</th>
                <th>Total in Stock</th>
                <th>Reserved</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => (
                <tr key={w.warehouseId}>
                  <td>{w.warehouseName}</td>
                  <td>{w.location}</td>
                  <td>{w.quantityAvailable + w.quantityReserved}</td>
                  <td>{w.quantityReserved}</td>
                  <td>
                    <strong>{w.quantityAvailable}</strong>
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
