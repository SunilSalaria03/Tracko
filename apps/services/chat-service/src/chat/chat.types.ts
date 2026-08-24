export type ChatColleague = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
  unreadCount: number;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
};

export type ChatConversation = {
  id: string;
  otherUser: ChatColleague;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

export type ChatReceipt = {
  messageId: string;
  conversationId: string;
  senderId: string;
  deliveredAt?: string | null;
  readAt?: string | null;
};

export type ChatTypingPayload = {
  conversationId: string;
  userId: string;
};

export type ChatPresencePayload = {
  userId: string;
};
