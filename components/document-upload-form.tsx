"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { uploadDocument } from "@/app/desk/deals/actions";

// Same client-side wrapper as the credit-grade/income/insurance badges'
// own upload forms — uploadDocument returns {ok, error} instead of
// throwing (Next.js redacts a thrown Server Action's message in
// production), so this is what actually shows the real failure instead of
// silently dropping it (a plain <form action={...}> ignores a returned
// value entirely).
export function DocumentUploadForm({ dealId }: { dealId: string }) {
  const [isPending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);

  function upload(formData: FormData) {
    setUploadError(null);
    startTransition(async () => {
      const result = await uploadDocument(dealId, formData);
      if (!result.ok) setUploadError(result.error ?? "Upload failed — try again.");
    });
  }

  return (
    <div>
      <form action={upload} className="flex flex-wrap items-end gap-3 border-t border-[var(--color-hairline)] pt-3">
        <div className="w-40">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Type</div>
          <Select name="category" defaultValue="insurance">
            <option value="insurance">Insurance</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div className="flex-1">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">File</div>
          <input
            name="file"
            type="file"
            required
            className="block w-full text-[12.5px] text-[var(--color-text-muted)] file:mr-3 file:rounded-[var(--radius-pill)] file:border-0 file:bg-[var(--color-fill-subtle)] file:px-3 file:py-1.5 file:text-[12px] file:font-semibold"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? "Uploading…" : "Upload"}
        </Button>
      </form>
      {uploadError && <p className="mt-1.5 text-[12px] text-[var(--color-negative-text)]">{uploadError}</p>}
    </div>
  );
}
