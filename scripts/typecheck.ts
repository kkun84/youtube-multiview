import { spawnSync } from "node:child_process"

const located = spawnSync("effect-tsgo", ["get-exe-path"], { encoding: "utf8", shell: process.platform === "win32" })
const tsgo = located.stdout.trim().split("\n").at(-1) ?? ""
const checked = spawnSync(tsgo, ["-p", "tsconfig.json"], { stdio: "inherit" })

process.exitCode = located.status === 0 && checked.status === 0 ? 0 : 1
