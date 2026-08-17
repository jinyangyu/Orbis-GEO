import { createHmac, createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MiB

export type StoredObject = {
  /** Stored in report_exports.file_path */
  filePath: string;
  bytes: number;
};

function storageMode(): "local" | "s3" {
  const mode = (process.env.REPORTS_STORAGE ?? "local").trim().toLowerCase();
  return mode === "s3" ? "s3" : "local";
}

function localRoot(): string {
  const raw = (process.env.REPORTS_LOCAL_DIR ?? ".data/reports").trim();
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
}

function objectKey(workspaceId: string, exportId: string): string {
  return `${workspaceId}/${exportId}.pdf`;
}

export function isStoredFilePath(filePath: string | null | undefined): boolean {
  if (!filePath) return false;
  return filePath.startsWith("local:") || filePath.startsWith("s3:");
}

export function parseStoredFilePath(
  filePath: string,
): { backend: "local" | "s3"; key: string } | null {
  if (filePath.startsWith("local:")) {
    return { backend: "local", key: filePath.slice("local:".length) };
  }
  if (filePath.startsWith("s3:")) {
    return { backend: "s3", key: filePath.slice("s3:".length) };
  }
  return null;
}

export async function putReportPdf(
  workspaceId: string,
  exportId: string,
  body: Uint8Array,
): Promise<StoredObject> {
  if (body.byteLength === 0) throw new Error("空文件");
  if (body.byteLength > MAX_BYTES) {
    throw new Error(`PDF 超过 ${MAX_BYTES / (1024 * 1024)}MB 限制`);
  }
  const key = objectKey(workspaceId, exportId);
  if (storageMode() === "s3") {
    await s3Put(key, body);
    return { filePath: `s3:${key}`, bytes: body.byteLength };
  }
  const full = path.join(localRoot(), key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
  return { filePath: `local:${key}`, bytes: body.byteLength };
}

export async function getReportPdf(
  filePath: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const parsed = parseStoredFilePath(filePath);
  if (!parsed) return null;
  if (parsed.backend === "s3") {
    const bytes = await s3Get(parsed.key);
    return bytes ? { bytes, contentType: "application/pdf" } : null;
  }
  try {
    const full = path.join(localRoot(), parsed.key);
    const buf = await readFile(full);
    return { bytes: new Uint8Array(buf), contentType: "application/pdf" };
  } catch {
    return null;
  }
}

export async function deleteReportPdf(
  filePath: string | null | undefined,
): Promise<void> {
  const parsed = filePath ? parseStoredFilePath(filePath) : null;
  if (!parsed) return;
  if (parsed.backend === "s3") {
    await s3Delete(parsed.key).catch(() => undefined);
    return;
  }
  try {
    await unlink(path.join(localRoot(), parsed.key));
  } catch {
    /* missing ok */
  }
}

/* ——— minimal S3/R2 SigV4 (Put/Get/Delete) ——— */

function s3Config() {
  const endpoint = (process.env.REPORTS_S3_ENDPOINT ?? "").trim().replace(/\/$/, "");
  const bucket = (process.env.REPORTS_S3_BUCKET ?? "").trim();
  const accessKeyId = (process.env.REPORTS_S3_ACCESS_KEY_ID ?? "").trim();
  const secretAccessKey = (process.env.REPORTS_S3_SECRET_ACCESS_KEY ?? "").trim();
  const region = (process.env.REPORTS_S3_REGION ?? "auto").trim() || "auto";
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3 存储未配置：需要 REPORTS_S3_ENDPOINT / BUCKET / ACCESS_KEY_ID / SECRET_ACCESS_KEY",
    );
  }
  return { endpoint, bucket, accessKeyId, secretAccessKey, region };
}

function sha256Hex(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function amzDate(d = new Date()): { amz: string; day: string } {
  const iso = d.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amz: iso, day: iso.slice(0, 8) };
}

async function s3SignedRequest(
  method: string,
  key: string,
  body?: Uint8Array,
): Promise<Response> {
  const cfg = s3Config();
  const { amz, day } = amzDate();
  const host = new URL(cfg.endpoint).host;
  const canonicalUri = `/${cfg.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const payloadHash = body ? sha256Hex(body) : sha256Hex("");
  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amz}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${day}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, day);
  const kRegion = hmac(kDate, cfg.region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `${cfg.endpoint}/${cfg.bucket}/${key}`;
  return fetch(url, {
    method,
    headers: {
      host,
      "x-amz-date": amz,
      "x-amz-content-sha256": payloadHash,
      authorization,
      ...(body
        ? {
            "content-type": "application/pdf",
            "content-length": String(body.byteLength),
          }
        : {}),
    },
    body: body ? Buffer.from(body) : undefined,
  });
}

async function s3Put(key: string, body: Uint8Array): Promise<void> {
  const res = await s3SignedRequest("PUT", key, body);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`S3 PUT 失败 (${res.status}): ${text.slice(0, 200)}`);
  }
}

async function s3Get(key: string): Promise<Uint8Array | null> {
  const res = await s3SignedRequest("GET", key);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`S3 GET 失败 (${res.status}): ${text.slice(0, 200)}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function s3Delete(key: string): Promise<void> {
  const res = await s3SignedRequest("DELETE", key);
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`S3 DELETE 失败 (${res.status}): ${text.slice(0, 200)}`);
  }
}
