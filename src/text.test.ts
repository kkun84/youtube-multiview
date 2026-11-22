import { expect, test } from "vitest"
import { escapeHtml, formatDuration } from "./text"

test("秒数を日本語で表す", () => {
  expect(formatDuration(20.4)).toBe("20秒")
  expect(formatDuration(65)).toBe("1分5秒")
  expect(formatDuration(120)).toBe("2分")
})

test("タイトルに含まれるHTMLの記号を無害にする", () => {
  expect(escapeHtml('<b>"A&B"</b>')).toBe("&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;")
})
