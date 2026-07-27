import { describe, expect, it } from "vitest";

import { getPhoneAuthProvider } from "./provider";

describe("mock phone provider", () => {
  it("keeps disabled phone auth on the explicit 503 path", async () => {
    const provider = getPhoneAuthProvider("mock");

    await expect(
      provider.send("+8613800138000"),
    ).rejects.toMatchObject({
      code: "phone_auth_disabled",
      status: 503,
    });
  });

  it("does not pretend to verify codes while the mock provider is disabled", async () => {
    const provider = getPhoneAuthProvider("mock");

    await expect(
      provider.check("+8613800138000", "123456"),
    ).rejects.toMatchObject({
      code: "phone_auth_disabled",
      status: 503,
    });
  });
});
