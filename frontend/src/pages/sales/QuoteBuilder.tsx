import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { getQuote, submitQuote, updateQuote } from "../../api/quotes";
import { searchProducts } from "../../api/products";
import { getProductAvailability } from "../../api/inventory";
import type { Product, ProductCategory, Quote, WarehouseAvailability } from "../../types/sales";
import "./sales.css";

interface BuilderItem {
  productId: string;
  name: string;
  sku: string;
  category: ProductCategory;
  unitPrice: number;
  quantity: number;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message
    ? err.response.data.message
    : fallback;
}

export function QuoteBuilder() {
  const { id } = useParams<{ id: string }>();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<BuilderItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  const [availability, setAvailability] = useState<Record<string, WarehouseAvailability[] | "loading" | "error">>({});

  const isEditable = quote?.status === "DRAFT";

  useEffect(() => {
    if (!id) return;
    getQuote(id)
      .then((q) => {
        setQuote(q);
        setItems(
          q.items.map((item) => ({
            productId: item.productId,
            name: item.product.name,
            sku: item.product.sku,
            category: item.product.category,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
          }))
        );
      })
      .catch((err) => setLoadError(errorMessage(err, "Failed to load this quote.")));
  }, [id]);

  const loadAvailability = useCallback((productId: string) => {
    setAvailability((prev) => ({ ...prev, [productId]: "loading" }));
    getProductAvailability(productId)
      .then((data) => setAvailability((prev) => ({ ...prev, [productId]: data })))
      .catch(() => setAvailability((prev) => ({ ...prev, [productId]: "error" })));
  }, []);

  useEffect(() => {
    for (const item of items) {
      if (!(item.productId in availability)) {
        loadAvailability(item.productId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    const handle = setTimeout(() => {
      searchProducts({
        search: searchTerm || undefined,
        category: categoryFilter || undefined,
      })
        .then(setSearchResults)
        .catch(() => setSearchResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [searchTerm, categoryFilter]);

  function addProduct(product: Product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          category: product.category,
          unitPrice: product.unitPrice,
          quantity: 1,
        },
      ];
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    const safeQuantity = Number.isFinite(quantity) && quantity >= 1 ? Math.floor(quantity) : 1;
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, quantity: safeQuantity } : i)));
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  const localSubtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  async function persistItems(): Promise<Quote> {
    if (!id) throw new Error("Missing quote id");
    const updated = await updateQuote(id, {
      notes: quote?.notes ?? undefined,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });
    setQuote(updated);
    setItems(
      updated.items.map((item) => ({
        productId: item.productId,
        name: item.product.name,
        sku: item.product.sku,
        category: item.product.category,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      }))
    );
    return updated;
  }

  async function handleSaveDraft() {
    setActionError(null);
    setSuccessMessage(null);
    setIsSaving(true);
    try {
      await persistItems();
      setSuccessMessage("Draft saved.");
    } catch (err) {
      setActionError(errorMessage(err, "Failed to save draft."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit() {
    if (!id) return;
    setActionError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      await persistItems();
      const submitted = await submitQuote(id);
      setQuote(submitted);
      setSuccessMessage("Quote submitted.");
    } catch (err) {
      setActionError(errorMessage(err, "Failed to submit quote."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="sales-page">
        <div className="banner-error">{loadError}</div>
        <Link className="sales-back-link" to="/sales/quotes">
          ← Back to my quotes
        </Link>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="sales-page">
        <p className="sales-empty">Loading...</p>
      </div>
    );
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1>
          Quote Builder — {quote.quoteNumber}{" "}
          <span className={`status-badge status-${quote.status}`}>{quote.status}</span>
        </h1>
        <Link className="sales-back-link" to="/sales/quotes">
          ← Back to my quotes
        </Link>
      </div>

      {actionError && <div className="banner-error">{actionError}</div>}
      {successMessage && <div className="banner-success">{successMessage}</div>}

      <div className="sales-card">
        <h2>Customer</h2>
        <p>
          <strong>{quote.customer.name}</strong>{" "}
          <span className="tier-badge">{quote.customer.tier}</span>
        </p>
      </div>

      {isEditable && (
        <div className="sales-card">
          <h2>Product Search</h2>
          <div className="product-search-row">
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              <option value="HARDWARE">Hardware</option>
              <option value="SERVICE">Service</option>
              <option value="SUBSCRIPTION">Subscription</option>
            </select>
          </div>
          {searchResults.length === 0 ? (
            <p className="sales-empty">No products found.</p>
          ) : (
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Selling Price</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{product.sku}</td>
                    <td>{product.category}</td>
                    <td>{formatCurrency(product.unitPrice)}</td>
                    <td>
                      <button className="sales-btn" onClick={() => addProduct(product)}>
                        Add
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="sales-card">
        <h2>Selected Products</h2>
        {items.length === 0 ? (
          <p className="sales-empty">No products added yet.</p>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Unit Price</th>
                <th>Quantity</th>
                <th>Line Total</th>
                {isEditable && <th></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.productId}>
                  <td>
                    {item.name}
                    <div>
                      {(() => {
                        const avail = availability[item.productId];
                        if (avail === "loading") {
                          return <span className="warehouse-line">Loading availability...</span>;
                        }
                        if (avail === "error" || !avail) {
                          return null;
                        }
                        if (avail.length === 0) {
                          return <span className="warehouse-line">No warehouse stock configured.</span>;
                        }
                        return avail.map((w) => (
                          <div className="warehouse-line" key={w.warehouseId}>
                            {w.warehouseName} ({w.location}) — {w.quantityAvailable} available
                          </div>
                        ));
                      })()}
                    </div>
                  </td>
                  <td>{item.sku}</td>
                  <td>{formatCurrency(item.unitPrice)}</td>
                  <td>
                    {isEditable ? (
                      <div className="qty-control">
                        <button onClick={() => updateQuantity(item.productId, item.quantity - 1)}>−</button>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.productId, Number(e.target.value))}
                        />
                        <button onClick={() => updateQuantity(item.productId, item.quantity + 1)}>+</button>
                      </div>
                    ) : (
                      item.quantity
                    )}
                  </td>
                  <td>{formatCurrency(item.unitPrice * item.quantity)}</td>
                  {isEditable && (
                    <td>
                      <button className="sales-btn sales-btn-danger" onClick={() => removeItem(item.productId)}>
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="sales-card">
        <h2>Quote Summary</h2>
        <div className="quote-summary-row">
          <span>Subtotal</span>
          <span>{formatCurrency(isEditable ? localSubtotal : quote.subtotal)}</span>
        </div>
        <div className="quote-summary-row">
          <span>Discount</span>
          <span>{formatCurrency(0)}</span>
        </div>
        <div className="quote-summary-row">
          <span>Tax</span>
          <span>{formatCurrency(0)}</span>
        </div>
        <div className="quote-summary-row total">
          <span>Total</span>
          <span>{formatCurrency(isEditable ? localSubtotal : quote.totalAmount)}</span>
        </div>
        <p style={{ color: "#888", fontSize: "0.78rem", marginTop: "0.5rem" }}>
          Final totals are always recalculated by the server on save.
        </p>
      </div>

      <div className="recommendations-panel">
        Upsell &amp; cross-sell recommendations will appear here in a future release.
      </div>

      {isEditable && (
        <div className="sales-actions" style={{ marginTop: "1.25rem" }}>
          <button className="sales-btn" onClick={handleSaveDraft} disabled={isSaving || isSubmitting}>
            {isSaving ? "Saving..." : "Save Draft"}
          </button>
          <button
            className="sales-btn sales-btn-primary"
            onClick={handleSubmit}
            disabled={isSaving || isSubmitting || items.length === 0}
          >
            {isSubmitting ? "Submitting..." : "Submit Quote"}
          </button>
        </div>
      )}
    </div>
  );
}
