import {
  authHeaders,
  getOrCreateClientUserId,
} from "@/lib/identity";

/** Authenticated API fetch: always send cookies + bootstrap hint header. */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const hint = authHeaders(getOrCreateClientUserId());
  for (const [k, v] of Object.entries(hint)) {
    if (!headers.has(k)) headers.set(k, String(v));
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}
