import { Outlet } from "react-router-dom";
import { CustomerNav } from "./CustomerNav";

export function CustomerLayout() {
  return (
    <div>
      <CustomerNav />
      <Outlet />
    </div>
  );
}
