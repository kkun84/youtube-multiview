import { defineConfig, type Plugin } from "vite"

// 版番号はビルドした日時(日本時間)。ページに埋め込み、同じ値を version.json にも書き出して更新の確認に使う
const version = new Date(Date.now() + 9 * 3600 * 1000).toISOString().replaceAll(/[-:]/g, "").replace("T", "-").slice(0, 15)

const versionFile = (): Plugin => ({
  name: "version-file",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "version.json", source: `${JSON.stringify({ version })}\n` })
  }
})

export default defineConfig({
  // GitHub Pages では /youtube-multiview/ の下に置かれるので、相対パスで出力する
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [versionFile()]
})
