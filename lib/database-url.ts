export type MysqlConnectionOptions = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

/** MySQL treats localhost (unix socket) and 127.0.0.1 (TCP) as different users. */
export function normalizeMysqlHost(host: string): string {
  return host === "localhost" || host === "::1" ? "127.0.0.1" : host;
}

export function parseDatabaseUrl(url: string): MysqlConnectionOptions {
  const parsed = new URL(url.trim());
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!parsed.username || !database) {
    throw new Error(
      "DATABASE_URL must be mysql://USER:PASSWORD@127.0.0.1:3306/DATABASE",
    );
  }
  return {
    host: normalizeMysqlHost(parsed.hostname || "127.0.0.1"),
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
  };
}

export function requireDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = (env.DATABASE_URL ?? "").trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Copy .env.example to .env.local and set this machine's MySQL user/password (host must be 127.0.0.1).",
    );
  }
  return url;
}
