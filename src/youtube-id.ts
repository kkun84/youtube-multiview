const ID = /^[\w-]{11}$/

export const isVideoId = (s: string): boolean => ID.test(s)

/** YouTubeの動画・配信のURL(または動画ID)から動画IDを取り出す。読み取れなければ null */
export function parseVideoId(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  if (ID.test(s)) return s
  let url: URL
  try {
    url = new URL(/^https?:/i.test(s) ? s : `https://${s}`)
  } catch {
    return null
  }
  if (!/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/.test(url.hostname)) return null
  if (url.hostname.endsWith("youtu.be")) {
    const id = url.pathname.slice(1, 12)
    return ID.test(id) ? id : null
  }
  const v = url.searchParams.get("v")
  if (v && ID.test(v)) return v
  return url.pathname.match(/\/(?:live|embed|shorts|v)\/([\w-]{11})/)?.[1] ?? null
}
