import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PublicUser } from '../users/user.types';
import { UsersService } from '../users/users.service';
import { ChatRepository } from './chat.repository';
import type {
  ChatColleague,
  ChatConversation,
  ChatMessage,
  ChatReceipt,
} from './chat.types';

@Injectable()
export class ChatService {
  constructor(
    private readonly chatRepository: ChatRepository,
    private readonly usersService: UsersService,
  ) {}

  listColleagues(user: PublicUser): Promise<ChatColleague[]> {
    return this.chatRepository.listColleagues(user.id);
  }

  listConversations(user: PublicUser): Promise<ChatConversation[]> {
    return this.chatRepository.listConversations(user.id);
  }

  async getOrCreateConversation(
    user: PublicUser,
    otherUserId: string,
  ): Promise<ChatConversation> {
    if (otherUserId === user.id) {
      throw new BadRequestException('You cannot chat with yourself');
    }

    const other = await this.usersService.findById(otherUserId);
    if (!other) {
      throw new NotFoundException('User not found');
    }

    const id = await this.chatRepository.getOrCreateConversation(
      user.id,
      otherUserId,
    );
    const conversations = await this.chatRepository.listConversations(user.id);
    const match = conversations.find((item) => item.id === id);

    return (
      match ?? {
        id,
        otherUser: {
          id: other.id,
          firstName: other.firstName,
          lastName: other.lastName,
          email: other.email,
          role: other.role,
          unreadCount: 0,
        },
        lastMessage: null,
        lastMessageAt: null,
        unreadCount: 0,
      }
    );
  }

  async listMessages(
    user: PublicUser,
    conversationId: string,
  ): Promise<ChatMessage[]> {
    await this.assertParticipant(user.id, conversationId);
    return this.chatRepository.listMessages(conversationId);
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    body: string,
  ): Promise<{ message: ChatMessage; recipientId: string }> {
    const pair = await this.assertParticipant(userId, conversationId);
    const trimmed = body.trim();
    if (!trimmed) {
      throw new BadRequestException('Message cannot be empty');
    }

    const message = await this.chatRepository.insertMessage(
      conversationId,
      userId,
      trimmed,
    );
    const recipientId = this.otherUserId(pair, userId);
    return { message, recipientId };
  }

  otherParticipant(conversationId: string, userId: string) {
    return this.assertParticipant(userId, conversationId).then((pair) =>
      this.otherUserId(pair, userId),
    );
  }

  async markDeliveredForRecipient(recipientId: string): Promise<ChatReceipt[]> {
    return this.chatRepository.markDeliveredForRecipient(recipientId);
  }

  async markMessageDelivered(
    recipientId: string,
    messageId: string,
  ): Promise<ChatReceipt | null> {
    return this.chatRepository.markMessageDelivered(recipientId, messageId);
  }

  async markConversationRead(
    readerId: string,
    conversationId: string,
  ): Promise<ChatReceipt[]> {
    await this.assertParticipant(readerId, conversationId);
    return this.chatRepository.markConversationRead(readerId, conversationId);
  }

  private otherUserId(
    pair: { user_low: string; user_high: string },
    userId: string,
  ): string {
    return pair.user_low === userId ? pair.user_high : pair.user_low;
  }

  private async assertParticipant(
    userId: string,
    conversationId: string,
  ): Promise<{ user_low: string; user_high: string }> {
    const pair = await this.chatRepository.findConversationPair(conversationId);
    if (!pair) {
      throw new NotFoundException('Conversation not found');
    }

    if (pair.user_low !== userId && pair.user_high !== userId) {
      throw new ForbiddenException('You are not part of this conversation');
    }

    return pair;
  }
}
