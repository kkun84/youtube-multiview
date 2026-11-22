import { expect, test } from "vitest"
import { parseVideoId } from "./youtube-id"

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
