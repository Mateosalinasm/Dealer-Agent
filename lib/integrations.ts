import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

type Provider = (typeof schema.integrationProvider)[number];

/** Reads a connected integration's stored config. Null if never connected. */
export async function getIntegrationConfig<T = Record<string, unknown>>(provider: Provider): Promise<T | null> {
  const [row] = await db.select().from(schema.integrations).where(eq(schema.integrations.provider, provider)).limit(1);
  if (!row?.connected) return null;
  return (row.config as T) ?? null;
}

/** Whether a provider has been connected at all (for showing status, without exposing the config). */
export async function isIntegrationConnected(provider: Provider): Promise<boolean> {
  const [row] = await db.select({ connected: schema.integrations.connected }).from(schema.integrations).where(eq(schema.integrations.provider, provider)).limit(1);
  return !!row?.connected;
}

export async function setIntegrationConfig(provider: Provider, config: object): Promise<void> {
  await db
    .insert(schema.integrations)
    .values({ provider, config, connected: true, connectedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.integrations.provider,
      set: { config, connected: true, connectedAt: new Date(), updatedAt: new Date() },
    });
}

export async function disconnectIntegration(provider: Provider): Promise<void> {
  await db
    .insert(schema.integrations)
    .values({ provider, config: null, connected: false })
    .onConflictDoUpdate({
      target: schema.integrations.provider,
      set: { config: null, connected: false, updatedAt: new Date() },
    });
}
