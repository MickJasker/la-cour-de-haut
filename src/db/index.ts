import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// neon() throws at module load if DATABASE_URL is unset, crashing next build
// before env vars are provisioned. Lazy init avoids this.
let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    _db = drizzle({ client: neon(process.env.DATABASE_URL!), schema });
  }
  return _db;
}
