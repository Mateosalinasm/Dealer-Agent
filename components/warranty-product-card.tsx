"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/utils";
import { WarrantyProductForm } from "@/components/warranty-product-form";
import { deleteWarrantyProduct, setWarrantyProductActive, updateWarrantyProduct } from "@/app/warranty/actions";
import type { warrantyProductTypeValues } from "@/lib/validation";

type WarrantyProductType = (typeof warrantyProductTypeValues)[number];

const TYPE_LABEL: Record<string, string> = {
  vsc: "Vehicle service contract",
  gap: "GAP",
  tire_wheel: "Tire & wheel",
  key_replacement: "Key replacement",
  maintenance: "Maintenance plan",
  other: "Other",
};

export interface WarrantyProductRow {
  id: string;
  name: string;
  provider: string;
  productType: string;
  costCents: number;
  priceCents: number;
  termMonths: number | null;
  termMiles: number | null;
  deductibleCents: number | null;
  maxVehicleAgeYears: number | null;
  maxVehicleMiles: number | null;
  minSalePriceCents: number | null;
  maxSalePriceCents: number | null;
  active: boolean;
  notes: string | null;
}

export function WarrantyProductCard({ product }: { product: WarrantyProductRow }) {
  const [editing, setEditing] = useState(false);
  const margin = product.priceCents - product.costCents;

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold text-[var(--color-text)]">{product.name}</span>
            <Badge tone="neutral">{TYPE_LABEL[product.productType] ?? product.productType}</Badge>
            {!product.active && <Badge tone="neutral">Inactive</Badge>}
          </div>
          <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{product.provider}</div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-[var(--color-text-muted)]">
            <span>Cost {formatCents(product.costCents)}</span>
            <span>Sells {formatCents(product.priceCents)}</span>
            <span className="font-semibold text-[var(--color-positive-text)]">{formatCents(margin)} margin</span>
            {product.termMonths != null && <span>{product.termMonths}mo</span>}
            {product.termMiles != null && <span>+{product.termMiles.toLocaleString()} mi</span>}
            {product.deductibleCents != null && <span>{formatCents(product.deductibleCents)} deductible</span>}
            {product.maxVehicleAgeYears != null && <span>≤{product.maxVehicleAgeYears}yr</span>}
            {product.maxVehicleMiles != null && <span>≤{product.maxVehicleMiles.toLocaleString()} mi</span>}
          </div>
          {product.notes && <div className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">{product.notes}</div>}
        </div>
        <div className="flex flex-none items-center gap-2">
          <form action={setWarrantyProductActive.bind(null, product.id, !product.active)}>
            <Button type="submit" variant="secondary" className="px-2 py-1 text-[11px]">
              {product.active ? "Deactivate" : "Activate"}
            </Button>
          </form>
          <Button type="button" variant="secondary" className="px-2 py-1 text-[11px]" onClick={() => setEditing((v) => !v)}>
            {editing ? "Close" : "Edit"}
          </Button>
          <form action={deleteWarrantyProduct.bind(null, product.id)}>
            <Button type="submit" variant="destructive" className="px-2 py-1 text-[11px]">
              Delete
            </Button>
          </form>
        </div>
      </div>

      {editing && (
        <WarrantyProductForm
          action={async (fd) => {
            await updateWarrantyProduct(product.id, fd);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          initial={{
            name: product.name,
            provider: product.provider,
            productType: product.productType as WarrantyProductType,
            costDollars: product.costCents / 100,
            priceDollars: product.priceCents / 100,
            termMonths: product.termMonths,
            termMiles: product.termMiles,
            deductibleDollars: product.deductibleCents != null ? product.deductibleCents / 100 : null,
            maxVehicleAgeYears: product.maxVehicleAgeYears,
            maxVehicleMiles: product.maxVehicleMiles,
            minSalePriceDollars: product.minSalePriceCents != null ? product.minSalePriceCents / 100 : null,
            maxSalePriceDollars: product.maxSalePriceCents != null ? product.maxSalePriceCents / 100 : null,
            notes: product.notes,
          }}
        />
      )}
    </Card>
  );
}
