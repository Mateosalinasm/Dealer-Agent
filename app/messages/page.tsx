import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPhoneForDisplay } from "@/lib/phone";
import { whatsappConfigured } from "@/lib/whatsapp";
import { MessageThread } from "@/components/message-thread";
import { StartConversationForm } from "@/components/start-conversation-form";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function timeAgo(date: Date | null): string {
  if (!date) return "";
  const ms = Date.now() - date.getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.round(hr / 24)}d`;
}

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c: selectedId } = await searchParams;

  const conversations = await db.select().from(schema.conversations).orderBy(desc(schema.conversations.lastMessageAt));
  const selected = selectedId ? conversations.find((c) => c.id === selectedId) ?? null : conversations[0] ?? null;
  const messages = selected
    ? await db.select().from(schema.messages).where(eq(schema.messages.conversationId, selected.id)).orderBy(schema.messages.createdAt)
    : [];

  const configured = whatsappConfigured();

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">Messages</h1>
          <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">WhatsApp conversations with leads and customers.</p>
        </div>
      </div>

      {!configured && (
        <div className="mb-4 rounded-[var(--radius-card)] bg-[var(--color-caution-bg)] p-4 text-[12.5px] text-[var(--color-caution-text)]">
          <div className="font-semibold">WhatsApp isn&rsquo;t connected yet</div>
          <p className="mt-1">
            Add <code className="rounded bg-black/10 px-1 py-0.5">TWILIO_ACCOUNT_SID</code>,{" "}
            <code className="rounded bg-black/10 px-1 py-0.5">TWILIO_AUTH_TOKEN</code>, and{" "}
            <code className="rounded bg-black/10 px-1 py-0.5">TWILIO_WHATSAPP_FROM</code> to <code className="rounded bg-black/10 px-1 py-0.5">.env.local</code>,
            then point the WhatsApp sender&rsquo;s webhook at <code className="rounded bg-black/10 px-1 py-0.5">/api/whatsapp/webhook</code> in the Twilio console.
            You can still read this page — sending will just fail until then.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        <Card className="flex h-fit flex-col gap-1 p-2">
          <div className="px-2 pb-2 pt-1">
            <StartConversationForm />
          </div>
          {conversations.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12.5px] text-[var(--color-text-muted)]">No conversations yet.</p>
          ) : (
            conversations.map((c) => (
              <Link
                key={c.id}
                href={`/messages?c=${c.id}`}
                className={cn(
                  "flex items-start justify-between gap-2 rounded-[var(--radius-panel)] px-3 py-2.5 text-left",
                  selected?.id === c.id ? "bg-[var(--color-info-bg)]" : "hover:bg-[var(--color-fill-subtle)]",
                )}
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-[var(--color-text)]">
                    {c.contactName || formatPhoneForDisplay(c.contactPhone) || "Facebook Marketplace"}
                  </div>
                  <div className="truncate text-[11.5px] text-[var(--color-text-muted)]">
                    {formatPhoneForDisplay(c.contactPhone) || (c.channel === "facebook_marketplace" ? "Marketplace message" : "")}
                  </div>
                </div>
                <div className="flex flex-none flex-col items-end gap-1">
                  <span className="text-[10.5px] tabular-nums text-[var(--color-text-placeholder)]">{timeAgo(c.lastMessageAt)}</span>
                  {c.unreadCount > 0 && <Badge tone="info">{c.unreadCount}</Badge>}
                </div>
              </Link>
            ))
          )}
        </Card>

        {selected ? (
          <MessageThread conversation={selected} messages={messages} />
        ) : (
          <Card className="flex h-full min-h-[300px] items-center justify-center text-[12.5px] text-[var(--color-text-muted)]">
            Start a conversation to see it here.
          </Card>
        )}
      </div>
    </div>
  );
}
