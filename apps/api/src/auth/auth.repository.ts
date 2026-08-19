import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  AuthProvider,
  PublicUser,
  UserRecord,
  UserRole,
} from '../users/user.types';

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

type CreateUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string | null;
  googleId: string | null;
  authProvider: AuthProvider;
  role: UserRole;
};

const USER_COLUMNS = `
  id, first_name, last_name, email, password_hash, google_id, auth_provider, role
`;

@Injectable()
export class AuthRepository {
  constructor(private readonly database: DatabaseService) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.database.query<UserRow>(
      `
        SELECT ${USER_COLUMNS}
        FROM users
        WHERE email = $1
      `,
      [email],
    );

    const row = result.rows[0];
    return row ? this.toUserRecord(row) : null;
  }

  async findByGoogleId(googleId: string): Promise<UserRecord | null> {
    const result = await this.database.query<UserRow>(
      `
        SELECT ${USER_COLUMNS}
        FROM users
        WHERE google_id = $1
      `,
      [googleId],
    );

    const row = result.rows[0];
    return row ? this.toUserRecord(row) : null;
  }

  async createUser(input: CreateUserInput): Promise<PublicUser> {
    const result = await this.database.query<UserRow>(
      `
        INSERT INTO users (
          first_name,
          last_name,
          email,
          password_hash,
          google_id,
          auth_provider,
          role
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING ${USER_COLUMNS}
      `,
      [
        input.firstName,
        input.lastName,
        input.email,
        input.passwordHash,
        input.googleId,
        input.authProvider,
        input.role,
      ],
    );

    return this.toPublicUser(result.rows[0]);
  }

  async linkGoogleId(userId: string, googleId: string): Promise<void> {
    await this.database.query(
      `
        UPDATE users
        SET google_id = $1, updated_at = NOW()
        WHERE id = $2 AND google_id IS NULL
      `,
      [googleId, userId],
    );
  }

  private toPublicUser(row: UserRow): PublicUser {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      role: row.role,
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
