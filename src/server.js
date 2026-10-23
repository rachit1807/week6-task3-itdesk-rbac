import { randomBytes } from "node:crypto";
import { openDatabase, seed } from "./db.js";
import { createApp } from "./app.js";
const production = process.env.NODE_ENV === "production";
if (
  production &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
)
  throw Error("Set JWT_SECRET to at least 32 random characters.");
if (production && !process.env.DATABASE_URL)
  throw Error("Set a dedicated DATABASE_URL for persistent hosted storage.");
const db = await openDatabase(process.env.DATABASE_PATH || "./data/itdesk.db");
if (process.env.DEMO_MODE === "true" || !production) await seed(db);
const server = createApp(
  db,
  process.env.JWT_SECRET || randomBytes(48).toString("hex"),
  { secure: production },
).listen(process.env.PORT || 3000, "0.0.0.0", () =>
  console.log("ITDesk ready on port " + (process.env.PORT || 3000)),
);
for (const s of ["SIGINT", "SIGTERM"])
  process.on(s, () => {
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
