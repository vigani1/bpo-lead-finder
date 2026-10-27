/**
 * Neon's connection strings say `sslmode=require`. node-postgres treats that as
 * full certificate verification today but will switch to libpq's weaker meaning;
 * asking for `verify-full` keeps the check (Neon's certificates are publicly valid).
 */
export function withVerifiedSsl(connectionString: string): string {
  const url = new URL(connectionString);
  if (url.searchParams.get("sslmode") === "require") url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}
