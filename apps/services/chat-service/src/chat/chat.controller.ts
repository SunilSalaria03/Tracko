import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { PublicUser } from '../users/user.types';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { CreateConversationDto, SendMessageDto } from './dto/chat.dto';
import type {
  ChatColleague,
  ChatConversation,
  ChatMessage,
} from './chat.types';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('colleagues')
  listColleagues(@CurrentUser() user: PublicUser): Promise<ChatColleague[]> {
    return this.chatService.listColleagues(user);
  }

  @Get('conversations')
  listConversations(
    @CurrentUser() user: PublicUser,
  ): Promise<ChatConversation[]> {
    return this.chatService.listConversations(user);
  }

  @Post('conversations')
  createConversation(
    @CurrentUser() user: PublicUser,
    @Body() dto: CreateConversationDto,
  ): Promise<ChatConversation> {
    return this.chatService.getOrCreateConversation(user, dto.otherUserId);
  }

  @Get('conversations/:id/messages')
  listMessages(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ChatMessage[]> {
    return this.chatService.listMessages(user, id);
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ): Promise<ChatMessage> {
    const { message, recipientId } = await this.chatService.sendMessage(
      user.id,
      id,
      dto.body,
    );
    await this.chatGateway.broadcastNewMessage(user.id, recipientId, message);
    return message;
  }
}
