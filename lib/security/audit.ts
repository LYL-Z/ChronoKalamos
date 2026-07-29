export type SecurityAuditEvent = {
  event:
    | "turn.request_rejected"
    | "turn.authentication_failed"
    | "turn.configuration_failed"
    | "turn.started"
    | "turn.failed"
    | "turn.committed";
  outcome: "allowed" | "denied" | "failed" | "succeeded";
  requestId: string;
  actorId?: string;
  code?: string;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function actorHash(
  actorId: string | undefined,
  salt: string | undefined,
): Promise<string | undefined> {
  if (!actorId || !salt?.trim()) return undefined;
  const input = new TextEncoder().encode(`${salt.trim()}:${actorId}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return bytesToHex(new Uint8Array(digest)).slice(0, 24);
}

/**
 * Emit one structured, deliberately sparse security event. Never add request
 * bodies, prompts, narrative text, email addresses, phone numbers, IP
 * addresses, bearer tokens, cookies, provider responses, or credentials.
 */
export async function writeSecurityAudit(
  input: SecurityAuditEvent,
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const pseudonymousActor = await actorHash(input.actorId, env.SECURITY_AUDIT_SALT);
  const record = {
    timestamp: new Date().toISOString(),
    service: "chronokalamos",
    event: input.event,
    outcome: input.outcome,
    requestId: input.requestId,
    ...(input.code ? { code: input.code.slice(0, 64) } : {}),
    ...(pseudonymousActor ? { actorHash: pseudonymousActor } : {}),
  };
  console.info(JSON.stringify(record));
}
