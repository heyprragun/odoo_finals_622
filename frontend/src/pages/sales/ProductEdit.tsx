import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import {
  createProduct,
  deactivateProduct,
  getProduct,
  updateProduct,
} from "../../api/products";
import { getProductAvailability, updateInventoryForProduct } from "../../api/inventory";
import { listWarehouses } from "../../api/warehouses";
import type { ProductCategory, Warehouse } from "../../types/sales";
import { NoAccessBlock } from "./NoAccessBlock";
import "./sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

export function ProductEdit() {
  const { id } = useParams<{ id: string }>();
  const isCreateMode = !id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState<ProductCategory>("HARDWARE");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("0");
  const [cost, setCost] = useState("0");
  const [active, setActive] = useState(true);

  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingInventory, setIsSavingInventory] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    listWarehouses()
      .then(setWarehouses)
      .catch(() => setWarehouses([]));

    if (!id) return;
    Promise.all([getProduct(id), getProductAvailability(id)])
      .then(([product, availability]) => {
        setName(product.name);
        setSku(product.sku);
        setCategory(product.category);
        setDescription(product.description ?? "");
        setUnitPrice(String(product.unitPrice));
        setCost(String(product.cost ?? 0));
        setActive(product.active);
        setQuantities(
          Object.fromEntries(availability.map((w) => [w.warehouseId, String(w.quantityAvailable)]))
        );
      })
      .catch((err) => setLoadError(errorMessage(err, "Failed to load this product.")));
  }, [id, isAdmin]);

  if (!isAdmin) {
    return <NoAccessBlock title="Product Catalog" />;
  }

  async function handleSave() {
    setSaveError(null);
    setSaveMessage(null);
    setIsSaving(true);
    try {
      const payload = {
        name,
        sku,
        category,
        description: description || undefined,
        unitPrice: Number(unitPrice),
        cost: Number(cost),
      };
      if (isCreateMode) {
        const created = await createProduct(payload);
        navigate(`/sales/products/${created.id}`, { replace: true });
      } else if (id) {
        await updateProduct(id, payload);
        setSaveMessage("Product saved.");
      }
    } catch (err) {
      setSaveError(errorMessage(err, "Failed to save this product."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!id) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      if (active) {
        await deactivateProduct(id);
        setActive(false);
      } else {
        await updateProduct(id, { active: true });
        setActive(true);
      }
    } catch (err) {
      setSaveError(errorMessage(err, "Failed to update this product's status."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveInventory() {
    if (!id || !warehouses) return;
    setSaveError(null);
    setSaveMessage(null);
    setIsSavingInventory(true);
    try {
      const entries = warehouses.map((w) => ({
        warehouseId: w.id,
        quantityAvailable: Math.max(0, Math.floor(Number(quantities[w.id] ?? 0)) || 0),
      }));
      await updateInventoryForProduct(id, entries);
      setSaveMessage("Inventory saved.");
    } catch (err) {
      setSaveError(errorMessage(err, "Failed to save inventory."));
    } finally {
      setIsSavingInventory(false);
    }
  }

  if (loadError) {
    return (
      <div className="sales-page">
        <div className="banner-error">{loadError}</div>
        <Link className="sales-back-link" to="/sales/products">
          ← Back to Product Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>{isCreateMode ? "Add Product" : name || "Edit Product"}</h1>
          {!isCreateMode && (
            <p className="page-subtitle">
              <span className={`status-badge status-${active ? "ACTIVE" : "CANCELLED"}`}>
                {active ? "ACTIVE" : "INACTIVE"}
              </span>
            </p>
          )}
        </div>
        <Link className="sales-back-link" to="/sales/products">
          ← Back to Product Catalog
        </Link>
      </div>

      {saveError && <div className="banner-error">{saveError}</div>}
      {saveMessage && <div className="banner-success">{saveMessage}</div>}

      <div className="sales-card">
        <h2>Product Details</h2>
        <div className="product-search-row">
          <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="text" placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
          <select value={category} onChange={(e) => setCategory(e.target.value as ProductCategory)}>
            <option value="HARDWARE">Hardware</option>
            <option value="SERVICE">Service</option>
            <option value="SUBSCRIPTION">Subscription</option>
          </select>
        </div>
        <div className="product-search-row">
          <input
            type="text"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
        <div className="product-search-row">
          <input
            type="number"
            min={0}
            placeholder="Selling Price"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
          <input
            type="number"
            min={0}
            placeholder="Cost"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </div>
        <div className="sales-actions">
          <button className="sales-btn sales-btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Product"}
          </button>
          {!isCreateMode && (
            <button className="sales-btn sales-btn-danger" onClick={handleToggleActive} disabled={isSaving}>
              {active ? "Remove Product" : "Reactivate Product"}
            </button>
          )}
        </div>
      </div>

      {!isCreateMode && (
        <div className="sales-card">
          <h2>Warehouse Inventory</h2>
          {warehouses === null && <p className="sales-empty">Loading...</p>}
          {warehouses !== null && warehouses.length === 0 && (
            <p className="sales-empty">No warehouses configured.</p>
          )}
          {warehouses !== null && warehouses.length > 0 && (
            <>
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Warehouse</th>
                    <th>Location</th>
                    <th>Quantity Available</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.map((w) => (
                    <tr key={w.id}>
                      <td>{w.name}</td>
                      <td>{w.location}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={quantities[w.id] ?? "0"}
                          onChange={(e) =>
                            setQuantities((prev) => ({ ...prev, [w.id]: e.target.value }))
                          }
                          style={{ width: 90 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="sales-actions" style={{ marginTop: "1rem" }}>
                <button
                  className="sales-btn sales-btn-primary"
                  onClick={handleSaveInventory}
                  disabled={isSavingInventory}
                >
                  {isSavingInventory ? "Saving..." : "Save Inventory"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
