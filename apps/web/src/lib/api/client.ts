const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const AUTH_SKIP_REFRESH = [
  "/api/auth/refresh",
  "/api/auth/signin",
  "/api/auth/signup",
  "/api/auth/logout",
  "/api/auth/google",
  "/api/auth/google/dummy",
  "/api/auth/forgot-password",
  "/api/auth/verify-reset-code",
  "/api/auth/reset-password",
];

let refreshInFlight: Promise<boolean> | null = null;

function shouldAttemptRefresh(path: string): boolean {
  return !AUTH_SKIP_REFRESH.some((prefix) => path.startsWith(prefix));
}

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const request = () =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });

  const response = await request();
  if (response.status !== 401 || !shouldAttemptRefresh(path)) {
    return response;
  }

  const refreshed = await refreshSession();
  if (!refreshed) {
    return response;
  }

  const { reconnectChatSocket } = await import("@/lib/realtime/socket");
  reconnectChatSocket();

  return request();
}

export async function readApiError(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (typeof data === "object" && data && "message" in data) {
      const message = (data as { message: unknown }).message;
      if (typeof message === "string") {
        return message;
      }
      if (Array.isArray(message)) {
        return message.filter((item) => typeof item === "string").join(", ");
      }
    }
  } catch {
    // Use the HTTP status text when the body is not JSON.
  }

  return response.statusText || "Request failed";
}

export async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new ApiError(await readApiError(response), response.status);
  }

  return (await response.json()) as T;
}
