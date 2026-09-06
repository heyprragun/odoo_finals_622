import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { searchProducts } from "../../api/products";
import { createMyRequest } from "../../api/customerPortal";
import type { Product } from "../../types/sales";
import "../sales/sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

interface RequestLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export function CreateCustomerRequest() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [lines, setLines] = useState<RequestLine[]>([]);
  const [expectedDiscountPercentage, setExpectedDiscountPercentage] = useState("");
  const [shippingLocation, setShippingLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    searchProducts({})
      .then((list) => {
        setProducts(list);
        if (list.length > 0) setSelectedProductId(list[0].id);
      })
      .catch((err) => setError(errorMessage(err, "Failed to load products.")));
  }, []);

  function addLine() {
    if (!selectedProductId || !products) return;
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { productId: product.id, name: product.name, unitPrice: product.unitPrice, quantity: 1 }];
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    const safe = Number.isFinite(quantity) && quantity >= 1 ? Math.floor(quantity) : 1;
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity: safe } : l)));
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }

  async function handleSubmit() {
    setError(null);
    setSuccessMessage(null);
    if (lines.length === 0) {
      setError("Add at least one product before submitting.");
      return;
    }
    if (!shippingLocation.trim()) {
      setError("Enter where this order should ship before submitting.");
      return;
    }
    setIsSubmitting(true);
    try {
      await createMyRequest({
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        expectedDiscountPercentage: expectedDiscountPercentage ? Number(expectedDiscountPercentage) : undefined,
        shippingLocation: shippingLocation.trim(),
        notes: notes.trim() || undefined,
      });
      setSuccessMessage("Your request has been sent to our sales team.");
      setLines([]);
      setExpectedDiscountPercentage("");
      setShippingLocation("");
      setNotes("");
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (err) {
      setError(errorMessage(err, "Failed to submit your request."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1>Create New Request</h1>
      </div>

      {error && <div className="banner-error">{error}</div>}
      {successMessage && <div className="banner-success">{successMessage}</div>}

      <div className="sales-card">
        <h2>Add Products</h2>
        {products === null ? (
          <p className="sales-empty">Loading products...</p>
        ) : (
          <div className="product-search-row">
            <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} — {formatCurrency(product.unitPrice)}
                </option>
              ))}
            </select>
            <button className="sales-btn sales-btn-primary" onClick={addLine} disabled={!selectedProductId}>
              Add Product
            </button>
          </div>
        )}

        {lines.length === 0 ? (
          <p className="sales-empty">No products added yet.</p>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit Price</th>
                <th>Quantity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.productId}>
                  <td>{line.name}</td>
                  <td>{formatCurrency(line.unitPrice)}</td>
                  <td>
                    <div className="qty-control">
                      <button onClick={() => updateQuantity(line.productId, line.quantity - 1)}>−</button>
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateQuantity(line.productId, Number(e.target.value))}
                      />
                      <button onClick={() => updateQuantity(line.productId, line.quantity + 1)}>+</button>
                    </div>
                  </td>
                  <td>
                    <button className="sales-btn sales-btn-danger" onClick={() => removeLine(line.productId)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="sales-card">
        <h2>Shipping Location</h2>
        <div className="product-search-row">
          <input
            type="text"
            placeholder="e.g. Bangalore, Karnataka"
            value={shippingLocation}
            onChange={(e) => setShippingLocation(e.target.value)}
            style={{ flex: 1, minWidth: 240 }}
          />
        </div>
        <p className="explainer-text" style={{ margin: 0 }}>
          Where should this order be shipped? We use this to pick the warehouse(s) that ship it to you
          fastest and cheapest.
        </p>
      </div>

      <div className="sales-card">
        <h2>Discount &amp; Special Requirements</h2>
        <div className="product-search-row">
          <label>
            Expected Discount %:{" "}
            <input
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={expectedDiscountPercentage}
              onChange={(e) => setExpectedDiscountPercentage(e.target.value)}
              style={{ width: 90 }}
            />
          </label>
        </div>
        <textarea
          placeholder="Any special requirements or comments for our sales team..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          style={{ width: "100%", padding: "0.6rem", borderRadius: 6, border: "1px solid #ccc", fontFamily: "inherit" }}
        />
      </div>

      <div className="sales-actions">
        <button className="sales-btn sales-btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit Request"}
        </button>
      </div>
    </div>
  );
}
