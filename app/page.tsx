import { db, schema } from "@/lib/db";
import { HomeQuicklinks } from "@/components/home-quicklinks";
import { HomeSummaryCard, type SummaryStat } from "@/components/home-summary-card";
import { monthOf, daysSince } from "@/lib/deal-stage";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [leads, vehicles, appointments] = await Promise.all([
    db.select().from(schema.leads),
    db.select().from(schema.vehicles),
    db.select().from(schema.appointments),
  ]);

  const now = new Date();
  const nowMs = now.getTime();
  const currentMonth = monthOf(now);

  const openLeads = leads.filter((l) => l.status === "open").length;
  const inProgressLeads = leads.filter((l) => l.status === "contacted" || l.status === "appointment").length;
  const newLeadsThisWeek = leads.filter((l) => daysSince(l.createdAt) <= 7).length;

  const activeInventory = vehicles.filter((v) => !v.sold).length;
  const soldThisMonth = vehicles.filter((v) => v.sold && v.soldOn && monthOf(v.soldOn) === currentMonth).length;
  const agedInventory = vehicles.filter((v) => !v.sold && v.acquiredOn && daysSince(new Date(v.acquiredOn)) >= 30).length;

  const scheduled = appointments.filter((a) => a.status === "scheduled");
  const todayStr = now.toDateString();
  const todaysAppointments = scheduled.filter((a) => a.scheduledAt.toDateString() === todayStr).length;
  const next7Days = scheduled.filter((a) => a.scheduledAt.getTime() >= nowMs && a.scheduledAt.getTime() <= nowMs + 7 * 86_400_000).length;
  const totalUpcoming = scheduled.filter((a) => a.scheduledAt.getTime() >= nowMs).length;

  const customerStats: SummaryStat[] = [
    { value: openLeads, label: "Open leads" },
    { value: inProgressLeads, label: "In progress (contacted / appointment set)" },
    { value: newLeadsThisWeek, label: "New this week" },
  ];

  const inventoryStats: SummaryStat[] = [
    { value: activeInventory, label: "Active inventory" },
    { value: soldThisMonth, label: "Sold this month" },
    { value: agedInventory, label: "Aged 30+ days", tone: agedInventory > 0 ? "caution" : "default" },
  ];

  const appointmentStats: SummaryStat[] = [
    { value: todaysAppointments, label: "Today" },
    { value: next7Days, label: "Next 7 days" },
    { value: totalUpcoming, label: "Total upcoming" },
  ];

  return (
    <div>
      <h1 className="mb-5 text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">Home</h1>

      <HomeQuicklinks />

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <HomeSummaryCard title="Customers" viewHref="/leads" stats={customerStats} />
        <HomeSummaryCard title="Inventory" viewHref="/inventory" stats={inventoryStats} />
        <HomeSummaryCard title="Appointments" viewHref="/desk/appointments" stats={appointmentStats} />
      </div>
    </div>
  );
}
