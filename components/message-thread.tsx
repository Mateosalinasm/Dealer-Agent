"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { formatPhoneForDisplay } from "@/lib/phone";
import { markConversationRead, sendMessage } from "@/app/messages/actions";
import { cn } from "@/lib/utils";
import type { schema } from "@/lib/db";

type Conversation = typeof schema.conversations.$inferSelect;
type Message = typeof schema.messages.$inferSelect;

export function MessageThread({ conversation, messages }: { conversation: Conversation; messages: Message[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages.length]);

  useEffect(() => {
    if (conversation.unreadCount > 0) {
      startTransition(() => markConversationRead(conversation.id));
    }
    // Only re-run when the selected conversation changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  function submit(formData: FormData) {
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    setDraft("");
    setError(null);
    startTransition(async () => {
      const err = await sendMessage(conversation.id, formData);
      if (err) setError(err);
    });
  }

  return (
    <Card className="flex h-full min-h-[500px] flex-col p-0">
      <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-4 py-3">
        <div>
          <div className="text-[14px] font-semibold text-[var(--color-text)]">{conversation.contactName || formatPhoneForDisplay(conversation.contactPhone)}</div>
          <div className="text-[11.5px] text-[var(--color-text-muted)]">{formatPhoneForDisplay(conversation.contactPhone)}</div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-center text-[12.5px] text-[var(--color-text-muted)]">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-[var(--radius-panel)] px-3 py-2 text-[13px]",
                  m.direction === "outbound" ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-fill-subtle)] text-[var(--color-text)]",
                )}
              >
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className={cn("mt-1 text-[10px]", m.direction === "outbound" ? "text-white/70" : "text-[var(--color-text-placeholder)]")}>
                  {new Date(m.createdAt).toLocaleString(undefined, { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}
                  {m.status === "failed" && " · Failed to send"}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div className="px-4 pb-1 text-[11.5px] text-[var(--color-negative-text)]">{error}</div>}

      <form action={submit} className="flex items-end gap-2 border-t border-[var(--color-hairline)] p-3">
        <Textarea
          name="body"
          rows={1}
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          className="flex-1 resize-none"
        />
        <Button type="submit" disabled={isPending || !draft.trim()}>
          Send
        </Button>
      </form>
    </Card>
  );
}
