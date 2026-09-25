// The extension fetches photos and reports results from outside this app's
// own request context, so it needs absolute URLs — relative /api/... paths
// mean nothing to a browser extension's own network requests.
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}
