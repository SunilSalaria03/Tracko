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

type ResetChallengeRow = {
  id: string;
  email: string;
  code_hash: string;
  reset_token_hash: string | null;
  expires_at: Date;
  verified_at: Date | null;
  consumed_at: Date | null;
};

export type PasswordResetChallenge = {
  id: string;
  email: string;
  codeHash: string;
  resetTokenHash: string | null;
  expiresAt: Date;
  verifiedAt: Date | null;
  consumedAt: Date | null;
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

  async findById(id: string): Promise<UserRecord | null> {
    const result = await this.database.query<UserRow>(
      `
        SELECT ${USER_COLUMNS}
        FROM users
        WHERE id = $1
      `,
      [id],
    );

    const row = result.rows[0];
    return row ? this.toUserRecord(row) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.database.query<UserRow>(
      `
        SELECT ${USER_COLUMNS}
        FROM users
        WHERE LOWER(email) = LOWER($1)
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

  async setPassword(
    userId: string,
    passwordHash: string,
  ): Promise<UserRecord | null> {
    const result = await this.database.query<UserRow>(
      `
        UPDATE users
        SET password_hash = $1, updated_at = NOW()
        WHERE id = $2 AND password_hash IS NULL
        RETURNING ${USER_COLUMNS}
      `,
      [passwordHash, userId],
    );

    const row = result.rows[0];
    return row ? this.toUserRecord(row) : null;
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
  ): Promise<UserRecord | null> {
    const result = await this.database.query<UserRow>(
      `
        UPDATE users
        SET password_hash = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING ${USER_COLUMNS}
      `,
      [passwordHash, userId],
    );

    const row = result.rows[0];
    return row ? this.toUserRecord(row) : null;
  }

  async invalidateResetChallenges(email: string): Promise<void> {
    await this.database.query(
      `
        UPDATE password_reset_challenges
        SET consumed_at = NOW()
        WHERE LOWER(email) = LOWER($1)
          AND consumed_at IS NULL
      `,
      [email],
    );
  }

  async createResetChallenge(input: {
    email: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetChallenge> {
    const result = await this.database.query<ResetChallengeRow>(
      `
        INSERT INTO password_reset_challenges (email, code_hash, expires_at)
        VALUES ($1, $2, $3)
        RETURNING id, email, code_hash, reset_token_hash, expires_at, verified_at, consumed_at
      `,
      [input.email, input.codeHash, input.expiresAt],
    );

    return this.toResetChallenge(result.rows[0]);
  }

  async findActiveResetChallenge(
    email: string,
  ): Promise<PasswordResetChallenge | null> {
    const result = await this.database.query<ResetChallengeRow>(
      `
        SELECT id, email, code_hash, reset_token_hash, expires_at, verified_at, consumed_at
        FROM password_reset_challenges
        WHERE LOWER(email) = LOWER($1)
          AND consumed_at IS NULL
          AND verified_at IS NULL
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [email],
    );

    const row = result.rows[0];
    return row ? this.toResetChallenge(row) : null;
  }

  async markChallengeVerified(
    id: string,
    resetTokenHash: string,
  ): Promise<void> {
    await this.database.query(
      `
        UPDATE password_reset_challenges
        SET verified_at = NOW(), reset_token_hash = $2
        WHERE id = $1 AND consumed_at IS NULL
      `,
      [id, resetTokenHash],
    );
  }

  async findVerifiedChallengeByTokenHash(
    resetTokenHash: string,
  ): Promise<PasswordResetChallenge | null> {
    const result = await this.database.query<ResetChallengeRow>(
      `
        SELECT id, email, code_hash, reset_token_hash, expires_at, verified_at, consumed_at
        FROM password_reset_challenges
        WHERE reset_token_hash = $1
          AND verified_at IS NOT NULL
          AND consumed_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
      `,
      [resetTokenHash],
    );

    const row = result.rows[0];
    return row ? this.toResetChallenge(row) : null;
  }

  async consumeChallenge(id: string): Promise<void> {
    await this.database.query(
      `
        UPDATE password_reset_challenges
        SET consumed_at = NOW()
        WHERE id = $1
      `,
      [id],
    );
  }

  private toResetChallenge(row: ResetChallengeRow): PasswordResetChallenge {
    return {
      id: row.id,
      email: row.email,
      codeHash: row.code_hash,
      resetTokenHash: row.reset_token_hash,
      expiresAt: row.expires_at,
      verifiedAt: row.verified_at,
      consumedAt: row.consumed_at,
    };
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
