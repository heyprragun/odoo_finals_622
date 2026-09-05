import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { getQuote, markStockUnavailable, submitQuote, updateQuote } from "../../api/quotes";
import { searchProducts } from "../../api/products";
import { getStockAllocation } from "../../api/inventory";
import { RecommendationsPanel } from "./RecommendationsPanel";
import type { Product, ProductCategory, Quote, StockAllocationResult } from "../../types/sales";
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
  const { user } = useAuth();

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

  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [taxPercentage, setTaxPercentage] = useState(0);

  // Keyed by `${productId}:${quantity}` so changing a line's quantity
  // triggers a fresh allocation check rather than reusing a stale one.
  const [allocations, setAllocations] = useState<Record<string, StockAllocationResult | "loading" | "error">>({});
  const [showStockIssueForm, setShowStockIssueForm] = useState(false);
  const [stockIssueNote, setStockIssueNote] = useState("Order not possible");
  const [isFlaggingStockIssue, setIsFlaggingStockIssue] = useState(false);

  // Viewing is fine for a Manager (their Quotations screen mirrors the Sales
  // Rep's), but editing/submitting is still the owning Sales Rep's alone -
  // the backend enforces this too, this just keeps the UI from offering
  // controls that would 403.
  const isOwnQuote = !!quote && !!user && quote.salesRepId === user.id;
  const isEditable =
    isOwnQuote && (quote?.status === "DRAFT" || quote?.status === "REVISION_REQUIRED");

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
        setDiscountPercentage(q.discountPercentage);
        setTaxPercentage(q.taxPercentage);
      })
      .catch((err) => setLoadError(errorMessage(err, "Failed to load this quote.")));
  }, [id]);

  const loadAllocation = useCallback((productId: string, quantity: number) => {
    const key = `${productId}:${quantity}`;
    setAllocations((prev) => ({ ...prev, [key]: "loading" }));
    getStockAllocation(productId, quantity)
      .then((data) => setAllocations((prev) => ({ ...prev, [key]: data })))
      .catch(() => setAllocations((prev) => ({ ...prev, [key]: "error" })));
  }, []);

  useEffect(() => {
    for (const item of items) {
      const key = `${item.productId}:${item.quantity}`;
      if (!(key in allocations)) {
        loadAllocation(item.productId, item.quantity);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Flags on-screen when the currently-entered quantity for any line
  // exceeds total available inventory - informational only, doesn't block
  // saving/submitting on its own. The Rep decides whether to tell the
  // customer via the "Mark Order Not Possible" action below.
  const hasStockIssue = items.some((item) => {
    const alloc = allocations[`${item.productId}:${item.quantity}`];
    return alloc && alloc !== "loading" && alloc !== "error" && !alloc.fulfillable;
  });

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
  const localDiscountAmount = (localSubtotal * discountPercentage) / 100;
  const localTaxableAmount = localSubtotal - localDiscountAmount;
  const localTaxAmount = (localTaxableAmount * taxPercentage) / 100;
  const localTotal = localTaxableAmount + localTaxAmount;

  async function persistItems(): Promise<Quote> {
    if (!id) throw new Error("Missing quote id");
    const updated = await updateQuote(id, {
      notes: quote?.notes ?? undefined,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      discountPercentage,
      taxPercentage,
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
    setDiscountPercentage(updated.discountPercentage);
    setTaxPercentage(updated.taxPercentage);
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

  async function handleMarkStockUnavailable() {
    if (!id) return;
    setActionError(null);
    setIsFlaggingStockIssue(true);
    try {
      const updated = await markStockUnavailable(id, stockIssueNote.trim() || undefined);
      setQuote(updated);
      setShowStockIssueForm(false);
      setSuccessMessage("Customer notified: order not possible.");
    } catch (err) {
      setActionError(errorMessage(err, "Failed to notify the customer."));
    } finally {
      setIsFlaggingStockIssue(false);
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

      {isEditable && hasStockIssue && (
        <div className="sales-card">
          <h2>Stock Issue Detected</h2>
          <p className="banner-error">
            One or more products in this quote exceed available inventory. If this can't be resolved, let
            the customer know.
          </p>
          {!showStockIssueForm ? (
            <div className="sales-actions">
              <button className="sales-btn sales-btn-danger" onClick={() => setShowStockIssueForm(true)}>
                Mark Order Not Possible
              </button>
            </div>
          ) : (
            <>
              <textarea
                value={stockIssueNote}
                onChange={(e) => setStockIssueNote(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  padding: "0.6rem",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  fontFamily: "inherit",
                  marginBottom: "0.75rem",
                }}
              />
              <div className="sales-actions">
                <button
                  className="sales-btn sales-btn-danger"
                  onClick={handleMarkStockUnavailable}
                  disabled={isFlaggingStockIssue}
                >
                  {isFlaggingStockIssue ? "Notifying..." : "Confirm & Notify Customer"}
                </button>
                <button
                  className="sales-btn"
                  onClick={() => setShowStockIssueForm(false)}
                  disabled={isFlaggingStockIssue}
                >
                  Never Mind
                </button>
              </div>
            </>
          )}
        </div>
      )}

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
                        const alloc = allocations[`${item.productId}:${item.quantity}`];
                        if (alloc === "loading") {
                          return <span className="warehouse-line">Checking stock...</span>;
                        }
                        if (alloc === "error" || !alloc) {
                          return null;
                        }
                        if (alloc.totalAvailable === 0 && alloc.allocations.length === 0) {
                          return <span className="warehouse-line">No warehouse stock configured.</span>;
                        }
                        return (
                          <>
                            {!alloc.fulfillable && (
                              <div
                                className="banner-error"
                                style={{ margin: "0.3rem 0", padding: "0.35rem 0.6rem", fontSize: "0.78rem" }}
                              >
                                Order not possible — only {alloc.totalAvailable} available, need{" "}
                                {alloc.requestedQuantity} (short by {alloc.shortfall}).
                              </div>
                            )}
                            {alloc.allocations.map((a) => (
                              <div className="warehouse-line" key={a.warehouseId}>
                                {a.warehouseName} ({a.location}) — take {a.quantityAllocated} of{" "}
                                {a.quantityAvailable} available
                              </div>
                            ))}
                          </>
                        );
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
          <span>
            Discount
            {isEditable ? (
              <span className="qty-control" style={{ marginLeft: "0.6rem" }}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={discountPercentage}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setDiscountPercentage(Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0);
                  }}
                  style={{ width: 64 }}
                />
                <span>%</span>
              </span>
            ) : (
              ` (${quote.discountPercentage}%)`
            )}
          </span>
          <span>−{formatCurrency(isEditable ? localDiscountAmount : quote.discountAmount)}</span>
        </div>
        <div className="quote-summary-row">
          <span>
            Tax
            {isEditable ? (
              <span className="qty-control" style={{ marginLeft: "0.6rem" }}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={taxPercentage}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setTaxPercentage(Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0);
                  }}
                  style={{ width: 64 }}
                />
                <span>%</span>
              </span>
            ) : (
              ` (${quote.taxPercentage}%)`
            )}
          </span>
          <span>{formatCurrency(isEditable ? localTaxAmount : quote.taxAmount)}</span>
        </div>
        <div className="quote-summary-row total">
          <span>Total</span>
          <span>{formatCurrency(isEditable ? localTotal : quote.totalAmount)}</span>
        </div>
        <p style={{ color: "#888", fontSize: "0.78rem", marginTop: "0.5rem" }}>
          Final totals are always recalculated by the server on save.
        </p>
      </div>

      {(isOwnQuote || user?.role === "ADMIN") && (
        <RecommendationsPanel
          quoteId={quote.id}
          hasItems={items.length > 0}
          onBeforeGenerate={isEditable ? persistItems : undefined}
        />
      )}

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
