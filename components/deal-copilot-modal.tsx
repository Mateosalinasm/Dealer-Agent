"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { askDealCopilot } from "@/app/desk/deals/copilot-actions";
import type { CopilotMessage } from "@/lib/deal-copilot";

interface ChatMessage extends CopilotMessage {
  error?: boolean;
}

export function DealCopilotModal({ dealId, customerName, configured }: { dealId: string; customerName: string; configured: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function submit(formData: FormData) {
    const text = String(formData.get("question") ?? "").trim();
    if (!text) return;
    setDraft("");
    const next = [...messages, { role: "user" as const, text }];
    setMessages(next);
    startTransition(async () => {
      const result = await askDealCopilot(dealId, next);
      if (result.ok && result.reply) {
        setMessages((prev) => [...prev, { role: "assistant", text: result.reply! }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", text: result.error ?? "Something went wrong.", error: true }]);
      }
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">
          Deal copilot
        </Button>
      </DialogTrigger>
      <DialogContent title={customerName} subtitle="Deal copilot" className="max-w-2xl">
        {!configured ? (
          <div className="py-6 text-center">
            <div className="text-[14px] font-semibold text-[var(--color-text)]">Not connected yet</div>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-[var(--color-text-muted)]">
              Deal Copilot needs an Anthropic API key. Add <code className="rounded bg-[var(--color-fill-subtle)] px-1 py-0.5">ANTHROPIC_API_KEY</code> to
              .env.local and this starts working immediately — no other setup.
            </p>
          </div>
        ) : (
          <div className="flex h-[60vh] flex-col">
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto pb-3">
              {messages.length === 0 ? (
                <p className="py-4 text-[12.5px] text-[var(--color-text-muted)]">
                  Ask about structuring this deal, which bank to try, or anything else — it can see this deal&apos;s vehicle, credit facts, lender matches, and eligible F&I products.
                </p>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-panel)] px-3 py-2 text-[13px]",
                        m.role === "user"
                          ? "bg-[var(--color-primary)] text-white"
                          : m.error
                            ? "bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]"
                            : "bg-[var(--color-fill-subtle)] text-[var(--color-text)]",
                      )}
                    >
                      {m.text}
                    </div>
                  </div>
                ))
              )}
              {isPending && <div className="text-[12px] text-[var(--color-text-muted)]">Thinking…</div>}
              <div ref={bottomRef} />
            </div>

            <form action={submit} className="flex items-end gap-2 border-t border-[var(--color-hairline)] pt-3">
              <Textarea
                name="question"
                rows={1}
                placeholder="Ask Deal Copilot…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                className="flex-1 resize-none"
                disabled={isPending}
              />
              <Button type="submit" disabled={isPending || !draft.trim()}>
                Ask
              </Button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
