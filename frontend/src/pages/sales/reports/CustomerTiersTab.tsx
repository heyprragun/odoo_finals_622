import { useEffect, useState } from "react";
import axios from "axios";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { getCustomerTierOverview } from "../../../api/reports";
import { useSortableTable } from "../../../hooks/useSortableTable";
import { useTableFilter } from "../../../hooks/useTableFilter";
import { SortableHeader } from "../../../components/SortableHeader";
import type { CustomerTierRow } from "../../../types/sales";
import { CustomerDetailModal } from "./CustomerDetailModal";
import "../sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

const TIER_COLORS: Record<string, string> = { GOLD: "#d4a017", SILVER: "#9aa0a6", BRONZE: "#b0651d" };

function getSortValue(customer: CustomerTierRow, key: string): string | number | null {
  switch (key) {
    case "name":
      return customer.name;
    case "tier":
      return customer.tier;
    case "orders":
      return customer.totalOrders;
    case "spend":
      return customer.totalApprovedSpend;
    case "subscriptions":
      return customer.activeSubscriptions;
    default:
      return null;
  }
}

export function CustomerTiersTab() {
  const [customers, setCustomers] = useState<CustomerTierRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const { filtered, filterText, setFilterText } = useTableFilter(
    customers ?? [],
    (c) => `${c.name} ${c.tier}`
  );
  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(filtered, getSortValue, "name");

  useEffect(() => {
    getCustomerTierOverview()
      .then(setCustomers)
      .catch((err) => setError(errorMessage(err, "Failed to load customers.")));
  }, []);

  if (error) return <div className="banner-error">{error}</div>;
  if (customers === null) return <p className="sales-empty">Loading...</p>;

  const pieData = ["GOLD", "SILVER", "BRONZE"].map((tier) => ({
    name: tier,
    value: customers.filter((c) => c.tier === tier).length,
  })).filter((d) => d.value > 0);

  return (
    <>
      <div className="sales-card">
        <h2>Customers by Tier</h2>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={TIER_COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="table-toolbar">
          <input
            type="text"
            placeholder="Filter by customer or tier..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
        <table className="sales-table">
          <thead>
            <tr>
              <SortableHeader label="Customer" sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              <SortableHeader label="Tier" sortKey="tier" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              <SortableHeader label="Total Orders" sortKey="orders" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              <SortableHeader label="Approved Spend" sortKey="spend" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              <SortableHeader label="Active Subscriptions" sortKey="subscriptions" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((customer) => (
              <tr
                key={customer.id}
                className="clickable-row"
                onClick={() => setSelectedCustomerId(customer.id)}
              >
                <td>{customer.name}</td>
                <td>
                  <span className="tier-badge">{customer.tier}</span>
                </td>
                <td>{customer.totalOrders}</td>
                <td>{formatCurrency(customer.totalApprovedSpend)}</td>
                <td>{customer.activeSubscriptions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCustomerId && (
        <CustomerDetailModal customerId={selectedCustomerId} onClose={() => setSelectedCustomerId(null)} />
      )}
    </>
  );
}
