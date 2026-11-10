import { Plugin } from "@opencode/plugin"
import { readFileSync } from "node:fs"

// ===== 全局变量设置区域 =====
const STATE_FILE = `${process.env.HOME}/.local/state/opencode/model.json`
const POLL_MS = 1000
const DEBUG = true
const FALLBACK = { providerID: "opencode-go", modelID: "deepseek-v4.1-flash" }
// ==========================================================

type Recent = { providerID: string; modelID: string }

type Options = {
  enabled?: boolean
  pollMs?: number
  debug?: boolean
}

const readRecent = (): Recent[] => {
  const raw = readFileSync(STATE_FILE, "utf8")
  const data = JSON.parse(raw)
  if (!Array.isArray(data.recent)) return []
  return data.recent.filter((item: unknown): item is Recent => {
    const entry = item as Partial<Recent> | null
    return typeof entry?.providerID === "string" && typeof entry?.modelID === "string"
  })
}

export default Plugin.define({
  id: "remember-model",
  async setup(ctx) {
    const opt = { enabled: true, pollMs: POLL_MS, debug: DEBUG, ...((ctx.options ?? {}) as Options) }
    const log = (...args: unknown[]) => {
      if (opt.debug) console.log("[remember-model]", ...args)
    }
    if (!opt.enabled) return () => {}

    let registration: Awaited<ReturnType<typeof ctx.model.transform>> | undefined
    let applied = ""

    const apply = async () => {
      const recent = readRecent()
      const raw = (await ctx.model.list()) as unknown
      const available: { providerID: string; id: string; enabled?: boolean }[] = Array.isArray(raw)
        ? (raw as never)
        : Array.isArray((raw as { data?: unknown })?.data)
          ? ((raw as { data: never[] }).data)
          : Array.from(raw as Iterable<{ providerID: string; id: string; enabled?: boolean }>)
      const usable = (entry: Recent) =>
        available.some((model) => model.providerID === entry.providerID && model.id === entry.modelID && model.enabled)
      const pick = recent.find(usable) ?? (usable(FALLBACK) ? FALLBACK : undefined)
      if (!pick) return log("最近模型与保底模型都不可用")
      const key = `${pick.providerID}/${pick.modelID}`
      if (key === applied) return
      if (registration) await registration.dispose()
      registration = await ctx.model.transform((editor) => {
        editor.default.set(pick.providerID, pick.modelID)
      })
      applied = key
      log("默认模型改为", key)
    }

    await apply()

    const timer = setInterval(() => {
      void apply().catch((error) => log("应用失败", error))
    }, opt.pollMs)

    return async () => {
      clearInterval(timer)
      if (registration) await registration.dispose()
    }
  },
})
