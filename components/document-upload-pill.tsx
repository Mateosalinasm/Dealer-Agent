"use client";

import { useState, useTransition } from "react";
import { Upload, Check, TriangleAlert } from "lucide-react";
import { uploadDocument } from "@/app/desk/deals/actions";
import { cn } from "@/lib/utils";

type Status = "idle" | "uploading" | "done" | "error";

// Shared header-pill upload control: pick a file, it uploads AND runs AI
// extraction immediately (uploadDocument does both in one server action —
// see app/desk/deals/actions.ts — so there's no separate "Analyze with AI"
// click for the first pass anywhere this is used). Same placement (next to
// the modal's title) and same bounce/pulse animation everywhere it
// appears: credit report upload, and here for TurboPass/bank statements.
export function DocumentUploadPill({
  dealId,
  category,
  label,
  multiple = false,
  accept = ".pdf,image/*",
}: {
  dealId: string;
  category: string;
  label: string;
  multiple?: boolean;
  accept?: string;
}) {
  const [fileLabel, setFileLabel] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setFileLabel(files.length > 1 ? `${files.length} files` : files[0].name);
    setError(null);
    setStatus("uploading");

    startTransition(async () => {
      const fd = new FormData();
      fd.set("category", category);
      for (const file of files) fd.append("file", file);
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
        title={pending ? `Uploading and reading ${label.toLowerCase()}…` : status === "done" ? "Uploaded and analyzed" : status === "error" ? (error ?? "Couldn't upload the file") : `Upload ${label.toLowerCase()}`}
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
        <span className="max-w-[170px] truncate">{pending ? "Uploading…" : status === "done" ? "Uploaded" : status === "error" ? "Failed — retry" : fileLabel || label}</span>
        <input type="file" accept={accept} multiple={multiple} className="hidden" disabled={pending} onChange={onChange} />
      </label>
      {status === "error" && error && <p className="max-w-[220px] text-right text-[10.5px] text-[var(--color-negative-text)]">{error}</p>}
    </div>
  );
}
