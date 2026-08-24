import { io, type Socket } from "socket.io-client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

let socket: Socket | null = null;
let subscribers = 0;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function getChatSocket(): Socket {
  if (!socket) {
    socket = io(`${API_BASE_URL}/realtime`, {
      withCredentials: true,
      autoConnect: false,
      transports: ["polling", "websocket"],
      reconnection: true,
    });
  }

  return socket;
}

export function connectChatSocket(): Socket {
  const client = getChatSocket();
  subscribers += 1;
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  if (!client.connected) {
    client.connect();
  }
  return client;
}

export function reconnectChatSocket(): void {
  if (!socket || subscribers <= 0) {
    return;
  }

  if (socket.connected) {
    socket.disconnect();
  }
  socket.connect();
}

export function releaseChatSocket(): void {
  subscribers = Math.max(0, subscribers - 1);
  if (subscribers > 0) {
    return;
  }

  disconnectTimer = setTimeout(() => {
    socket?.disconnect();
    disconnectTimer = null;
  }, 400);
}
