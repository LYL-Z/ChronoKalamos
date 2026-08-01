import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const testUrl = process.env.SUPABASE_TEST_URL;
const testSecret = process.env.SUPABASE_TEST_SECRET_KEY;

async function finishBoot(page: Page) {
  await page.goto("/");
  const skip = page.getByRole("button", { name: "跳过启动" });
  await skip.waitFor({ state: "visible", timeout: 7_000 }).catch(() => undefined);
  if (await skip.isVisible()) await skip.click();
  await expect(page.getByRole("heading", { name: "历史总是对我紧追不舍。" })).toBeVisible();
}

async function browserUserId(page: Page) {
  return page.evaluate(() => {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.endsWith("-auth-token")) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as { currentSession?: { user?: { id?: unknown } }; session?: { user?: { id?: unknown } }; user?: { id?: unknown } };
        const id = parsed.currentSession?.user?.id ?? parsed.session?.user?.id ?? parsed.user?.id;
        if (typeof id === "string") return id;
      } catch {
        // Ignore unrelated localStorage values. No auth payload is logged.
      }
    }
    return null;
  });
}

test.describe("Phase 16 authenticated playable shell", () => {
  let createdUserId: string | null = null;

  test.afterEach(async ({ page }) => {
    createdUserId ??= await browserUserId(page).catch(() => null);
    if (!createdUserId || !testUrl || !testSecret) return;
    const admin = createClient(testUrl, testSecret, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    let cleanupError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { error } = await admin.auth.admin.deleteUser(createdUserId);
      cleanupError = error;
      if (!error) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
    expect(cleanupError, "temporary Phase 16 E2E identity must be deleted").toBeNull();
  });

  test("guest onboarding, archive utilities, keyboard, axe, and mobile layout", async ({ page }) => {
    test.skip(!testUrl || !testSecret, "SUPABASE_TEST_URL and SUPABASE_TEST_SECRET_KEY are required");

    await finishBoot(page);
    await page.getByRole("button", { name: "以游客身份开始 →" }).click();
    await expect(page.getByRole("dialog", { name: "把时间落在一个人身上。" })).toBeVisible();
    createdUserId = await browserUserId(page);
    expect(createdUserId).toMatch(/^[0-9a-f-]{36}$/);

    await page.getByLabel("姓名").fill("验收旅人");
    await page.getByRole("button", { name: "确认并进入" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /ChronoKalamos 742 年长安档案模拟/ })).toBeVisible();
    await expect(page.getByText(/STATE v0/)).toBeVisible();
    await expect(page.getByLabel("当前旬目标")).toBeVisible();

    await page.getByRole("button", { name: "图鉴", exact: true }).click();
    await expect(page.getByRole("heading", { name: "证据图鉴" })).toBeVisible();
    await expect(page.getByText("条已发布来源")).toBeVisible();
    await page.getByRole("button", { name: "关闭面板" }).click();

    await page.getByRole("button", { name: "天下", exact: true }).click();
    const worldPanel = page.getByRole("dialog", { name: "天下与制度工作台" });
    await expect(worldPanel).toBeVisible();
    await expect(worldPanel.getByRole("button", { name: "七阶层" })).toBeVisible();
    await expect(worldPanel.locator(".phase17-strata-grid > article")).toHaveCount(7);
    await worldPanel.getByRole("button", { name: "长安坊市" }).click();
    await expect(worldPanel.getByRole("gridcell")).toHaveCount(110);
    await worldPanel.getByRole("button", { name: "天下十五道" }).click();
    await expect(worldPanel.locator(".phase17-realm-map button")).toHaveCount(15);
    await worldPanel.getByRole("button", { name: "物品目录" }).click();
    await expect(worldPanel.locator(".phase17-item-grid article")).toHaveCount(200);
    await worldPanel.getByRole("button", { name: "结局档案" }).click();
    await expect(worldPanel.locator(".phase17-ending-grid article")).toHaveCount(50);
    const worldAxe = await new AxeBuilder({ page })
      .include(".phase17-world-panel")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(worldAxe.violations).toEqual([]);
    await page.screenshot({ path: path.resolve("audit/phase17/world-systems-desktop.png"), fullPage: true });
    await worldPanel.getByRole("button", { name: "关闭" }).click();

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("a");
    await expect(page.getByRole("heading", { name: "成就与旬目标" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /档案成就/ })).toBeVisible();
    await page.getByRole("button", { name: "关闭面板" }).click();

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("1");
    await expect(page.locator('[data-phase16-choice="1"]')).toBeFocused();
    await expect(page.getByText(/STATE v0/)).toBeVisible();

    const desktopAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(desktopAxe.violations).toEqual([]);
    await page.screenshot({ path: path.resolve("audit/phase16/e2e-desktop.png"), fullPage: true });

    await page.getByRole("button", { name: "低动态" }).click();
    await expect(page.locator("main.phase15-shell")).toHaveClass(/low-motion/);
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const mobileAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(mobileAxe.violations).toEqual([]);
    await page.screenshot({ path: path.resolve("audit/phase16/e2e-mobile-390.png"), fullPage: true });

    await page.getByRole("button", { name: "天下", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "天下与制度工作台" })).toBeVisible();
    const worldOverflow = await page.locator(".phase17-world-panel").evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(worldOverflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.resolve("audit/phase17/world-systems-mobile-390.png"), fullPage: true });
  });
});
