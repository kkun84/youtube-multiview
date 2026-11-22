import { expect, test } from "@playwright/test"
import { openApp, player, press, tile, tweak, VIDEOS } from "../support/page.ts"

const [first, second, third] = VIDEOS

test("全部の動画が無音で再生される", async ({ page }) => {
  await openApp(page)
  for (const id of VIDEOS) {
    await expect.poll(() => player(page, id)).toMatchObject({ muted: true, state: 1 })
  }
})

test("音声は選んだ1つだけ出る", async ({ page }) => {
  await openApp(page)
  const a = await press(page, first, ".sound")
  await expect(a.locator(".sound")).toHaveAttribute("aria-pressed", "true")
  await expect.poll(() => player(page, first)).toMatchObject({ muted: false })

  const b = await press(page, second, ".sound")
  await expect(b.locator(".sound")).toHaveAttribute("aria-pressed", "true")
  await expect(a.locator(".sound")).toHaveAttribute("aria-pressed", "false")
  await expect.poll(() => player(page, first)).toMatchObject({ muted: true })
  await expect.poll(() => player(page, second)).toMatchObject({ muted: false })

  await b.locator(".sound").click()
  await expect(b.locator(".sound")).toHaveAttribute("aria-pressed", "false")
  await expect.poll(() => player(page, second)).toMatchObject({ muted: true })
})

test("全部を消音で音声が消える", async ({ page }) => {
  await openApp(page)
  const a = await press(page, first, ".sound")
  await page.locator("#muteAll").click()
  await expect(a.locator(".sound")).toHaveAttribute("aria-pressed", "false")
  await expect.poll(() => player(page, first)).toMatchObject({ muted: true })
})

test("動画ごとに一時停止と再生ができる", async ({ page }) => {
  await openApp(page)
  await press(page, first, ".play")
  await expect.poll(() => player(page, first)).toMatchObject({ state: 2 })
  await expect.poll(() => player(page, second)).toMatchObject({ state: 1 })
  await press(page, first, ".play")
  await expect.poll(() => player(page, first)).toMatchObject({ state: 1 })
})

test("全部を一時停止して、全部を再生できる", async ({ page }) => {
  await openApp(page)
  await page.locator("#playAll").click()
  for (const id of VIDEOS) await expect.poll(() => player(page, id)).toMatchObject({ state: 2 })
  await page.locator("#playAll").click()
  for (const id of VIDEOS) await expect.poll(() => player(page, id)).toMatchObject({ state: 1 })
})

test("自分で止めた動画は、勝手に再生し直さない", async ({ page }) => {
  await openApp(page)
  await press(page, first, ".play")
  await page.waitForTimeout(4000)
  expect(await player(page, first)).toMatchObject({ state: 2 })
})

test("ブラウザに止められた無音の動画は、再生し直す", async ({ page }) => {
  await openApp(page)
  await expect.poll(() => player(page, third)).toMatchObject({ state: 1 })
  await tweak(page, third, { state: 2 })
  await expect.poll(() => player(page, third), { timeout: 8000 }).toMatchObject({ state: 1, muted: true })
})

test("全部を最新の位置へで、遅れているライブ配信が最新に戻り、結果が画面に出る", async ({ page }) => {
  await openApp(page)
  await page.waitForTimeout(2500)
  for (const id of VIDEOS) await tweak(page, id, { behind: 40 })
  await page.locator("#toLive").click()
  for (const id of VIDEOS) {
    await expect.poll(async () => (await player(page, id)).behind).toBeLessThan(5)
  }
  const toast = page.locator("ui-toast")
  await expect(toast).toContainText("4件のライブ配信を最新の位置に合わせました")
  const viewport = page.viewportSize()
  const rect = await toast.boundingBox()
  expect(rect && viewport && rect.x >= 0 && rect.x + rect.width <= viewport.width && rect.y + rect.height <= viewport.height).toBe(true)
})

test("再生位置が進まない端末でも、再生中なら遅れとみなさない", async ({ page }) => {
  test.setTimeout(60_000)
  await openApp(page)
  await tweak(page, first, { frozenAt: 1234 })
  await page.waitForTimeout(22_000)
  await expect(tile(page, first).locator(".live")).toBeHidden()
})

test("遅れが出ると動画に遅れの表示が出て、押すと最新に戻る", async ({ page }) => {
  test.setTimeout(60_000)
  await openApp(page)
  await page.waitForTimeout(2500)
  await tweak(page, first, { state: 3 })
  const chip = tile(page, first).locator(".live")
  await expect(chip).toContainText("遅れ", { timeout: 30_000 })
  await chip.click()
  await expect.poll(async () => (await player(page, first)).calls).toContain("seekTo")
})
