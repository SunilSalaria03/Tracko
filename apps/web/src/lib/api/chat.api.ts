import { apiFetch, parseJson } from "@/lib/api/client";

export type ChatColleague = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
  unreadCount?: number;
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

export const chatColleaguesQueryKey = ["chat", "colleagues"] as const;
export const chatConversationsQueryKey = ["chat", "conversations"] as const;
export const chatMessagesQueryKey = (conversationId: string) =>
  ["chat", "messages", conversationId] as const;

export async function listChatColleagues(): Promise<ChatColleague[]> {
  const response = await apiFetch("/api/chat/colleagues");
  return parseJson<ChatColleague[]>(response);
}

export async function listChatConversations(): Promise<ChatConversation[]> {
  const response = await apiFetch("/api/chat/conversations");
  return parseJson<ChatConversation[]>(response);
}

export async function openChatConversation(
  otherUserId: string,
): Promise<ChatConversation> {
  const response = await apiFetch("/api/chat/conversations", {
    method: "POST",
    body: JSON.stringify({ otherUserId }),
  });
  return parseJson<ChatConversation>(response);
}

export async function listChatMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  const response = await apiFetch(
    `/api/chat/conversations/${conversationId}/messages`,
  );
  return parseJson<ChatMessage[]>(response);
}

export async function sendChatMessage(
  conversationId: string,
  body: string,
): Promise<ChatMessage> {
  const response = await apiFetch(
    `/api/chat/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    },
  );
  return parseJson<ChatMessage>(response);
}
