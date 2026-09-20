"use client";

import { useState } from "react";
import { Upload } from "lucide-react";

// Lives in the New Deal modal's header, outside the <form> element — the
// `form` attribute below ties it to #new-deal-form by id regardless of DOM
// position, so the file rides along on submit and createDeal() attaches it
// to the deal it just created.
//
// This only stores the file (see createDeal in app/desk/deals/actions.ts,
// which saves it as a `credit_app` document). It does not read or fill in
// name/address fields yet — that needs AI extraction (ANTHROPIC_API_KEY),
// which isn't configured. Once it is, analyzeDocument() can run against
// this document the same way it already does for other categories.
export function CreditAppUploadField() {
  const [fileName, setFileName] = useState("");

  return (
    <label className="flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-fill-subtle)]">
      <Upload size={14} className="text-[var(--color-text-muted)]" />
      <span className="max-w-[160px] truncate">{fileName || "Upload credit application"}</span>
      <input
        type="file"
        name="creditApp"
        form="new-deal-form"
        accept=".pdf,image/*"
        className="hidden"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
      />
    </label>
  );
}
