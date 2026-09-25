import "server-only";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// Pairing tokens for the Facebook-posting browser extension. Same shape as
// any API key: the raw token is shown to the operator exactly once, at
// creation, and pasted into the extension's options page — only its
// SHA-256 hash is ever stored here, so a leaked database dump doesn't hand
// out working tokens.

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken, "utf-8").digest("hex");
}

/** Creates a new token, returning the raw value — the only time it's ever visible. */
export async function createExtensionToken(label: string): Promise<string> {
  const rawToken = "dext_" + crypto.randomBytes(24).toString("base64url");
  await db.insert(schema.extensionTokens).values({ label, tokenHash: hashToken(rawToken) });
  return rawToken;
}

export async function revokeExtensionToken(id: string) {
  await db.update(schema.extensionTokens).set({ revokedAt: new Date() }).where(eq(schema.extensionTokens.id, id));
}

/**
 * Verifies a raw token from an `Authorization: Bearer <token>` header.
 * Returns the token row (and bumps lastUsedAt) if it's valid and not
 * revoked, otherwise null. Looked up by hash — the raw token is never
 * stored, so this always re-hashes and matches on that.
 */
export async function verifyExtensionToken(rawToken: string | null): Promise<{ id: string; label: string } | null> {
  if (!rawToken) return null;
  const hash = hashToken(rawToken);
  const [row] = await db.select().from(schema.extensionTokens).where(eq(schema.extensionTokens.tokenHash, hash)).limit(1);
  if (!row || row.revokedAt) return null;

  await db.update(schema.extensionTokens).set({ lastUsedAt: new Date() }).where(eq(schema.extensionTokens.id, row.id));
  return { id: row.id, label: row.label };
}

/** Pulls the bearer token out of a request's Authorization header, or null. */
export function bearerTokenFrom(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}
