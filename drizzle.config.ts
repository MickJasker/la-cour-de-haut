import { defineConfig } from 'drizzle-kit';

// drizzle-kit doesn't load .env.local (Next.js convention); Node 22+ built-in
process.loadEnvFile('.env.local');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
