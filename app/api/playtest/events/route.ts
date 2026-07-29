import { createServerSupabaseClient } from "@/lib/game/supabase-repository";
import { authenticateApiRequest } from "@/lib/game/api-session";
import { clientPlaytestEventSchema } from "@/lib/playtest/schemas";
import { recordClientEvent } from "@/lib/playtest/server";
import { withSecurityHeaders } from "@/lib/security/http";

export const dynamic = "force-dynamic";
const MAX_EVENT_BYTES = 2 * 1024;

export async function POST(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_EVENT_BYTES) {
    return withSecurityHeaders(Response.json({ error: "event_too_large" }, { status: 413 }), request);
  }

  try {
    const rawText = await request.text();
    if (new TextEncoder().encode(rawText).byteLength > MAX_EVENT_BYTES) {
      return withSecurityHeaders(Response.json({ error: "event_too_large" }, { status: 413 }), request);
    }
    const parsed = clientPlaytestEventSchema.safeParse(JSON.parse(rawText || "null"));
    if (!parsed.success) {
      return withSecurityHeaders(Response.json({ error: "invalid_event" }, { status: 400 }), request);
    }
    const { user } = await authenticateApiRequest(request);
    await recordClientEvent(createServerSupabaseClient(), user.id, parsed.data);
    return withSecurityHeaders(new Response(null, { status: 204 }), request);
  } catch (error) {
    const code = error instanceof Error ? error.message : "playtest_event_failed";
    const status = code.startsWith("authentication_") ? 401 : 500;
    return withSecurityHeaders(Response.json({ error: status === 401 ? code : "playtest_event_failed" }, { status }), request);
  }
}

