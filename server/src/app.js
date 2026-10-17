import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import hydrationRoutes from "./routes/hydration.js";
import screentimeRoutes from "./routes/screentime.js";
import postureRoutes from "./routes/posture.js";
import analyticsRoutes from "./routes/analytics.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json({ limit: "10kb" }));
app.use(morgan("dev"));

// express-rate-limit v8 uses "limit" (older versions called it "max")
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/hydration", hydrationRoutes);
app.use("/api/screentime", screentimeRoutes);
app.use("/api/posture", postureRoutes);
app.use("/api/analytics", analyticsRoutes);

app.use(notFound);
app.use(errorHandler); // always last

export default app;