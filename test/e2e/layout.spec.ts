import { expect, test, type Page } from "@playwright/test"
import { box, openApp, settle, showControls, tile, VIDEOS } from "../support/page.ts"

const [first, second, third, fourth] = VIDEOS

const rects = (page: Page) => Promise.all(VIDEOS.map((id) => box(tile(page, id))))

test("動画は画面の中に重ならずに並び、左上から右下へ順に並ぶ", async ({ page }) => {
  await openApp(page)
  const viewport = page.viewportSize()!
  const all = await rects(page)
  for (const r of all) {
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.x + r.width).toBeLessThanOrEqual(viewport.width + 0.5)
    expect(r.y + r.height).toBeLessThanOrEqual(viewport.height + 0.5)
    expect(r.width / r.height).toBeCloseTo(16 / 9, 1)
  }
  all.forEach((a, i) => {
    for (const b of all.slice(i + 1)) {
      const apart = a.x + a.width <= b.x + 0.5 || b.x + b.width <= a.x + 0.5 || a.y + a.height <= b.y + 0.5 || b.y + b.height <= a.y + 0.5
      expect(apart).toBe(true)
      expect(b.y > a.y + 1 || (Math.abs(b.y - a.y) <= 1 && b.x > a.x)).toBe(true)
    }
  })
})

test("並べ方の選択肢は全部画面の中に見えている。スマホでは選択メニューから選ぶ", async ({ page }) => {
  await openApp(page)
  const viewport = page.viewportSize()!
  if (viewport.width <= 600) {
    await expect(page.locator("#layout")).toBeHidden()
    await page.locator("#layoutSelect button").click()
    await page.locator('ui-select-item[value="1"]').click()
    await settle(page)
    const [a, b] = await Promise.all([box(tile(page, first)), box(tile(page, second))])
    expect(Math.abs(a.x - b.x)).toBeLessThan(1)
    expect(b.y).toBeGreaterThan(a.y)
    await expect(page.locator("#layoutSelect button")).toContainText("1列")
    return
  }
  const items = page.locator("#layout ui-segmented-control-item")
  await expect(items.first()).toBeVisible()
  for (const item of await items.all()) {
    const r = await box(item)
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.x + r.width).toBeLessThanOrEqual(viewport.width)
  }
})

test("スマホでは操作バーが1段に収まり、画面の下にある。トーストはバーに重ならない", async ({ page }) => {
  await openApp(page)
  test.skip(page.viewportSize()!.width > 600, "スマホの幅だけ")
  const bar = await box(page.locator("header.bar"))
  const viewport = page.viewportSize()!
  expect(bar.height).toBeLessThan(60)
  expect(bar.y + bar.height).toBeCloseTo(viewport.height, 0)
  for (const id of VIDEOS) expect((await box(tile(page, id))).y + (await box(tile(page, id))).height).toBeLessThanOrEqual(bar.y)
  await page.locator("#toLive").click()
  const toast = await box(page.locator("ui-toast"))
  expect(toast.y + toast.height).toBeLessThanOrEqual(bar.y)
  for (const button of await page.locator("header.bar button:visible").all()) {
    const r = await box(button)
    expect(r.x + r.width).toBeLessThanOrEqual(viewport.width)
  }
})

test("大きくすると、その動画だけ大きくなり、戻すと元の並びに戻る", async ({ page }) => {
  await openApp(page)
  const before = await rects(page)
  const target = await showControls(page, third)
  await target.locator(".zoom").click()
  await expect(target.locator(".zoom")).toHaveAttribute("aria-pressed", "true")
  await settle(page)
  const big = await rects(page)
  expect(big[2]!.width).toBeGreaterThan(big[0]!.width * 1.5)
  expect(big[0]!.x).toBeLessThan(big[1]!.x)
  expect(big[1]!.x).toBeLessThan(big[3]!.x)

  await showControls(page, third)
  await target.locator(".zoom").click()
  await expect(target.locator(".zoom")).toHaveAttribute("aria-pressed", "false")
  await settle(page)
  expect(await rects(page)).toEqual(before)
})

test("ダブルタップで大きくなる", async ({ page }) => {
  await openApp(page)
  await tile(page, second)
    .locator(".shield")
    .dblclick({ position: { x: 30, y: 30 } })
  await expect(tile(page, second).locator(".zoom")).toHaveAttribute("aria-pressed", "true")
})

test("操作ボタンはタップで出て、4秒ほどで消える。押した後も消える", async ({ page }) => {
  await openApp(page)
  const target = tile(page, fourth)
  await page.waitForTimeout(4500)
  await expect(target.locator(".controls")).toHaveCSS("opacity", "0")
  await showControls(page, fourth)
  await target.locator(".sound").click()
  await expect(target.locator(".controls")).toHaveCSS("opacity", "0", { timeout: 6000 })
})

test("移動ボタンをタップして移動先を選ぶと、並びが入れ替わる", async ({ page }) => {
  await openApp(page)
  const before = await rects(page)
  const target = await showControls(page, first)
  await target.locator(".grip").click()
  await expect(page.locator("#movebar")).toBeVisible()
  await tile(page, third).locator(".target").click()
  await expect(page.locator("#movebar")).toBeHidden()
  await settle(page)
  const after = await rects(page)
  expect(after[0]).toEqual(before[2])
  expect(after[1]).toEqual(before[0])
  expect(after[2]).toEqual(before[1])
})

test("チャットを開いて閉じられる。開いても動画は画面の中に収まる", async ({ page }) => {
  await openApp(page)
  await page.locator("#chatBtn").click()
  await expect(page.locator("#chat")).toBeVisible()
  await expect(page.locator("#chatBtn")).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator("#chatFrame")).toHaveAttribute("src", new RegExp(`live_chat\\?v=${first}`))
  await settle(page)
  const viewport = page.viewportSize()!
  const chat = await box(page.locator("#chat"))
  for (const r of await rects(page)) {
    expect(r.x + r.width).toBeLessThanOrEqual(viewport.width + 0.5)
    const beside = r.x + r.width <= chat.x + 0.5
    const above = r.y + r.height <= chat.y + 0.5
    expect(beside || above).toBe(true)
  }
  await page.locator("#chatClose").click()
  await expect(page.locator("#chat")).toBeHidden()
  await expect(page.locator("#chatBtn")).toHaveAttribute("aria-pressed", "false")
})

test("YouTubeで直接操作を始めて終われる", async ({ page }) => {
  await openApp(page)
  const target = await showControls(page, first)
  await target.locator(".hand").click()
  await expect(target).toHaveAttribute("data-direct", "")
  await expect(target.locator(".shield")).toBeHidden()
  await target.locator(".directEnd").click()
  await expect(target).not.toHaveAttribute("data-direct", "")
  await expect(target.locator(".shield")).toBeVisible()
})

test("小さい動画でも、操作ボタンは動画の枠の中に収まる", async ({ page }) => {
  await openApp(page)
  const big = await showControls(page, first)
  await big.locator(".zoom").click()
  await settle(page)
  const small = await showControls(page, fourth)
  const frame = await box(small)
  for (const button of await small.locator(".controls button:visible").all()) {
    const r = await box(button)
    expect(r.x).toBeGreaterThanOrEqual(frame.x)
    expect(r.x + r.width).toBeLessThanOrEqual(frame.x + frame.width + 0.5)
    expect(r.y).toBeGreaterThanOrEqual(frame.y)
    expect(r.y + r.height).toBeLessThanOrEqual(frame.y + frame.height + 0.5)
  }
})
