"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Lives in the New Deal modal's header, outside the <form> element — the
// `form` attribute below ties it to #new-deal-form by id regardless of DOM
// position, so the file rides along on submit. createDeal (see
// app/desk/deals/actions.ts) stores it as a credit_app document and runs
// AI extraction on it synchronously before redirecting to the new deal,
// auto-filling whatever buyer-info fields are still blank.
//
// That extraction is what actually takes a few seconds, and it happens
// server-side during the "Add deal" submit — not the moment a file is
// picked — so the animated "uploading & analyzing" state below is tied to
// the form's real submit event (via a plain DOM listener, since this
// button isn't a descendant of the <form> in the React tree — only
// connected to it through the `form` attribute — so useFormStatus can't
// see it). Picking a file shows an immediate "attached" checkmark instead
// of a false-start analyzing animation, since nothing is happening yet.
export function CreditAppUploadField() {
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
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

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.files?.[0]?.name ?? "";
    setFileName(name);
    hasFileRef.current = !!name;
  }

  const attached = !!fileName && !submitting;

  return (
    <label
      title={submitting ? "Uploading and analyzing the credit application…" : attached ? "Attached — will be analyzed when you add the deal" : "Upload credit application"}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-pill)] border px-3 py-1.5 text-[12px] font-semibold transition-colors",
        submitting
          ? "border-[var(--color-info-text)]/40 text-[var(--color-info-text)] [animation:upload-pulse-tone_1.1s_ease-in-out_infinite]"
          : attached
            ? "border-[var(--color-positive-text)]/30 bg-[var(--color-positive-bg)] text-[var(--color-positive-text)]"
            : "border-[var(--color-hairline)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-fill-subtle)]",
      )}
    >
      {submitting ? (
        <Upload size={14} className="flex-none [animation:upload-arrow-bounce_0.9s_ease-in-out_infinite]" />
      ) : attached ? (
        <Check size={14} className="flex-none" />
      ) : (
        <Upload size={14} className="flex-none text-[var(--color-text-muted)]" />
      )}
      <span className="max-w-[180px] truncate">
        {submitting ? "Uploading & analyzing…" : fileName || "Upload credit application"}
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
  );
}
