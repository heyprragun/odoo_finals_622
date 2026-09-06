import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { createWarehouse, listWarehouses } from "../../api/warehouses";
import { useSortableTable } from "../../hooks/useSortableTable";
import { useTableFilter } from "../../hooks/useTableFilter";
import { SortableHeader } from "../../components/SortableHeader";
import type { Warehouse } from "../../types/sales";
import { NoAccessBlock } from "./NoAccessBlock";
import "./sales.css";

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : fallback;
}

function getSortValue(warehouse: Warehouse, key: string): string | number | null {
  switch (key) {
    case "name":
      return warehouse.name;
    case "location":
      return warehouse.location;
    default:
      return null;
  }
}

export function Warehouses() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDenied = user?.role !== "ADMIN";

  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const { filtered, filterText, setFilterText } = useTableFilter(
    warehouses ?? [],
    (w) => `${w.name} ${w.location}`
  );
  const { sorted, sortKey, sortDirection, toggleSort } = useSortableTable(filtered, getSortValue, "name");

  function load() {
    listWarehouses()
      .then(setWarehouses)
      .catch((err) => setLoadError(errorMessage(err, "Failed to load warehouses.")));
  }

  useEffect(() => {
    if (isDenied) return;
    load();
  }, [isDenied]);

  if (isDenied) {
    return <NoAccessBlock title="Warehouses" />;
  }

  async function handleAddWarehouse() {
    setAddError(null);
    setIsAdding(true);
    try {
      const created = await createWarehouse({ name: newName.trim(), location: newLocation.trim() });
      setWarehouses((prev) => [...(prev ?? []), created]);
      setNewName("");
      setNewLocation("");
      setShowAddForm(false);
    } catch (err) {
      setAddError(errorMessage(err, "Failed to add this warehouse."));
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1>Warehouses</h1>
        <button className="sales-btn sales-btn-primary" onClick={() => setShowAddForm((v) => !v)}>
          Add Warehouse
        </button>
      </div>

      {loadError && <div className="banner-error">{loadError}</div>}

      {showAddForm && (
        <div className="sales-card">
          <h2>New Warehouse</h2>
          {addError && <div className="banner-error">{addError}</div>}
          <div className="product-search-row">
            <input
              type="text"
              placeholder="Warehouse Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Location (city/region)"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
            />
            <button
              className="sales-btn sales-btn-primary"
              onClick={handleAddWarehouse}
              disabled={isAdding || !newName.trim() || !newLocation.trim()}
            >
              {isAdding ? "Adding..." : "Save Warehouse"}
            </button>
          </div>
        </div>
      )}

      <div className="sales-card">
        <div className="table-toolbar">
          <input
            type="text"
            placeholder="Filter by name or location..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>

        {warehouses === null && !loadError && <p className="sales-empty">Loading...</p>}
        {warehouses !== null && warehouses.length === 0 && (
          <p className="sales-empty">No warehouses yet - add one above.</p>
        )}
        {sorted.length === 0 && warehouses !== null && warehouses.length > 0 && (
          <p className="sales-empty">No warehouses match this filter.</p>
        )}
        {sorted.length > 0 && (
          <table className="sales-table">
            <thead>
              <tr>
                <SortableHeader label="Warehouse" sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Location" sortKey="location" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((w) => (
                <tr key={w.id} className="clickable-row" onClick={() => navigate(`/sales/warehouses/${w.id}`)}>
                  <td>{w.name}</td>
                  <td>{w.location}</td>
                  <td>
                    <span className="sales-btn">View Stock</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
