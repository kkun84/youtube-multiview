import { readFileSync } from "node:fs"
import { expect, type Locator, type Page } from "@playwright/test"

const fakeYouTube = readFileSync(new URL("fake-youtube.js", import.meta.url), "utf8")

export const VIDEOS = ["aaaaaaaaaa1", "bbbbbbbbbb2", "cccccccccc3", "dddddddddd4"] as const

type FakePlayer = {
  muted: boolean
  state: number
  behind: number
  calls: string[]
  change: (state: number) => void
  getCurrentTime: () => number
  live: boolean
}
type FakeWindow = { fakeYouTube: { byVideo: (id: string) => FakePlayer } }

/** YouTubeへの通信を差し替えてページを開く */
export async function openApp(page: Page, videos: readonly string[] = VIDEOS): Promise<void> {
  await page.route("https://www.youtube.com/iframe_api", (route) => route.fulfill({ contentType: "text/javascript", body: fakeYouTube }))
  await page.route("https://www.youtube.com/live_chat**", (route) => route.fulfill({ contentType: "text/html", body: "<p>chat</p>" }))
  await page.goto(`/#v=${videos.join(",")}`)
  await expect(page.locator("mv-tile")).toHaveCount(videos.length)
  await expect(tile(page, videos[0] ?? "").locator("iframe")).toBeVisible()
  await settle(page)
}

/** 配置が動かなくなるまで待つ */
export async function settle(page: Page): Promise<void> {
  const snapshot = () =>
    page.evaluate(() => [...document.querySelectorAll("mv-tile")].map((el) => JSON.stringify(el.getBoundingClientRect())).join("|"))
  let previous = await snapshot()
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.waitForTimeout(200)
    const current = await snapshot()
    if (current === previous) return
    previous = current
  }
  throw new Error("配置が落ち着きませんでした")
}

export const tile = (page: Page, videoId: string): Locator => page.locator(`mv-tile[value="${videoId}"]`)

/** 動画をタップして操作ボタンを出す */
export async function showControls(page: Page, videoId: string): Promise<Locator> {
  const target = tile(page, videoId)
  // 初めて開いた直後は操作ボタンが出ている。出ている間に動画をタップすると、小さい動画ではボタンに当たる
  const shown = await target.evaluate((el) => Object.hasOwn((el as HTMLElement).dataset, "show"))
  if (shown) await target.locator(".play").hover()
  else await target.locator(".shield").click({ position: { x: 20, y: 12 } })
  await expect(target.locator(".controls")).toHaveCSS("opacity", "1")
  return target
}

export const player = (page: Page, videoId: string): Promise<Pick<FakePlayer, "muted" | "state" | "behind" | "calls">> =>
  page.evaluate((id) => {
    const found = (window as unknown as FakeWindow).fakeYouTube.byVideo(id)
    return { muted: found.muted, state: found.state, behind: found.behind, calls: [...found.calls] }
  }, videoId)

type Tweak = { behind: number } | { state: number } | { frozenAt: number } | { live: boolean }

/** 偽のプレーヤーの状態を外から変える */
export const tweak = (page: Page, videoId: string, change: Tweak): Promise<void> =>
  page.evaluate(
    ([id, wanted]) => {
      const found = (window as unknown as FakeWindow).fakeYouTube.byVideo(id)
      if ("behind" in wanted) found.behind = wanted.behind
      if ("state" in wanted) found.change(wanted.state)
      if ("live" in wanted) found.live = wanted.live
      if ("frozenAt" in wanted) found.getCurrentTime = () => wanted.frozenAt
    },
    [videoId, change] as const
  )

/** 動画の操作ボタンを出して押す */
export async function press(page: Page, videoId: string, button: string): Promise<Locator> {
  const target = await showControls(page, videoId)
  await target.locator(button).click()
  return target
}

export const box = async (locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> => {
  const found = await locator.boundingBox()
  if (!found) throw new Error("要素が表示されていません")
  return found
}
