"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mapHeaders, parseCsv, parseVehicleInfo } from "@/lib/csv";
import { importVehicles } from "@/app/inventory/actions";
import type { VehicleImportRowInput } from "@/lib/validation";

type DraftRow = VehicleImportRowInput & { _key: string };

const FIELDS: Array<{ key: keyof VehicleImportRowInput; label: string }> = [
  { key: "stockNumber", label: "Stock #" },
  { key: "vin", label: "VIN" },
  { key: "year", label: "Year" },
  { key: "make", label: "Make" },
  { key: "model", label: "Model" },
  { key: "trim", label: "Trim" },
  { key: "color", label: "Color" },
  { key: "bodyType", label: "Body type" },
  { key: "miles", label: "Miles" },
  { key: "askingPriceDollars", label: "Asking price" },
  { key: "costDollars", label: "Cost" },
  { key: "acquiredOn", label: "In stock since" },
];

export function InventoryImport() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; updated: number; markedSold: number; errors: string[] } | null>(null);

  async function handleFile(file: File) {
    setResult(null);
    const text = await file.text();
    const { headers, rows, errors } = parseCsv(text);
    setParseErrors(errors);

    const fieldIndex = mapHeaders(headers);
    const optionalFields = new Set(["trim", "stockNumber", "vin", "bodyType", "costDollars"]);
    if (fieldIndex.vehicleInfo != null) {
      // A combined "vehicle info" column stands in for year/make/model —
      // don't warn about those being unmapped when it's present.
      optionalFields.add("year");
      optionalFields.add("make");
      optionalFields.add("model");
    }
    if (fieldIndex.daysInStock != null) optionalFields.add("acquiredOn");
    const missing = FIELDS.filter((f) => !optionalFields.has(f.key) && fieldIndex[f.key] === undefined);
    if (missing.length) {
      setParseErrors((prev) => [
        ...prev,
        `Couldn't find a column for: ${missing.map((m) => m.label).join(", ")}. Those fields will be blank — fix in the review table below or re-export with clearer headers.`,
      ]);
    }

    // "In stock since" derived from a days-in-stock count, when that's what
    // the file has instead of a literal date — today's date, in the browser's
    // local timezone, minus that many days.
    function acquiredOnFromDaysInStock(raw: string): string {
      const days = Number(raw.replace(/[^0-9.]/g, ""));
      if (!raw || Number.isNaN(days)) return "";
      const d = new Date();
      d.setDate(d.getDate() - Math.round(days));
      return d.toISOString().slice(0, 10);
    }

    const nextDraft: DraftRow[] = rows.map((r, i) => {
      // Only a fallback for whichever of year/make/model has no dedicated
      // column of its own — a file with real Year/Make/Model columns keeps
      // using those even if it also happens to carry a description column.
      const info = fieldIndex.vehicleInfo != null ? parseVehicleInfo(r[fieldIndex.vehicleInfo]) : {};
      const yearCell = fieldIndex.year != null ? r[fieldIndex.year] : "";
      const makeCell = fieldIndex.make != null ? r[fieldIndex.make] : "";
      const modelCell = fieldIndex.model != null ? r[fieldIndex.model] : "";
      return {
        _key: `${i}-${Date.now()}`,
        stockNumber: fieldIndex.stockNumber != null ? r[fieldIndex.stockNumber] : "",
        vin: fieldIndex.vin != null ? r[fieldIndex.vin] : "",
        year: yearCell || (info.year != null ? String(info.year) : ""),
        make: makeCell || info.make || "",
        model: modelCell || info.model || "",
        trim: fieldIndex.trim != null ? r[fieldIndex.trim] : "",
        color: fieldIndex.color != null ? r[fieldIndex.color] : "",
        bodyType: fieldIndex.bodyType != null ? r[fieldIndex.bodyType] : "",
        miles: fieldIndex.miles != null ? r[fieldIndex.miles].replace(/[^0-9.]/g, "") : "",
        askingPriceDollars:
          fieldIndex.askingPriceDollars != null
            ? r[fieldIndex.askingPriceDollars].replace(/[^0-9.]/g, "")
            : "",
        costDollars: fieldIndex.costDollars != null ? r[fieldIndex.costDollars].replace(/[^0-9.]/g, "") : "",
        acquiredOn:
          fieldIndex.daysInStock != null
            ? acquiredOnFromDaysInStock(r[fieldIndex.daysInStock])
            : fieldIndex.acquiredOn != null
              ? r[fieldIndex.acquiredOn]
              : "",
      };
    });
    setDraft(nextDraft);
  }

  function updateCell(key: string, field: keyof VehicleImportRowInput, value: string) {
    setDraft((prev) =>
      prev ? prev.map((row) => (row._key === key ? { ...row, [field]: value } : row)) : prev,
    );
  }

  async function commit() {
    if (!draft) return;
    setImporting(true);
    const rows = draft.map((row): VehicleImportRowInput => {
      const { stockNumber, vin, year, make, model, trim, color, bodyType, miles, askingPriceDollars, costDollars, acquiredOn } = row;
      return { stockNumber, vin, year, make, model, trim, color, bodyType, miles, askingPriceDollars, costDollars, acquiredOn };
    });
    const res = await importVehicles(rows);
    setImporting(false);
    setResult(res);
    if (res.errors.length === 0) {
      setDraft(null);
      router.refresh();
      setOpen(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Closed without a clean commit — don't leave a stale review table
      // showing next time this opens.
      setDraft(null);
      setParseErrors([]);
      setResult(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">Import stock list</Button>
      </DialogTrigger>
      <DialogContent title="Import a stock list" className="max-w-4xl">
        <p className="mb-3 text-[12px] text-[var(--color-text-muted)]">
          Upload a CSV with your current inventory. Columns are matched by name (stock #, year, make,
          model, trim, color, body type, miles, price, cost, in stock since) — review and fix anything
          below before committing. Nothing is saved until you click Import.
        </p>
        <p className="mb-3 text-[12px] text-[var(--color-text-muted)]">
          Matched by VIN (or stock # if no VIN) against what&rsquo;s already in stock: a match updates
          whatever changed — miles, cost, price, etc. — without touching its photos or anything else on
          file. A vehicle that&rsquo;s currently in stock but missing from this list is assumed sold.
          Anything that doesn&rsquo;t match is added as new.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="mb-3 block text-[12.5px] text-[var(--color-text-muted)] file:mr-3 file:rounded-[var(--radius-pill)] file:border-0 file:bg-[var(--color-fill-subtle)] file:px-3 file:py-1.5 file:text-[12px] file:font-semibold"
        />

        {parseErrors.length > 0 && (
          <div className="mb-3 rounded-[var(--radius-panel)] bg-[var(--color-caution-bg)] p-3 text-[11.5px] text-[var(--color-caution-text)]">
            {parseErrors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        )}

        {result && result.errors.length === 0 && (
          <div className="mb-3 rounded-[var(--radius-panel)] bg-[var(--color-positive-bg)] p-3 text-[11.5px] text-[var(--color-positive-text)]">
            {result.imported} new · {result.updated} updated · {result.markedSold} marked sold
          </div>
        )}

        {result && result.errors.length > 0 && (
          <div className="mb-3 rounded-[var(--radius-panel)] bg-[var(--color-negative-bg)] p-3 text-[11.5px] text-[var(--color-negative-text)]">
            <div className="font-semibold">
              {result.imported} new · {result.updated} updated · {result.markedSold} marked sold. These rows failed:
            </div>
            {result.errors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        )}

        {draft && draft.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-[var(--color-header-rule)] text-left text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  {FIELDS.map((f) => (
                    <th key={f.key} className="px-2 py-2">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.map((row) => (
                  <tr key={row._key} className="border-b border-[var(--color-hairline)]">
                    {FIELDS.map((f) => (
                      <td key={f.key} className="px-2 py-1.5">
                        <Input
                          value={row[f.key] ?? ""}
                          onChange={(e) => updateCell(row._key, f.key, e.target.value)}
                          className="min-w-[90px] px-2 py-1"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[12px] text-[var(--color-text-muted)]">{draft.length} row(s) ready</span>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
                  Discard
                </Button>
                <Button type="button" onClick={commit} disabled={importing}>
                  {importing ? "Importing…" : `Import ${draft.length} vehicle${draft.length === 1 ? "" : "s"}`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
