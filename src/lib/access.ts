/** Cookie that proves the visitor entered the access code. Holds a hash, never the code. */
export const ACCESS_COOKIE = "lead_finder_access";

export async function accessToken(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`lead-finder:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
