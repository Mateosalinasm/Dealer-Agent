import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createDeal } from "@/app/desk/deals/actions";

export async function NewDealView() {
  const unsoldVehicles = await db
    .select()
    .from(schema.vehicles)
    .where(eq(schema.vehicles.sold, false));

  return (
    <div>
      <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">New deal</h1>
      <Card className="mt-5">
        <form action={createDeal} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="customerName">Customer name</Label>
            <Input id="customerName" name="customerName" required placeholder="Jane Rodriguez" />
          </div>
          <div>
            <Label htmlFor="vehicleId">Vehicle (optional)</Label>
            <Select id="vehicleId" name="vehicleId" defaultValue="">
              <option value="">No vehicle yet</option>
              {unsoldVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.year} {v.make} {v.model} {v.trim ?? ""} {v.stockNumber ? `· #${v.stockNumber}` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" rows={3} placeholder="How they found us, what they want, etc." />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="submit">Create deal</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
