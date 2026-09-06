import { useEffect, useState } from "react";
import axios from "axios";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { getTeamDirectory } from "../../../api/reports";
import { useSortableTable } from "../../../hooks/useSortableTable";
import { SortableHeader } from "../../../components/SortableHeader";
import type { TeamMemberPerformance } from "../../../types/sales";
import "../sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

const ROLE_FILTERS = ["ALL", "SALES_REP", "MANAGER", "FINANCE"] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];

function getSortValue(member: TeamMemberPerformance, key: string): string | number | null {
  switch (key) {
    case "name":
      return member.name;
    case "role":
      return member.role;
    case "owned":
      return member.ownedQuotesTotal;
    case "approved":
      return member.ownedQuotesApproved;
    case "rejected":
      return member.ownedQuotesRejected;
    case "pending":
      return member.ownedQuotesPending;
    case "approvalsGiven":
      return member.approvalsGiven;
    case "returnsGiven":
      return member.returnsGiven;
    case "rejectionsGiven":
      return member.rejectionsGiven;
    default:
      return null;
  }
}

export function TeamPerformanceTab() {
  const [team, setTeam] = useState<TeamMemberPerformance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");

  useEffect(() => {
    getTeamDirectory()
      .then(setTeam)
      .catch((err) => setError(errorMessage(err, "Failed to load team performance.")));
  }, []);

  if (error) return <div className="banner-error">{error}</div>;
  if (team === null) return <p className="sales-empty">Loading...</p>;

  const filtered = roleFilter === "ALL" ? team : team.filter((m) => m.role === roleFilter);
  return <TeamPerformanceTable filtered={filtered} roleFilter={roleFilter} setRoleFilter={setRoleFilter} />;
}

function TeamPerformanceTable({
  filtered,
  roleFilter,
  setRoleFilter,
}: {
  filtered: TeamMemberPerformance[];
  roleFilter: RoleFilter;
  setRoleFilter: (r: RoleFilter) => void;
}) {
  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(filtered, getSortValue, "name");
  const chartData = filtered.map((m) => ({
    name: m.name,
    "Deals Approved": m.ownedQuotesApproved,
    "Approvals Given": m.approvalsGiven,
  }));

  return (
    <>
      <div className="sales-card">
        <h2>Team Performance</h2>
        <div className="product-search-row">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}>
            {ROLE_FILTERS.map((r) => (
              <option key={r} value={r}>
                {r === "ALL" ? "All Roles" : r.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div style={{ width: "100%", height: 280, marginBottom: "1.25rem" }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="Deals Approved" fill="#2f6fed" />
              <Bar dataKey="Approvals Given" fill="#1b8a4a" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <table className="sales-table">
          <thead>
            <tr>
              <SortableHeader label="Name" sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              <SortableHeader label="Role" sortKey="role" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              <SortableHeader label="Owned Deals" sortKey="owned" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              <SortableHeader label="Approved" sortKey="approved" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              <SortableHeader label="Rejected" sortKey="rejected" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              <SortableHeader label="Pending" sortKey="pending" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              <SortableHeader label="Approvals Given" sortKey="approvalsGiven" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              <SortableHeader label="Returns Given" sortKey="returnsGiven" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
              <SortableHeader label="Rejections Given" sortKey="rejectionsGiven" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.name}
                  <div className="warehouse-line">{m.email}</div>
                </td>
                <td>
                  <span className="tier-badge">{m.role.replace("_", " ")}</span>
                </td>
                <td>{m.ownedQuotesTotal}</td>
                <td>{m.ownedQuotesApproved}</td>
                <td>{m.ownedQuotesRejected}</td>
                <td>{m.ownedQuotesPending}</td>
                <td>{m.approvalsGiven}</td>
                <td>{m.returnsGiven}</td>
                <td>{m.rejectionsGiven}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
