import {
  allowRateLimit,
  clientIp,
  tooManyRequests,
} from "@/lib/http/rate-limit";
import {
  buildGateCookieHeader,
  isGateEnabled,
  signGateToken,
  verifyGateCredentials,
} from "@/lib/auth/gate";

export async function POST(request: Request) {
  if (!isGateEnabled()) {
    return Response.json(
      { error: "未启用门禁（请配置 ORBIS_GATE_USER / ORBIS_GATE_PASSWORD）" },
      { status: 503 },
    );
  }
  if (
    !allowRateLimit(`gate-login:${clientIp(request)}`, {
      windowMs: 60_000,
      max: 20,
    })
  ) {
    return tooManyRequests(60);
  }

  let body: { username?: string; password?: string } = {};
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    return Response.json({ error: "无效请求" }, { status: 400 });
  }

  const username = String(body.username ?? "");
  const password = String(body.password ?? "");
  if (!verifyGateCredentials(username, password)) {
    return Response.json({ error: "账号或密码错误" }, { status: 401 });
  }

  const token = signGateToken();
  return Response.json(
    { ok: true },
    {
      headers: {
        "set-cookie": buildGateCookieHeader(token),
      },
    },
  );
}
