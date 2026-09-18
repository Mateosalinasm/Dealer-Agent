import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./schema-sketch/schema.ts",
  out: "./schema-sketch/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://dealdesk:dealdesk@localhost:5432/dealdesk_sourcing",
  },
});
