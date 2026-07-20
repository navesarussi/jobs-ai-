import { ok, fail } from "@/infrastructure/http";
import { getSupabaseConfig } from "@/infrastructure/supabase/client";
import { deriveSupabaseUrlFromDatabaseUrl } from "@/infrastructure/supabase/derive-url";
import { ensureSchema } from "@/infrastructure/db/schema";
import { getPool } from "@/infrastructure/db/pool";

export async function GET() {
  try {
    const supabase = getSupabaseConfig();
    const derivedUrl = deriveSupabaseUrlFromDatabaseUrl(process.env.DATABASE_URL);
    await ensureSchema();
    const pool = await getPool();
    const result = await pool.query<{ now: Date }>(`select now()`);
    return ok({
      postgres: true,
      timestamp: result.rows[0]?.now,
      supabase: Boolean(supabase),
      supabaseUrl: supabase?.url ?? derivedUrl,
    });
  } catch (e) {
    return fail(e);
  }
}
