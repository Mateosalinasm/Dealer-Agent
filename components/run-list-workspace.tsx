"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { formatCents } from "@/lib/utils";
import { parseRunList, type RunListRow } from "@/lib/run-list-parse";
import { countLeadsWanting, countOnLot, type LeadWant, type StockUnit } from "@/lib/run-list-match";
import { bidPlan, compStats, HOUSE_FEES, type Comp, type House } from "@/schema-sketch/bid-math";
import { addToWatchList } from "@/app/sourcing/run-list/actions";

const TITLE_OPTIONS = ["clean", "salvage", "rebuilt", "flood", "lemon", "branded"] as const;

interface DraftRow extends RunListRow {
  _key: string;
  title: string;
  retailDollars: string;
  wholesaleDollars: string;
  reconDollars: string;
  watched: boolean;
}

interface RunListWorkspaceProps {
  targetGross: number;
  holdingCost: number;
  turnDays: number;
  holdingPerDay: number;
  leads: LeadWant[];
  vehicles: StockUnit[];
  comps: Comp[];
}

function toDraftRow(row: RunListRow, i: number): DraftRow {
  return {
    ...row,
    _key: `${i}-${Date.now()}`,
    title: "clean",
    retailDollars: "",
    wholesaleDollars: "",
    reconDollars: "0",
    watched: false,
  };
}

export function RunListWorkspace({ targetGross, holdingCost, turnDays, holdingPerDay, leads, vehicles, comps }: RunListWorkspaceProps) {
  const [house, setHouse] = useState<House>("manheim");
  const [pasteText, setPasteText] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [rows, setRows] = useState<DraftRow[] | null>(null);

  function handleParse() {
    const { rows: parsed, errors } = parseRunList(pasteText);
    setParseErrors(errors);
    setRows(parsed.map(toDraftRow));
  }

  function updateCell(key: string, field: keyof DraftRow, value: string) {
    setRows((prev) => (prev ? prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)) : prev));
  }

  const scored = useMemo(() => {
    if (!rows) return [];
    return rows.map((row) => {
      const retail = row.retailDollars ? Math.round(Number(row.retailDollars) * 100) : 0;
      const wholesale = row.wholesaleDollars ? Math.round(Number(row.wholesaleDollars) * 100) : null;
      const recon = row.reconDollars ? Math.round(Number(row.reconDollars) * 100) : 0;
      const plan = retail > 0 ? bidPlan({ house, retail, targetGross, recon, holdingCost }) : null;
      const headroom = plan && wholesale != null ? plan.maxBid - wholesale : null;
      const leadsWant = countLeadsWanting(row.make, row.model, leads);
      const onLot = countOnLot(row.make, row.model, vehicles);
      const stats = compStats(comps, row.make, row.model);
      return { row, plan, headroom, leadsWant, onLot, stats };
    });
  }, [rows, house, targetGross, holdingCost, leads, vehicles, comps]);

  const sorted = useMemo(() => {
    return [...scored].sort((a, b) => {
      if (a.leadsWant !== b.leadsWant) return b.leadsWant - a.leadsWant;
      const ah = a.headroom ?? -Infinity;
      const bh = b.headroom ?? -Infinity;
      return bh - ah;
    });
  }, [scored]);

  async function handleWatch(key: string) {
    const entry = scored.find((s) => s.row._key === key);
    if (!entry) return;
    await addToWatchList({
      house,
      runNumber: entry.row.runNumber,
      year: entry.row.year,
      make: entry.row.make,
      model: entry.row.model,
      trim: entry.row.trim,
      miles: entry.row.miles,
      vin: entry.row.vin,
      title: entry.row.title as (typeof TITLE_OPTIONS)[number],
      retailDollars: entry.row.retailDollars,
      wholesaleDollars: entry.row.wholesaleDollars,
      reconDollars: entry.row.reconDollars,
      announcements: entry.row.announcements,
    });
    setRows((prev) => (prev ? prev.map((r) => (r._key === key ? { ...r, watched: true } : r)) : prev));
  }

  return (
    <div>
      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
          <div>
            <Label htmlFor="house">Auction house</Label>
            <Select id="house" value={house} onChange={(e) => setHouse(e.target.value as House)}>
              {Object.entries(HOUSE_FEES).map(([value, cfg]) => (
                <option key={value} value={value}>
                  {cfg.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="paste">Paste the run list</Label>
            <Textarea
              id="paste"
              rows={6}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste straight from the auction site or a spreadsheet — tab or comma separated, first row headers."
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button type="button" onClick={handleParse} disabled={!pasteText.trim()}>
            Parse
          </Button>
        </div>
      </Card>

      {parseErrors.length > 0 && (
        <div className="mt-3 rounded-[var(--radius-panel)] bg-[var(--color-caution-bg)] p-3 text-[11.5px] text-[var(--color-caution-text)]">
          {parseErrors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}

      {rows && (
        <Card className="mt-3">
          <div className="mb-3 text-[12px] text-[var(--color-text-muted)]">
            {rows.length} unit{rows.length === 1 ? "" : "s"} read · {formatCents(targetGross)} target gross ·{" "}
            {formatCents(holdingPerDay)}/day holding ({turnDays}d assumed) · {HOUSE_FEES[house].label} fee (
            {formatCents(HOUSE_FEES[house].flat)} + {HOUSE_FEES[house].pct}%)
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-[var(--color-header-rule)] text-left text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  <th className="px-2 py-2">Run</th>
                  <th className="px-2 py-2">Unit</th>
                  <th className="px-2 py-2">Miles</th>
                  <th className="px-2 py-2">Title</th>
                  <th className="px-2 py-2">Retail</th>
                  <th className="px-2 py-2">Wholesale</th>
                  <th className="px-2 py-2">Recon</th>
                  <th className="px-2 py-2">Max bid</th>
                  <th className="px-2 py-2">Headroom</th>
                  <th className="px-2 py-2">Signal</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ row, plan, headroom, leadsWant, onLot, stats }) => (
                  <tr key={row._key} className="border-b border-[var(--color-hairline)] align-top">
                    <td className="px-2 py-2">
                      <Input
                        value={row.runNumber}
                        onChange={(e) => updateCell(row._key, "runNumber", e.target.value)}
                        className="w-16 px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        <Input value={row.year} onChange={(e) => updateCell(row._key, "year", e.target.value)} className="w-16 px-2 py-1" placeholder="Yr" />
                        <Input value={row.make} onChange={(e) => updateCell(row._key, "make", e.target.value)} className="w-24 px-2 py-1" placeholder="Make" />
                        <Input value={row.model} onChange={(e) => updateCell(row._key, "model", e.target.value)} className="w-28 px-2 py-1" placeholder="Model" />
                        <Input value={row.trim} onChange={(e) => updateCell(row._key, "trim", e.target.value)} className="w-20 px-2 py-1" placeholder="Trim" />
                      </div>
                      {row.announcements && (
                        <div className="mt-1 text-[10.5px] text-[var(--color-caution-text)]">{row.announcements}</div>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Input value={row.miles} onChange={(e) => updateCell(row._key, "miles", e.target.value)} className="w-20 px-2 py-1" />
                    </td>
                    <td className="px-2 py-2">
                      <Select
                        value={row.title}
                        onChange={(e) => updateCell(row._key, "title", e.target.value)}
                        className="w-28 px-2 py-1"
                      >
                        {TITLE_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={row.retailDollars}
                        onChange={(e) => updateCell(row._key, "retailDollars", e.target.value)}
                        className="w-24 px-2 py-1"
                        placeholder="$"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={row.wholesaleDollars}
                        onChange={(e) => updateCell(row._key, "wholesaleDollars", e.target.value)}
                        className="w-24 px-2 py-1"
                        placeholder="$"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={row.reconDollars}
                        onChange={(e) => updateCell(row._key, "reconDollars", e.target.value)}
                        className="w-20 px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {plan ? (
                        <span className={plan.maxBid > 0 ? "font-semibold text-[var(--color-positive)]" : "font-semibold text-[var(--color-negative)]"}>
                          {formatCents(plan.maxBid)}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-placeholder)]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {headroom != null ? (
                        <span className={headroom >= 0 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}>
                          {formatCents(headroom)}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-placeholder)]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-1">
                        {leadsWant > 0 && <Badge tone="positive">{leadsWant} lead{leadsWant === 1 ? "" : "s"} want this</Badge>}
                        {onLot > 0 && <Badge tone="caution">{onLot} already on the lot</Badge>}
                        {stats && plan && (
                          <Badge tone={stats.avg <= plan.maxBid ? "positive" : "negative"}>
                            {stats.n} seen · avg {formatCents(stats.avg)}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        variant={row.watched ? "secondary" : "primary"}
                        className="px-2 py-1 text-[11px]"
                        disabled={row.watched || !row.make || !row.model}
                        onClick={() => handleWatch(row._key)}
                      >
                        {row.watched ? "Watching" : "Watch"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
