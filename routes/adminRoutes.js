import { Router } from "express";
import { authorize } from "../middleware/authorize.js";
export function adminRoutes(db) {
  const r = Router();
  r.use(authorize("admin"));
  r.get("/users", async (req, res) =>
    res.json(await db.prepare("SELECT id,name,email,role FROM users").all()),
  );
  r.get("/audit", async (req, res) =>
    res.json(
      await db
        .prepare(
          "SELECT a.*,u.name FROM audit a LEFT JOIN users u ON u.id=a.actor ORDER BY a.id DESC LIMIT 100",
        )
        .all(),
    ),
  );
  r.patch("/users/:id/role", async (req, res) => {
    const id = Number(req.params.id),
      role = req.body.role;
    if (!["user", "agent", "admin"].includes(role))
      return res.status(400).json({ error: "Invalid role." });
    if (id === req.user.id)
      return res
        .status(400)
        .json({ error: "You cannot change your own role." });
    if (process.env.DEMO_MODE === "true" && id <= 3)
      return res
        .status(403)
        .json({
          error:
            "Demo roles are protected. Register a new account to test role changes.",
        });
    if (!(await db.prepare("SELECT id FROM users WHERE id=?").get(id)))
      return res.status(404).json({ error: "User not found." });
    await db.prepare("UPDATE users SET role=? WHERE id=?").run(role, id);
    await db
      .prepare("INSERT INTO audit(actor,action) VALUES(?,?)")
      .run(req.user.id, `Changed user ${id} to ${role}`);
    res.json({ message: "Role updated." });
  });
  return r;
}
