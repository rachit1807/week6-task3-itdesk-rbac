import pg from "pg";
// A dedicated database is required. All application tables live in the itdesk schema.
export async function openPostgres(connectionString) {
  const pool = new pg.Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    options: "-c search_path=itdesk,public",
  });
  await pool.query(`CREATE SCHEMA IF NOT EXISTS itdesk;
 CREATE TABLE IF NOT EXISTS itdesk.users(id SERIAL PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','agent','admin')));
 CREATE TABLE IF NOT EXISTS itdesk.tickets(id SERIAL PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,category TEXT NOT NULL,priority TEXT NOT NULL CHECK(priority IN ('low','medium','high','urgent')),status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in-progress','resolved','closed')),owner INTEGER NOT NULL REFERENCES itdesk.users(id),assignee INTEGER REFERENCES itdesk.users(id),created TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 CREATE TABLE IF NOT EXISTS itdesk.comments(id SERIAL PRIMARY KEY,ticket INTEGER NOT NULL REFERENCES itdesk.tickets(id),author INTEGER NOT NULL REFERENCES itdesk.users(id),body TEXT NOT NULL,created TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 CREATE TABLE IF NOT EXISTS itdesk.audit(id SERIAL PRIMARY KEY,actor INTEGER REFERENCES itdesk.users(id),action TEXT NOT NULL,created TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));`);
  return {
    prepare(sql) {
      let n = 0;
      const query = sql.replace(/\?/g, () => "$" + ++n);
      return {
        async get(...args) {
          return (await pool.query(query, args)).rows[0];
        },
        async all(...args) {
          return (await pool.query(query, args)).rows;
        },
        async run(...args) {
          const inserted = /^INSERT /i.test(query);
          const r = await pool.query(
            query + (inserted ? " RETURNING id" : ""),
            args,
          );
          return { lastInsertRowid: r.rows[0]?.id, changes: r.rowCount };
        },
      };
    },
    close: () => pool.end(),
  };
}
