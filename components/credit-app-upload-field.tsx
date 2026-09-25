"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Upload, Check, TriangleAlert } from "lucide-react";
import { extractCreditAppFile } from "@/app/desk/deals/actions";
import { creditAppToFormFieldValues } from "@/lib/buyer-application";
import { cn } from "@/lib/utils";

type Status = "idle" | "attached" | "extracting" | "filled" | "error";

// Lives in the New Deal modal's header, outside the <form> element — the
// `form` attribute below ties it to #new-deal-form by id regardless of DOM
// position, so the file still rides along on submit (createDeal saves it
// as the deal's permanent credit_app document and re-analyzes it there).
//
// But that server-side analysis only ever happens AFTER "Add deal" is
// clicked and the page navigates away — nothing on the still-open form
// could ever visibly change from it. So this reads the file itself, the
// moment it's picked, via a standalone extraction (extractCreditAppFile —
// no deal exists yet, so there's nowhere to attach a documents row to) and
// writes the result straight into the open form's own inputs — only ever
// into a field that's still blank, exactly like the same-name server-side
// merge (creditAppFillPatch) does for an existing deal. The Buyer info /
// Address / Employment sections auto-expand (via forceOpenSignal on
// NewDealForm) so the finance manager actually sees what landed, and can
// still edit anything before submitting.
export function CreditAppUploadField({ onFilled }: { onFilled?: (values: Record<string, string>) => void }) {
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [filledCount, setFilledCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasFileRef = useRef(false);

  useEffect(() => {
    const form = document.getElementById("new-deal-form");
    if (!form) return;
    const onSubmit = () => {
      if (hasFileRef.current) setSubmitting(true);
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);

  function applyToForm(values: Record<string, string>): number {
    const form = document.getElementById("new-deal-form") as HTMLFormElement | null;
    if (!form) return 0;
    let count = 0;
    for (const [name, value] of Object.entries(values)) {
      const el = form.elements.namedItem(name);
      if (!el) continue;
      if (el instanceof HTMLSelectElement) {
        const match = bestSelectMatch(el, value);
        if (match != null && !el.value) {
          el.value = match;
          count++;
        }
      } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        if (!el.value.trim()) {
          el.value = value;
          count++;
        }
      }
    }
    return count;
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    const name = file?.name ?? "";
    setFileName(name);
    hasFileRef.current = !!name;
    setError(null);

    if (!file) {
      setStatus("idle");
      return;
    }
    setStatus("extracting");

    startTransition(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const result = await extractCreditAppFile(fd);
      if (!result.ok || !result.data) {
        setStatus("error");
        setError(result.error ?? "Couldn't read the file.");
        return;
      }
      const values = creditAppToFormFieldValues(result.data);
      const count = applyToForm(values);
      setFilledCount(count);
      setStatus("filled");
      onFilled?.(values);
    });
  }

  const pending = isPending || status === "extracting";

  return (
    <div className="flex flex-col items-end gap-1">
      <label
        title={
          submitting
            ? "Uploading and saving the credit application to the deal…"
            : status === "extracting"
              ? "Reading the credit application…"
              : status === "filled"
                ? `Filled ${filledCount} field${filledCount === 1 ? "" : "s"} from the credit app — review before adding the deal`
                : status === "error"
                  ? error ?? "Couldn't read the file"
                  : "Upload credit application"
        }
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-pill)] border px-3 py-1.5 text-[12px] font-semibold transition-colors",
          submitting || pending
            ? "border-[var(--color-info-text)]/40 text-[var(--color-info-text)] [animation:upload-pulse-tone_1.1s_ease-in-out_infinite]"
            : status === "filled"
              ? "border-[var(--color-positive-text)]/30 bg-[var(--color-positive-bg)] text-[var(--color-positive-text)]"
              : status === "error"
                ? "border-[var(--color-negative-text)]/30 bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]"
                : "border-[var(--color-hairline)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-fill-subtle)]",
        )}
      >
        {submitting || pending ? (
          <Upload size={14} className="flex-none [animation:upload-arrow-bounce_0.9s_ease-in-out_infinite]" />
        ) : status === "filled" ? (
          <Check size={14} className="flex-none" />
        ) : status === "error" ? (
          <TriangleAlert size={14} className="flex-none" />
        ) : (
          <Upload size={14} className="flex-none text-[var(--color-text-muted)]" />
        )}
        <span className="max-w-[200px] truncate">
          {submitting
            ? "Uploading & analyzing…"
            : status === "extracting"
              ? "Reading credit app…"
              : status === "filled"
                ? `Filled ${filledCount} field${filledCount === 1 ? "" : "s"} — review below`
                : status === "error"
                  ? "Couldn't read file — click to retry"
                  : fileName || "Upload credit application"}
        </span>
        <input
          type="file"
          name="creditApp"
          form="new-deal-form"
          accept=".pdf,image/*"
          className="hidden"
          disabled={submitting}
          onChange={onChange}
        />
      </label>
      {status === "error" && error && <p className="max-w-[260px] text-right text-[10.5px] text-[var(--color-negative-text)]">{error}</p>}
    </div>
  );
}

function bestSelectMatch(select: HTMLSelectElement, raw: string): string | null {
  const target = raw.trim().toLowerCase();
  if (!target) return null;
  for (const opt of Array.from(select.options)) {
    if (opt.value.toLowerCase() === target || (opt.textContent ?? "").trim().toLowerCase() === target) return opt.value;
  }
  for (const opt of Array.from(select.options)) {
    const optText = (opt.textContent ?? "").trim().toLowerCase();
    if (optText && (optText.includes(target) || target.includes(optText))) return opt.value;
  }
  return null;
}
