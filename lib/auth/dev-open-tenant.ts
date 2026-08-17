type EnvSlice = {
  NODE_ENV?: string;
  ORBIS_DEV_OPEN_TENANT?: string;
};

export function isDevOpenTenant(env: EnvSlice = process.env): boolean {
  if ((env.NODE_ENV ?? "").trim() === "production") return false;
  return (env.ORBIS_DEV_OPEN_TENANT ?? "").trim() === "1";
}
