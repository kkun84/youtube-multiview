import { AxeBuilder } from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"
import { openApp, tile, VIDEOS } from "../support/page.ts"

const [first, second] = VIDEOS

const order = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("mv-list-item")]
      .toSorted((a, b) => Number(a.dataset["index"]) - Number(b.dataset["index"]))
      .map((item) => item.getAttribute("value"))
  )

const openList = async (page: Page) => {
  await page.locator("#openList").click()
  await expect(page.locator("#dialogTitle")).toBeVisible()
}

test("一覧から動画を追加できる。同じ動画や読めないURLは追加しない", async ({ page }) => {
  await openApp(page, [first, second])
  await openList(page)
  await page.locator("#addInput").fill("https://www.youtube.com/watch?v=eeeeeeeeee5")
  await page.locator("#addInput").press("Enter")
  await expect(page.locator("mv-list-item")).toHaveCount(3)
  await expect(tile(page, "eeeeeeeeee5")).toHaveCount(1)

  await page.locator("#addInput").fill("https://youtu.be/eeeeeeeeee5")
  await page.locator("#addInput").press("Enter")
  await expect(page.locator("#addError")).not.toBeEmpty()
  await page.locator("#addInput").fill("これはURLではない")
  await page.locator("#addInput").press("Enter")
  await expect(page.locator("#addError")).not.toBeEmpty()
  await expect(page.locator("mv-list-item")).toHaveCount(3)
})

test("一覧の上下ボタンで並べ替えると、動画の並びも変わる", async ({ page }) => {
  await openApp(page)
  await openList(page)
  expect(await order(page)).toEqual([...VIDEOS])
  await page.locator(`mv-list-item[value="${first}"] .down`).click()
  expect(await order(page)).toEqual([second, first, VIDEOS[2], VIDEOS[3]])
  await expect(page.locator(`mv-list-item[value="${second}"] .up`)).toHaveAttribute("aria-disabled", "true")
  await expect(tile(page, second)).toHaveAttribute("data-index", "0")
})

test("一覧から削除できる。並びは開き直しても残る", async ({ page }) => {
  await openApp(page)
  await openList(page)
  await page.locator(`mv-list-item[value="${first}"] .del`).click()
  await expect(page.locator("mv-list-item")).toHaveCount(3)
  await expect(tile(page, first)).toHaveCount(0)
  await page.goto("about:blank")
  await page.goto("/")
  await expect(page.locator("mv-tile")).toHaveCount(3)
})

test("アクセシビリティの問題がない", async ({ page }) => {
  await openApp(page)
  const main = await new AxeBuilder({ page }).exclude("mv-tile iframe").analyze()
  expect(main.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([])
  await page.locator("#chatBtn").click()
  await openList(page)
  const dialog = await new AxeBuilder({ page }).exclude("mv-tile iframe").exclude("#chatFrame").analyze()
  expect(dialog.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([])
})

test("一覧とチャット欄から、概要欄とコメントを見るためにYouTubeの動画ページを開ける", async ({ page }) => {
  await openApp(page)
  await page.locator("#chatBtn").click()
  await expect(page.locator("#watchOpen")).toHaveAttribute("href", `https://www.youtube.com/watch?v=${first}`)
  await expect(page.locator("#watchOpen")).toHaveAttribute("target", "_blank")
  await openList(page)
  const link = page.locator(`mv-list-item[value="${second}"] .open`)
  await expect(link).toHaveAttribute("href", `https://www.youtube.com/watch?v=${second}`)
  await expect(link).toHaveAccessibleName(/概要欄とコメント/)
})
