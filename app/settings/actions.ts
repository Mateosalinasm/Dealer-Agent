"use server";

import { revalidatePath } from "next/cache";
import { disconnectIntegration } from "@/lib/integrations";

export async function disconnectGoogleCalendar() {
  await disconnectIntegration("google_calendar");
  revalidatePath("/settings");
}
