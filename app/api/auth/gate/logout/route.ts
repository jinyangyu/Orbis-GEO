import { buildClearGateCookieHeader, isGateEnabled } from "@/lib/auth/gate";

export async function POST() {
  return Response.json(
    { ok: true, enabled: isGateEnabled() },
    {
      headers: {
        "set-cookie": buildClearGateCookieHeader(),
      },
    },
  );
}
