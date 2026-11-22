import { expect, test } from "vitest"
import { isVideoId, parseVideoId } from "./youtube-id"

test.each([
  ["https://www.youtube.com/watch?v=QNZjuyvcjw8", "QNZjuyvcjw8"],
  ["https://youtu.be/jeJTS1LrTO0?si=abc", "jeJTS1LrTO0"],
  ["youtube.com/live/_oNm1mKvgac?feature=share", "_oNm1mKvgac"],
  ["https://m.youtube.com/shorts/3UtyipqHJbw", "3UtyipqHJbw"],
  ["https://www.youtube-nocookie.com/embed/6Lp2NYJDVsQ", "6Lp2NYJDVsQ"],
  ["  6Lp2NYJDVsQ  ", "6Lp2NYJDVsQ"]
])("%s から動画IDを取り出す", (input, id) => {
  expect(parseVideoId(input)).toBe(id)
})

test.each([
  "",
  "https://www.youtube.com/@eastgeeksmash6420",
  "https://example.com/watch?v=QNZjuyvcjw8",
  "https://www.youtube.com/watch?v=short"
])("%s は動画として読み取らない", (input) => {
  expect(parseVideoId(input)).toBeNull()
})

test("動画IDは英数字と - _ の11文字ちょうど", () => {
  expect(isVideoId("abcDEF_-123")).toBe(true)
  expect(isVideoId("abcDEF_-1234")).toBe(false)
  expect(isVideoId("abcDEF_-12")).toBe(false)
  expect(parseVideoId("abcDEF_-1234")).toBeNull()
})

test("YouTube以外のサイトや、YouTubeに似せた名前のサイトは読まない", () => {
  expect(parseVideoId("https://example.com/watch?v=abcDEF_-123")).toBeNull()
  expect(parseVideoId("https://notyoutube.com/watch?v=abcDEF_-123")).toBeNull()
  expect(parseVideoId("https://youtube.com.example.com/watch?v=abcDEF_-123")).toBeNull()
  expect(parseVideoId("https://youtu.be.example.com/abcDEF_-123")).toBeNull()
})

test("http でも、https:// を省いても、空白が前後にあっても読める", () => {
  expect(parseVideoId("http://www.youtube.com/watch?v=abcDEF_-123")).toBe("abcDEF_-123")
  expect(parseVideoId("  youtube.com/watch?v=abcDEF_-123  ")).toBe("abcDEF_-123")
  expect(parseVideoId("ftp://https://www.youtube.com/watch?v=abcDEF_-123")).toBeNull()
})

test("空や、読めない文字列、IDが短い短縮URLは null", () => {
  expect(parseVideoId("   ")).toBeNull()
  expect(parseVideoId("http://[")).toBeNull()
  expect(parseVideoId("https://youtu.be/short")).toBeNull()
})
