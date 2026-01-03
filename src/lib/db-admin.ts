import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

export async function runMigrations() {
    if (!DATABASE_URL) {
        console.warn('⚠️  DATABASE_URL not found. Skipping automatic migrations.');
        console.warn('Please add DATABASE_URL to your .env file to enable automated schema management.');
        return;
    }

    const sql = postgres(DATABASE_URL);

    try {
        // 1. Ensure migrations table exists
        await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

        // 2. Read migration files
        const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
        if (!fs.existsSync(migrationsDir)) {
            console.log('No migrations directory found.');
            return;
        }

        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        for (const file of files) {
            // Check if migration was already applied
            const [alreadyApplied] = await sql`
        SELECT id FROM _migrations WHERE name = ${file}
      `;

            if (alreadyApplied) {
                continue;
            }

            console.log(`🚀 Applying migration: ${file}`);
            const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

            // Execute migration in a transaction
            await sql.begin(async (tx) => {
                // Split by semicolon if needed, but 'postgres' can often handle multiple statements 
                // if they are not specifically restricted. However, for complex migrations,
                // we might want to be careful.
                await tx.unsafe(content);
                await tx`INSERT INTO _migrations (name) VALUES (${file})`;
            });

            console.log(`✅ Migration applied: ${file}`);
        }
    } catch (error) {
        console.error('❌ Migration failed:', error);
        // Don't exit process, let the app try to start anyway
    } finally {
        await sql.end();
    }
}
