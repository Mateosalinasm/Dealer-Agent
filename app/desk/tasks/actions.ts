"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";

export async function createTask(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const dealId = String(formData.get("dealId") ?? "").trim();

  await db.insert(schema.tasks).values({
    title,
    dueDate: dueDate || null,
    dealId: dealId || null,
  });

  revalidatePath("/desk/tasks");
  if (dealId) revalidatePath(`/desk/deals/${dealId}`);
}

export async function toggleTaskDone(taskId: string, dealId: string | null) {
  const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).limit(1);
  if (!task) return;
  const done = !task.done;

  await db.update(schema.tasks).set({ done, doneAt: done ? new Date() : null }).where(eq(schema.tasks.id, taskId));

  revalidatePath("/desk/tasks");
  if (dealId) revalidatePath(`/desk/deals/${dealId}`);
}

export async function deleteTask(taskId: string, dealId: string | null) {
  await db.delete(schema.tasks).where(eq(schema.tasks.id, taskId));
  revalidatePath("/desk/tasks");
  if (dealId) revalidatePath(`/desk/deals/${dealId}`);
}
