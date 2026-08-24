import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type {
  ChatColleague,
  ChatConversation,
  ChatMessage,
  ChatReceipt,
} from './chat.types';

type ColleagueRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
  unread_count: string;
};

type ConversationRow = {
  id: string;
  other_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
  last_body: string | null;
  last_at: string | null;
  unread_count: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
};

type ReceiptRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  delivered_at: string | null;
  read_at: string | null;
};

type PairRow = {
  id: string;
  user_low: string;
  user_high: string;
};

@Injectable()
export class ChatRepository {
  constructor(private readonly database: DatabaseService) {}

  async listColleagues(userId: string): Promise<ChatColleague[]> {
    const result = await this.database.query<ColleagueRow>(
      `
        SELECT
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          u.role,
          COALESCE((
            SELECT COUNT(*)::text
            FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            WHERE m.sender_id = u.id
              AND m.read_at IS NULL
              AND (c.user_low = $1 OR c.user_high = $1)
          ), '0') AS unread_count
        FROM users u
        WHERE u.id <> $1
        ORDER BY (
          SELECT MAX(m.created_at)
          FROM conversations c
          JOIN messages m ON m.conversation_id = c.id
          WHERE (c.user_low = $1 AND c.user_high = u.id)
             OR (c.user_high = $1 AND c.user_low = u.id)
        ) DESC NULLS LAST, u.first_name, u.last_name
      `,
      [userId],
    );

    return result.rows.map((row) => this.toColleague(row));
  }

  async listConversations(userId: string): Promise<ChatConversation[]> {
    const result = await this.database.query<ConversationRow>(
      `
        SELECT
          c.id,
          CASE WHEN c.user_low = $1 THEN c.user_high ELSE c.user_low END AS other_id,
          u.first_name,
          u.last_name,
          u.email,
          u.role,
          m.body AS last_body,
          m.created_at::text AS last_at,
          (
            SELECT COUNT(*)::text
            FROM messages um
            WHERE um.conversation_id = c.id
              AND um.sender_id <> $1
              AND um.read_at IS NULL
          ) AS unread_count
        FROM conversations c
        JOIN users u ON u.id = CASE
          WHEN c.user_low = $1 THEN c.user_high
          ELSE c.user_low
        END
        LEFT JOIN LATERAL (
          SELECT body, created_at
          FROM messages
          WHERE conversation_id = c.id
          ORDER BY created_at DESC
          LIMIT 1
        ) m ON TRUE
        WHERE c.user_low = $1 OR c.user_high = $1
        ORDER BY COALESCE(m.created_at, c.created_at) DESC
      `,
      [userId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      otherUser: {
        id: row.other_id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        role: row.role,
        unreadCount: Number(row.unread_count ?? 0),
      },
      lastMessage: row.last_body,
      lastMessageAt: row.last_at,
      unreadCount: Number(row.unread_count ?? 0),
    }));
  }

  async getOrCreateConversation(
    userId: string,
    otherUserId: string,
  ): Promise<string> {
    const userLow = userId < otherUserId ? userId : otherUserId;
    const userHigh = userId < otherUserId ? otherUserId : userId;

    const inserted = await this.database.query<{ id: string }>(
      `
        INSERT INTO conversations (user_low, user_high)
        VALUES ($1, $2)
        ON CONFLICT (user_low, user_high) DO NOTHING
        RETURNING id
      `,
      [userLow, userHigh],
    );

    if (inserted.rows[0]) {
      return inserted.rows[0].id;
    }

    const existing = await this.database.query<{ id: string }>(
      `
        SELECT id FROM conversations
        WHERE user_low = $1 AND user_high = $2
      `,
      [userLow, userHigh],
    );

    return existing.rows[0].id;
  }

  async findConversationPair(conversationId: string): Promise<PairRow | null> {
    const result = await this.database.query<PairRow>(
      `
        SELECT id, user_low, user_high
        FROM conversations
        WHERE id = $1
      `,
      [conversationId],
    );

    return result.rows[0] ?? null;
  }

  async listMessages(
    conversationId: string,
    limit = 100,
  ): Promise<ChatMessage[]> {
    const result = await this.database.query<MessageRow>(
      `
        SELECT
          id,
          conversation_id,
          sender_id,
          body,
          created_at::text,
          delivered_at::text,
          read_at::text
        FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
        LIMIT $2
      `,
      [conversationId, limit],
    );

    return result.rows.map((row) => this.toMessage(row));
  }

  async insertMessage(
    conversationId: string,
    senderId: string,
    body: string,
  ): Promise<ChatMessage> {
    const result = await this.database.query<MessageRow>(
      `
        INSERT INTO messages (conversation_id, sender_id, body)
        VALUES ($1, $2, $3)
        RETURNING
          id,
          conversation_id,
          sender_id,
          body,
          created_at::text,
          delivered_at::text,
          read_at::text
      `,
      [conversationId, senderId, body],
    );

    return this.toMessage(result.rows[0]);
  }

  async markMessageDelivered(
    recipientId: string,
    messageId: string,
  ): Promise<ChatReceipt | null> {
    const result = await this.database.query<ReceiptRow>(
      `
        UPDATE messages m
        SET delivered_at = COALESCE(m.delivered_at, NOW())
        FROM conversations c
        WHERE m.id = $1
          AND m.conversation_id = c.id
          AND m.sender_id <> $2
          AND (c.user_low = $2 OR c.user_high = $2)
        RETURNING
          m.id,
          m.conversation_id,
          m.sender_id,
          m.delivered_at::text,
          m.read_at::text
      `,
      [messageId, recipientId],
    );

    const row = result.rows[0];
    return row ? this.toReceipt(row) : null;
  }

  async markDeliveredForRecipient(recipientId: string): Promise<ChatReceipt[]> {
    const result = await this.database.query<ReceiptRow>(
      `
        UPDATE messages m
        SET delivered_at = NOW()
        FROM conversations c
        WHERE m.conversation_id = c.id
          AND m.delivered_at IS NULL
          AND m.sender_id <> $1
          AND (c.user_low = $1 OR c.user_high = $1)
        RETURNING
          m.id,
          m.conversation_id,
          m.sender_id,
          m.delivered_at::text,
          m.read_at::text
      `,
      [recipientId],
    );

    return result.rows.map((row) => this.toReceipt(row));
  }

  async markConversationRead(
    readerId: string,
    conversationId: string,
  ): Promise<ChatReceipt[]> {
    const result = await this.database.query<ReceiptRow>(
      `
        UPDATE messages
        SET
          delivered_at = COALESCE(delivered_at, NOW()),
          read_at = COALESCE(read_at, NOW())
        WHERE conversation_id = $1
          AND sender_id <> $2
          AND read_at IS NULL
        RETURNING
          id,
          conversation_id,
          sender_id,
          delivered_at::text,
          read_at::text
      `,
      [conversationId, readerId],
    );

    return result.rows.map((row) => this.toReceipt(row));
  }

  private toColleague(row: ColleagueRow): ChatColleague {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      role: row.role,
      unreadCount: Number(row.unread_count ?? 0),
    };
  }

  private toMessage(row: MessageRow): ChatMessage {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      body: row.body,
      createdAt: row.created_at,
      deliveredAt: row.delivered_at,
      readAt: row.read_at,
    };
  }

  private toReceipt(row: ReceiptRow): ChatReceipt {
    return {
      messageId: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      deliveredAt: row.delivered_at,
      readAt: row.read_at,
    };
  }
}
