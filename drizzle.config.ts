import { defineConfig } from 'drizzle-kit';

// drizzle-kit doesn't load .env.local (Next.js convention); Node 22+ built-in
// Silently ignored on Vercel where .env.local doesn't exist
try { process.loadEnvFile('.env.local'); } catch {}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    // Migrations require a direct (unpooled) connection — PgBouncer blocks DDL
    url: (() => {
      const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
      if (!url) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set");
      return url;
    })(),
  },
});
