import { Pool } from "pg";
import { poolerConnectionCandidates } from "./connection-string";

declare global {
  var __shidukhPg: Pool | undefined;
  var __shidukhPgResolving: Promise<Pool> | undefined;
}

async function probeConnection(connectionString: string): Promise<string> {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 2500,
  });
  try {
    const client = await pool.connect();
    await client.query("select 1");
    client.release();
    return connectionString;
  } finally {
    await pool.end();
  }
}

async function resolveConnectionString(): Promise<string> {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) throw new Error("DATABASE_URL is not set");

  const candidates = poolerConnectionCandidates(raw);
  let lastError = "unknown";
  for (const candidate of candidates) {
    try {
      return await probeConnection(candidate);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(
    `Could not connect to Postgres (${candidates.length} tried): ${lastError}`,
  );
}

export async function getPool(): Promise<Pool> {
  if (global.__shidukhPg) return global.__shidukhPg;
  if (!global.__shidukhPgResolving) {
    global.__shidukhPgResolving = (async () => {
      const connectionString = await resolveConnectionString();
      global.__shidukhPg = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 5,
        connectionTimeoutMillis: 8000,
        idleTimeoutMillis: 20_000,
      });
      return global.__shidukhPg;
    })();
  }
  try {
    return await global.__shidukhPgResolving;
  } catch (e) {
    global.__shidukhPgResolving = undefined;
    throw e;
  }
}
