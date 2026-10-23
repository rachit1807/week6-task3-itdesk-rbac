import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "node:url";
import { publicUser } from "../models/User.js";
import { adminRoutes } from "../routes/adminRoutes.js";
export function createApp(db, secret, { secure = false } = {}) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json({ limit: "32kb" }));
  const limit = rateLimit({
    windowMs: 900000,
    limit: 50,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin
    ) {
      try {
        if (new URL(req.headers.origin).host !== req.get("host"))
          return res
            .status(403)
            .json({ error: "Cross-site request rejected." });
      } catch {
        return res.status(403).json({ error: "Invalid origin." });
      }
    }
    next();
  });
  const session = (u, res) => {
    const token = jwt.sign({ role: u.role }, secret, {
      subject: String(u.id),
      expiresIn: "2h",
      algorithm: "HS256",
    });
    res.cookie("itdesk", token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 7200000,
      path: "/",
    });
    res.json({ user: publicUser(u), token });
  };
  app.get("/api/health", async (_, res) => {
    await db.prepare("SELECT 1").get();
    res.json({ status: "ok" });
  });
  app.post("/api/auth/login", limit, async (req, res, next) => {
    try {
      const { email, password } = req.body;
      if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        password.length > 128
      )
        return res
          .status(400)
          .json({ error: "Enter your email and password." });
      const u = await db
        .prepare("SELECT * FROM users WHERE email=?")
        .get(email.toLowerCase().trim());
      if (!u || !(await bcrypt.compare(password, u.password)))
        return res
          .status(401)
          .json({ error: "Email or password is incorrect." });
      session(u, res);
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/auth/register", limit, async (req, res, next) => {
    try {
      const { name, email, password } = req.body;
      if (
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.length > 80 ||
        typeof email !== "string" ||
        !/^\S+@\S+\.\S+$/.test(email) ||
        email.length > 180 ||
        typeof password !== "string" ||
        password.length < 10 ||
        password.length > 128
      )
        return res
          .status(400)
          .json({
            error:
              "Use a name, valid email, and password of 10–128 characters.",
          });
      if (
        await db
          .prepare("SELECT id FROM users WHERE email=?")
          .get(email.toLowerCase().trim())
      )
        return res.status(409).json({ error: "Email already registered." });
      const hash = await bcrypt.hash(password, 12);
      const r = await db
        .prepare(
          "INSERT INTO users(name,email,password,role) VALUES(?,?,?,'user')",
        )
        .run(name.trim(), email.toLowerCase().trim(), hash);
      session(
        await db
          .prepare("SELECT * FROM users WHERE id=?")
          .get(r.lastInsertRowid),
        res,
      );
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/auth/logout", async (_, res) => {
    res.clearCookie("itdesk", {
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "lax",
    });
    res.json({ message: "Signed out." });
  });
  app.use("/api", async (req, res, next) => {
    try {
      const cookie = req.headers.cookie
        ?.split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("itdesk="))
        ?.slice(7);
      const token = req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : cookie;
      const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
      const u = await db
        .prepare("SELECT * FROM users WHERE id=?")
        .get(payload.sub);
      if (!u) throw Error();
      req.user = {
        ...publicUser(u),
        role: payload.role === u.role ? payload.role : u.role,
      };
      next();
    } catch {
      res.status(401).json({ error: "Please sign in to continue." });
    }
  });
  app.get("/api/auth/me", async (req, res) => res.json(req.user));
  app.use("/api/admin", adminRoutes(db));
  const q =
    "SELECT t.*,u.name AS owner_name,a.name AS assignee_name FROM tickets t JOIN users u ON u.id=t.owner LEFT JOIN users a ON a.id=t.assignee";
  const access = async (req, res) => {
    const t = await db
      .prepare("SELECT * FROM tickets WHERE id=?")
      .get(Number(req.params.id));
    if (!t) {
      res.status(404).json({ error: "Ticket not found." });
      return;
    }
    if (
      (req.user.role === "user" && t.owner !== req.user.id) ||
      (req.user.role === "agent" && t.assignee !== req.user.id)
    ) {
      res.status(403).json({ error: "You do not have access to this ticket." });
      return;
    }
    return t;
  };
  app.get("/api/tickets", async (req, res) =>
    res.json(
      await db
        .prepare(
          q +
            (req.user.role === "user"
              ? " WHERE t.owner=?"
              : req.user.role === "agent"
                ? " WHERE t.assignee=?"
                : "") +
            " ORDER BY t.id DESC",
        )
        .all(...(req.user.role === "admin" ? [] : [req.user.id])),
    ),
  );
  app.post("/api/tickets", async (req, res) => {
    const { title, description, category, priority } = req.body;
    if (
      typeof title !== "string" ||
      title.trim().length < 5 ||
      title.length > 120 ||
      typeof description !== "string" ||
      description.trim().length < 10 ||
      description.length > 5000 ||
      !["Hardware", "Software", "Network", "Access", "Other"].includes(
        category,
      ) ||
      !["low", "medium", "high", "urgent"].includes(priority)
    )
      return res
        .status(400)
        .json({
          error:
            "Check the title (5–120 characters) and description (10–5000 characters).",
        });
    const r = await db
      .prepare(
        "INSERT INTO tickets(title,description,category,priority,owner) VALUES(?,?,?,?,?)",
      )
      .run(title.trim(), description.trim(), category, priority, req.user.id);
    await db
      .prepare("INSERT INTO audit(actor,action) VALUES(?,?)")
      .run(req.user.id, `Created ticket #${r.lastInsertRowid}`);
    res
      .status(201)
      .json(await db.prepare(q + " WHERE t.id=?").get(r.lastInsertRowid));
  });
  app.get("/api/tickets/:id", async (req, res) => {
    if (!(await access(req, res))) return;
    res.json({
      ...(await db.prepare(q + " WHERE t.id=?").get(Number(req.params.id))),
      comments: await db
        .prepare(
          "SELECT c.*,u.name FROM comments c JOIN users u ON u.id=c.author WHERE ticket=? ORDER BY c.id",
        )
        .all(Number(req.params.id)),
    });
  });
  app.post("/api/tickets/:id/comments", async (req, res) => {
    if (!(await access(req, res))) return;
    const { body } = req.body;
    if (typeof body !== "string" || !body.trim() || body.length > 2000)
      return res
        .status(400)
        .json({ error: "Comment must be 1–2000 characters." });
    await db
      .prepare("INSERT INTO comments(ticket,author,body) VALUES(?,?,?)")
      .run(Number(req.params.id), req.user.id, body.trim());
    res.status(201).json({ message: "Comment added." });
  });
  app.patch("/api/tickets/:id", async (req, res) => {
    const t = await access(req, res);
    if (!t) return;
    if (req.user.role === "user")
      return res
        .status(403)
        .json({ error: "Only support agents and admins can update tickets." });
    let { status = t.status, priority = t.priority } = req.body;
    const assignee = Object.hasOwn(req.body, "assignee")
      ? req.body.assignee
      : t.assignee;
    if (
      !["open", "in-progress", "resolved", "closed"].includes(status) ||
      !["low", "medium", "high", "urgent"].includes(priority)
    )
      return res.status(400).json({ error: "Invalid status or priority." });
    if (assignee !== t.assignee && req.user.role !== "admin")
      return res.status(403).json({ error: "Only admins can assign tickets." });
    if (
      assignee !== null &&
      !(await db
        .prepare(
          "SELECT id FROM users WHERE id=? AND role IN ('agent','admin')",
        )
        .get(assignee))
    )
      return res.status(400).json({ error: "Select a valid agent." });
    await db
      .prepare("UPDATE tickets SET status=?,priority=?,assignee=? WHERE id=?")
      .run(status, priority, assignee, t.id);
    await db
      .prepare("INSERT INTO audit(actor,action) VALUES(?,?)")
      .run(req.user.id, `Updated ticket #${t.id}: ${status}`);
    res.json({ message: "Ticket updated." });
  });
  app.use("/api", async (_, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));
  app.use((err, req, res, next) => {
    console.error(err.message);
    res
      .status(err.type === "entity.parse.failed" ? 400 : 500)
      .json({
        error:
          err.type === "entity.parse.failed"
            ? "Invalid JSON."
            : "Something went wrong. Please try again.",
      });
  });
  return app;
}
