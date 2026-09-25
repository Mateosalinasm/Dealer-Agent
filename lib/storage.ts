import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Supabase Storage in production, local disk for dev when the Supabase
// storage env vars aren't set — same saveFile/readStoredFile/urlFor
// signatures either way, so no caller needs to know which backend is
// active. This matters for real: Vercel's filesystem is read-only outside
// /tmp, and /tmp doesn't persist across invocations, so plain local-disk
// writes (the original version of this module) 500 on every upload once
// deployed. Needs two env vars in production:
//   SUPABASE_URL               — Project Settings → API → Project URL
//   SUPABASE_SERVICE_ROLE_KEY  — same page, "service_role" secret (NOT the
//                                 anon key — this bypasses RLS, server-only)
// Optional: SUPABASE_STORAGE_BUCKET (defaults to "documents"). Create that
// bucket in Supabase Storage as PRIVATE — reads only ever happen through
// /api/documents/[id]/file, which does its own DB-backed authorization, so
// the bucket itself should never be public.

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "documents";

function supabaseStorageConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export async function saveFile(file: File): Promise<{ storagePath: string; fileSize: number }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const buffer = Buffer.from(await file.arrayBuffer());
  return saveBuffer(buffer, file.type || undefined, safeName);
}

// Same dual-backend write as saveFile, for callers that already have raw
// bytes rather than a Web File — e.g. an AI-edited image coming back from
// lib/photo-editor.ts, which has no File object to begin with.
export async function saveBuffer(buffer: Buffer, contentType: string | undefined, name: string): Promise<{ storagePath: string; fileSize: number }> {
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${randomUUID()}-${safeName}`;

  if (supabaseStorageConfigured()) {
    const { error } = await supabaseClient()
      .storage.from(BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: false });
    if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
    return { storagePath, fileSize: buffer.byteLength };
  }

  await mkdir(UPLOAD_ROOT, { recursive: true });
  await writeFile(path.join(UPLOAD_ROOT, storagePath), buffer);
  return { storagePath, fileSize: buffer.byteLength };
}

// In-place overwrite at an EXISTING storagePath — unlike saveBuffer, this
// never generates a new path, so no DB row needs to change to point at it.
// Used to persist a self-healed (aspect-normalized) photo back over the
// un-normalized bytes it replaced; see app/api/vehicle-photos/[id]/file.
export async function overwriteStoredFile(storagePath: string, buffer: Buffer, contentType: string | undefined): Promise<void> {
  if (supabaseStorageConfigured()) {
    const { error } = await supabaseClient()
      .storage.from(BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: true });
    if (error) throw new Error(`Supabase Storage overwrite failed: ${error.message}`);
    return;
  }

  const resolved = path.join(UPLOAD_ROOT, storagePath);
  if (!resolved.startsWith(UPLOAD_ROOT)) {
    throw new Error("Invalid storage path");
  }
  await mkdir(UPLOAD_ROOT, { recursive: true });
  await writeFile(resolved, buffer);
}

export async function readStoredFile(storagePath: string): Promise<Buffer> {
  if (supabaseStorageConfigured()) {
    const { data, error } = await supabaseClient().storage.from(BUCKET).download(storagePath);
    if (error || !data) throw new Error(`Supabase Storage download failed: ${error?.message ?? "not found"}`);
    return Buffer.from(await data.arrayBuffer());
  }

  const resolved = path.join(UPLOAD_ROOT, storagePath);
  if (!resolved.startsWith(UPLOAD_ROOT)) {
    throw new Error("Invalid storage path");
  }
  return readFile(resolved);
}

export function urlFor(documentId: string): string {
  return `/api/documents/${documentId}/file`;
}
