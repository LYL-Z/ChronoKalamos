import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function finishBoot(page: Page) {
  await page.goto("/");
  const skip = page.getByRole("button", { name: "跳过启动" });
  if (await skip.isVisible()) await skip.click();
  await expect(page.getByRole("heading", { name: "历史总是对我紧追不舍。" })).toBeVisible();
}

test.describe("Phase 12 product routes", () => {
  test("home evidence filters and chapter state are operable", async ({ page }) => {
    await finishBoot(page);

    await expect(page.getByRole("form", { name: "证据图层筛选" })).toBeVisible();
    const chapter = page.getByRole("region", { name: "merchant-ledger-day" });
    await expect(chapter).toBeVisible();
    await expect(chapter.getByText("当前事件", { exact: true })).toBeVisible();

    await page.getByRole("spinbutton", { name: "证据年份" }).fill("500");
    await expect(page.getByText("没有符合筛选条件的证据要素。")).toBeVisible();
    await page.getByRole("button", { name: "恢复 742 年全部图层" }).click();
    await expect(page.getByRole("button", { name: /西市，合理重建/ })).toBeVisible();
  });

  test("archives is a real identity-bound state, not demo records", async ({ page }) => {
    await page.goto("/saves");
    await expect(page.getByRole("heading", { name: "历史存档" })).toBeVisible();
    await expect(page.getByText("当前构建没有 Supabase 公开配置。")).toBeVisible();
    await expect(page.locator(".save-card")).toHaveCount(0);
  });

  test("settings exposes motion, text size, and honest translation status", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "个人设置" })).toBeVisible();
    const lowMotion = page.getByRole("checkbox", { name: /低动态模式/ });
    await lowMotion.check();
    await expect(lowMotion).toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");

    await page.getByRole("radio", { name: "较大" }).check();
    await expect(page.locator("html")).toHaveAttribute("data-text-scale", "large");
    await expect(page.getByText("法语、希腊语和俄语仅处于界面翻译状态。")).toBeVisible();
    await expect(page.getByText("仅界面翻译")).toHaveCount(3);
  });

  test("support presents health and recovery paths", async ({ page }) => {
    await page.goto("/support");
    await expect(page.getByRole("heading", { name: "支持说明" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "回合失败或断线" })).toBeVisible();
    await expect(page.getByText(/chronokalamos · ok/)).toBeVisible();
    await expect(page.getByRole("button", { name: "复制诊断摘要" })).toBeVisible();
  });

  test("offline state is announced without erasing the current page", async ({ page, context }) => {
    await page.goto("/support");
    await expect(page.getByRole("heading", { name: "支持说明" })).toBeVisible();
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByRole("alert").filter({ hasText: "当前离线" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "支持说明" })).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe("Phase 12 accessibility and responsive regression", () => {
  for (const path of ["/", "/saves", "/settings", "/support"]) {
    test(`${path} has no automated WCAG A/AA violations`, async ({ page }) => {
      if (path === "/") await finishBoot(page);
      else await page.goto(path);
      await page.locator("main").waitFor();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("keyboard path exposes skip link and navigable product routes", async ({ page }) => {
    await page.goto("/settings");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "跳到主要内容" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    const archives = page.getByRole("link", { name: /历史存档/ });
    await archives.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/saves$/);
  });

  for (const viewport of [
    { name: "phone-390", width: 390, height: 844 },
    { name: "tablet-768", width: 768, height: 1024 },
  ]) {
    test(`${viewport.name} has no horizontal page overflow`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await finishBoot(page);
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      await expect(page.getByRole("form", { name: "证据图层筛选" })).toBeVisible();
      await expect(page.getByRole("complementary", { name: "游客入口" })).toBeVisible();
    });
  }

  test("font fallbacks load and remain explicit", async ({ page }) => {
    await finishBoot(page);
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        status: document.fonts.status,
        body: getComputedStyle(document.body).fontFamily,
        title: getComputedStyle(document.querySelector("#hero-title")!).fontFamily,
        mono: getComputedStyle(document.querySelector(".eyebrow")!).fontFamily,
      };
    });
    expect(fonts.status).toBe("loaded");
    expect(fonts.body).toContain("Segoe UI");
    expect(fonts.title).toContain("Georgia");
    expect(fonts.mono).toContain("Cascadia Mono");
  });

  test("core shell stays within the Phase 12 performance budget", async ({ page }) => {
    await finishBoot(page);
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
        transferred: resources.reduce((sum, resource) => sum + resource.transferSize, 0),
        resourceCount: resources.length,
      };
    });
    expect(metrics.domContentLoaded).toBeLessThan(2_500);
    expect(metrics.transferred).toBeLessThan(1_800_000);
    expect(metrics.resourceCount).toBeLessThan(80);
  });
});
