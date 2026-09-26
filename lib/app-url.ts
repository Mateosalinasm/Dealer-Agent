// The extension fetches photos and reports results from outside this app's
// own request context, so it needs absolute URLs — relative /api/... paths
// mean nothing to a browser extension's own network requests. Just as
// important: it needs to be the SAME stable domain the operator paired
// the extension against in Settings — VERCEL_URL is a different, unique
// hostname on every single deployment (a real bug: it produced photo URLs
// on a hostname the extension had no permission for, which looks exactly
// like a CORS error even though the real issue is a wrong URL, not
// missing CORS headers). VERCEL_PROJECT_PRODUCTION_URL is the stable
// custom/production domain and is what should be used whenever it's set.
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}
