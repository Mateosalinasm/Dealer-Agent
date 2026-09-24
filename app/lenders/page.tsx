import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LenderCard } from "@/components/lender-card";
import { createLender } from "@/app/lenders/actions";

export const dynamic = "force-dynamic";

export default async function LendersPage() {
  const [lenders, programs, guidelinesDocs] = await Promise.all([
    db.select().from(schema.lenders),
    db.select().from(schema.lenderPrograms),
    db.select().from(schema.documents).where(eq(schema.documents.category, "lender_guidelines")),
  ]);

  const programsByLender = new Map<string, typeof programs>();
  for (const p of programs) {
    const list = programsByLender.get(p.lenderId) ?? [];
    list.push(p);
    programsByLender.set(p.lenderId, list);
  }

  const guidelinesByLender = new Map<string, typeof guidelinesDocs>();
  for (const d of guidelinesDocs) {
    if (!d.lenderId) continue;
    const list = guidelinesByLender.get(d.lenderId) ?? [];
    list.push(d);
    guidelinesByLender.set(d.lenderId, list);
  }

  return (
    <div>
      <h1 className="mb-5 text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">Lenders</h1>

      <Card className="mb-4 max-w-3xl">
        <div className="mb-2 text-[13.5px] font-semibold text-[var(--color-text)]">Add a lender</div>
        <form action={createLender} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Veros" />
            </div>
            <div>
              <Label htmlFor="contact">Contact (optional)</Label>
              <Input id="contact" name="contact" placeholder="Rep name" />
            </div>
            <div>
              <Label htmlFor="repPhone">Rep phone (optional)</Label>
              <Input id="repPhone" name="repPhone" type="tel" placeholder="(555) 555-0123" />
            </div>
            <div>
              <Label htmlFor="address">Address (optional)</Label>
              <Input id="address" name="address" placeholder="For insurance lienholder matching" />
            </div>
            <div>
              <Label htmlFor="maxDeductibleDollars">Max insurance deductible ($)</Label>
              <Input id="maxDeductibleDollars" name="maxDeductibleDollars" type="number" step="1" min={0} defaultValue={1000} />
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          <Button type="submit" className="self-end">
            Add lender
          </Button>
        </form>
      </Card>

      {lenders.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-8 text-center">
          <div className="text-[15px] font-semibold text-[var(--color-text)]">No lenders yet</div>
          <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">Add one above to start matching deals.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lenders.map((lender) => (
            <LenderCard
              key={lender.id}
              lender={lender}
              programs={programsByLender.get(lender.id) ?? []}
              guidelinesDocs={guidelinesByLender.get(lender.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
