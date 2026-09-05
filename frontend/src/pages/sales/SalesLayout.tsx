import { Outlet } from "react-router-dom";
import { SalesNav } from "./SalesNav";

export function SalesLayout() {
  return (
    <div>
      <SalesNav />
      <Outlet />
    </div>
  );
}
