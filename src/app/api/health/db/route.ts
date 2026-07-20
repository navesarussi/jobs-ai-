import { ok, fail } from "@/infrastructure/http";
import { getSupabaseConfig } from "@/infrastructure/supabase/client";
import { ensureSchema } from "@/infrastructure/db/schema";
import { getPool } from "@/infrastructure/db/pool";

export async function GET() {
  try {
    const supabase = getSupabaseConfig();
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query<{ now: Date }>(`select now()`);
    return ok({
      postgres: true,
      timestamp: result.rows[0]?.now,
      supabase: Boolean(supabase),
      supabaseUrl: supabase?.url ?? null,
    });
  } catch (e) {
    return fail(e);
  }
}
