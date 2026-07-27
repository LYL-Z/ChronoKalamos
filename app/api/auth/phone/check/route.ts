import { getPhoneAuthReadiness } from "@/lib/auth/phone/config";
import { getPhoneAuthProvider, PhoneProviderError } from "@/lib/auth/phone/provider";
import { recordPhoneAudit, requestIp, PhoneGuardrailError } from "@/lib/auth/phone/guardrails";
import { verifyTurnstileToken, TurnstileVerificationError } from "@/lib/security/turnstile";
import { withSecurityHeaders } from "@/lib/security/http";
import { z } from "zod";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 8 * 1024;
const requestSchema = z.object({
  phone: z.string().min(1).max(64),
  code: z.string().regex(/^\d{4,10}$/),
  turnstileToken: z.string().min(1).max(4096),
  requestId: z.string().uuid().optional(),
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

async function bestEffortAudit(input: Parameters<typeof recordPhoneAudit>[0]): Promise<void> {
  try {
    await recordPhoneAudit(input);
  } catch {
    // Do not replace the user-facing verification error with an audit detail.
  }
}

export async function POST(request: Request): Promise<Response> {
  const readiness = getPhoneAuthReadiness();
  if (!readiness.enabled) {
    return response(request, {
      code: "phone_auth_not_enabled",
      message: "手机号登录仍处于准备阶段，当前不会校验真实短信。",
      readiness,
    }, 503);
  }

  const parsed = requestSchema.safeParse(await readBody(request));
  if (!parsed.success) {
    return response(request, { code: "invalid_parameter", message: "手机号、验证码、Turnstile 令牌或请求 ID 格式无效。" }, 400);
  }

  const requestId = parsed.data.requestId ?? crypto.randomUUID();
  const ip = requestIp(request);
  try {
    await verifyTurnstileToken({
      token: parsed.data.turnstileToken,
      remoteIp: ip,
      expectedAction: "phone-auth",
      expectedHostname: process.env.TURNSTILE_EXPECTED_HOSTNAME,
    });
    const provider = getPhoneAuthProvider(readiness.providerMode);
    const result = await provider.check(parsed.data.phone, parsed.data.code);
    await recordPhoneAudit({
      requestId,
      operation: "check",
      phone: parsed.data.phone,
      ip,
      provider: readiness.providerMode,
      resultCode: result.status === "approved" ? "approved" : result.status,
      providerStatus: result.status,
      providerRequestId: result.sid,
    });
    return response(request, {
      approved: result.status === "approved",
      status: result.status,
      destination: result.to,
      requestId,
    }, result.status === "approved" ? 200 : 400);
  } catch (error) {
    if (error instanceof TurnstileVerificationError) {
      await bestEffortAudit({
        requestId,
        operation: "check",
        phone: parsed.data.phone,
        ip,
        provider: readiness.providerMode,
        resultCode: "turnstile_rejected",
      });
      return response(request, { code: "turnstile_required", message: error.message }, 400);
    }
    if (error instanceof PhoneProviderError) {
      await bestEffortAudit({
        requestId,
        operation: "check",
        phone: parsed.data.phone,
        ip,
        provider: readiness.providerMode,
        resultCode: error.code,
      });
      return response(request, { code: error.code, message: error.message, retryable: error.retryable }, error.status);
    }
    if (error instanceof PhoneGuardrailError) {
      return response(request, { code: error.code, message: error.message }, 503);
    }
    return response(request, { code: "phone_auth_failed", message: "手机号验证暂时失败，请稍后再试。" }, 502);
  }
}
