import {
  buildClearGateCookieHeader,
  isGateEnabled,
} from "@/lib/auth/gate";
import { buildClearSessionCookieHeader } from "@/lib/auth/session";

export async function POST() {
  const headers = new Headers();
  headers.append("set-cookie", buildClearSessionCookieHeader());
  if (isGateEnabled()) {
    headers.append("set-cookie", buildClearGateCookieHeader());
  }
  return Response.json({ ok: true }, { headers });
}
