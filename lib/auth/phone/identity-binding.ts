import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { normalizeChinaPhone } from "@/lib/auth/phone/config";
import { createServerSupabaseClient } from "@/lib/game/supabase-repository";

const preparationSchema = z.object({
  status: z.enum([
    "ready",
    "already_bound",
    "user_not_found",
    "invalid_phone",
    "invalid_stale_window",
    "phone_already_bound",
    "phone_change_in_progress",
    "phone_replacement_requires_reauth",
  ]),
  cleared_stale_phone_changes: z.number().int().nonnegative().optional(),
});

type BindingUser = Pick<
  User,
  "id" | "email" | "email_confirmed_at" | "is_anonymous" | "phone"
>;

type PhoneBindingDependencies = {
  getUser(accessToken: string): Promise<BindingUser | null>;
  prepare(userId: string, phone: string): Promise<z.infer<typeof preparationSchema>>;
  bind(userId: string, phone: string): Promise<BindingUser>;
};

export class PhoneIdentityError extends Error {
  constructor(
    public readonly code:
      | "phone_authentication_required"
      | "permanent_account_required"
      | "confirmed_email_required"
      | "phone_already_bound"
      | "phone_change_in_progress"
      | "phone_replacement_requires_reauth"
      | "phone_identity_unavailable",
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "PhoneIdentityError";
  }
}

function defaultDependencies(): PhoneBindingDependencies {
  const client = createServerSupabaseClient();
  return {
    async getUser(accessToken) {
      const { data, error } = await client.auth.getUser(accessToken);
      if (error) throw new PhoneIdentityError(
        "phone_authentication_required",
        "当前登录会话无效，请重新使用邮箱登录。",
        401,
      );
      return data.user;
    },
    async prepare(userId, phone) {
      const { data, error } = await client.rpc("prepare_verified_phone_binding", {
        p_user_id: userId,
        p_phone: phone,
        p_stale_after_minutes: 1440,
      });
      if (error) throw new PhoneIdentityError(
        "phone_identity_unavailable",
        "手机号归属检查暂时不可用，请稍后再试。",
        503,
      );
      return preparationSchema.parse(data);
    },
    async bind(userId, phone) {
      const { data, error } = await client.auth.admin.updateUserById(userId, {
        phone,
        phone_confirm: true,
      });
      if (error || !data.user) {
        const conflict = error?.message.toLowerCase().includes("phone")
          && (error.message.toLowerCase().includes("unique")
            || error.message.toLowerCase().includes("registered"));
        throw new PhoneIdentityError(
          conflict ? "phone_already_bound" : "phone_identity_unavailable",
          conflict ? "该手机号已绑定其他账户。" : "手机号验证成功，但身份绑定未提交。请稍后重试。",
          conflict ? 409 : 503,
        );
      }
      return data.user;
    },
  };
}

export function bearerAccessToken(request: Request): string {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
  if (!match?.[1]) {
    throw new PhoneIdentityError(
      "phone_authentication_required",
      "绑定手机号前必须先登录已确认的邮箱账户。",
      401,
    );
  }
  return match[1];
}

function assertEligibleAccount(user: BindingUser | null): asserts user is BindingUser {
  if (!user) {
    throw new PhoneIdentityError(
      "phone_authentication_required",
      "当前登录会话无效，请重新使用邮箱登录。",
      401,
    );
  }
  if (user.is_anonymous) {
    throw new PhoneIdentityError(
      "permanent_account_required",
      "游客不能绑定手机号。请先升级为邮箱账户并完成确认。",
      403,
    );
  }
  if (!user.email || !user.email_confirmed_at) {
    throw new PhoneIdentityError(
      "confirmed_email_required",
      "手机号只能绑定到已确认邮箱的账户；邮箱仍是主要恢复凭证。",
      403,
    );
  }
}

function assertPreparation(
  result: z.infer<typeof preparationSchema>,
  allowAlreadyBound: boolean,
): void {
  if (result.status === "ready" || (allowAlreadyBound && result.status === "already_bound")) return;

  const errors: Record<
    Exclude<typeof result.status, "ready" | "already_bound"> | "already_bound",
    PhoneIdentityError
  > = {
    already_bound: new PhoneIdentityError(
      "phone_already_bound",
      "该手机号已经绑定当前账户，无需重复发送验证码。",
      409,
    ),
    user_not_found: new PhoneIdentityError(
      "phone_authentication_required",
      "当前账户不存在，请重新登录。",
      401,
    ),
    invalid_phone: new PhoneIdentityError(
      "phone_identity_unavailable",
      "当前准备版只接受中国大陆 E.164 手机号。",
      400,
    ),
    invalid_stale_window: new PhoneIdentityError(
      "phone_identity_unavailable",
      "手机号恢复策略配置无效。",
      503,
    ),
    phone_already_bound: new PhoneIdentityError(
      "phone_already_bound",
      "该手机号已绑定其他账户。系统不会自动合并账户。",
      409,
    ),
    phone_change_in_progress: new PhoneIdentityError(
      "phone_change_in_progress",
      "该手机号存在尚未过期的换号流程，请在 24 小时后重试或先完成原流程。",
      409,
    ),
    phone_replacement_requires_reauth: new PhoneIdentityError(
      "phone_replacement_requires_reauth",
      "更换已绑定手机号需要重新验证邮箱，不能直接覆盖。",
      409,
    ),
  };
  throw errors[result.status];
}

export async function preflightPhoneIdentityBinding({
  accessToken,
  phone,
  dependencies = defaultDependencies(),
  allowAlreadyBound = false,
}: {
  accessToken: string;
  phone: string;
  dependencies?: PhoneBindingDependencies;
  allowAlreadyBound?: boolean;
}): Promise<{ user: BindingUser; normalizedPhone: string; alreadyBound: boolean }> {
  let normalizedPhone: string;
  try {
    normalizedPhone = normalizeChinaPhone(phone);
  } catch {
    throw new PhoneIdentityError(
      "phone_identity_unavailable",
      "当前准备版只接受中国大陆 E.164 手机号。",
      400,
    );
  }
  const user = await dependencies.getUser(accessToken);
  assertEligibleAccount(user);
  const result = await dependencies.prepare(user.id, normalizedPhone);
  assertPreparation(result, allowAlreadyBound);
  return { user, normalizedPhone, alreadyBound: result.status === "already_bound" };
}

export async function bindVerifiedPhoneIdentity({
  accessToken,
  phone,
  dependencies = defaultDependencies(),
}: {
  accessToken: string;
  phone: string;
  dependencies?: PhoneBindingDependencies;
}): Promise<{ userId: string; normalizedPhone: string; alreadyBound: boolean }> {
  const candidate = await preflightPhoneIdentityBinding({
    accessToken,
    phone,
    dependencies,
    allowAlreadyBound: true,
  });
  if (candidate.alreadyBound) {
    return {
      userId: candidate.user.id,
      normalizedPhone: candidate.normalizedPhone,
      alreadyBound: true,
    };
  }
  const user = await dependencies.bind(candidate.user.id, candidate.normalizedPhone);
  return { userId: user.id, normalizedPhone: candidate.normalizedPhone, alreadyBound: false };
}
