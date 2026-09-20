"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteLenderDocument, uploadLenderGuidelines } from "@/app/lenders/actions";

interface GuidelinesDoc {
  id: string;
  fileName: string;
}

// Reference-only upload (no AI extraction) — read the guidelines and enter
// the program's rules by hand in the form above, same as before.
export function LenderGuidelinesUpload({ lenderId, documents }: { lenderId: string; documents: GuidelinesDoc[] }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {documents.map((doc) => (
        <div key={doc.id} className="flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-fill-subtle)] px-2.5 py-1">
          <a
            href={`/api/documents/${doc.id}/file`}
            target="_blank"
            rel="noreferrer"
            className="max-w-[160px] truncate text-[11.5px] font-medium text-[var(--color-primary)] hover:underline"
          >
            {doc.fileName}
          </a>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => deleteLenderDocument(doc.id))}
            className="text-[12px] text-[var(--color-text-placeholder)] hover:text-[var(--color-negative)]"
          >
            ×
          </button>
        </div>
      ))}

      <form action={uploadLenderGuidelines.bind(null, lenderId)} className="flex items-center gap-2">
        <input
          name="file"
          type="file"
          required
          className="block text-[12px] text-[var(--color-text-muted)] file:mr-2 file:rounded-[var(--radius-pill)] file:border-0 file:bg-[var(--color-fill-subtle)] file:px-3 file:py-1.5 file:text-[11.5px] file:font-semibold"
        />
        <Button type="submit" variant="secondary" className="px-2 py-1 text-[11px]">
          Upload this lender&rsquo;s guidelines
        </Button>
      </form>
    </div>
  );
}
