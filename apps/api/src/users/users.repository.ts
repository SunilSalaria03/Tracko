import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthProvider, PublicUser, UserRecord, UserRole } from './user.types';

type UserRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string | null;
  google_id: string | null;
  auth_provider: AuthProvider;
  role: UserRole;
};

@Injectable()
export class UsersRepository {
  constructor(private readonly database: DatabaseService) {}

  async findById(id: string): Promise<PublicUser | null> {
    const result = await this.database.query<UserRow>(
      `
        SELECT id, first_name, last_name, email, password_hash, google_id, auth_provider, role
        FROM users
        WHERE id = $1
      `,
      [id],
    );

    const row = result.rows[0];
    return row ? this.toPublicUser(row) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.database.query<UserRow>(
      `
        SELECT id, first_name, last_name, email, password_hash, google_id, auth_provider, role
        FROM users
        WHERE LOWER(email) = LOWER($1)
      `,
      [email],
    );

    const row = result.rows[0];
    return row ? this.toUserRecord(row) : null;
  }

  private toPublicUser(row: UserRow): PublicUser {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      role: row.role,
      hasPassword: row.password_hash != null,
      hasGoogle: row.google_id != null,
    };
  }

  private toUserRecord(row: UserRow): UserRecord {
    return {
      ...this.toPublicUser(row),
      passwordHash: row.password_hash,
      googleId: row.google_id,
      authProvider: row.auth_provider,
    };
  }
}
