"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authoritativeSystemActionRequestSchema,
  committedSystemActionSchema,
  turnRequestSchema,
  turnStreamEventSchema,
  type AuthoritativeSystemActionRequest,
  type CommittedSystemAction,
  type TurnRequest,
  type TurnStreamEvent,
} from "@/lib/game/schemas";

function parseFrame(frame: string): TurnStreamEvent | null {
  let eventName = "";
  let data = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!eventName || !data) return null;
  return turnStreamEventSchema.parse({
    event: eventName,
    data: JSON.parse(data),
  });
}

export async function streamGameTurn(options: {
  client: SupabaseClient;
  sessionId: string;
  request: TurnRequest;
  onEvent: (event: TurnStreamEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const request = turnRequestSchema.parse(options.request);
  const { data, error } = await options.client.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("请先创建游客身份或登录邮箱账户。");

  const response = await fetch(`/api/game-sessions/${encodeURIComponent(options.sessionId)}/turns`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal: options.signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`回合流无法建立（HTTP ${response.status}）。`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done }).replace(/\r\n/g, "\n");
    let separator = buffer.indexOf("\n\n");
    while (separator >= 0) {
      const frame = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      const parsed = parseFrame(frame);
      if (parsed) options.onEvent(parsed);
      separator = buffer.indexOf("\n\n");
    }
    if (done) break;
  }
  const trailing = parseFrame(buffer);
  if (trailing) options.onEvent(trailing);
}

export async function commitAuthoritativeSystemAction(options: {
  client: SupabaseClient;
  sessionId: string;
  request: AuthoritativeSystemActionRequest;
  signal?: AbortSignal;
}): Promise<CommittedSystemAction> {
  const request = authoritativeSystemActionRequestSchema.parse(options.request);
  const { data, error } = await options.client.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("请先创建游客身份或登录邮箱账户。");

  const response = await fetch(`/api/game-sessions/${encodeURIComponent(options.sessionId)}/system-actions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal: options.signal,
  });
  const payload = await response.json() as unknown;
  if (!response.ok) {
    const parsed = payload && typeof payload === "object" ? payload as { message?: string } : {};
    throw new Error(parsed.message ?? `系统行动提交失败（HTTP ${response.status}）。`);
  }
  return committedSystemActionSchema.parse(payload);
}
