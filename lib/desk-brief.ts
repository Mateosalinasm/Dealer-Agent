import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getDealershipTimezone, todayInTimezone } from "@/lib/dealership-time";
import { dealFacts } from "@/lib/deal-facts";
import { dealHealth, nextAction } from "@/lib/deal-health";
import { getOpenTasksGrouped } from "@/lib/tasks";

/** YYYY-MM-DD for a Date in the given IANA timezone — same shape todayInTimezone returns, for comparing against it. */
function dateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function timeInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(date);
}

export interface DeskBrief {
  dateLabel: string;
  text: string;
}

/**
 * Composes the daily desk brief: today's appointments, deals in red
 * health, open stips, and open leads — the exact same "how's the desk
 * right now" numbers as the Analytics snapshot row (app/desk/analytics),
 * just as a message instead of stat tiles. Read-only — sending is the
 * caller's job (app/api/cron/daily/route.ts), so this stays testable and
 * reusable (e.g. the Settings page's "send test brief now" button) without
 * needing WhatsApp/email actually configured.
 */
export async function buildDeskBrief(): Promise<DeskBrief> {
  const timezone = await getDealershipTimezone();
  const today = todayInTimezone(timezone);

  const [appointments, allDeals, vehicles, leads, taskGroups] = await Promise.all([
    db.select().from(schema.appointments).where(eq(schema.appointments.status, "scheduled")),
    db.select().from(schema.deals),
    db.select().from(schema.vehicles),
    db.select({ status: schema.leads.status }).from(schema.leads),
    getOpenTasksGrouped(),
  ]);

  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const todaysAppointments = appointments
    .filter((a) => dateInTimezone(a.scheduledAt, timezone) === today)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  const activeDeals = allDeals.filter((d) => !d.funded && !d.archived);
  const criticalDeals = activeDeals
    .map((d) => {
      const vehicle = d.vehicleId ? (vehicleById.get(d.vehicleId) ?? null) : null;
      const facts = dealFacts(d, vehicle);
      const health = dealHealth(d, facts);
      return { deal: d, health, next: nextAction(d, facts, health) };
    })
    .filter((r) => r.health.status === "red");

  const stipsOutstanding = activeDeals.reduce((sum, d) => sum + d.stips.filter((s) => !s.done).length, 0);
  const openLeadsCount = leads.filter((l) => l.status === "open" || l.status === "contacted" || l.status === "appointment").length;

  const dateLabel = new Date(`${today}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const lines: string[] = [`Desk brief — ${dateLabel}`, ""];

  if (todaysAppointments.length === 0) {
    lines.push("No appointments today.");
  } else {
    lines.push(`${todaysAppointments.length} appointment${todaysAppointments.length === 1 ? "" : "s"} today:`);
    for (const a of todaysAppointments) {
      lines.push(`- ${timeInTimezone(a.scheduledAt, timezone)} ${a.customerName}`);
    }
  }

  lines.push("");
  if (criticalDeals.length === 0) {
    lines.push("No deals in the red.");
  } else {
    lines.push(`${criticalDeals.length} deal${criticalDeals.length === 1 ? "" : "s"} need attention:`);
    for (const r of criticalDeals) {
      lines.push(`- ${r.deal.customerName ?? "Unnamed"} — ${r.next.label}`);
    }
  }

  const dueTasks = [...taskGroups.overdue, ...taskGroups.dueToday];
  if (dueTasks.length > 0) {
    lines.push("");
    lines.push(`${dueTasks.length} task${dueTasks.length === 1 ? "" : "s"} due${taskGroups.overdue.length ? " or overdue" : ""}:`);
    for (const t of dueTasks) {
      const overdueTag = taskGroups.overdue.includes(t) ? " (overdue)" : "";
      lines.push(`- ${t.title}${t.dealCustomerName ? ` — ${t.dealCustomerName}` : ""}${overdueTag}`);
    }
  }

  lines.push("");
  lines.push(`${stipsOutstanding} stip${stipsOutstanding === 1 ? "" : "s"} outstanding · ${openLeadsCount} open lead${openLeadsCount === 1 ? "" : "s"}.`);

  return { dateLabel, text: lines.join("\n") };
}
