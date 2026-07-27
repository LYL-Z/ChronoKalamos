import { getPhoneAuthReadiness } from "@/lib/auth/phone/config";
import { getPhoneAuthProvider, PhoneProviderError } from "@/lib/auth/phone/provider";
import { completePhoneSend, recordPhoneAudit, requestIp, reservePhoneSend, PhoneGuardrailError } from "@/lib/auth/phone/guardrails";
import {
  bearerAccessToken,
  PhoneIdentityError,
  preflightPhoneIdentityBinding,
} from "@/lib/auth/phone/identity-binding";
import { verifyTurnstileToken, TurnstileVerificationError } from "@/lib/security/turnstile";
import { withSecurityHeaders } from "@/lib/security/http";
import { z } from "zod";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 8 * 1024;
const requestSchema = z.object({
  phone: z.string().min(1).max(64),
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

function requestIdOrNew(candidate?: string): string {
  return candidate ?? crypto.randomUUID();
}

async function bestEffortAudit(input: Parameters<typeof recordPhoneAudit>[0]): Promise<void> {
  try {
    await recordPhoneAudit(input);
  } catch {
    // Audit failure must not expose a server credential or replace the
    // original provider/captcha error. The next alert is the operational log.
  }
}

export async function POST(request: Request): Promise<Response> {
  const readiness = getPhoneAuthReadiness();
  if (!readiness.enabled) {
    return response(request, {
      code: "phone_auth_not_enabled",
      message: "手机号登录仍处于准备阶段，当前不会发送真实短信。",
      readiness,
    }, 503);
  }

  const parsed = requestSchema.safeParse(await readBody(request));
  if (!parsed.success) {
    return response(request, { code: "invalid_parameter", message: "手机号、Turnstile 令牌或请求 ID 格式无效。" }, 400);
  }

  const requestId = requestIdOrNew(parsed.data.requestId);
  const ip = requestIp(request);
  try {
    const accessToken = bearerAccessToken(request);
    await preflightPhoneIdentityBinding({
      accessToken,
      phone: parsed.data.phone,
    });
    await verifyTurnstileToken({
      token: parsed.data.turnstileToken,
      remoteIp: ip,
      expectedAction: "phone-auth",
      expectedHostname: process.env.TURNSTILE_EXPECTED_HOSTNAME,
      idempotencyKey: requestId,
    });

    const reservation = await reservePhoneSend({
      requestId,
      phone: parsed.data.phone,
      ip,
      provider: readiness.providerMode,
    });
    if (reservation.status !== "reserved") {
      const code = reservation.status === "duplicate" ? "duplicate_request" : reservation.status;
      const status = reservation.status === "duplicate" ? 409 : 429;
      return response(request, { code, message: code === "phone_cooldown" ? "同一手机号 60 秒内只能发送一次。" : code === "ip_daily_limit" ? "当前 IP 已达到每日短信上限。" : code === "daily_limit" ? "今日短信预算已用尽，已自动停止真实调用。" : "该请求已处理，不会重复发送短信。" }, status);
    }

    const provider = getPhoneAuthProvider(readiness.providerMode);
    try {
      const result = await provider.send(parsed.data.phone);
      await completePhoneSend({
        requestId,
        resultCode: "sent",
        providerStatus: result.status,
        providerRequestId: result.sid,
      });
      return response(request, {
        status: result.status,
        channel: result.channel,
        destination: result.to,
        requestId,
      }, 202);
    } catch (error) {
      const providerError = error instanceof PhoneProviderError
        ? error
        : new PhoneProviderError("provider_unavailable", "短信供应商暂时不可用，请稍后再试。", 502, true);
      await completePhoneSend({ requestId, resultCode: providerError.code });
      throw providerError;
    }
  } catch (error) {
    if (error instanceof PhoneIdentityError) {
      await bestEffortAudit({
        requestId,
        operation: "send",
        phone: parsed.data.phone,
        ip,
        provider: readiness.providerMode,
        resultCode: error.code,
        metadata: { identityPreflight: false },
      });
      return response(request, { code: error.code, message: error.message }, error.status);
    }
    if (error instanceof TurnstileVerificationError) {
      await bestEffortAudit({
        requestId,
        operation: "send",
        phone: parsed.data.phone,
        ip,
        provider: readiness.providerMode,
        resultCode: "turnstile_rejected",
      });
      return response(request, { code: "turnstile_required", message: error.message }, 400);
    }
    if (error instanceof PhoneProviderError) {
      return response(request, { code: error.code, message: error.message, retryable: error.retryable }, error.status);
    }
    if (error instanceof PhoneGuardrailError) {
      return response(request, { code: error.code, message: error.message }, 503);
    }
    if (error instanceof Error && error.message === "phone_number_invalid") {
      await bestEffortAudit({
        requestId,
        operation: "send",
        phone: parsed.data.phone,
        ip,
        provider: readiness.providerMode,
        resultCode: "invalid_parameter",
      });
      return response(request, { code: "invalid_parameter", message: "当前准备版只接受中国大陆 E.164 手机号。" }, 400);
    }
    return response(request, { code: "phone_auth_failed", message: "手机号验证暂时失败，请稍后再试。" }, 502);
  }
}
