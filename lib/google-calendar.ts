import "server-only";
import { getIntegrationConfig, setIntegrationConfig } from "@/lib/integrations";

// Google Calendar sync over plain fetch (same call as lib/whatsapp.ts —
// no googleapis dependency for code that can't be exercised without real
// credentials). Needs three env vars, from a Google Cloud project with
// the Calendar API enabled (console.cloud.google.com → APIs & Services →
// Credentials → OAuth client ID, type "Web application"):
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   GOOGLE_REDIRECT_URI     — must exactly match an "Authorized redirect URI"
//                             on that OAuth client, e.g.
//                             https://<your-domain>/api/integrations/google/callback

interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

export function googleCalendarConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

export function getGoogleAuthUrl(): string | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    // offline + consent so Google actually issues a refresh_token — without
    // both of these it only comes back on the very first authorization.
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/calendar.events",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<{ ok: boolean; error?: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return { ok: false, error: "Google Calendar isn't configured — add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI." };
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }).toString(),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token || !data.refresh_token) {
      return { ok: false, error: data?.error_description ?? "Google didn't return a refresh token — try disconnecting and reconnecting." };
    }
    await setIntegrationConfig("google_calendar", {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    } satisfies GoogleTokens);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function refreshGoogleToken(tokens: GoogleTokens): Promise<GoogleTokens | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const refreshed: GoogleTokens = {
    accessToken: data.access_token,
    refreshToken: tokens.refreshToken, // Google doesn't re-issue this on refresh
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  await setIntegrationConfig("google_calendar", refreshed);
  return refreshed;
}

async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getIntegrationConfig<GoogleTokens>("google_calendar");
  if (!tokens) return null;
  // Refresh a minute early rather than racing an exact expiry.
  if (Date.now() > tokens.expiresAt - 60_000) {
    const refreshed = await refreshGoogleToken(tokens);
    return refreshed?.accessToken ?? null;
  }
  return tokens.accessToken;
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  startsAt: Date;
  durationMinutes?: number;
}

export interface SyncResult {
  ok: boolean;
  eventId?: string;
  error?: string;
}

/** Creates the event if googleEventId is null, otherwise updates it in place. */
export async function syncAppointmentToGoogle(event: CalendarEventInput, existingEventId: string | null): Promise<SyncResult> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return { ok: false, error: "Google Calendar isn't connected — connect it in Settings first." };
  }

  const end = new Date(event.startsAt.getTime() + (event.durationMinutes ?? 30) * 60_000);
  const payload = {
    summary: event.summary,
    description: event.description,
    start: { dateTime: event.startsAt.toISOString() },
    end: { dateTime: end.toISOString() },
  };

  const url = existingEventId
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingEventId}`
    : "https://www.googleapis.com/calendar/v3/calendars/primary/events";

  try {
    const res = await fetch(url, {
      method: existingEventId ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data?.error?.message ?? `Google Calendar returned ${res.status}` };
    }
    return { ok: true, eventId: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteGoogleEvent(eventId: string): Promise<void> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return;
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {
    // Best-effort — a failed remote delete shouldn't block the local cancel.
  });
}
