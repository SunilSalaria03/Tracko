import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AUTH_COOKIE_NAME } from '../auth/auth.constants';
import { UsersService } from '../users/users.service';
import { ChatService } from './chat.service';
import type { ChatMessage, ChatReceipt } from './chat.types';

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) {
    return null;
  }

  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return null;
}

function asUserId(client: Socket): string | null {
  const userId = client.data.userId as string | undefined;
  return userId ?? null;
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly connectionCounts = new Map<string, number>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = readCookie(
      client.handshake.headers.cookie,
      AUTH_COOKIE_NAME,
    );

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(
        token,
      );
      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        client.disconnect(true);
        return;
      }

      client.data.userId = user.id;
      await client.join(`user:${user.id}`);

      const next = (this.connectionCounts.get(user.id) ?? 0) + 1;
      this.connectionCounts.set(user.id, next);

      if (next === 1) {
        this.server.emit('userOnline', { userId: user.id });
      }

      for (const [onlineId, count] of this.connectionCounts) {
        if (count > 0 && onlineId !== user.id) {
          client.emit('userOnline', { userId: onlineId });
        }
      }

      const receipts = await this.chatService.markDeliveredForRecipient(
        user.id,
      );
      this.emitReceipts('messageDelivered', receipts);
    } catch {
      this.logger.debug('Socket rejected: invalid JWT');
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = asUserId(client);
    if (!userId) {
      return;
    }

    void client.leave(`user:${userId}`);
    const next = (this.connectionCounts.get(userId) ?? 1) - 1;
    if (next <= 0) {
      this.connectionCounts.delete(userId);
      this.server.emit('userOffline', { userId });
      return;
    }

    this.connectionCounts.set(userId, next);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { conversationId?: string; body?: string },
  ): Promise<{ ok: true; message: ChatMessage } | { ok: false; error: string }> {
    const userId = asUserId(client);
    if (!userId) {
      return { ok: false, error: 'Unauthorized' };
    }

    try {
      const { message, recipientId } = await this.chatService.sendMessage(
        userId,
        payload.conversationId ?? '',
        payload.body ?? '',
      );

      await this.broadcastNewMessage(userId, recipientId, message);
      return { ok: true, message };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not send',
      };
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId?: string },
  ): Promise<void> {
    await this.relayTyping(client, payload.conversationId, 'typing');
  }

  @SubscribeMessage('stopTyping')
  async handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId?: string },
  ): Promise<void> {
    await this.relayTyping(client, payload.conversationId, 'stopTyping');
  }

  @SubscribeMessage('messageDelivered')
  async handleMessageDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId?: string },
  ): Promise<void> {
    const userId = asUserId(client);
    if (!userId || !payload.messageId) {
      return;
    }

    const receipt = await this.chatService.markMessageDelivered(
      userId,
      payload.messageId,
    );
    if (receipt) {
      this.toUser(receipt.senderId).emit('messageDelivered', receipt);
    }
  }

  @SubscribeMessage('messageRead')
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId?: string },
  ): Promise<void> {
    const userId = asUserId(client);
    if (!userId || !payload.conversationId) {
      return;
    }

    const receipts = await this.chatService.markConversationRead(
      userId,
      payload.conversationId,
    );
    this.emitReceipts('messageRead', receipts);
  }

  async broadcastNewMessage(
    senderId: string,
    recipientId: string,
    message: ChatMessage,
  ): Promise<void> {
    this.toUser(senderId).emit('newMessage', message);
    this.toUser(recipientId).emit('newMessage', message);

    if (this.isOnline(recipientId)) {
      const receipt = await this.chatService.markMessageDelivered(
        recipientId,
        message.id,
      );
      if (receipt) {
        this.toUser(receipt.senderId).emit('messageDelivered', receipt);
      }
    }
  }

  private async relayTyping(
    client: Socket,
    conversationId: string | undefined,
    event: 'typing' | 'stopTyping',
  ): Promise<void> {
    const userId = asUserId(client);
    if (!userId || !conversationId) {
      return;
    }

    try {
      const otherId = await this.chatService.otherParticipant(
        conversationId,
        userId,
      );
      this.toUser(otherId).emit(event, { conversationId, userId });
    } catch {
      // Ignore typing for conversations the user cannot access.
    }
  }

  private isOnline(userId: string): boolean {
    return (this.connectionCounts.get(userId) ?? 0) > 0;
  }

  private toUser(userId: string) {
    return this.server.to(`user:${userId}`);
  }

  private emitReceipts(
    event: 'messageDelivered' | 'messageRead',
    receipts: ChatReceipt[],
  ): void {
    for (const receipt of receipts) {
      this.toUser(receipt.senderId).emit(event, receipt);
    }
  }
}
