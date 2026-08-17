import { isUuid, newUserId } from "@/lib/uuid";

export { isUuid, newUserId } from "@/lib/uuid";

export const ORBIS_USER_ID_KEY = "orbis_user_id";
export const ORBIS_USER_ID_HEADER = "x-orbis-user-id";

/** Client: get or create local user id in localStorage (bootstrap hint only). */
export function getOrCreateClientUserId(): string {
  try {
    const existing = window.localStorage.getItem(ORBIS_USER_ID_KEY);
    if (existing && isUuid(existing)) return existing;
    const id = newUserId();
    window.localStorage.setItem(ORBIS_USER_ID_KEY, id);
    return id;
  } catch {
    return newUserId();
  }
}

export function authHeaders(userId: string): HeadersInit {
  return { [ORBIS_USER_ID_HEADER]: userId };
}

export class UserIdRequiredError extends Error {
  constructor() {
    super("Missing or invalid session cookie");
    this.name = "UserIdRequiredError";
  }
}
