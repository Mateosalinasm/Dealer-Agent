"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Next.js's error.tsx boundary — without one here, any uncaught error in
// this route (a failed upload, a bad query) took down the whole page with
// Vercel's generic "This page couldn't load" screen and no way back except
// closing the tab. This keeps the app shell up and gives a way out. The
// digest is Vercel's own error-log correlation id, not the real message —
// production strips the actual error text before it reaches the client, by
// design, so cross-reference it in Vercel's Runtime Logs for the real cause.
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] bg-[var(--color-surface)] p-8 text-center">
      <TriangleAlert size={28} className="text-[var(--color-negative-text)]" />
      <div className="text-[15px] font-semibold text-[var(--color-text)]">Something went wrong loading this page</div>
      <p className="max-w-md text-[12.5px] text-[var(--color-text-muted)]">
        This didn&apos;t affect anything you&apos;ve already saved. Try again, or head back to the deals board.
      </p>
      {error.digest && <p className="text-[10.5px] text-[var(--color-text-placeholder)]">Error ref: {error.digest}</p>}
      <div className="mt-1 flex gap-2">
        <Button type="button" variant="secondary" onClick={() => reset()}>
          Try again
        </Button>
        <Link href="/desk/deals">
          <Button type="button">Back to deals</Button>
        </Link>
      </div>
    </div>
  );
}
