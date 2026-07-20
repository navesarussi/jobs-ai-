import { Pool } from "pg";
import {
  poolerConnectionForRegion,
  poolerRegionCandidates,
  toPoolerConnectionString,
} from "./connection-string";

declare global {
  // eslint-disable-next-line no-var
  var __shidukhPg: Pool | undefined;
}

async function connectPool(connectionString: string): Promise<Pool> {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 5000,
  });
  const client = await pool.connect();
  client.release();
  return pool;
}

async function resolveConnectionString(): Promise<string> {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) throw new Error("DATABASE_URL is not set");

  const pooled = toPoolerConnectionString(raw);
  if (pooled === raw) return raw;

  try {
    const probe = await connectPool(pooled);
    await probe.end();
    return pooled;
  } catch {
    for (const region of poolerRegionCandidates()) {
      const candidate = poolerConnectionForRegion(raw, region);
      try {
        const probe = await connectPool(candidate);
        await probe.end();
        return candidate;
      } catch {
        continue;
      }
    }
    return pooled;
  }
}

export async function getPool(): Promise<Pool> {
  if (!global.__shidukhPg) {
    const connectionString = await resolveConnectionString();
    global.__shidukhPg = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 3,
      connectionTimeoutMillis: 10000,
    });
  }
  return global.__shidukhPg;
}
