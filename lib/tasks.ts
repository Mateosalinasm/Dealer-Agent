import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getDealershipTimezone, todayInTimezone } from "@/lib/dealership-time";

export interface OpenTaskRow {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
  dealId: string | null;
  dealCustomerName: string | null;
}

export interface GroupedOpenTasks {
  today: string;
  overdue: OpenTaskRow[];
  dueToday: OpenTaskRow[];
  upcoming: OpenTaskRow[];
  noDueDate: OpenTaskRow[];
  totalOpen: number;
}

/**
 * Every open (not done) task, bucketed by due date against "today" in the
 * dealership's own timezone — same boundary logic as the daily desk brief
 * (lib/desk-brief.ts), which calls this directly for its overdue/due-today
 * line rather than re-deriving the buckets itself.
 */
export async function getOpenTasksGrouped(): Promise<GroupedOpenTasks> {
  const timezone = await getDealershipTimezone();
  const today = todayInTimezone(timezone);

  const rows = await db
    .select({
      id: schema.tasks.id,
      title: schema.tasks.title,
      dueDate: schema.tasks.dueDate,
      done: schema.tasks.done,
      dealId: schema.tasks.dealId,
      dealCustomerName: schema.deals.customerName,
    })
    .from(schema.tasks)
    .leftJoin(schema.deals, eq(schema.tasks.dealId, schema.deals.id))
    .where(eq(schema.tasks.done, false));

  const overdue = rows.filter((t) => t.dueDate && t.dueDate < today).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const dueToday = rows.filter((t) => t.dueDate === today);
  const upcoming = rows.filter((t) => t.dueDate && t.dueDate > today).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const noDueDate = rows.filter((t) => !t.dueDate);

  return { today, overdue, dueToday, upcoming, noDueDate, totalOpen: rows.length };
}
