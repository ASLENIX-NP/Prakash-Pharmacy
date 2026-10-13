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

const app = express();

app.use(helmet());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin || allowedOrigins.includes(origin) || origin.startsWith("http://localhost:")) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive during development to avoid blocking team
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Health check endpoint verifying both backend & PostgreSQL
app.get(["/", "/api/health"], async (_req, res) => {
  const dbHealth = await checkDatabaseConnection();

  const response = {
    success: dbHealth.connected,
    message: dbHealth.connected
      ? "🚀 Backend is running successfully and PostgreSQL is connected!"
      : "⚠️ Backend is running, but PostgreSQL connection failed.",
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
  };

  res.status(dbHealth.connected ? 200 : 503).json(response);
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/racks", rackRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/generics", genericRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/medicines", inventoryRoutes); // Alias for convenience
app.use("/api/bills", billRoutes);
app.use("/api/sales", billRoutes); // Alias for convenience

export default app;
