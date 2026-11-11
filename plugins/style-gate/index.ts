import { Plugin } from "@opencode/plugin"
import { execFile } from "node:child_process"
import { readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

// ===== 全局变量设置区域 =====
const CONFIG_DIR = join(homedir(), ".config", "opencode")
const GATE_FILE = join(CONFIG_DIR, "输出闸门.md")
const REFLECT_FILE = join(CONFIG_DIR, "reflection", "latest.json")
const REFLECT_SCRIPT = join(homedir(), "code", "py_apps", "mac_mcp", "scripts", "reflect_cron.py")
const REFRESH_HOURS = 24
const CHECK_MS = 6 * 60 * 60 * 1000
const GATE_MAX_CHARS = 900
// ==========================================================

type Options = {
  enabled?: boolean
  reflectScript?: string
}

const readText = (path: string) => {
  try {
    return readFileSync(path, "utf8")
  } catch {
    return ""
  }
}

const gateText = () => {
  const raw = readText(GATE_FILE).trim()
  if (raw.length === 0) return ""
  const body = raw.replace(/^#.*$/gm, "").trim()
  return body.length > GATE_MAX_CHARS ? body.slice(0, GATE_MAX_CHARS) : body
}

const topIssue = () => {
  const raw = readText(REFLECT_FILE)
  if (raw.length === 0) return ""
  try {
    const data = JSON.parse(raw) as { top_issue?: { name?: string; example?: string } }
    const name = data.top_issue?.name ?? ""
    if (name.length === 0) return ""
    const example = (data.top_issue?.example ?? "").replace(/[。！？!?]+$/, "").slice(0, 50)
    return example.length > 0 ? `${name}，最近一次原话：${example}` : name
  } catch {
    return ""
  }
}

const stale = () => {
  try {
    const age = Date.now() - statSync(REFLECT_FILE).mtimeMs
    return age > REFRESH_HOURS * 60 * 60 * 1000
  } catch {
    return true
  }
}

export default Plugin.define({
  id: "style-gate",
  async setup(ctx) {
    const opt = { enabled: true, reflectScript: REFLECT_SCRIPT, ...((ctx.options ?? {}) as Options) }
    if (!opt.enabled) return

    const refresh = () => {
      if (!stale()) return
      execFile("python3", [opt.reflectScript as string], { timeout: 60_000 }, () => {})
    }
    refresh()
    const timer = setInterval(refresh, CHECK_MS)

    const registration = await ctx.session.hook("context", (event) => {
      if (event.system.some((part) => part.type === "text" && part.text.includes("<输出闸门>"))) return
      const gate = gateText()
      if (gate.length === 0) return
      const issue = topIssue()
      const text = [
        "<输出闸门>",
        "以下是用户的硬性要求，与其它说明冲突时以这里为准。",
        gate,
        issue.length > 0 ? `最近反复出现的问题：${issue}。这次回答前先对照检查。` : "",
        "</输出闸门>",
      ]
        .filter((line) => line.length > 0)
        .join("\n")
      event.system.push({ type: "text", text })
    })

    return async () => {
      clearInterval(timer)
      await registration.dispose()
    }
  },
})
