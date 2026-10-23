import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import bcrypt from "bcryptjs";
import { openPostgres } from "./postgres.js";
export async function openDatabase(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  if (process.env.DATABASE_URL && path !== ":memory:")
    return openPostgres(process.env.DATABASE_URL);
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','agent','admin')));
 CREATE TABLE IF NOT EXISTS tickets(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,description TEXT NOT NULL,category TEXT NOT NULL,priority TEXT NOT NULL CHECK(priority IN ('low','medium','high','urgent')),status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in-progress','resolved','closed')),owner INTEGER NOT NULL REFERENCES users(id),assignee INTEGER REFERENCES users(id),created TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
 CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY,ticket INTEGER NOT NULL REFERENCES tickets(id),author INTEGER NOT NULL REFERENCES users(id),body TEXT NOT NULL,created TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor INTEGER REFERENCES users(id),action TEXT NOT NULL,created TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));`);
  return db;
}
export async function seed(db) {
  if (Number((await db.prepare("SELECT count(*) AS n FROM users").get()).n))
    return;
  const hash = bcrypt.hashSync("DeskDemo!2026", 12),
    add = db.prepare(
      "INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)",
    );
  await add.run("Rachit Tripathi", "admin@itdesk.demo", hash, "admin");
  await add.run("Alex Morgan", "agent@itdesk.demo", hash, "agent");
  await add.run("Jamie Chen", "user@itdesk.demo", hash, "user");
  const ins = db.prepare(
    "INSERT INTO tickets(title,description,category,priority,status,owner,assignee) VALUES(?,?,?,?,?,3,?)",
  );
  for (const t of [
    [
      "VPN drops during client calls",
      "The connection drops every few minutes on the office network. This is affecting our client calls.",
      "Network",
      "urgent",
      "open",
      2,
    ],
    [
      "New starter · development setup",
      "Please provision engineering tools and repository access for the new team member.",
      "Access",
      "high",
      "in-progress",
      2,
    ],
    [
      "External monitor not detected",
      "The laptop does not recognise the monitor through the USB-C dock. Another cable did not help.",
      "Hardware",
      "medium",
      "open",
      null,
    ],
    [
      "Access to staging environment",
      "Requesting read-only staging access to verify the release checklist.",
      "Access",
      "medium",
      "open",
      null,
    ],
    [
      "Email sync issue on mobile",
      "Messages arrive on desktop but mobile has not synced since yesterday.",
      "Software",
      "low",
      "in-progress",
      2,
    ],
    [
      "Design software license renewed",
      "The renewed license is activated and the application is working again.",
      "Software",
      "low",
      "resolved",
      2,
    ],
  ])
    await ins.run(...t);
  await db
    .prepare("INSERT INTO comments(ticket,author,body) VALUES(1,2,?)")
    .run(
      "I am reviewing the gateway logs. Please keep the VPN client running so we can capture the next disconnect.",
    );
  await db
    .prepare("INSERT INTO audit(actor,action) VALUES(1,?)")
    .run("Demo workspace initialized");
}
