import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js reads `.env.local`; the Prisma CLI does not. Load it first so the
// migration engine can use the direct (non-pooled) Neon connection.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
