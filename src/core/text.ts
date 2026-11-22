/** 秒数を「1分5秒」「20秒」の形にする */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  if (!m) return `${s}秒`
  return s ? `${m}分${s}秒` : `${m}分`
}

export const escapeHtml = (s: string): string =>
  s.replaceAll(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)
