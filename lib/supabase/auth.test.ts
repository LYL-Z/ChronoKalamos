import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isAnonymousUser, linkGuestToEmail } from "./auth";

function createAuthClient(user: Partial<User> | null) {
  const updateUser = vi.fn().mockResolvedValue({ error: null });
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: user ? { user } : null },
        error: null,
      }),
      updateUser,
    },
  } as unknown as SupabaseClient;

  return { client, updateUser };
}

describe("anonymous identity upgrade", () => {
  it("recognizes only explicitly anonymous users", () => {
    expect(isAnonymousUser({ is_anonymous: true } as User)).toBe(true);
    expect(isAnonymousUser({ is_anonymous: false } as User)).toBe(false);
    expect(isAnonymousUser(null)).toBe(false);
  });

  it("links a normalized email through updateUser so the current user id is retained", async () => {
    const { client, updateUser } = createAuthClient({
      id: "18c63f31-58f2-431c-9fe4-ab4f5aa8c5d2",
      is_anonymous: true,
    });

    await linkGuestToEmail(client, "  reader@example.com ", "https://example.com/");

    expect(updateUser).toHaveBeenCalledOnce();
    expect(updateUser).toHaveBeenCalledWith(
      { email: "reader@example.com" },
      { emailRedirectTo: "https://example.com/" },
    );
  });

  it("rejects account linking when the current user is not anonymous", async () => {
    const { client, updateUser } = createAuthClient({
      id: "18c63f31-58f2-431c-9fe4-ab4f5aa8c5d2",
      is_anonymous: false,
    });

    await expect(linkGuestToEmail(client, "reader@example.com", "https://example.com/"))
      .rejects.toThrow("当前身份不是游客");
    expect(updateUser).not.toHaveBeenCalled();
  });
});
