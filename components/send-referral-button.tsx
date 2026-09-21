"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { sendReferralMessage } from "@/app/desk/deals/actions";

export function SendReferralButton({ dealId }: { dealId: string }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await sendReferralMessage(dealId);
            setFeedback(result.ok ? { ok: true, text: "Sent" } : { ok: false, text: result.error ?? "Failed to send" });
          })
        }
      >
        {isPending ? "Sending…" : "Send referral message"}
      </Button>
      {feedback && (
        <span className={`text-[11.5px] ${feedback.ok ? "text-[var(--color-positive-text)]" : "text-[var(--color-negative-text)]"}`}>
          {feedback.text}
        </span>
      )}
    </div>
  );
}
