import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Pins the project root explicitly. Without this, Turbopack infers the
// root by walking up looking for a lockfile — if a stray package-lock.json
// or similar sits in a parent directory (e.g. the user's home folder from
// an unrelated project), Turbopack can mis-root itself there instead of
// this project, which silently breaks .env.local loading and other
// filesystem-relative behavior. See the "ignored package-lock.json ...
// outside the current Git repository" warning this fixes.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  // Next's own Server Action body limit defaults to 1MB — far below what a
  // real credit app/bank statement scan or phone camera photo produces.
  // 4mb leaves headroom under Vercel's hard, non-configurable 4.5MB
  // serverless request-body ceiling (see FUNCTION_PAYLOAD_TOO_LARGE) —
  // that platform limit can't be raised from here, which is why vehicle
  // photo uploads also get resized client-side before they're sent
  // (components/vehicle-photos-section.tsx) rather than relying on this
  // alone.
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
