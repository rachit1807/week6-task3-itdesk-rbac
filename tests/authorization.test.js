import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import { openDatabase, seed } from "../src/db.js";
import { createApp } from "../src/app.js";
const db = await openDatabase(":memory:");
await seed(db);
const secret = "test-secret-at-least-thirty-two-characters",
  app = createApp(db, secret);
let admin, agent, user;
before(async () => {
  for (const role of ["admin", "agent", "user"]) {
    const r = await request(app)
      .post("/api/auth/login")
      .send({ email: role + "@itdesk.demo", password: "DeskDemo!2026" })
      .expect(200);
    if (role === "admin") admin = r.body.token;
    if (role === "agent") agent = r.body.token;
    if (role === "user") user = r.body.token;
  }
});
after(() => db.close());
const auth = (t) => ({ Authorization: "Bearer " + t });
test("admin can list users; employee and agent receive 403", async () => {
  await request(app).get("/api/admin/users").set(auth(admin)).expect(200);
  await request(app).get("/api/admin/users").set(auth(user)).expect(403);
  await request(app).get("/api/admin/users").set(auth(agent)).expect(403);
});
test("missing, forged, and expired tokens receive 401", async () => {
  await request(app).get("/api/tickets").expect(401);
  await request(app)
    .get("/api/tickets")
    .set(auth(jwt.sign({ role: "admin" }, "wrong-secret", { subject: "1" })))
    .expect(401);
  await request(app)
    .get("/api/tickets")
    .set(
      auth(
        jwt.sign({ role: "admin" }, secret, { subject: "1", expiresIn: -1 }),
      ),
    )
    .expect(401);
});
test("public signup ignores a supplied administrator role", async () => {
  const r = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Other Employee",
      email: "other@example.test",
      password: "Testing!2026",
      role: "admin",
    })
    .expect(200);
  assert.equal(r.body.user.role, "user");
  await request(app).get("/api/tickets/1").set(auth(r.body.token)).expect(403);
  await request(app)
    .post("/api/tickets/1/comments")
    .set(auth(r.body.token))
    .send({ body: "Unauthorized" })
    .expect(403);
});
test("agent only sees assigned tickets and cannot assign", async () => {
  const r = await request(app).get("/api/tickets").set(auth(agent)).expect(200);
  assert.ok(r.body.every((t) => t.assignee === 2));
  await request(app).get("/api/tickets/3").set(auth(agent)).expect(403);
  await request(app)
    .patch("/api/tickets/1")
    .set(auth(agent))
    .send({ assignee: 1 })
    .expect(403);
});
test("employee cannot update ticket status", async () => {
  await request(app)
    .patch("/api/tickets/1")
    .set(auth(user))
    .send({ status: "resolved" })
    .expect(403);
});
test("admin assigns a ticket; agent resolves it; employee comments", async () => {
  await request(app)
    .patch("/api/tickets/3")
    .set(auth(admin))
    .send({ assignee: 2 })
    .expect(200);
  await request(app)
    .patch("/api/tickets/3")
    .set(auth(agent))
    .send({ status: "resolved" })
    .expect(200);
  await request(app)
    .post("/api/tickets/3/comments")
    .set(auth(user))
    .send({ body: "Thank you, this works now." })
    .expect(201);
  const r = await request(app)
    .get("/api/tickets/3")
    .set(auth(user))
    .expect(200);
  assert.equal(r.body.status, "resolved");
  assert.equal(r.body.comments[0].body, "Thank you, this works now.");
});
test("invalid inputs fail; a valid ticket persists", async () => {
  await request(app)
    .post("/api/tickets")
    .set(auth(user))
    .send({ title: "x" })
    .expect(400);
  const r = await request(app)
    .post("/api/tickets")
    .set(auth(user))
    .send({
      title: "Keyboard is not working",
      description: "The external keyboard stopped responding this morning.",
      category: "Hardware",
      priority: "medium",
    })
    .expect(201);
  const saved = await request(app)
    .get("/api/tickets/" + r.body.id)
    .set(auth(user))
    .expect(200);
  assert.equal(saved.body.owner, 3);
});
test("stored role changes apply to an existing token", async () => {
  db.prepare("UPDATE users SET role='user' WHERE id=2").run();
  await request(app)
    .patch("/api/tickets/1")
    .set(auth(agent))
    .send({ status: "closed" })
    .expect(403);
  db.prepare("UPDATE users SET role='agent' WHERE id=2").run();
});
test("cross-site mutations rejected; SQL-like search input is data", async () => {
  await request(app)
    .post("/api/tickets")
    .set(auth(user))
    .set("Origin", "https://evil.example")
    .send({})
    .expect(403);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "' OR 1=1 --", password: "anything" })
    .expect(401);
});
