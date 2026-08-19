import { isGateEnabled, readGateOk } from "@/lib/auth/gate";

export async function GET(request: Request) {
  const required = isGateEnabled();
  return Response.json({
    required,
    ok: required ? readGateOk(request) : true,
  });
}
