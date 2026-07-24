import { shouldUseMemoryStore } from "@/infrastructure/db/memory-store";
import { getPool } from "@/infrastructure/db/pool";
import { ensureSchema } from "@/infrastructure/db/schema";

const memoryBlobs = new Map<string, Buffer>();

/** Persist CV bytes in Postgres (works with existing DATABASE_URL; no Storage required). */
export async function saveCandidateDocumentBlob(params: {
  id: string;
  userId: string;
  content: Buffer;
}): Promise<string> {
  if (shouldUseMemoryStore()) {
    const key = `mem:${params.id}`;
    memoryBlobs.set(key, params.content);
    return key;
  }

  await ensureSchema();
  const pool = await getPool();
  await pool.query(
    `insert into candidate_document_blobs (id, user_id, content)
     values ($1, $2, $3)
     on conflict (id) do update set content = excluded.content, user_id = excluded.user_id`,
    [params.id, params.userId, params.content],
  );
  return `pg:${params.id}`;
}

export async function readCandidateDocumentBlob(storageKey: string): Promise<Buffer | null> {
  if (storageKey.startsWith("mem:")) {
    return memoryBlobs.get(storageKey) ?? null;
  }

  await ensureSchema();
  if (!storageKey.startsWith("pg:")) return null;
  const id = storageKey.slice(3);
  const pool = await getPool();
  const result = await pool.query<{ content: Buffer }>(
    `select content from candidate_document_blobs where id = $1 limit 1`,
    [id],
  );
  const row = result.rows[0];
  if (!row?.content) return null;
  return Buffer.isBuffer(row.content) ? row.content : Buffer.from(row.content);
}

/** Test helper — clears in-memory blobs between tests. */
export function clearMemoryDocumentBlobs(): void {
  memoryBlobs.clear();
}

export async function deleteCandidateDocumentBlobs(storageKeys: string[]): Promise<void> {
  for (const key of storageKeys) {
    if (key.startsWith("mem:")) memoryBlobs.delete(key);
  }
  const ids = storageKeys.filter((k) => k.startsWith("pg:")).map((k) => k.slice(3));
  if (ids.length === 0 || shouldUseMemoryStore()) return;
  await ensureSchema();
  const pool = await getPool();
  await pool.query(`delete from candidate_document_blobs where id = any($1::text[])`, [ids]);
}
