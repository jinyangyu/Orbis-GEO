/** Host used to fetch a brand favicon. Returns null when input is not a public hostname. */
export function brandLogoHost(input: string | null | undefined): string | null {
  if (!input) return null;
  let value = input.trim().toLowerCase();
  if (!value) return null;
  value = value.replace(/^https?:\/\//, "").replace(/^\/\//, "");
  value = value.split("/")[0]?.split("?")[0]?.split("#")[0] ?? "";
  value = value.replace(/^www\./, "").replace(/:\d+$/, "");
  if (!value || value.length > 253) return null;
  if (value === "localhost" || value.endsWith(".local")) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(value)) {
    return null;
  }
  return value;
}

export function brandLogoUrl(host: string, size = 64): string {
  return `https://www.google.com/s2/favicons?sz=${size}&domain=${encodeURIComponent(host)}`;
}

export function brandLogoFallbackUrl(host: string): string {
  return `https://icons.duckduckgo.com/ip3/${host}.ico`;
}

export function brandLetter(name: string): string {
  const ch = name.trim().slice(0, 1);
  return ch ? ch.toUpperCase() : "?";
}
