import { z } from "zod";

const turnstileResponseSchema = z.object({
  success: z.boolean(),
  action: z.string().optional(),
  hostname: z.string().optional(),
  cdata: z.string().optional(),
  "error-codes": z.array(z.string()).optional(),
}).passthrough();

export type TurnstileVerification = {
  success: boolean;
  action?: string;
  hostname?: string;
  errorCodes: string[];
};

export class TurnstileVerificationError extends Error {
  constructor(
    public readonly code:
      | "turnstile_not_configured"
      | "turnstile_request_failed"
      | "turnstile_invalid_response"
      | "turnstile_rejected",
    message: string,
  ) {
    super(message);
    this.name = "TurnstileVerificationError";
  }
}

export type VerifyTurnstileOptions = {
  token: string;
  remoteIp?: string;
  expectedAction?: string;
  expectedHostname?: string;
  secret?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

/**
 * Turnstile verification is intentionally server-side only. The secret is
 * read by the caller from a server runtime environment and is never returned.
 */
export async function verifyTurnstileToken({
  token,
  remoteIp,
  expectedAction,
  expectedHostname,
  secret = process.env.TURNSTILE_SECRET,
  fetcher = fetch,
  timeoutMs = 5000,
}: VerifyTurnstileOptions): Promise<TurnstileVerification> {
  const normalizedToken = token.trim();
  if (!secret?.trim()) {
    throw new TurnstileVerificationError(
      "turnstile_not_configured",
      "Cloudflare Turnstile 服务端密钥尚未配置。",
    );
  }
  if (!normalizedToken) {
    throw new TurnstileVerificationError(
      "turnstile_rejected",
      "Turnstile 验证令牌为空。",
    );
  }

  const body = new URLSearchParams({
    secret: secret.trim(),
    response: normalizedToken,
  });
  if (remoteIp?.trim()) body.set("remoteip", remoteIp.trim());

  let response: Response;
  try {
    response = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new TurnstileVerificationError(
      "turnstile_request_failed",
      "Turnstile 验证服务暂时不可用。",
    );
  }

  const payload: unknown = await response.json().catch(() => null);
  const parsed = turnstileResponseSchema.safeParse(payload);
  if (!response.ok || !parsed.success) {
    throw new TurnstileVerificationError(
      "turnstile_invalid_response",
      "Turnstile 返回了无法验证的响应。",
    );
  }

  const result = parsed.data;
  const errorCodes = result["error-codes"] ?? [];
  if (!result.success) {
    throw new TurnstileVerificationError(
      "turnstile_rejected",
      "Turnstile 未通过验证。",
    );
  }
  if (expectedAction && result.action !== expectedAction) {
    throw new TurnstileVerificationError(
      "turnstile_rejected",
      "Turnstile action 与当前操作不匹配。",
    );
  }
  if (expectedHostname && result.hostname !== expectedHostname) {
    throw new TurnstileVerificationError(
      "turnstile_rejected",
      "Turnstile hostname 与当前站点不匹配。",
    );
  }

  return {
    success: true,
    action: result.action,
    hostname: result.hostname,
    errorCodes,
  };
}
