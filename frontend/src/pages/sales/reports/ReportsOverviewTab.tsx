import { useEffect, useState } from "react";
import axios from "axios";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { getCustomerTierOverview, getOrdersOverview, getProductPerformance } from "../../../api/reports";
import { useSortableTable } from "../../../hooks/useSortableTable";
import { SortableHeader } from "../../../components/SortableHeader";
import type { CustomerTierRow, ProductPerformanceRow, QuotationsOverviewResponse } from "../../../types/sales";
import "../sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function getSortValue(row: ProductPerformanceRow, key: string): string | number | null {
  switch (key) {
    case "name":
      return row.name;
    case "unitsSold":
      return row.unitsSold;
    case "revenue":
      return row.revenue;
    default:
      return null;
  }
}

const BUCKET_COLORS: Record<string, string> = {
  "Pending - Manager": "#b3720a",
  "Pending - Finance": "#b3720a",
  "Pending - Admin": "#b3720a",
  Approved: "#1b8a4a",
  Rejected: "#b3261e",
  Cancelled: "#888",
  "Draft / Revision": "#2f6fed",
};

export function ReportsOverviewTab() {
  const [orders, setOrders] = useState<QuotationsOverviewResponse | null>(null);
  const [products, setProducts] = useState<ProductPerformanceRow[] | null>(null);
  const [customers, setCustomers] = useState<CustomerTierRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getOrdersOverview({}), getProductPerformance(), getCustomerTierOverview()])
      .then(([ordersData, productsData, customersData]) => {
        setOrders(ordersData);
        setProducts(productsData.bestSelling);
        setCustomers(customersData);
      })
      .catch((err) => setError(errorMessage(err, "Failed to load report overview.")));
  }, []);

  if (error) return <div className="banner-error">{error}</div>;
  if (orders === null || products === null || customers === null) {
    return <p className="sales-empty">Loading...</p>;
  }

  const totalApprovedSpend = customers.reduce((sum, c) => sum + c.totalApprovedSpend, 0);

  return (
    <ReportsOverviewContent
      orders={orders}
      products={products}
      customers={customers}
      totalApprovedSpend={totalApprovedSpend}
    />
  );
}

function ReportsOverviewContent({
  orders,
  products,
  customers,
  totalApprovedSpend,
}: {
  orders: QuotationsOverviewResponse;
  products: ProductPerformanceRow[];
  customers: CustomerTierRow[];
  totalApprovedSpend: number;
}) {
  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(products, getSortValue, "unitsSold", "desc");

  const pieData = [
    { name: "Pending - Manager", value: orders.summary.pendingManager },
    { name: "Pending - Finance", value: orders.summary.pendingFinance },
    { name: "Pending - Admin", value: orders.summary.pendingAdmin },
    { name: "Approved", value: orders.summary.approved },
    { name: "Rejected", value: orders.summary.rejected },
    { name: "Cancelled", value: orders.summary.cancelled },
    { name: "Draft / Revision", value: orders.summary.draftOrRevision },
  ].filter((d) => d.value > 0);

  return (
    <>
      <div className="sales-summary-grid">
        <div className="sales-stat">
          <div className="value">{orders.underReview.length}</div>
          <div className="label">Orders Under Review</div>
        </div>
        <div className="sales-stat">
          <div className="value">{orders.toBeShipped.length}</div>
          <div className="label">Orders To Be Shipped</div>
        </div>
        <div className="sales-stat">
          <div className="value">{customers.length}</div>
          <div className="label">Total Customers</div>
        </div>
        <div className="sales-stat">
          <div className="value">{formatCurrency(totalApprovedSpend)}</div>
          <div className="label">Approved Revenue</div>
        </div>
      </div>

      <div className="sales-card">
        <h2>Quotation Status Distribution</h2>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={BUCKET_COLORS[entry.name] ?? "#999"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="sales-card">
        <h2>Top Best-Selling Products</h2>
        {products.length === 0 ? (
          <p className="sales-empty">No approved sales yet.</p>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <SortableHeader label="Product" sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Units Sold" sortKey="unitsSold" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Revenue" sortKey="revenue" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.productId}>
                  <td>{p.name}</td>
                  <td>{p.unitsSold}</td>
                  <td>{formatCurrency(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
