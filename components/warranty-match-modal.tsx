"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/utils";
import {
  matchWarrantyProducts,
  type DealForWarrantyMatch,
  type VehicleForWarrantyMatch,
  type WarrantyMatchResult,
  type WarrantyProductForMatch,
} from "@/lib/warranty-match";

const TYPE_LABEL: Record<string, string> = {
  vsc: "Vehicle service contract",
  gap: "GAP",
  tire_wheel: "Tire & wheel",
  key_replacement: "Key replacement",
  maintenance: "Maintenance plan",
  other: "Other",
};

function ProductRow({ result }: { result: WarrantyMatchResult }) {
  const [open, setOpen] = useState(false);
  const hasDetail = result.exclusionReasons.length > 0 || result.cautions.length > 0 || result.recommendReason;

  return (
    <div className="rounded-[var(--radius-panel)] border border-[var(--color-hairline)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2 w-2 flex-none rounded-full"
            style={{ background: `var(--color-${result.eligible ? (result.recommended ? "positive" : "text-muted") : "negative"})` }}
          />
          <span className="truncate text-[13.5px] font-semibold text-[var(--color-text)]">{result.name}</span>
          <span className="flex-none text-[11px] text-[var(--color-text-muted)]">{result.provider}</span>
          <Badge tone="neutral">{TYPE_LABEL[result.productType] ?? result.productType}</Badge>
          {result.recommended && <Badge tone="positive">Recommended</Badge>}
          {!result.eligible && <Badge tone="negative">Not eligible</Badge>}
        </div>
        <div className="flex flex-none items-center gap-2">
          <span className="text-[12px] font-semibold tabular-nums text-[var(--color-text)]">{formatCents(result.priceCents)}</span>
          {hasDetail && (
            <button type="button" className="text-[12px] font-semibold text-[var(--color-primary)] hover:underline" onClick={() => setOpen((v) => !v)}>
              {open ? "Hide" : "Why?"}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-2.5 flex flex-col gap-1.5 border-t border-[var(--color-hairline)] pt-2.5 text-[11.5px]">
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[var(--color-text-muted)]">
            <span>Cost {formatCents(result.costCents)}</span>
            <span>Margin {formatCents(result.marginCents)}</span>
          </div>
          {result.exclusionReasons.length > 0 && (
            <ul className="list-inside list-disc text-[var(--color-negative-text)]">
              {result.exclusionReasons.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
          {result.recommendReason && <p className="italic text-[var(--color-text)]">{result.recommendReason}</p>}
          {result.cautions.length > 0 && (
            <ul className="list-inside list-disc text-[var(--color-text-muted)]">
              {result.cautions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export interface WarrantyMatchModalProps {
  customerName: string;
  vehicle: VehicleForWarrantyMatch;
  deal: DealForWarrantyMatch;
  products: WarrantyProductForMatch[];
}

export function WarrantyMatchModal({ customerName, vehicle, deal, products }: WarrantyMatchModalProps) {
  const results = useMemo(() => matchWarrantyProducts(vehicle, deal, products), [vehicle, deal, products]);
  const recommended = results.filter((r) => r.eligible && r.recommended);
  const other = results.filter((r) => !(r.eligible && r.recommended));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">
          Warranty & F&I match
        </Button>
      </DialogTrigger>
      <DialogContent title={customerName} subtitle="Warranty & F&I match" className="max-w-2xl">
        {products.length === 0 ? (
          <p className="py-4 text-[12.5px] text-[var(--color-text-muted)]">
            No products in the catalog yet — add some on the Warranty & F&I products page.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {recommended.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  Recommended for this deal
                </div>
                <div className="flex flex-col gap-2">
                  {recommended.map((r) => (
                    <ProductRow key={r.id} result={r} />
                  ))}
                </div>
              </div>
            )}
            {other.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  Rest of the catalog
                </div>
                <div className="flex flex-col gap-2">
                  {other.map((r) => (
                    <ProductRow key={r.id} result={r} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
