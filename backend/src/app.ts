import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { checkDatabaseConnection } from "./db.js";
import authRoutes from "./routes/auth.routes.js";
import rackRoutes from "./routes/rack.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import genericRoutes from "./routes/generic.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import billRoutes from "./routes/bill.routes.js";
import distributorRoutes from "./routes/distributor.routes.js";
import purchaseRoutes from "./routes/purchase.routes.js";
import settingRoutes from "./routes/setting.routes.js";
import reportRoutes from "./routes/report.routes.js";
import doctorRoutes from "./routes/doctor.routes.js";
import clinicPatientRoutes from "./routes/clinic-patient.routes.js";
import clinicVisitRoutes from "./routes/clinic-visit.routes.js";
import { requireAuth, requireAdmin } from "./middleware/auth.middleware.js";

const app = express();

app.use(helmet());

const configuredOrigins = [
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGINS,
]
  .filter(Boolean)
  .flatMap((value) => String(value).split(","))
  .map((value) => value.trim())
  .filter(Boolean);

const developmentOrigins =
  process.env.NODE_ENV === "production"
    ? []
    : [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
      ];

const allowedOrigins = new Set([
  ...configuredOrigins,
  ...developmentOrigins,
]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Requests without Origin (server-to-server, curl, Postman) do not need
      // browser CORS permission. Browser origins must be explicitly allowed.
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Public health endpoint: intentionally minimal so it cannot disclose
// database/user/version metadata to unauthenticated callers.
app.get(["/", "/api/health"], async (_req, res) => {
  const dbHealth = await checkDatabaseConnection();

  res.status(dbHealth.connected ? 200 : 503).json({
    success: dbHealth.connected,
    status: dbHealth.connected ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
  });
});

// Detailed diagnostics are useful for deployment/QA, but are administrative
// information and therefore require a current Admin identity.
app.get(
  "/api/health/details",
  requireAuth,
  requireAdmin,
  async (_req, res) => {
    const dbHealth = await checkDatabaseConnection();

    res.status(dbHealth.connected ? 200 : 503).json({
      success: dbHealth.connected,
      timestamp: new Date().toISOString(),
      services: {
        backend: {
          status: "RUNNING",
          uptimeSeconds: Math.floor(process.uptime()),
          nodeVersion: process.version,
        },
        postgres: {
          status: dbHealth.connected ? "CONNECTED" : "DISCONNECTED",
          database: dbHealth.database ?? "unknown",
          user: dbHealth.user ?? "unknown",
          version: dbHealth.version ?? "unknown",
          error: dbHealth.error ?? null,
        },
      },
    });
  }
);
// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/racks", rackRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/generics", genericRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/medicines", inventoryRoutes); // Alias for convenience
app.use("/api/bills", billRoutes);
app.use("/api/sales", billRoutes); // Alias for convenience
app.use("/api/distributors", distributorRoutes);
app.use("/api/stockists", distributorRoutes); // Alias for convenience
app.use("/api/purchases", purchaseRoutes);
app.use("/api/purchase-invoices", purchaseRoutes); // Alias for convenience
app.use("/api/settings", settingRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/clinic-patients", clinicPatientRoutes);
app.use("/api/clinic-visits", clinicVisitRoutes);

export default app;
