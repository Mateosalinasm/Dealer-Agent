"use client";

import { useState, useTransition } from "react";
import { Upload, Check, TriangleAlert } from "lucide-react";
import { uploadDocument } from "@/app/desk/deals/actions";
import { cn } from "@/lib/utils";

type Status = "idle" | "uploading" | "done" | "error";

// Lives in the credit-grade modal's header, next to the customer name —
// same placement and same "pick a file, it just goes" behavior as the New
// Deal credit-app upload button. uploadDocument already saves the file AND
// runs AI extraction in one server action (see app/desk/deals/actions.ts),
// so there's no separate "Analyze with AI" step to trigger here — the
// pending state below covers both.
export function CreditReportUploadField({ dealId }: { dealId: string }) {
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setStatus("uploading");

    startTransition(async () => {
      const fd = new FormData();
      fd.set("category", "credit_report");
      fd.set("file", file);
      const result = await uploadDocument(dealId, fd);
      if (!result.ok) {
        setStatus("error");
        setError(result.error ?? "Upload failed — try again.");
        return;
      }
      setStatus("done");
    });
  }

  const pending = isPending || status === "uploading";

  return (
    <div className="flex flex-col items-end gap-1">
      <label
        title={
          pending
            ? "Uploading and reading the credit report…"
            : status === "done"
              ? "Uploaded and analyzed"
              : status === "error"
                ? (error ?? "Couldn't upload the file")
                : "Upload credit report"
        }
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-pill)] border px-3 py-1.5 text-[12px] font-semibold transition-colors",
          pending
            ? "border-[var(--color-info-text)]/40 text-[var(--color-info-text)] [animation:upload-pulse-tone_1.1s_ease-in-out_infinite]"
            : status === "done"
              ? "border-[var(--color-positive-text)]/30 bg-[var(--color-positive-bg)] text-[var(--color-positive-text)]"
              : status === "error"
                ? "border-[var(--color-negative-text)]/30 bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]"
                : "border-[var(--color-hairline)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-fill-subtle)]",
        )}
      >
        {pending ? (
          <Upload size={14} className="flex-none [animation:upload-arrow-bounce_0.9s_ease-in-out_infinite]" />
        ) : status === "done" ? (
          <Check size={14} className="flex-none" />
        ) : status === "error" ? (
          <TriangleAlert size={14} className="flex-none" />
        ) : (
          <Upload size={14} className="flex-none text-[var(--color-text-muted)]" />
        )}
        <span className="max-w-[200px] truncate">
          {pending ? "Uploading & analyzing…" : status === "done" ? "Uploaded — see below" : status === "error" ? "Failed — click to retry" : fileName || "Upload credit report"}
        </span>
        <input type="file" accept=".pdf,image/*" className="hidden" disabled={pending} onChange={onChange} />
      </label>
      {status === "error" && error && <p className="max-w-[260px] text-right text-[10.5px] text-[var(--color-negative-text)]">{error}</p>}
    </div>
  );
}
