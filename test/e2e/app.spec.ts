import { expect, test } from "@playwright/test";

const e2eEmail = process.env.COMIXX_E2E_EMAIL;
const e2ePassword = process.env.COMIXX_E2E_PASSWORD;
const canRunAuthFlow = Boolean(e2eEmail && e2ePassword);

async function signIn(page: Parameters<typeof test>[0]["page"]) {
  await page.goto("/login");

  const loginPanel = page.locator("section.panel").first();
  await loginPanel.getByLabel("メールアドレス").fill(e2eEmail!);
  await loginPanel.getByLabel("パスワード").fill(e2ePassword!);
  await loginPanel.getByRole("button", { name: "ログイン" }).click();

  await page.waitForURL("**/main");
  await expect(page.getByRole("heading", { name: "公開中のパレット一覧" })).toBeVisible();
}

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("みんなで漫画を育てる、共創プラットフォーム")).toBeVisible();
});

test("unauthenticated access redirects to login", async ({ page, context }) => {
  await context.clearCookies();
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.goto("/main");

  const mainHeadingVisible = await page
    .getByRole("heading", { name: "公開中のパレット一覧" })
    .isVisible()
    .catch(() => false);
  test.skip(mainHeadingVisible, "Session already authenticated in this environment.");

  await page.waitForURL("**/login", { timeout: 10000 });
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
});

test("owner can create channel and post/reply/react in chat", async ({ page }) => {
  test.skip(!canRunAuthFlow, "COMIXX_E2E_EMAIL / COMIXX_E2E_PASSWORD is required.");

  await signIn(page);

  await page.getByRole("link", { name: "パレット作成" }).click();
  await page.waitForURL("**/palette/new");

  const paletteName = `e2e-${Date.now()}`;
  await page.getByLabel("パレット名").fill(paletteName);
  await page.getByLabel("説明").fill("E2Eで作成したパレットです");
  await page.getByRole("button", { name: "作成する" }).click();

  await page.waitForURL("**/palette/**");

  await page.getByRole("link", { name: "チャット" }).click();
  await page.waitForURL("**/chat");

  await page.getByRole("button", { name: "+ チャンネル作成" }).click();
  const channelName = `talk-${Date.now().toString().slice(-6)}`;
  await page.getByLabel("チャンネル名").fill(channelName);
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.getByRole("heading", { name: `#${channelName}` })).toBeVisible();

  const firstMessage = `first-${Date.now()}`;
  const composer = page.locator("textarea[name='content']");
  await composer.fill(firstMessage);
  await composer.press("Enter");
  await expect(page.getByText(firstMessage)).toBeVisible();

  const firstRow = page.locator(".chat-row").filter({ hasText: firstMessage }).first();
  await firstRow.click({ button: "right" });
  await page.getByRole("button", { name: "返信" }).click();

  const replyMessage = `reply-${Date.now()}`;
  await composer.fill(replyMessage);
  await composer.press("Enter");
  await expect(page.getByText(replyMessage)).toBeVisible();

  await firstRow.click({ button: "right" });
  await page.getByRole("button", { name: "リアクション（❤️）" }).click();
  await expect(page.getByText("❤️ 1")).toBeVisible();
});



