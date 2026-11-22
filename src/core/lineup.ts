import type { LayoutMode } from "./layout"
import { isVideoId, parseVideoId } from "./youtube-id"

export const MAX = 9
export const GAP = 4

/** 並べる動画と、その名前・音声・大きく表示する動画 */
export type Lineup = {
  readonly ids: readonly string[]
  readonly titles: ReadonlyMap<string, string>
  readonly audioId: string | null
  readonly focusId: string | null
}

export const nameOf = (lineup: Pick<Lineup, "ids" | "titles">, id: string): string =>
  lineup.titles.get(id) ?? `動画${lineup.ids.indexOf(id) + 1}`

/** 大きく表示する動画。選ばれていないか消えていれば、音声を出している動画か先頭の動画にする */
export function focusedId(lineup: Pick<Lineup, "ids" | "audioId" | "focusId">): string | undefined {
  if (lineup.focusId && lineup.ids.includes(lineup.focusId)) return lineup.focusId
  if (lineup.audioId && lineup.ids.includes(lineup.audioId)) return lineup.audioId
  return lineup.ids[0]
}

export const layoutKey: (mode: LayoutMode) => string = String

/** 保存した並べ方を読む。以前の版は自動を "0" で保存していた */
export function parseLayout(value: string): LayoutMode {
  if (value === "focus") return "focus"
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : "auto"
}

/** URLや保存した値から並べる動画を読む。読めないIDと重複を除き、上限までにする */
export const parseIds = (value: string): string[] => [...new Set(value.split(",").filter((id) => isVideoId(id)))].slice(0, MAX)

/** YouTubeの動画ページ。概要欄とコメントはここで見る(埋め込みプレーヤーからは取れない) */
export const watchUrl = (id: string): string => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`

/** 追加しようとしたURLを確かめる。追加できるなら動画ID、できないなら理由 */
export function checkAddition(raw: string, ids: readonly string[]): { id: string } | { error: string } {
  if (!raw.trim()) return { error: "URLを入れてください。" }
  const id = parseVideoId(raw)
  if (!id) return { error: "YouTubeの動画として読み取れません。チャンネルのURLではなく、動画や配信そのもののURLを入れてください。" }
  if (ids.includes(id)) return { error: "この動画はもう並んでいます。" }
  if (ids.length >= MAX) return { error: `並べられるのは${MAX}つまでです。どれかを削除してから追加してください。` }
  return { id }
}

/** id を step だけ前後に動かした並び。動かせなければ null */
export function shifted(ids: readonly string[], id: string, step: number): string[] | null {
  const i = ids.indexOf(id)
  const j = i + step
  if (i < 0 || j < 0 || j >= ids.length) return null
  const next = ids.filter((x) => x !== id)
  next.splice(j, 0, id)
  return next
}

/** source を target の位置へ動かした並び */
export function movedTo(ids: readonly string[], source: string, target: string): string[] {
  const index = ids.indexOf(target)
  const next = ids.filter((x) => x !== source)
  next.splice(index, 0, source)
  return next
}
