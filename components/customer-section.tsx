import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateCustomerFacts } from "@/app/desk/deals/actions";
import type { schema } from "@/lib/db";

type Deal = typeof schema.deals.$inferSelect;

interface VehicleOption {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
}

const dollarsOrEmpty = (cents: number | null) => (cents != null ? cents / 100 : "");
const vehicleLabel = (v: VehicleOption) => [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");

export function CustomerSection({
  dealId,
  deal,
  lenders,
  vehicles,
}: {
  dealId: string;
  deal: Deal;
  lenders: { id: string; name: string }[];
  vehicles: VehicleOption[];
}) {
  return (
    <form action={updateCustomerFacts.bind(null, dealId)} className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Label>Vehicle</Label>
        <Select name="vehicleId" defaultValue={deal.vehicleId ?? ""}>
          <option value="">Vehicle TBD</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {vehicleLabel(v)}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Bank</Label>
        <Select name="lenderId" defaultValue={deal.lenderId ?? ""}>
          <option value="">Not submitted</option>
          {lenders.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Lot</Label>
        <Input name="lot" defaultValue={deal.lot ?? ""} placeholder="Main lot" />
      </div>
      <div>
        <Label>Down payment</Label>
        <Input name="cashDownDollars" type="number" step="0.01" defaultValue={dollarsOrEmpty(deal.cashDown)} />
      </div>
      <div>
        <Label>Stated income / mo</Label>
        <Input name="statedIncomeDollars" type="number" step="0.01" defaultValue={dollarsOrEmpty(deal.statedIncome)} />
      </div>
      <div>
        <Label>Verified income / mo</Label>
        <Input name="verifiedIncomeDollars" type="number" step="0.01" defaultValue={dollarsOrEmpty(deal.verifiedIncome)} />
      </div>
      <div>
        <Label>Payment call / mo</Label>
        <Input name="paymentDollars" type="number" step="0.01" defaultValue={dollarsOrEmpty(deal.payment)} />
      </div>
      <div>
        <Label>Open auto payment / mo</Label>
        <Input name="openAutoPaymentDollars" type="number" step="0.01" defaultValue={dollarsOrEmpty(deal.openAutoPayment)} />
      </div>
      <div>
        <Label>ID type</Label>
        <Select name="idType" defaultValue={deal.idType ?? "US ID"}>
          <option value="US ID">US ID</option>
          <option value="ITIN">ITIN</option>
          <option value="Foreign passport">Foreign passport</option>
        </Select>
      </div>
      <div className="col-span-2">
        <Label>Address on the application</Label>
        <Input name="statedAddress" defaultValue={deal.statedAddress ?? ""} placeholder="123 Main Street" />
      </div>
      <Button type="submit" className="col-span-2 self-end">
        Save
      </Button>
    </form>
  );
}
