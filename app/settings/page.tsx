import { desc } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationSettingsForm } from "@/components/notification-settings-form";
import { AutoPostSettingsForm } from "@/components/auto-post-settings-form";
import { whatsappConfigured } from "@/lib/whatsapp";
import { emailConfigured } from "@/lib/email";
import { googleCalendarConfigured } from "@/lib/google-calendar";
import { isIntegrationConnected } from "@/lib/integrations";
import { disconnectGoogleCalendar } from "@/app/settings/actions";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

const GOOGLE_STATUS_MESSAGE: Record<string, { tone: "positive" | "negative" | "caution"; text: string }> = {
  connected: { tone: "positive", text: "Google Calendar connected." },
  error: { tone: "negative", text: "Couldn't connect Google Calendar — check the server log for details." },
  denied: { tone: "caution", text: "Google sign-in was cancelled." },
  not_configured: { tone: "negative", text: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI aren't set yet." },
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { google } = await searchParams;
  const statusBanner = google ? GOOGLE_STATUS_MESSAGE[google] : null;

  const [waConfigured, gcalEnvConfigured, gcalConnected, settingsRows, extensionTokenRows] = await Promise.all([
    Promise.resolve(whatsappConfigured()),
    Promise.resolve(googleCalendarConfigured()),
    isIntegrationConnected("google_calendar"),
    db.select().from(schema.settings).limit(1),
    db.select().from(schema.extensionTokens).orderBy(desc(schema.extensionTokens.createdAt)),
  ]);
  const settingsRow = settingsRows[0] ?? null;
  const emlConfigured = emailConfigured();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-5 text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">Settings</h1>

      {statusBanner && (
        <div
          className={`mb-4 rounded-[var(--radius-card)] p-3.5 text-[12.5px] ${
            statusBanner.tone === "positive"
              ? "bg-[var(--color-positive-bg)] text-[var(--color-positive-text)]"
              : statusBanner.tone === "negative"
                ? "bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]"
                : "bg-[var(--color-caution-bg)] text-[var(--color-caution-text)]"
          }`}
        >
          {statusBanner.text}
        </div>
      )}

      <Card className="mb-4">
        <div className="mb-1 text-[13.5px] font-semibold text-[var(--color-text)]">Integrations</div>
        <p className="mb-4 text-[11.5px] text-[var(--color-text-muted)]">Connect the outside services this app talks to.</p>

        <div className="flex flex-col divide-y divide-[var(--color-hairline)]">
          <div className="flex items-center justify-between py-3.5">
            <div>
              <div className="text-[13.5px] font-semibold text-[var(--color-text)]">WhatsApp (Twilio)</div>
              <div className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">
                {waConfigured ? "Ready — messages send and receive from the Messages page." : "Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM to .env.local."}
              </div>
            </div>
            <Badge tone={waConfigured ? "positive" : "neutral"}>{waConfigured ? "Connected" : "Not connected"}</Badge>
          </div>

          <div className="flex items-center justify-between py-3.5">
            <div>
              <div className="text-[13.5px] font-semibold text-[var(--color-text)]">Google Calendar</div>
              <div className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">
                {!gcalEnvConfigured
                  ? "Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to .env.local first."
                  : gcalConnected
                    ? "Appointments sync to your primary calendar."
                    : "Not connected yet."}
              </div>
            </div>
            {gcalConnected ? (
              <form action={disconnectGoogleCalendar}>
                <Button type="submit" variant="secondary" className="px-3 py-1.5 text-[11.5px]">
                  Disconnect
                </Button>
              </form>
            ) : gcalEnvConfigured ? (
              <a href="/api/integrations/google/connect">
                <Button type="button" className="px-3 py-1.5 text-[11.5px]">
                  Connect
                </Button>
              </a>
            ) : (
              <Button type="button" variant="secondary" disabled className="px-3 py-1.5 text-[11.5px]">
                Connect
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between py-3.5">
            <div>
              <div className="text-[13.5px] font-semibold text-[var(--color-text)]">Email (Resend)</div>
              <div className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">
                {emlConfigured ? "Ready — the daily desk brief can email you." : "Add RESEND_API_KEY and RESEND_FROM_EMAIL to .env.local."}
              </div>
            </div>
            <Badge tone={emlConfigured ? "positive" : "neutral"}>{emlConfigured ? "Connected" : "Not connected"}</Badge>
          </div>

          <div className="flex items-center justify-between py-3.5">
            <div>
              <div className="text-[13.5px] font-semibold text-[var(--color-text)]">Anthropic (Deal Copilot)</div>
              <div className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">
                {process.env.ANTHROPIC_API_KEY ? "Ready — the Deal Copilot button on a deal page is live." : "Add ANTHROPIC_API_KEY to .env.local."}
              </div>
            </div>
            <Badge tone={process.env.ANTHROPIC_API_KEY ? "positive" : "neutral"}>{process.env.ANTHROPIC_API_KEY ? "Connected" : "Not connected"}</Badge>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-1 text-[13.5px] font-semibold text-[var(--color-text)]">Notifications</div>
        <p className="mb-4 text-[11.5px] text-[var(--color-text-muted)]">
          Where the daily desk brief goes — what&apos;s on today, deals needing attention, open stips and leads. Runs
          automatically once a day; use the button below to see it right now.
        </p>
        <NotificationSettingsForm
          operatorPhone={settingsRow?.operatorPhone ?? null}
          operatorEmail={settingsRow?.operatorEmail ?? null}
          googleReviewUrl={settingsRow?.googleReviewUrl ?? null}
        />
      </Card>

      <Card className="mt-4">
        <div className="mb-1 text-[13.5px] font-semibold text-[var(--color-text)]">Facebook Marketplace auto-post</div>
        <p className="mb-4 text-[11.5px] text-[var(--color-text-muted)]">
          A paired browser extension posts queued listings for you (see the Marketing page). This app never touches
          your Facebook password — the extension runs in your own logged-in browser.
        </p>
        <AutoPostSettingsForm
          autoPostEnabled={settingsRow?.autoPostEnabled ?? false}
          autoPostMaxPerDay={settingsRow?.autoPostMaxPerDay ?? 1}
          autoPostTimes={settingsRow?.autoPostTimes ?? ["09:00"]}
          tokens={extensionTokenRows.map((t) => ({
            id: t.id,
            label: t.label,
            createdAt: t.createdAt.toISOString(),
            lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
            revokedAt: t.revokedAt ? t.revokedAt.toISOString() : null,
          }))}
        />
      </Card>
    </div>
  );
}
