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
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
      <RadixDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-card)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)] outline-none",
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
            <RadixDialog.Close className="flex-none rounded-full p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-fill-subtle)]" aria-label="Close">
              <X size={18} />
            </RadixDialog.Close>
          </div>
        </div>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
