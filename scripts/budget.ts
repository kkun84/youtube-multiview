import { readdir, readFile } from "node:fs/promises"
import { gzipSync } from "node:zlib"

interface Budgets {
  readonly gzip: Readonly<Record<string, number>>
}

const budgets = JSON.parse(await readFile(new URL("../budgets.json", import.meta.url), "utf8")) as Budgets
const assets = new URL("../dist/assets/", import.meta.url)
const names = await readdir(assets)

const sizeOf = async (extension: string): Promise<number> => {
  const files = names.filter((name) => name.endsWith(`.${extension}`))
  const contents = await Promise.all(files.map((name) => readFile(new URL(name, assets))))
  return contents.reduce((total, content) => total + gzipSync(content).length, 0)
}

const results = await Promise.all(
  Object.entries(budgets.gzip).map(async ([extension, limit]) => ({ extension, limit, size: await sizeOf(extension) }))
)

for (const { extension, limit, size } of results) {
  process.stdout.write(`${extension}: ${size} / ${limit} bytes (gzip)\n`)
}
const over = results.filter(({ limit, size }) => size > limit)
if (over.length > 0) {
  process.stderr.write(`サイズの上限を超えました: ${over.map(({ extension }) => extension).join(", ")}\n`)
  process.exitCode = 1
}
