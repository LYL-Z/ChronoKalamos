import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Phase 14 public beta surface", () => {
  test("discloses consent, privacy, gates, and external evidence status", async ({ page }) => {
    await page.goto("/playtest");
    await expect(page.getByRole("heading", { name: "742年长安小规模公开测试" })).toBeVisible();
    await expect(page.getByText("当前评估：证据不足。")).toBeVisible();
    await expect(page.getByRole("heading", { name: "只记录评估必需的事件" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "体验与可信度必须同时通过" })).toBeVisible();
    await expect(page.getByText(/自由输入、叙事正文、邮箱、手机号、IP/)).toBeVisible();
    await expect(page.getByText(/邀请仍需真人完成/)).toBeVisible();
  });

  test("has no automated WCAG A or AA violations", async ({ page }) => {
    await page.goto("/playtest");
    await page.locator("main").waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("390px layout has no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/playtest");
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
});

