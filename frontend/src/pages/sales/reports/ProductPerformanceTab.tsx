import { useEffect, useState } from "react";
import axios from "axios";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { getProductPerformance } from "../../../api/reports";
import { useSortableTable } from "../../../hooks/useSortableTable";
import { SortableHeader } from "../../../components/SortableHeader";
import type { ProductPerformanceResponse, ProductPerformanceRow } from "../../../types/sales";
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
    case "sku":
      return row.sku;
    case "category":
      return row.category;
    case "unitsSold":
      return row.unitsSold;
    case "revenue":
      return row.revenue;
    case "discount":
      return row.averageDiscountPercentage;
    default:
      return null;
  }
}

function ProductTable({ title, rows }: { title: string; rows: ProductPerformanceRow[] }) {
  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(rows, getSortValue, "unitsSold", "desc");
  return (
    <div className="sales-card">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="sales-empty">No data yet.</p>
      ) : (
        <table className="sales-table">
          <thead>
            <tr>
              <SortableHeader label="Product" sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              <SortableHeader label="SKU" sortKey="sku" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              <SortableHeader label="Category" sortKey="category" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              <SortableHeader label="Units Sold" sortKey="unitsSold" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              <SortableHeader label="Revenue" sortKey="revenue" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              <SortableHeader label="Avg Discount %" sortKey="discount" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.productId}>
                <td>{row.name}</td>
                <td>{row.sku}</td>
                <td>{row.category}</td>
                <td>{row.unitsSold}</td>
                <td>{formatCurrency(row.revenue)}</td>
                <td>{row.averageDiscountPercentage.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function ProductPerformanceTab() {
  const [data, setData] = useState<ProductPerformanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProductPerformance()
      .then(setData)
      .catch((err) => setError(errorMessage(err, "Failed to load product performance.")));
  }, []);

  if (error) return <div className="banner-error">{error}</div>;
  if (data === null) return <p className="sales-empty">Loading...</p>;

  const chartData = [...data.bestSelling]
    .slice(0, 5)
    .reverse()
    .concat([...data.leastSelling].slice(0, 5))
    .map((row) => ({ name: row.name, "Units Sold": row.unitsSold }));

  return (
    <>
      <div className="sales-card">
        <h2>Units Sold - Top &amp; Bottom Performers</h2>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
              <Tooltip />
              <Bar dataKey="Units Sold" fill="#2f6fed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ProductTable title="Best-Selling Products" rows={data.bestSelling} />
      <ProductTable title="Least-Selling Products" rows={data.leastSelling} />
      <ProductTable title="Most-Discounted Products" rows={data.mostDiscounted} />
    </>
  );
}
