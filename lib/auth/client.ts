/**
 * Client helpers for session bootstrap. API credentials must include cookies.
 */
import {
  authHeaders,
  getOrCreateClientUserId,
} from "@/lib/identity";

export type BootstrapResult = {
  userId: string;
  devOpenTenant: boolean;
};

let bootstrapPromise: Promise<BootstrapResult> | null = null;

export async function bootstrapSession(): Promise<BootstrapResult> {
  if (typeof window === "undefined") {
    throw new Error("bootstrapSession is client-only");
  }
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const proposed = getOrCreateClientUserId();
      const res = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: authHeaders(proposed),
        credentials: "include",
        cache: "no-store",
      });
      // note: bootstrap itself must use credentials to store Set-Cookie
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        bootstrapPromise = null;
        throw new Error(body.error ?? `Session bootstrap failed (${res.status})`);
      }
      const data = (await res.json()) as {
        userId: string;
        devOpenTenant?: boolean;
      };
      try {
        window.localStorage.setItem("orbis_user_id", data.userId);
      } catch {
        /* ignore */
      }
      return {
        userId: data.userId,
        devOpenTenant: data.devOpenTenant === true,
      };
    })();
  }
  return bootstrapPromise;
}

/** Reset in-memory bootstrap latch (e.g. after logout). */
export function resetBootstrapLatch() {
  bootstrapPromise = null;
}
