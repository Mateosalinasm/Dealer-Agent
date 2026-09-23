"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;

export function DialogContent({
  title,
  subtitle,
  headerExtra,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  // Extra control rendered in the header row, between the title block and
  // the close button — e.g. the "Upload AutoCheck" button in Add vehicle.
  headerExtra?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay
        className="fixed inset-0 z-40 bg-black/30 data-[state=open]:animate-[dialog-overlay-in_180ms_ease-out] data-[state=closed]:animate-[dialog-overlay-out_150ms_ease-in]"
      />
      {/* Centers via flexbox, not a `translate(-50%,-50%)` transform — a
          transform-based center fights with the enter/exit animation below
          (which also animates `transform`, for the scale effect), and the
          two computing at different times is what caused the dialog to
          flash in the wrong spot before snapping to center. Flexbox
          centering is pure layout, so it can't do that. */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <RadixDialog.Content
          className={cn(
            "max-h-[85vh] w-[92vw] max-w-2xl overflow-y-auto rounded-[var(--radius-card)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)] outline-none",
            "data-[state=open]:animate-[dialog-content-in_200ms_cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-[dialog-content-out_150ms_ease-in]",
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <RadixDialog.Title className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">{title}</RadixDialog.Title>
              {subtitle && <RadixDialog.Description className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">{subtitle}</RadixDialog.Description>}
            </div>
            <div className="flex flex-none items-center gap-2">
              {headerExtra}
              <RadixDialog.Close
                className="relative flex-none rounded-full p-1.5 text-[var(--color-text-muted)] transition-colors after:absolute after:-inset-3 after:content-[''] hover:bg-[var(--color-fill-subtle)] active:bg-[var(--color-fill-subtle)] active:scale-90"
                aria-label="Close"
              >
                <X size={18} />
              </RadixDialog.Close>
            </div>
          </div>
          {children}
        </RadixDialog.Content>
      </div>
    </RadixDialog.Portal>
  );
}
