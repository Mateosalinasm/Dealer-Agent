"use client";

import { useTransition } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskRow, type TaskRowData } from "@/components/task-row";
import { createTask } from "@/app/desk/tasks/actions";

export function DealTasksSection({ dealId, tasks }: { dealId: string; tasks: Omit<TaskRowData, "dealCustomerName">[] }) {
  const [isPending, startTransition] = useTransition();
  const open = tasks.filter((t) => !t.done).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const done = tasks.filter((t) => t.done);

  function submit(formData: FormData) {
    formData.set("dealId", dealId);
    startTransition(() => createTask(formData));
  }

  return (
    <div>
      {tasks.length === 0 ? (
        <p className="mb-3 text-[12.5px] text-[var(--color-text-muted)]">No tasks on this deal yet.</p>
      ) : (
        <div className="mb-3 flex flex-col">
          {[...open, ...done].map((t) => (
            <TaskRow key={t.id} task={{ ...t, dealCustomerName: null }} />
          ))}
        </div>
      )}

      <form action={submit} className="flex flex-wrap items-end gap-2 border-t border-[var(--color-hairline)] pt-3">
        <div className="min-w-[180px] flex-1">
          <Label htmlFor={`task-title-${dealId}`}>New task</Label>
          <Input id={`task-title-${dealId}`} name="title" required placeholder="Call lender by Thursday" />
        </div>
        <div>
          <Label htmlFor={`task-due-${dealId}`}>Due (optional)</Label>
          <Input id={`task-due-${dealId}`} name="dueDate" type="date" />
        </div>
        <Button type="submit" variant="secondary" disabled={isPending}>
          Add
        </Button>
      </form>
    </div>
  );
}
