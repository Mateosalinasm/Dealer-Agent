import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./schema-sketch/schema.ts",
  out: "./schema-sketch/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations need a session-mode connection (prepared statements), not
    // the transaction-mode pooler the running app uses — see DIRECT_URL.
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      "postgresql://dealdesk:dealdesk@localhost:5432/dealdesk_sourcing",
  },
});
