import { asc, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createAppointment, setAppointmentStatus } from "@/app/desk/deals/actions";

export const dynamic = "force-dynamic";

const STATUS_TONE = {
  scheduled: "info",
  completed: "positive",
  canceled: "neutral",
} as const;

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ dealId?: string; customerName?: string }>;
}) {
  const { dealId, customerName } = await searchParams;

  const appointments = await db
    .select()
    .from(schema.appointments)
    .where(ne(schema.appointments.status, "canceled"))
    .orderBy(asc(schema.appointments.scheduledAt));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="mb-5 text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">
          Appointments
        </h1>
        {appointments.length === 0 ? (
          <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-8 text-center">
            <div className="text-[15px] font-semibold text-[var(--color-text)]">Nothing scheduled</div>
            <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
              Set one up on the right.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {appointments.map((a) => (
              <Card key={a.id} className="flex items-center justify-between">
                <div>
                  <div className="text-[13.5px] font-semibold text-[var(--color-text)]">
                    {a.customerName}
                  </div>
                  <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                    {new Date(a.scheduledAt).toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {a.phone ? ` · ${a.phone}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
                  {a.status === "scheduled" && (
                    <>
                      <form action={setAppointmentStatus.bind(null, a.id, "completed")}>
                        <Button type="submit" variant="secondary" className="px-2 py-1 text-[11px]">
                          Done
                        </Button>
                      </form>
                      <form action={setAppointmentStatus.bind(null, a.id, "canceled")}>
                        <Button type="submit" variant="destructive" className="px-2 py-1 text-[11px]">
                          Cancel
                        </Button>
                      </form>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card className="h-fit">
        <div className="mb-3 text-[13.5px] font-semibold text-[var(--color-text)]">
          Schedule an appointment
        </div>
        <form action={createAppointment} className="flex flex-col gap-3">
          {dealId && <input type="hidden" name="dealId" value={dealId} />}
          <div>
            <Label htmlFor="customerName">Customer name</Label>
            <Input id="customerName" name="customerName" required defaultValue={customerName ?? ""} />
          </div>
          <div>
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" name="phone" type="tel" />
          </div>
          <div>
            <Label htmlFor="scheduledAt">Date & time</Label>
            <Input id="scheduledAt" name="scheduledAt" type="datetime-local" required />
          </div>
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" name="notes" placeholder="What they're coming in for" />
          </div>
          <Button type="submit" className="mt-1 self-end">
            Schedule
          </Button>
        </form>
      </Card>
    </div>
  );
}
