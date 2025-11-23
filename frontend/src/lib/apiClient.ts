const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";

type ApiOptions = RequestInit & {
  token?: string;
};

async function apiFetch<T>(path: string, options: ApiOptions): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "API request failed");
  }

  // Attempt to parse JSON; if empty body, return as unknown
  try {
    return (await response.json()) as T;
  } catch {
    return undefined as T;
  }
}

export interface TicketPayload {
  drawDate: string;
  numbers: string;
  serial: string;
  imageUrl?: string;
  meta?: Record<string, unknown>;
}

export async function submitTicket(payload: TicketPayload, token: string) {
  return apiFetch<{ id: string }>("/api/tickets", {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}

