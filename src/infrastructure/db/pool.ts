import dns from "node:dns/promises";
import { Pool } from "pg";
import { parseDatabaseUrl, poolerConnectionCandidates } from "./connection-string";

declare global {
  // eslint-disable-next-line no-var
  var __shidukhPg: Pool | undefined;
  // eslint-disable-next-line no-var
  var __shidukhPgUrl: string | undefined;
}

async function hostResolves(connectionString: string): Promise<boolean> {
  try {
    const { host } = parseDatabaseUrl(connectionString);
    await dns.lookup(host);
    return true;
  } catch {
    return false;
  }
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

  const ordered = [
    ...(global.__shidukhPgUrl ? [global.__shidukhPgUrl] : []),
    ...poolerConnectionCandidates(raw),
  ];
  const candidates = [...new Set(ordered)];

  const dnsHits = await Promise.all(candidates.map(async (c) => ((await hostResolves(c)) ? c : null)));
  const reachable = dnsHits.filter((c): c is string => Boolean(c));
  const toTry = reachable.length > 0 ? reachable : candidates;

  const batchSize = 6;
  let lastError = "unknown";
  for (let i = 0; i < toTry.length; i += batchSize) {
    const batch = toTry.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map((c) => probeConnection(c)));
    const hit = results.find((r) => r.status === "fulfilled");
    if (hit && hit.status === "fulfilled") {
      global.__shidukhPgUrl = hit.value;
      return hit.value;
    }
    const last = results.findLast((r) => r.status === "rejected");
    if (last && last.status === "rejected") {
      lastError = last.reason instanceof Error ? last.reason.message : String(last.reason);
    }
  }
  throw new Error(`Could not connect to Supabase via pooler (${toTry.length} tried): ${lastError}`);
}

export function getResolvedDatabaseHost(): string | null {
  const url = global.__shidukhPgUrl;
  if (!url) return null;
  try {
    return parseDatabaseUrl(url).host;
  } catch {
    return null;
  }
}

export async function getPool(): Promise<Pool> {
  if (!global.__shidukhPg) {
    const connectionString = await resolveConnectionString();
    global.__shidukhPgUrl = connectionString;
    global.__shidukhPg = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      connectionTimeoutMillis: 10000,
    });
  }
  return global.__shidukhPg;
}
