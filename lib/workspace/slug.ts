/** Build a URL-safe workspace slug from brand website or name. */
export function buildWorkspaceSlug(input: {
  website?: string;
  name?: string;
  fallbackId?: string;
}): string {
  const website = (input.website ?? "").trim().toLowerCase();
  const name = (input.name ?? "").trim().toLowerCase();

  let base = "";
  if (website) {
    base = website
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .replace(/:\d+$/, "");
  }
  if (!base && name) {
    base = name;
  }
  if (!base) {
    base = input.fallbackId ?? "workspace";
  }

  const slug = base
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/\.+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);

  return slug || "workspace";
}
