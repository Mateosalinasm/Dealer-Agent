"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toggleTaskDone, deleteTask } from "@/app/desk/tasks/actions";
import { cn } from "@/lib/utils";

export interface TaskRowData {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
  dealId: string | null;
  dealCustomerName: string | null;
}

function formatDue(dueDate: string | null) {
  if (!dueDate) return null;
  const d = new Date(`${dueDate}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TaskRow({ task, tone }: { task: TaskRowData; tone?: "overdue" }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2.5 rounded-[var(--radius-panel)] px-2 py-1.5 hover:bg-[var(--color-fill-subtle)]">
      <input
        type="checkbox"
        checked={task.done}
        disabled={isPending}
        onChange={() => startTransition(() => toggleTaskDone(task.id, task.dealId))}
        className="h-4 w-4 flex-none rounded accent-[var(--color-primary)]"
      />
      <div className="min-w-0 flex-1">
        <span className={cn("text-[13px] text-[var(--color-text)]", task.done && "text-[var(--color-text-muted)] line-through")}>
          {task.title}
        </span>
        {task.dealId && task.dealCustomerName && (
          <>
            {" · "}
            <Link href={`/desk/deals/${task.dealId}`} className="text-[12px] font-medium text-[var(--color-primary)] hover:underline">
              {task.dealCustomerName}
            </Link>
          </>
        )}
      </div>
      {task.dueDate && (
        <span className={cn("flex-none text-[11.5px] tabular-nums", tone === "overdue" ? "font-semibold text-[var(--color-negative-text)]" : "text-[var(--color-text-muted)]")}>
          {formatDue(task.dueDate)}
        </span>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => deleteTask(task.id, task.dealId))}
        className="flex-none text-[11px] font-semibold text-[var(--color-text-placeholder)] hover:text-[var(--color-negative-text)]"
        aria-label="Delete task"
      >
        Remove
      </button>
    </div>
  );
}
