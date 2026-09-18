"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mapHeaders, parseCsv } from "@/lib/csv";
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
  { key: "miles", label: "Miles" },
  { key: "askingPriceDollars", label: "Asking price" },
  { key: "acquiredOn", label: "In stock since" },
];

export function InventoryImport() {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  async function handleFile(file: File) {
    setResult(null);
    const text = await file.text();
    const { headers, rows, errors } = parseCsv(text);
    setParseErrors(errors);

    const fieldIndex = mapHeaders(headers);
    const optionalFields = new Set(["trim", "stockNumber", "vin"]);
    const missing = FIELDS.filter((f) => !optionalFields.has(f.key) && fieldIndex[f.key] === undefined);
    if (missing.length) {
      setParseErrors((prev) => [
        ...prev,
        `Couldn't find a column for: ${missing.map((m) => m.label).join(", ")}. Those fields will be blank — fix in the review table below or re-export with clearer headers.`,
      ]);
    }

    const nextDraft: DraftRow[] = rows.map((r, i) => ({
      _key: `${i}-${Date.now()}`,
      stockNumber: fieldIndex.stockNumber != null ? r[fieldIndex.stockNumber] : "",
      vin: fieldIndex.vin != null ? r[fieldIndex.vin] : "",
      year: fieldIndex.year != null ? r[fieldIndex.year] : "",
      make: fieldIndex.make != null ? r[fieldIndex.make] : "",
      model: fieldIndex.model != null ? r[fieldIndex.model] : "",
      trim: fieldIndex.trim != null ? r[fieldIndex.trim] : "",
      color: fieldIndex.color != null ? r[fieldIndex.color] : "",
      miles: fieldIndex.miles != null ? r[fieldIndex.miles].replace(/[^0-9.]/g, "") : "",
      askingPriceDollars:
        fieldIndex.askingPriceDollars != null
          ? r[fieldIndex.askingPriceDollars].replace(/[^0-9.]/g, "")
          : "",
      acquiredOn: fieldIndex.acquiredOn != null ? r[fieldIndex.acquiredOn] : "",
    }));
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
      const { stockNumber, vin, year, make, model, trim, color, miles, askingPriceDollars, acquiredOn } = row;
      return { stockNumber, vin, year, make, model, trim, color, miles, askingPriceDollars, acquiredOn };
    });
    const res = await importVehicles(rows);
    setImporting(false);
    setResult(res);
    if (res.errors.length === 0) {
      setDraft(null);
      router.refresh();
    }
  }

  return (
    <Card>
      <div className="mb-3 text-[13.5px] font-semibold text-[var(--color-text)]">
        Import a stock list
      </div>
      <p className="mb-3 text-[12px] text-[var(--color-text-muted)]">
        Upload a CSV with your current inventory. Columns are matched by name (stock #, year, make,
        model, trim, color, miles, price, in stock since) — review and fix anything below before
        committing. Nothing is saved until you click Import.
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

      {result && result.errors.length > 0 && (
        <div className="mb-3 rounded-[var(--radius-panel)] bg-[var(--color-negative-bg)] p-3 text-[11.5px] text-[var(--color-negative-text)]">
          <div className="font-semibold">{result.imported} row(s) imported. These failed:</div>
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
    </Card>
  );
}
