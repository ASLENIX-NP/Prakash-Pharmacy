import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { checkDatabaseConnection } from "./db.js";
import authRoutes from "./routes/auth.routes.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
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

// Authentication Routes
app.use("/api/auth", authRoutes);

export default app;
