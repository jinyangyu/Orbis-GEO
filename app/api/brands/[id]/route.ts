import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { deleteCompetitor, updateBrand } from "@/lib/brands/service";


export const PATCH = withApi(async (
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) => {
    const userId = requireUserId(request);
    const params = await Promise.resolve(context.params);
    const body = (await request.json()) as {
      name?: string;
      domain?: string;
      aliases?: string[];
      domainAliases?: string[];
      includeSubdomains?: boolean;
      market?: string;
      language?: string;
      mark?: string;
      color?: string;
    };
    const brand = await withDb((db) =>
      updateBrand(db, userId, params.id, body),
    );
    return Response.json(brand);
});

export const DELETE = withApi(async (
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) => {
    const userId = requireUserId(_request);
    const params = await Promise.resolve(context.params);
    await withDb((db) => deleteCompetitor(db, userId, params.id));
    return Response.json({ ok: true });
});
