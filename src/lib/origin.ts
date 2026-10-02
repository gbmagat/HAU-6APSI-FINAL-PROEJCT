/**
 * CSRF guard for browser writes. Compares the browser's Origin with the host it actually requested.
 * Behind the HTTPS proxy that host arrives as X-Forwarded-Host; Next's own nextUrl always reports
 * the server's internal address (for example http://localhost:3000), so it cannot be used here.
 */
export function isSameOriginRequest(request: { headers: Headers; nextUrl: { host: string } }): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    || request.headers.get("host")
    || request.nextUrl.host;
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
