import { test, expect } from "@playwright/test";

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("みんなで漫画を育てる、共創プラットフォーム")).toBeVisible();
});

test("unauthenticated access redirects to login", async ({ page }) => {
  await page.goto("/main");
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
});
