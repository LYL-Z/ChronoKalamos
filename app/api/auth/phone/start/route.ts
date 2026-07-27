import { getPhoneAuthReadiness } from "@/lib/auth/phone/config";
import { sendTwilioVerification, TwilioVerifyError } from "@/lib/auth/phone/twilio-verify";
import { withSecurityHeaders } from "@/lib/security/http";
import { z } from "zod";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 8 * 1024;
const requestSchema = z.object({
  phone: z.string().min(1).max(64),
  turnstileToken: z.string().min(1).max(4096),
}).strict();

async function readBody(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function response(request: Request, body: unknown, status: number): Response {
  return withSecurityHeaders(Response.json(body, { status }), request);
}

export async function POST(request: Request): Promise<Response> {
  const readiness = getPhoneAuthReadiness();
  if (!readiness.enabled) {
    return response(request, {
      code: "phone_auth_not_enabled",
      message: "中国大陆手机号登录仍处于准备阶段，当前不会发送真实短信。",
      readiness,
    }, 503);
  }

  const parsed = requestSchema.safeParse(await readBody(request));
  if (!parsed.success) {
    return response(request, { code: "invalid_request", message: "手机号或 Turnstile 令牌格式无效。" }, 400);
  }

  try {
    const result = await sendTwilioVerification({
      phone: parsed.data.phone,
      turnstileToken: parsed.data.turnstileToken,
      remoteIp: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });
    return response(request, {
      status: result.status,
      channel: result.channel,
      destination: result.to,
    }, 202);
  } catch (error) {
    if (error instanceof TwilioVerifyError) {
      return response(request, { code: error.code, message: error.message }, 400);
    }
    return response(request, { code: "phone_auth_failed", message: "手机号验证暂时失败。" }, 502);
  }
}
