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
};

export default nextConfig;
