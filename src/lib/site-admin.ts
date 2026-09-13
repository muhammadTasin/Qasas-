// Owner emails live only in a server-side env var (no NEXT_PUBLIC_ prefix), so
// they are never bundled for the client. Only the boolean this produces is
// attached to the session; re-check it directly wherever an owner-only page or
// route needs it.
export function isAdminEmail(email: string | null | undefined): boolean {
  const candidate = email?.trim().toLowerCase();
  if (!candidate) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(/[,\n]/)
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(candidate);
}
