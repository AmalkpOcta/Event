/**
 * Public origin used for QR join links and share URLs.
 * Prefer NEXT_PUBLIC_APP_URL (LAN IP) so phones on the same Wi‑Fi can open links
 * even if the host opened the dashboard via localhost.
 */
export function getAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

export function joinUrlForCode(code: string): string {
  return `${getAppOrigin()}/join/${code}`;
}
