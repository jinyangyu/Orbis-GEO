import { withDb } from "@/db";
import { UserIdRequiredError, requireUserId } from "@/lib/identity";
import { deleteCompetitor, updateBrand } from "@/lib/brands/service";

function errorResponse(error: unknown) {
  if (error instanceof UserIdRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status =
    message.includes("access denied") || message.includes("not found")
      ? 404
      : message.includes("DATABASE_URL")
        ? 503
        : message.includes("不能")
          ? 400
          : 500;
  return Response.json({ error: message }, { status });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
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
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const userId = requireUserId(_request);
    const params = await Promise.resolve(context.params);
    await withDb((db) => deleteCompetitor(db, userId, params.id));
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
