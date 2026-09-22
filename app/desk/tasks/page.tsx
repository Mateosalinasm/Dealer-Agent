import { eq, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { TaskRow } from "@/components/task-row";
import { getOpenTasksGrouped } from "@/lib/tasks";
import { createTask } from "@/app/desk/tasks/actions";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [{ overdue, dueToday, upcoming, noDueDate, totalOpen }, deals, recentlyDone] = await Promise.all([
    getOpenTasksGrouped(),
    db.select({ id: schema.deals.id, customerName: schema.deals.customerName }).from(schema.deals).where(eq(schema.deals.archived, false)),
    db.select().from(schema.tasks).where(eq(schema.tasks.done, true)).orderBy(desc(schema.tasks.doneAt)).limit(15),
  ]);

  const dealNameById = new Map(deals.map((d) => [d.id, d.customerName]));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="mb-1 text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">Tasks</h1>
        <p className="mb-5 text-[12.5px] text-[var(--color-text-muted)]">
          Reminders independent of appointments — call a lender, follow up on a stip, whatever isn&apos;t on the
          calendar. {totalOpen} open.
        </p>

        {totalOpen === 0 ? (
          <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-8 text-center">
            <div className="text-[15px] font-semibold text-[var(--color-text)]">Nothing on your list</div>
            <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">Add one on the right.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {overdue.length > 0 && (
              <Card>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-negative-text)]">
                  Overdue · {overdue.length}
                </div>
                <div className="flex flex-col">
                  {overdue.map((t) => (
                    <TaskRow key={t.id} task={t} tone="overdue" />
                  ))}
                </div>
              </Card>
            )}

            {dueToday.length > 0 && (
              <Card>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  Due today · {dueToday.length}
                </div>
                <div className="flex flex-col">
                  {dueToday.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              </Card>
            )}

            {upcoming.length > 0 && (
              <Card>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  Upcoming · {upcoming.length}
                </div>
                <div className="flex flex-col">
                  {upcoming.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              </Card>
            )}

            {noDueDate.length > 0 && (
              <Card>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  No due date · {noDueDate.length}
                </div>
                <div className="flex flex-col">
                  {noDueDate.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {recentlyDone.length > 0 && (
          <Card className="mt-4">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
              Recently completed
            </div>
            <div className="flex flex-col">
              {recentlyDone.map((t) => (
                <TaskRow key={t.id} task={{ ...t, dealCustomerName: t.dealId ? (dealNameById.get(t.dealId) ?? null) : null }} />
              ))}
            </div>
          </Card>
        )}
      </div>

      <Card className="h-fit">
        <div className="mb-3 text-[13.5px] font-semibold text-[var(--color-text)]">Add a task</div>
        <form action={createTask} className="flex flex-col gap-3">
          <div>
            <Label htmlFor="title">Task</Label>
            <Input id="title" name="title" required placeholder="Call Westlake about Priya Nair's file" />
          </div>
          <div>
            <Label htmlFor="dueDate">Due date (optional)</Label>
            <Input id="dueDate" name="dueDate" type="date" />
          </div>
          <div>
            <Label htmlFor="dealId">Linked deal (optional)</Label>
            <Select id="dealId" name="dealId" defaultValue="">
              <option value="">Not tied to a deal</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.customerName ?? "Unnamed"}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" className="self-end">
            Add task
          </Button>
        </form>
      </Card>
    </div>
  );
}
