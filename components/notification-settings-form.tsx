"use client";

import { useState, useTransition } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateNotificationSettings, sendTestDeskBrief } from "@/app/settings/actions";

export function NotificationSettingsForm({
  operatorPhone,
  operatorEmail,
  googleReviewUrl,
}: {
  operatorPhone: string | null;
  operatorEmail: string | null;
  googleReviewUrl: string | null;
}) {
  const [isSaving, startSaving] = useTransition();
  const [isSending, startSending] = useTransition();
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  function save(formData: FormData) {
    startSaving(() => updateNotificationSettings(formData));
  }

  function sendTest() {
    setTestFeedback(null);
    startSending(async () => {
      const r = await sendTestDeskBrief();
      if (r.neitherConfigured) {
        setTestFeedback("Add a phone number or email above and save first.");
        return;
      }
      const parts: string[] = [];
      if (r.sentWhatsApp) parts.push("WhatsApp sent");
      if (r.whatsappError) parts.push(`WhatsApp: ${r.whatsappError}`);
      if (r.sentEmail) parts.push("Email sent");
      if (r.emailError) parts.push(`Email: ${r.emailError}`);
      setTestFeedback(parts.join(" · ") || "Nothing to send.");
    });
  }

  return (
    <form action={save} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="operatorPhone">Your WhatsApp number</Label>
          <Input id="operatorPhone" name="operatorPhone" type="tel" defaultValue={operatorPhone ?? ""} placeholder="(555) 123-4567" />
        </div>
        <div>
          <Label htmlFor="operatorEmail">Your email</Label>
          <Input id="operatorEmail" name="operatorEmail" type="email" defaultValue={operatorEmail ?? ""} placeholder="you@dealership.com" />
        </div>
      </div>
      <div>
        <Label htmlFor="googleReviewUrl">Google review link (optional)</Label>
        <Input id="googleReviewUrl" name="googleReviewUrl" defaultValue={googleReviewUrl ?? ""} placeholder="https://g.page/r/.../review" />
        <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Included in the 90-day post-sale check-in message when set.</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button type="submit" variant="secondary" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
        <div className="flex items-center gap-2">
          {testFeedback && <span className="text-[11.5px] text-[var(--color-text-muted)]">{testFeedback}</span>}
          <Button type="button" variant="secondary" disabled={isSending} onClick={sendTest}>
            {isSending ? "Sending…" : "Send test brief now"}
          </Button>
        </div>
      </div>
    </form>
  );
}
