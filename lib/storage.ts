import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

// Local-disk storage for dev. `storagePath` stored in the documents table is
// opaque to the app — swapping this module for a Supabase Storage adapter
// (same saveFile/readFile/urlFor signatures, storagePath becomes the object
// key) shouldn't require touching any caller.

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

export async function saveFile(file: File): Promise<{ storagePath: string; fileSize: number }> {
  await mkdir(UPLOAD_ROOT, { recursive: true });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_ROOT, storagePath), buffer);
  return { storagePath, fileSize: buffer.byteLength };
}

export async function readStoredFile(storagePath: string): Promise<Buffer> {
  const resolved = path.join(UPLOAD_ROOT, storagePath);
  if (!resolved.startsWith(UPLOAD_ROOT)) {
    throw new Error("Invalid storage path");
  }
  return readFile(resolved);
}

export function urlFor(documentId: string): string {
  return `/api/documents/${documentId}/file`;
}
