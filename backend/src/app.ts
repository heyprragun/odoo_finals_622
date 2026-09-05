import express from "express";
import cors from "cors";
import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";
import testRoutes from "./routes/test.routes";
import productRoutes from "./routes/product.routes";
import customerRoutes from "./routes/customer.routes";
import customerRequestRoutes from "./routes/customerRequest.routes";
import inventoryRoutes from "./routes/inventory.routes";
import quoteRoutes from "./routes/quote.routes";
import approvalRoutes from "./routes/approval.routes";
import subscriptionRoutes from "./routes/subscription.routes";
import invoiceRoutes from "./routes/invoice.routes";
import warehouseRoutes from "./routes/warehouse.routes";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ success: true, message: "OK" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/test", testRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/customers", customerRoutes);
  app.use("/api/customer-requests", customerRequestRoutes);
  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/quotes", quoteRoutes);
  app.use("/api/approvals", approvalRoutes);
  app.use("/api/subscriptions", subscriptionRoutes);
  app.use("/api/invoices", invoiceRoutes);
  app.use("/api/warehouses", warehouseRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
