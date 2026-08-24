"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  chatColleaguesQueryKey,
  chatConversationsQueryKey,
  chatMessagesQueryKey,
  listChatColleagues,
  listChatConversations,
  listChatMessages,
  openChatConversation,
  sendChatMessage,
  type ChatColleague,
  type ChatConversation,
  type ChatMessage,
  type ChatReceipt,
} from "@/lib/api/chat.api";
import { ApiError } from "@/lib/api/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { connectChatSocket, getChatSocket, releaseChatSocket } from "@/lib/realtime/socket";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCheck, MessageCircle, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function displayName(person: ChatColleague) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function patchReceipt(
  current: ChatMessage[] | undefined,
  receipt: ChatReceipt,
): ChatMessage[] | undefined {
  if (!current) {
    return current;
  }

  return current.map((item) =>
    item.id === receipt.messageId
      ? {
          ...item,
          deliveredAt: receipt.deliveredAt ?? item.deliveredAt,
          readAt: receipt.readAt ?? item.readAt,
        }
      : item,
  );
}

export function ChatPanel() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [typing, setTyping] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  selectedIdRef.current = selectedId;

  const colleaguesQuery = useQuery({
    queryKey: chatColleaguesQueryKey,
    queryFn: listChatColleagues,
  });

  const conversationsQuery = useQuery({
    queryKey: chatConversationsQueryKey,
    queryFn: listChatConversations,
  });

  const messagesQuery = useQuery({
    queryKey: chatMessagesQueryKey(selectedId ?? ""),
    queryFn: () => listChatMessages(selectedId!),
    enabled: Boolean(selectedId),
  });

  const openMutation = useMutation({
    mutationFn: openChatConversation,
    onSuccess: async (conversation) => {
      setSelectedId(conversation.id);
      await queryClient.invalidateQueries({
        queryKey: chatConversationsQueryKey,
      });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not start chat");
    },
  });

  useEffect(() => {
    const socket = connectChatSocket();

    function addMessage(message: ChatMessage) {
      let isNew = true;
      queryClient.setQueryData<ChatMessage[]>(
        chatMessagesQueryKey(message.conversationId),
        (current) => {
          if (!current) {
            return [message];
          }
          if (current.some((item) => item.id === message.id)) {
            isNew = false;
            return current;
          }
          return [...current, message];
        },
      );

      if (!isNew) {
        return;
      }

      const incoming = message.senderId !== user?.id;
      const viewing = selectedIdRef.current === message.conversationId;
      queryClient.setQueryData<ChatConversation[]>(
        chatConversationsQueryKey,
        (current) =>
          current?.map((item) => {
            if (item.id !== message.conversationId) {
              return item;
            }
            return {
              ...item,
              lastMessage: message.body,
              lastMessageAt: message.createdAt,
              unreadCount: incoming
                ? viewing
                  ? 0
                  : item.unreadCount + 1
                : item.unreadCount,
            };
          }),
      );

      if (incoming) {
        queryClient.setQueryData<ChatColleague[]>(
          chatColleaguesQueryKey,
          (current) =>
            current?.map((person) => {
              if (person.id !== message.senderId) {
                return person;
              }
              return {
                ...person,
                unreadCount: viewing
                  ? 0
                  : (person.unreadCount ?? 0) + 1,
              };
            }),
        );
        socket.emit("messageDelivered", { messageId: message.id });
        if (viewing) {
          socket.emit("messageRead", {
            conversationId: message.conversationId,
          });
        }
      }
    }

    function applyReceipt(receipt: ChatReceipt) {
      queryClient.setQueryData<ChatMessage[]>(
        chatMessagesQueryKey(receipt.conversationId),
        (current) => patchReceipt(current, receipt),
      );
    }

    function onNewMessage(message: ChatMessage) {
      addMessage(message);
    }

    function onTyping(payload: { conversationId: string; userId: string }) {
      if (
        payload.userId !== user?.id &&
        payload.conversationId === selectedIdRef.current
      ) {
        setTyping(true);
      }
    }

    function onStopTyping(payload: { conversationId: string }) {
      if (payload.conversationId === selectedIdRef.current) {
        setTyping(false);
      }
    }

    function onDelivered(receipt: ChatReceipt) {
      applyReceipt(receipt);
    }

    function onRead(receipt: ChatReceipt) {
      applyReceipt(receipt);
    }

    function onOnline(payload: { userId: string }) {
      setOnlineIds((current) => new Set(current).add(payload.userId));
    }

    function onOffline(payload: { userId: string }) {
      setOnlineIds((current) => {
        const next = new Set(current);
        next.delete(payload.userId);
        return next;
      });
    }

    socket.on("newMessage", onNewMessage);
    socket.on("typing", onTyping);
    socket.on("stopTyping", onStopTyping);
    socket.on("messageDelivered", onDelivered);
    socket.on("messageRead", onRead);
    socket.on("userOnline", onOnline);
    socket.on("userOffline", onOffline);

    return () => {
      socket.off("newMessage", onNewMessage);
      socket.off("typing", onTyping);
      socket.off("stopTyping", onStopTyping);
      socket.off("messageDelivered", onDelivered);
      socket.off("messageRead", onRead);
      socket.off("userOnline", onOnline);
      socket.off("userOffline", onOffline);
      releaseChatSocket();
    };
  }, [queryClient, user?.id]);

  useEffect(() => {
    if (!selectedId) {
      setTyping(false);
      return;
    }

    getChatSocket().emit("messageRead", { conversationId: selectedId });
    queryClient.setQueryData<ChatConversation[]>(
      chatConversationsQueryKey,
      (current) =>
        current?.map((item) =>
          item.id === selectedId ? { ...item, unreadCount: 0 } : item,
        ),
    );
    const otherId = conversationsQuery.data?.find(
      (item) => item.id === selectedId,
    )?.otherUser.id;
    if (otherId) {
      queryClient.setQueryData<ChatColleague[]>(
        chatColleaguesQueryKey,
        (current) =>
          current?.map((person) =>
            person.id === otherId ? { ...person, unreadCount: 0 } : person,
          ),
      );
    }
  }, [conversationsQuery.data, queryClient, selectedId]);

  useEffect(() => {
    const box = messagesRef.current;
    if (box) {
      box.scrollTop = box.scrollHeight;
    }
  }, [messagesQuery.data?.length, selectedId, typing]);

  const conversations = conversationsQuery.data ?? [];
  const colleagues = colleaguesQuery.data ?? [];
  const selected = conversations.find((item) => item.id === selectedId) ?? null;

  const peopleRows = useMemo(() => {
    return colleagues
      .map((person) => {
        const conversation = conversations.find(
          (item) => item.otherUser.id === person.id,
        );
        return {
          person,
          conversation,
          unreadCount:
            conversation?.unreadCount ?? person.unreadCount ?? 0,
        };
      })
      .sort((left, right) => {
        const leftAt = left.conversation?.lastMessageAt;
        const rightAt = right.conversation?.lastMessageAt;
        if (leftAt && rightAt) {
          return rightAt.localeCompare(leftAt);
        }
        if (leftAt) {
          return -1;
        }
        if (rightAt) {
          return 1;
        }
        return displayName(left.person).localeCompare(displayName(right.person));
      });
  }, [colleagues, conversations]);

  function selectPerson(person: ChatColleague) {
    const existing = conversations.find(
      (item) => item.otherUser.id === person.id,
    );
    if (existing) {
      setSelectedId(existing.id);
      return;
    }
    openMutation.mutate(person.id);
  }

  function emitTyping(nextDraft: string) {
    if (!selectedId) {
      return;
    }

    const socket = getChatSocket();
    if (nextDraft.trim()) {
      socket.emit("typing", { conversationId: selectedId });
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
      }
      typingTimer.current = setTimeout(() => {
        socket.emit("stopTyping", { conversationId: selectedId });
      }, 1200);
      return;
    }

    socket.emit("stopTyping", { conversationId: selectedId });
  }

  async function sendViaHttp(conversationId: string, body: string) {
    const message = await sendChatMessage(conversationId, body);
    queryClient.setQueryData<ChatMessage[]>(
      chatMessagesQueryKey(message.conversationId),
      (current) => {
        if (!current) {
          return [message];
        }
        if (current.some((item) => item.id === message.id)) {
          return current;
        }
        return [...current, message];
      },
    );
    await queryClient.invalidateQueries({
      queryKey: chatConversationsQueryKey,
    });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId || !draft.trim() || sending) {
      return;
    }

    const conversationId = selectedId;
    const body = draft.trim();
    setSending(true);
    setError(null);
    const socket = getChatSocket();
    socket.emit("stopTyping", { conversationId });

    const finishOk = () => {
      setSending(false);
      setDraft("");
    };
    const finishErr = (message: string) => {
      setSending(false);
      setError(message);
    };

    if (!socket.connected) {
      void sendViaHttp(conversationId, body).then(finishOk).catch((err) => {
        finishErr(err instanceof ApiError ? err.message : "Could not send message");
      });
      return;
    }

    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      void sendViaHttp(conversationId, body).then(finishOk).catch((err) => {
        finishErr(err instanceof ApiError ? err.message : "Could not send message");
      });
    }, 2000);

    socket.emit(
      "sendMessage",
      { conversationId, body },
      (result: { ok: boolean; error?: string }) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timer);
        if (!result?.ok) {
          finishErr(result?.error ?? "Could not send message");
          return;
        }
        finishOk();
      },
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
        <p className="text-sm text-muted-foreground">
          Live 1-to-1 chat with employees and admins.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border bg-card md:grid-cols-[16rem_1fr] lg:grid-cols-[18rem_1fr]">
        <aside className="flex min-h-0 flex-col border-b md:border-b-0 md:border-r">
          <p className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            People
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {peopleRows.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No other users yet. Sign up a second employee to chat.
              </p>
            ) : null}
            {peopleRows.map(({ person, conversation, unreadCount }) => (
              <PersonButton
                key={person.id}
                person={person}
                preview={conversation?.lastMessage}
                unreadCount={unreadCount}
                online={onlineIds.has(person.id)}
                active={conversation?.id === selectedId}
                onClick={() => {
                  if (conversation) {
                    setSelectedId(conversation.id);
                    return;
                  }
                  selectPerson(person);
                }}
              />
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          {selected ? (
            <>
              <header className="shrink-0 border-b px-4 py-3">
                <p className="flex items-center gap-2 font-medium">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      onlineIds.has(selected.otherUser.id)
                        ? "bg-emerald-500"
                        : "bg-muted-foreground/40",
                    )}
                  />
                  {displayName(selected.otherUser)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {onlineIds.has(selected.otherUser.id) ? "Online" : "Offline"}{" "}
                  · {selected.otherUser.role === "ADMIN" ? "Admin" : "Employee"}{" "}
                  · {selected.otherUser.email}
                </p>
              </header>
              <div
                ref={messagesRef}
                className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
              >
                {(messagesQuery.data ?? []).map((message) => {
                  const mine = message.senderId === user?.id;
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        mine ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                          mine
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted",
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {message.body}
                        </p>
                        <p
                          className={cn(
                            "mt-1 flex items-center justify-end gap-1 text-[10px]",
                            mine
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground",
                          )}
                        >
                          {formatTime(message.createdAt)}
                          {mine ? <ReceiptIcon message={message} /> : null}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {typing ? (
                  <p className="text-xs text-muted-foreground">Typing…</p>
                ) : null}
              </div>
              <form onSubmit={onSubmit} className="flex shrink-0 gap-2 border-t p-3">
                <Input
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    emitTyping(event.target.value);
                  }}
                  placeholder="Write a message"
                  maxLength={4000}
                  autoComplete="off"
                />
                <Button type="submit" disabled={!draft.trim() || sending}>
                  <Send className="size-4" />
                  Send
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
              <MessageCircle className="size-10 opacity-50" />
              <p className="text-sm">Select a person to start a live chat.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ReceiptIcon({ message }: { message: ChatMessage }) {
  if (message.readAt) {
    return <CheckCheck className="size-3.5 text-sky-400" />;
  }
  if (message.deliveredAt) {
    return <CheckCheck className="size-3 opacity-80" />;
  }
  return <Check className="size-3 opacity-70" />;
}

function PersonButton({
  person,
  preview,
  unreadCount = 0,
  online,
  active,
  onClick,
}: {
  person: ChatColleague;
  preview?: string | null;
  unreadCount?: number;
  online: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
        active && "bg-muted font-medium",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              online ? "bg-emerald-500" : "bg-muted-foreground/40",
            )}
          />
          <span className="truncate">{displayName(person)}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {person.role === "ADMIN" ? "Admin" : "Employee"}
          </span>
        </span>
        {preview ? (
          <span
            className={cn(
              "mt-0.5 line-clamp-1 block pl-4 text-xs font-normal",
              unreadCount > 0
                ? "font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            {preview}
          </span>
        ) : null}
      </span>
      {unreadCount > 0 ? (
        <span className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 px-1.5 text-[11px] font-bold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </button>
  );
}
