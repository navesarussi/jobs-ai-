const POOLER_REGIONS = [
  "ap-southeast-2",
  "ap-southeast-1",
  "eu-central-1",
  "us-east-1",
  "eu-west-1",
  "us-west-1",
] as const;

/** Rewrite direct `db.*.supabase.co` URLs to IPv4-compatible Supavisor pooler. */
export function toPoolerConnectionString(
  connectionString: string,
  region = process.env.SUPABASE_POOLER_REGION?.trim(),
): string {
  try {
    const url = new URL(connectionString);
    const ref = url.hostname.match(/^db\.([^.]+)\.supabase\.co$/)?.[1];
    if (!ref || url.username.startsWith("postgres.")) return connectionString;

    const poolerRegion = region || inferRegionFromIpv6(url.hostname) || "ap-southeast-2";
    url.username = `postgres.${ref}`;
    url.hostname = `aws-0-${poolerRegion}.pooler.supabase.com`;
    url.port = "6543";
    url.searchParams.set("sslmode", "require");
    return url.toString();
  } catch {
    return connectionString;
  }
}

function inferRegionFromIpv6(hostname: string): string | null {
  void hostname;
  return null;
}

export function poolerRegionCandidates(): readonly string[] {
  const preferred = process.env.SUPABASE_POOLER_REGION?.trim();
  if (preferred) return [preferred, ...POOLER_REGIONS.filter((r) => r !== preferred)];
  return POOLER_REGIONS;
}

export function poolerConnectionForRegion(connectionString: string, region: string): string {
  return toPoolerConnectionString(connectionString, region);
}
