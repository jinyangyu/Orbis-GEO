const PRIVATE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "metadata.google.internal",
]);

function isIpv4Private(hostname: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function isIpv6Local(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h.includes(":")) return false;
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(h);
  if (mapped && isIpv4Private(mapped[1])) return true;
  if (h.startsWith("fe80:")) return true;
  // Unique-local fc00::/7 (includes cloud metadata such as fd00:ec2::254)
  if (h.startsWith("fc") || h.startsWith("fd")) return true;
  return false;
}

function isLoopbackLike(hostname: string): boolean {
  return hostname === "127.1" || hostname.startsWith("127.");
}

export function assertSafeOutboundUrl(
  raw: string,
  opts?: { productionHttpsOnly?: boolean },
): URL {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("URL 为空");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("URL 无效");
  }
  const proto = parsed.protocol.toLowerCase();
  if (proto !== "http:" && proto !== "https:") {
    throw new Error("仅支持 http(s) URL");
  }
  const productionHttpsOnly =
    opts?.productionHttpsOnly ??
    (process.env.NODE_ENV ?? "").trim() === "production";
  if (productionHttpsOnly && proto !== "https:") {
    throw new Error("生产环境 Webhook 仅允许 https");
  }
  const host = parsed.hostname.toLowerCase();
  if (
    PRIVATE_HOSTS.has(host) ||
    isLoopbackLike(host) ||
    isIpv4Private(host) ||
    isIpv6Local(host)
  ) {
    throw new Error("不允许指向内网或本机的 URL");
  }
  return parsed;
}

export function isSafeOutboundUrl(raw: string): boolean {
  try {
    assertSafeOutboundUrl(raw);
    return true;
  } catch {
    return false;
  }
}
