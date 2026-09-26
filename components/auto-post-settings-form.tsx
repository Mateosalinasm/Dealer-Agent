"use client";

import { useState, useTransition } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateAutoPostSchedule, createExtensionTokenAction, revokeExtensionTokenAction } from "@/app/settings/actions";

export interface ExtensionTokenRow {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export function AutoPostSettingsForm({
  autoPostEnabled,
  autoPostMaxPerDay,
  autoPostTimes,
  tokens,
}: {
  autoPostEnabled: boolean;
  autoPostMaxPerDay: number;
  autoPostTimes: string[];
  tokens: ExtensionTokenRow[];
}) {
  const [isSaving, startSaving] = useTransition();
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [newTokenLabel, setNewTokenLabel] = useState("");
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [isCreatingToken, startCreatingToken] = useTransition();
  const [isRevoking, startRevoking] = useTransition();

  function saveSchedule(formData: FormData) {
    setScheduleError(null);
    startSaving(async () => {
      const result = await updateAutoPostSchedule(formData);
      if (!result.ok) setScheduleError(result.error ?? "Couldn't save.");
    });
  }

  function createToken() {
    setRevealedToken(null);
    startCreatingToken(async () => {
      const token = await createExtensionTokenAction(newTokenLabel.trim());
      setRevealedToken(token);
      setNewTokenLabel("");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <form action={saveSchedule} className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-[13.5px] font-medium text-[var(--color-text)]">
          <input type="checkbox" name="autoPostEnabled" defaultChecked={autoPostEnabled} className="h-4 w-4 accent-[var(--color-primary)]" />
          Post to Facebook Marketplace automatically
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="autoPostMaxPerDay">Max posts per day</Label>
            <Input id="autoPostMaxPerDay" name="autoPostMaxPerDay" type="number" min={1} max={20} defaultValue={autoPostMaxPerDay} />
          </div>
          <div>
            <Label htmlFor="autoPostTimes">Post times (24h, comma-separated)</Label>
            <Input id="autoPostTimes" name="autoPostTimes" defaultValue={autoPostTimes.join(", ")} placeholder="09:00, 15:00" />
          </div>
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          A queued listing goes out once one of these times has passed for the day, up to the daily max — never more
          than one at a time, and only when the extension is running and paired below.
        </p>
        {scheduleError && <p className="text-[11.5px] text-[var(--color-negative-text)]">{scheduleError}</p>}
        <Button type="submit" variant="secondary" disabled={isSaving} className="self-start">
          {isSaving ? "Saving…" : "Save schedule"}
        </Button>
      </form>

      <div className="border-t border-[var(--color-hairline)] pt-4">
        <div className="mb-1 text-[13px] font-semibold text-[var(--color-text)]">Pair the browser extension</div>
        <p className="mb-3 text-[11.5px] text-[var(--color-text-muted)]">
          Generate a token and paste it into the extension&rsquo;s options page. Each token works for one browser —
          revoke it here if that computer stops being used for posting.
        </p>

        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="newTokenLabel">Label</Label>
            <Input id="newTokenLabel" value={newTokenLabel} onChange={(e) => setNewTokenLabel(e.target.value)} placeholder="e.g. Front desk laptop" />
          </div>
          <Button type="button" variant="secondary" disabled={isCreatingToken} onClick={createToken}>
            {isCreatingToken ? "Generating…" : "Generate token"}
          </Button>
        </div>

        {revealedToken && (
          <div className="mb-3 rounded-[var(--radius-panel)] bg-[var(--color-caution-bg)] p-3 text-[12.5px] text-[var(--color-caution-text)]">
            <div className="mb-1 font-semibold">Copy this now — it won&rsquo;t be shown again:</div>
            <code className="block break-all rounded-[var(--radius-panel)] bg-[var(--color-surface)] p-2 text-[12px] text-[var(--color-text)]">{revealedToken}</code>
          </div>
        )}

        {tokens.length === 0 ? (
          <p className="text-[12px] text-[var(--color-text-muted)]">No tokens yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--color-hairline)]">
            {tokens.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 py-2.5">
                <div>
                  <div className="text-[12.5px] font-medium text-[var(--color-text)]">{t.label}</div>
                  <div className="text-[11px] text-[var(--color-text-muted)]">
                    Created {new Date(t.createdAt).toLocaleDateString()}
                    {t.lastUsedAt ? ` · last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : " · never used"}
                  </div>
                </div>
                {t.revokedAt ? (
                  <Badge tone="neutral">Revoked</Badge>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isRevoking}
                    onClick={() => startRevoking(() => revokeExtensionTokenAction(t.id))}
                    className="px-3 py-1.5 text-[11.5px]"
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
