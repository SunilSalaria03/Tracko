import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor(private readonly config: ConfigService) {
    this.pool = new Pool({
      host: this.config.getOrThrow<string>('DATABASE_HOST'),
      port: Number(this.config.getOrThrow<string>('DATABASE_PORT')),
      database: this.config.getOrThrow<string>('DATABASE_NAME'),
      user: this.config.getOrThrow<string>('DATABASE_USER'),
      password: this.config.getOrThrow<string>('DATABASE_PASSWORD'),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query('SELECT 1');
    this.logger.log('Connected to PostgreSQL');
    await this.runMigrations();
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  private async runMigrations(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = join(__dirname, '..', '..', 'database', 'migrations');
    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const applied = await this.pool.query(
        'SELECT 1 FROM schema_migrations WHERE id = $1',
        [file],
      );

      if ((applied.rowCount ?? 0) > 0) {
        continue;
      }

      const sql = await readFile(join(migrationsDir, file), 'utf8');
      const client = await this.pool.connect();

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [
          file,
        ]);
        await client.query('COMMIT');
        this.logger.log(`Applied migration ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  }
}
