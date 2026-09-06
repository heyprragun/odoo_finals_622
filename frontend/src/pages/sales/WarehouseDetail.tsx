import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { getWarehouseDetail } from "../../api/warehouses";
import { updateInventoryForProduct } from "../../api/inventory";
import { useSortableTable } from "../../hooks/useSortableTable";
import { useTableFilter } from "../../hooks/useTableFilter";
import { SortableHeader } from "../../components/SortableHeader";
import type { WarehouseDetail as WarehouseDetailType, WarehouseStockItem } from "../../types/sales";
import { NoAccessBlock } from "./NoAccessBlock";
import "./sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function getSortValue(item: WarehouseStockItem, key: string): string | number | null {
  switch (key) {
    case "product":
      return item.productName;
    case "sku":
      return item.sku;
    case "category":
      return item.category;
    case "available":
      return item.quantityAvailable;
    case "reserved":
      return item.quantityReserved;
    default:
      return null;
  }
}

export function WarehouseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDenied = user?.role !== "ADMIN";

  const [detail, setDetail] = useState<WarehouseDetailType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const { filtered, filterText, setFilterText } = useTableFilter(
    detail?.items ?? [],
    (item) => `${item.productName} ${item.sku} ${item.category}`
  );
  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(filtered, getSortValue, "product");

  useEffect(() => {
    if (!id || isDenied) return;
    getWarehouseDetail(id)
      .then((d) => {
        setDetail(d);
        setQuantities(Object.fromEntries(d.items.map((i) => [i.productId, String(i.quantityAvailable)])));
      })
      .catch((err) => setLoadError(errorMessage(err, "Failed to load this warehouse.")));
  }, [id, isDenied]);

  if (isDenied) {
    return <NoAccessBlock title="Warehouses" />;
  }

  async function handleSave() {
    if (!id || !detail) return;
    setSaveError(null);
    setSaveMessage(null);
    setIsSaving(true);
    try {
      // Only push rows whose quantity actually changed - no need to re-save
      // every product just because one line was edited.
      const changed = detail.items.filter((item) => {
        const entered = Math.max(0, Math.floor(Number(quantities[item.productId] ?? 0)) || 0);
        return entered !== item.quantityAvailable;
      });
      await Promise.all(
        changed.map((item) =>
          updateInventoryForProduct(item.productId, [
            { warehouseId: id, quantityAvailable: Math.max(0, Math.floor(Number(quantities[item.productId] ?? 0)) || 0) },
          ])
        )
      );
      const refreshed = await getWarehouseDetail(id);
      setDetail(refreshed);
      setQuantities(Object.fromEntries(refreshed.items.map((i) => [i.productId, String(i.quantityAvailable)])));
      setSaveMessage(changed.length > 0 ? `Saved stock for ${changed.length} product(s).` : "No changes to save.");
    } catch (err) {
      setSaveError(errorMessage(err, "Failed to save stock."));
    } finally {
      setIsSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="sales-page">
        <div className="banner-error">{loadError}</div>
        <Link className="sales-back-link" to="/sales/warehouses">
          ← Back to Warehouses
        </Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="sales-page">
        <p className="sales-empty">Loading...</p>
      </div>
    );
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>{detail.name}</h1>
          <p className="page-subtitle">
            {detail.location} · {detail.summary.productsStocked} product(s) stocked ·{" "}
            {detail.summary.totalUnitsAvailable} unit(s) available
          </p>
        </div>
        <Link className="sales-back-link" to="/sales/warehouses">
          ← Back to Warehouses
        </Link>
      </div>

      {saveError && <div className="banner-error">{saveError}</div>}
      {saveMessage && <div className="banner-success">{saveMessage}</div>}

      <div className="sales-card">
        <h2>Stock at this Warehouse</h2>
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
          <>
            <table className="sales-table">
              <thead>
                <tr>
                  <SortableHeader label="Product" sortKey="product" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="SKU" sortKey="sku" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Category" sortKey="category" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Quantity Available" sortKey="available" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Reserved" sortKey="reserved" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => (
                  <tr key={item.productId}>
                    <td>{item.productName}</td>
                    <td>{item.sku}</td>
                    <td>{item.category}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        value={quantities[item.productId] ?? "0"}
                        onChange={(e) =>
                          setQuantities((prev) => ({ ...prev, [item.productId]: e.target.value }))
                        }
                        style={{ width: 90 }}
                      />
                    </td>
                    <td>{item.quantityReserved}</td>
                    <td>
                      <span
                        className="sales-btn"
                        onClick={() => navigate(`/sales/products/${item.productId}`)}
                      >
                        Manage in All Warehouses
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sales-actions" style={{ marginTop: "1rem" }}>
              <button className="sales-btn sales-btn-primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Stock"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
