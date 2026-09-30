import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import morgan from "morgan";
import pg from "pg";
import { z } from "zod";

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 5101);
const jwtSecret = process.env.JWT_SECRET || "development-only-secret";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);

type TokenPayload = { id: string; role: "customer" | "owner"; name: string; email: string };
type AuthRequest = Request & { user?: TokenPayload };

app.use(helmet());
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)), credentials: false }));
app.use(express.json({ limit: "200kb" }));
app.use(morgan("combined"));

function asyncRoute(handler: (req: AuthRequest, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => Promise.resolve(handler(req, res, next)).catch(next);
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Authentication required" });
  try { req.user = jwt.verify(token, jwtSecret) as TokenPayload; next(); }
  catch { return res.status(401).json({ message: "Invalid or expired token" }); }
}

function requireOwner(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "owner") return res.status(403).json({ message: "Owner access required" });
  next();
}

app.get("/health", asyncRoute(async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "ok", service: "bookease-api" });
}));

app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const input = z.object({ email: z.email(), password: z.string().min(6) }).parse(req.body);
  const result = await pool.query("SELECT id, name, email, role, password_hash FROM users WHERE LOWER(email) = LOWER($1)", [input.email]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(input.password, user.password_hash))) return res.status(401).json({ message: "Incorrect email or password" });
  const payload: TokenPayload = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ token: jwt.sign(payload, jwtSecret, { expiresIn: "8h" }), user: payload });
}));

app.get("/api/services", asyncRoute(async (_req, res) => {
  const result = await pool.query("SELECT id, name, description, duration_minutes, price::float, color FROM services WHERE is_active = TRUE ORDER BY price");
  res.json(result.rows);
}));

app.get("/api/bookings", requireAuth, asyncRoute(async (req, res) => {
  const owner = req.user?.role === "owner";
  const result = await pool.query(
    `SELECT b.id, b.starts_at, b.ends_at, b.status, b.notes,
            s.name AS service_name, s.duration_minutes, s.price::float, s.color,
            u.name AS customer_name, u.email AS customer_email
       FROM bookings b JOIN services s ON s.id = b.service_id JOIN users u ON u.id = b.customer_id
      WHERE ($1::boolean OR b.customer_id = $2) ORDER BY b.starts_at`,
    [owner, req.user?.id],
  );
  res.json(result.rows);
}));

app.post("/api/bookings", requireAuth, asyncRoute(async (req, res) => {
  const input = z.object({ serviceId: z.uuid(), startsAt: z.iso.datetime(), notes: z.string().max(500).optional() }).parse(req.body);
  const serviceResult = await pool.query("SELECT id, duration_minutes FROM services WHERE id = $1 AND is_active = TRUE", [input.serviceId]);
  const service = serviceResult.rows[0];
  if (!service) return res.status(404).json({ message: "Service not found" });
  const start = new Date(input.startsAt);
  const end = new Date(start.getTime() + service.duration_minutes * 60_000);
  const conflict = await pool.query("SELECT 1 FROM bookings WHERE status <> 'cancelled' AND starts_at < $2 AND ends_at > $1 LIMIT 1", [start, end]);
  if (conflict.rowCount) return res.status(409).json({ message: "That time is no longer available" });
  const result = await pool.query(
    "INSERT INTO bookings (customer_id, service_id, starts_at, ends_at, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [req.user?.id, input.serviceId, start, end, input.notes || null],
  );
  res.status(201).json(result.rows[0]);
}));

app.patch("/api/bookings/:id/status", requireAuth, asyncRoute(async (req, res) => {
  const input = z.object({ status: z.enum(["confirmed", "completed", "cancelled"]) }).parse(req.body);
  const result = await pool.query(
    `UPDATE bookings SET status = $1 WHERE id = $2 AND ($3::boolean OR customer_id = $4) RETURNING id, status`,
    [input.status, req.params.id, req.user?.role === "owner", req.user?.id],
  );
  if (!result.rowCount) return res.status(404).json({ message: "Booking not found" });
  res.json(result.rows[0]);
}));

app.get("/api/dashboard", requireAuth, requireOwner, asyncRoute(async (_req, res) => {
  const result = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE starts_at::date = CURRENT_DATE AND status <> 'cancelled')::int AS today_bookings,
      COUNT(*) FILTER (WHERE starts_at >= date_trunc('week', NOW()) AND status <> 'cancelled')::int AS week_bookings,
      COALESCE(SUM(s.price) FILTER (WHERE b.status = 'completed' AND b.starts_at >= date_trunc('month', NOW())),0)::float AS month_revenue,
      COUNT(DISTINCT customer_id)::int AS total_customers
    FROM bookings b JOIN services s ON s.id = b.service_id
  `);
  res.json(result.rows[0]);
}));

app.use((_req, res) => res.status(404).json({ message: "Route not found" }));
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid request", issues: error.issues });
  console.error(error);
  res.status(500).json({ message: "Unexpected server error" });
});

app.listen(port, "127.0.0.1", () => console.log(`BookEase API listening on ${port}`));
