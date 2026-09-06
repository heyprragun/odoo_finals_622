import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { searchProducts } from "../../api/products";
import { useSortableTable } from "../../hooks/useSortableTable";
import { SortableHeader } from "../../components/SortableHeader";
import type { Product } from "../../types/sales";
import { NoAccessBlock } from "./NoAccessBlock";
import "./sales.css";

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function getSortValue(product: Product, key: string): string | number | null {
  switch (key) {
    case "name":
      return product.name;
    case "sku":
      return product.sku;
    case "category":
      return product.category;
    case "price":
      return product.unitPrice;
    case "cost":
      return product.cost ?? null;
    case "status":
      return product.active ? 1 : 0;
    default:
      return null;
  }
}

export function Products() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDenied = user?.role === "FINANCE";
  const isAdmin = user?.role === "ADMIN";

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(products ?? [], getSortValue, "name");

  useEffect(() => {
    if (isDenied) return;
    const handle = setTimeout(() => {
      searchProducts({
        search: search || undefined,
        category: category || undefined,
        // Admin needs to see deactivated products too, to be able to
        // reactivate them - everyone else only ever sees active ones.
        includeInactive: isAdmin,
      })
        .then(setProducts)
        .catch(() => setError("Failed to load products."));
    }, 250);
    return () => clearTimeout(handle);
  }, [search, category, isDenied, isAdmin]);

  if (isDenied) {
    return <NoAccessBlock title="Product Catalog" />;
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1>Product Catalog</h1>
        {isAdmin && (
          <button className="sales-btn sales-btn-primary" onClick={() => navigate("/sales/products/new")}>
            Add Product
          </button>
        )}
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="sales-card">
        <div className="product-search-row">
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            <option value="HARDWARE">Hardware</option>
            <option value="SERVICE">Service</option>
            <option value="SUBSCRIPTION">Subscription</option>
          </select>
        </div>

        {products === null && !error && <p className="sales-empty">Loading...</p>}
        {products !== null && products.length === 0 && <p className="sales-empty">No products found.</p>}
        {products !== null && products.length > 0 && (
          <table className="sales-table">
            <thead>
              <tr>
                <SortableHeader label="Product" sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <SortableHeader label="SKU" sortKey="sku" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Category" sortKey="category" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Selling Price" sortKey="price" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                {isAdmin && (
                  <SortableHeader label="Cost" sortKey="cost" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                )}
                {isAdmin && (
                  <SortableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                )}
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr
                  key={p.id}
                  className={isAdmin ? "clickable-row" : undefined}
                  onClick={isAdmin ? () => navigate(`/sales/products/${p.id}`) : undefined}
                >
                  <td>{p.name}</td>
                  <td>{p.sku}</td>
                  <td>{p.category}</td>
                  <td>{formatCurrency(p.unitPrice)}</td>
                  {isAdmin && <td>{p.cost !== undefined ? formatCurrency(p.cost) : "—"}</td>}
                  {isAdmin && (
                    <td>
                      <span className={`status-badge status-${p.active ? "ACTIVE" : "CANCELLED"}`}>
                        {p.active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                  )}
                  {isAdmin && (
                    <td>
                      <span className="sales-btn">Edit</span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
