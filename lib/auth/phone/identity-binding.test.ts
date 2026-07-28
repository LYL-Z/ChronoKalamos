import { describe, expect, it } from "vitest";
import {
  bearerAccessToken,
  bindVerifiedPhoneIdentity,
  PhoneIdentityError,
  preflightPhoneIdentityBinding,
} from "./identity-binding";

const permanentUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "reader@example.com",
  email_confirmed_at: "2026-07-27T00:00:00.000Z",
  is_anonymous: false,
  phone: undefined,
};

function dependencies(
  preparation: "ready" | "already_bound" | "phone_already_bound" | "phone_change_in_progress" = "ready",
) {
  return {
    async getUser() {
      return permanentUser;
    },
    async prepare() {
      return { status: preparation as typeof preparation };
    },
    async bind(_userId: string, phone: string) {
      return { ...permanentUser, phone };
    },
  };
}

describe("Supabase verified phone identity binding", () => {
  it("requires a bearer session before any provider call", () => {
    expect(() => bearerAccessToken(new Request("https://example.test"))).toThrowError(
      expect.objectContaining({ code: "phone_authentication_required", status: 401 }),
    );
  });

  it("rejects anonymous accounts and unconfirmed email accounts", async () => {
    const anonymous = {
      ...dependencies(),
      async getUser() {
        return { ...permanentUser, is_anonymous: true };
      },
    };
    await expect(preflightPhoneIdentityBinding({
      accessToken: "token",
      phone: "13800138000",
      dependencies: anonymous,
    })).rejects.toMatchObject({ code: "permanent_account_required" } satisfies Partial<PhoneIdentityError>);

    const unconfirmed = {
      ...dependencies(),
      async getUser() {
        return { ...permanentUser, email_confirmed_at: undefined };
      },
    };
    await expect(preflightPhoneIdentityBinding({
      accessToken: "token",
      phone: "13800138000",
      dependencies: unconfirmed,
    })).rejects.toMatchObject({ code: "confirmed_email_required" } satisfies Partial<PhoneIdentityError>);
  });

  it("binds an approved number to the same Supabase user id", async () => {
    const result = await bindVerifiedPhoneIdentity({
      accessToken: "token",
      phone: "138 0013 8000",
      dependencies: dependencies(),
    });
    expect(result).toEqual({
      userId: permanentUser.id,
      normalizedPhone: "+8613800138000",
      alreadyBound: false,
    });
  });

  it("is idempotent after the number is already bound to this account", async () => {
    await expect(bindVerifiedPhoneIdentity({
      accessToken: "token",
      phone: "13800138000",
      dependencies: dependencies("already_bound"),
    })).resolves.toMatchObject({ alreadyBound: true, userId: permanentUser.id });
  });

  it.each([
    ["phone_already_bound", "phone_already_bound"],
    ["phone_change_in_progress", "phone_change_in_progress"],
  ] as const)("rejects cross-user isolation state %s", async (preparation, code) => {
    await expect(bindVerifiedPhoneIdentity({
      accessToken: "token",
      phone: "13800138000",
      dependencies: dependencies(preparation),
    })).rejects.toMatchObject({ code });
  });
});
