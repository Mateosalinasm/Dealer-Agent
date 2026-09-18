import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { StipChecklist } from "@/components/stip-checklist";
import { DocumentRow } from "@/components/document-row";
import { LenderMatchCard } from "@/components/lender-match-card";
import { formatCents } from "@/lib/utils";
import { getUnderwritingSnapshot } from "@/lib/deal-underwriting";
import { setDealFunded, updateDealInfo, uploadDocument } from "@/app/desk/deals/actions";
import type { ProgramForMatch, TitleStatus } from "@/lib/lender-match";

const CATEGORY_LABEL: Record<string, string> = {
  turbopass: "TurboPass",
  bank_statement: "Bank statement",
  credit_report: "Credit report",
  credit_app: "Credit app",
  insurance: "Insurance",
  other: "Other",
};

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, id)).limit(1);
  if (!deal) notFound();

  const [vehicle, lenders, programs, documents, stockVehicles, snapshot] = await Promise.all([
    deal.vehicleId
      ? db.select().from(schema.vehicles).where(eq(schema.vehicles.id, deal.vehicleId)).then((r) => r[0])
      : Promise.resolve(null),
    db.select().from(schema.lenders).where(eq(schema.lenders.active, true)),
    db.select().from(schema.lenderPrograms),
    db.select().from(schema.documents).where(eq(schema.documents.dealId, id)),
    db.select().from(schema.vehicles).where(eq(schema.vehicles.sold, false)),
    getUnderwritingSnapshot(id),
  ]);

  const lenderNameById = new Map(lenders.map((l) => [l.id, l.name]));
  const matchPrograms: ProgramForMatch[] = programs
    .filter((p) => lenderNameById.has(p.lenderId))
    .map((p) => ({
      lenderId: p.lenderId,
      lenderName: lenderNameById.get(p.lenderId)!,
      programId: p.id,
      programLabel: p.label,
      advancePct: p.advancePct,
      maxLtvPct: p.maxLtvPct,
      maxTermMonths: p.maxTermMonths,
      maxMiles: p.maxMiles,
      maxAgeYears: p.maxAgeYears,
      allowedTitles: p.allowedTitles as TitleStatus[] | null,
      minCreditScore: p.minCreditScore,
      maxPtiPct: p.maxPtiPct,
      typicalAprBps: p.typicalAprBps,
    }));

  const matchVehicles = (vehicle && !stockVehicles.some((v) => v.id === vehicle.id) ? [vehicle, ...stockVehicles] : stockVehicles).map(
    (v) => ({
      id: v.id,
      year: v.year,
      make: v.make,
      model: v.model,
      trim: v.trim,
      askingPrice: v.askingPrice,
      bookValue: v.bookValue,
      miles: v.miles,
      title: v.title as TitleStatus,
    }),
  );

  const openStips = deal.stips.filter((s) => !s.done).length;
  const boundUpdateDealInfo = updateDealInfo.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">
            {deal.customerName}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-[12.5px] text-[var(--color-text-muted)]">
            {vehicle ? (
              <span>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </span>
            ) : (
              <span>No vehicle attached</span>
            )}
            <span>· {openStips} stip{openStips === 1 ? "" : "s"} open</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={deal.funded ? "positive" : "neutral"}>{deal.funded ? "Funded" : "Open"}</Badge>
          <form action={setDealFunded.bind(null, id, !deal.funded)}>
            <Button type="submit" variant="secondary">
              {deal.funded ? "Mark unfunded" : "Mark funded"}
            </Button>
          </form>
          <Link href={`/desk/appointments?dealId=${id}&customerName=${encodeURIComponent(deal.customerName ?? "")}`}>
            <Button type="button" variant="secondary">
              Schedule appointment
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <div className="mb-3 text-[13.5px] font-semibold text-[var(--color-text)]">Stips</div>
          <StipChecklist dealId={id} stips={deal.stips} />
        </Card>

        <Card>
          <div className="mb-3 text-[13.5px] font-semibold text-[var(--color-text)]">Deal info</div>
          <form action={boundUpdateDealInfo} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="lenderId">Lender</Label>
              <Select id="lenderId" name="lenderId" defaultValue={deal.lenderId ?? ""}>
                <option value="">Not submitted</option>
                {lenders.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="programId">Program</Label>
              <Select id="programId" name="programId" defaultValue={deal.programId ?? ""}>
                <option value="">—</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="salePriceDollars">Sale price</Label>
                <Input
                  id="salePriceDollars"
                  name="salePriceDollars"
                  type="number"
                  step="0.01"
                  defaultValue={deal.salePrice != null ? deal.salePrice / 100 : ""}
                />
              </div>
              <div>
                <Label htmlFor="cashDownDollars">Cash down</Label>
                <Input
                  id="cashDownDollars"
                  name="cashDownDollars"
                  type="number"
                  step="0.01"
                  defaultValue={deal.cashDown != null ? deal.cashDown / 100 : ""}
                />
              </div>
              <div>
                <Label htmlFor="termMonths">Term (months)</Label>
                <Input id="termMonths" name="termMonths" type="number" defaultValue={deal.termMonths ?? ""} />
              </div>
              <div>
                <Label htmlFor="aprPct">APR %</Label>
                <Input
                  id="aprPct"
                  name="aprPct"
                  type="number"
                  step="0.01"
                  defaultValue={deal.apr != null ? deal.apr / 100 : ""}
                />
              </div>
              <div>
                <Label htmlFor="backEndGrossDollars">Back-end gross</Label>
                <Input
                  id="backEndGrossDollars"
                  name="backEndGrossDollars"
                  type="number"
                  step="0.01"
                  defaultValue={deal.backEndGross ? deal.backEndGross / 100 : ""}
                />
              </div>
            </div>
            <Button type="submit" className="mt-1 self-end">
              Save
            </Button>
          </form>
        </Card>
      </div>

      <div className="mt-4">
        <LenderMatchCard
          vehicles={matchVehicles}
          initialVehicleId={deal.vehicleId}
          programs={matchPrograms}
          snapshot={snapshot}
        />
      </div>

      <Card className="mt-4">
        <div className="mb-3 text-[13.5px] font-semibold text-[var(--color-text)]">Documents</div>
        <form action={uploadDocument.bind(null, id)} className="mb-4 flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Label htmlFor="category">Type</Label>
            <Select id="category" name="category" defaultValue="credit_app">
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <Label htmlFor="file">File</Label>
            <input
              id="file"
              name="file"
              type="file"
              required
              className="block w-full text-[12.5px] text-[var(--color-text-muted)] file:mr-3 file:rounded-[var(--radius-pill)] file:border-0 file:bg-[var(--color-fill-subtle)] file:px-3 file:py-1.5 file:text-[12px] file:font-semibold"
            />
          </div>
          <Button type="submit" variant="secondary">
            Upload
          </Button>
        </form>

        {documents.length === 0 ? (
          <p className="text-[12.5px] text-[var(--color-text-muted)]">No documents uploaded yet.</p>
        ) : (
          <div className="flex flex-col">
            {documents.map((docRow) => (
              <DocumentRow key={docRow.id} document={{ ...docRow, dealId: id }} />
            ))}
          </div>
        )}
      </Card>

      {deal.notes && (
        <Card className="mt-4">
          <div className="mb-2 text-[13.5px] font-semibold text-[var(--color-text)]">Notes</div>
          <p className="text-[12.5px] text-[var(--color-text-muted)]">{deal.notes}</p>
        </Card>
      )}

      {deal.salePrice != null && (
        <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">
          Sale price {formatCents(deal.salePrice)}
        </p>
      )}
    </div>
  );
}
