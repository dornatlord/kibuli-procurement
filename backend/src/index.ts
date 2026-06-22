import express, { Request, Response, NextFunction } from "express";
import session from "express-session";
import cors from "cors";
import authRouter from "./routes/auth.js";
import requestsRouter from "./routes/requests.js";
import budgetRouter from "./routes/budget.js";
import usersRouter from "./routes/users.js";
import lookupRouter from "./routes/lookup.js";
import savedItemsRouter from "./routes/savedItems.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.set("trust proxy", 1);

const allowedOrigins = [
  "http://localhost:5173",
  "https://kibuli-procurement.onrender.com",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json());

// Use memory store to avoid DB dependency at startup
// Sessions reset on redeploy — acceptable for free tier
app.use(
  session({
    store: new session.MemoryStore(),
    secret: process.env.SESSION_SECRET || "kibuli-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/budget", budgetRouter);
app.use("/api/users", usersRouter);
app.use("/api/lookup", lookupRouter);
app.use("/api/saved-items", savedItemsRouter);

// Global error handler — keeps CORS headers on 500s
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
