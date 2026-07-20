import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __shidukhPg: Pool | undefined;
}

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!global.__shidukhPg) {
    global.__shidukhPg = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 3,
    });
  }
  return global.__shidukhPg;
}
