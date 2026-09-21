import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { LeadStatusSelect } from "@/components/lead-status-select";
import { formatCents } from "@/lib/utils";
import { createLead, deleteLead } from "@/app/leads/actions";
import { leadSourceValues } from "@/lib/validation";

export default async function LeadsPage() {
  const leads = await db.select().from(schema.leads).orderBy(desc(schema.leads.createdAt));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="mb-5 text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">Leads</h1>

        {leads.length === 0 ? (
          <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-8 text-center">
            <div className="text-[15px] font-semibold text-[var(--color-text)]">No leads yet</div>
            <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
              Add one on the right — their want drives the demand badges on the run list.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {leads.map((lead) => (
              <Card key={lead.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-[var(--color-text)]">{lead.name}</div>
                  <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                    {lead.phone ? `${lead.phone} · ` : ""}
                    {lead.email ? `${lead.email} · ` : ""}
                    {lead.wantMake || lead.wantModel
                      ? `Wants ${[lead.wantMake, lead.wantModel].filter(Boolean).join(" ")}`
                      : lead.wants || "No stated want"}
                    {lead.source ? ` · ${lead.source}` : ""}
                  </div>
                  <div className="mt-0.5 flex gap-3 text-[11.5px] text-[var(--color-text-muted)]">
                    {lead.maxPayment != null && <span>Max {formatCents(lead.maxPayment)}/mo</span>}
                    {lead.downAvailable != null && <span>{formatCents(lead.downAvailable)} down</span>}
                    {lead.maxMiles != null && <span>Under {lead.maxMiles.toLocaleString()} mi</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <LeadStatusSelect leadId={lead.id} status={lead.status} />
                  <form action={deleteLead.bind(null, lead.id)}>
                    <Button type="submit" variant="destructive" className="px-2 py-1 text-[11px]">
                      Remove
                    </Button>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card className="h-fit">
        <div className="mb-3 text-[13.5px] font-semibold text-[var(--color-text)]">Add a lead</div>
        <form action={createLead} className="flex flex-col gap-3">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" />
            </div>
            <div>
              <Label htmlFor="source">Source</Label>
              <Select id="source" name="source" defaultValue="">
                <option value="">Unknown</option>
                {leadSourceValues.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="wantMake">Wants make</Label>
              <Input id="wantMake" name="wantMake" placeholder="Chevrolet" />
            </div>
            <div>
              <Label htmlFor="wantModel">Wants model</Label>
              <Input id="wantModel" name="wantModel" placeholder="Silverado" />
            </div>
          </div>
          <div>
            <Label htmlFor="wants">Notes on what they want</Label>
            <Textarea id="wants" name="wants" rows={2} placeholder="Silverado 1500, under 120k miles" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="maxMiles">Max miles</Label>
              <Input id="maxMiles" name="maxMiles" type="number" />
            </div>
            <div>
              <Label htmlFor="maxPaymentDollars">Max payment/mo</Label>
              <Input id="maxPaymentDollars" name="maxPaymentDollars" type="number" step="0.01" />
            </div>
            <div>
              <Label htmlFor="downAvailableDollars">Down available</Label>
              <Input id="downAvailableDollars" name="downAvailableDollars" type="number" step="0.01" />
            </div>
          </div>
          <Button type="submit" className="self-end">
            Add lead
          </Button>
        </form>
      </Card>
    </div>
  );
}
