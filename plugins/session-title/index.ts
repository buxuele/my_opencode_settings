import { Plugin } from "@opencode/plugin"
import { appendFileSync } from "node:fs"

// ===== 全局变量设置区域 =====
const SEPARATOR = " "
const PREFIX_FOLDER = false
const MAX_SUMMARY = 28
const CUT_MARKS = "，。？！；、,.;:： \t"
const NOISE_PREFIX = /^(?:帮我|请|麻烦|现在|接着|继续|那个|这个|然后|所以|我想|我要|我需要|能不能|可以吗|可以帮我|我想让你|给我)\s*/i
const CODE_FENCE = /```[\s\S]*?```/g
const REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g
const HEADING = /^\s{0,3}#{1,6}\s*/gm
const URL = /\b(?:https?:\/\/|www\.)\S+/g
const WS = /\s+/
const TITLE_PROMPT = /^Here is the first message/i
// ==========================================================

type Options = {
  separator?: string
  prefixFolder?: boolean
  maxSummary?: number
  debug?: boolean
}

type AnyMsg = {
  role?: string
  content?: unknown
}

const folderOf = (directory: string) => {
  const trimmed = directory.replace(/\/+$/, "")
  if (trimmed === "") return directory
  const name = trimmed.split("/").pop()
  return name && name.length > 0 ? name : trimmed
}

const textOf = (message: AnyMsg) => {
  const direct = (message as { text?: unknown })?.text
  if (typeof direct === "string") return direct
  const content = message.content
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .filter((part: any) => part?.type === "text" && typeof part.text === "string")
    .map((part: any) => part.text)
    .join(" ")
}

const firstUserText = (messages: readonly unknown[]) => {
  for (const message of messages as readonly AnyMsg[]) {
    if (message?.role !== "user") continue
    const text = textOf(message)
    if (text.trim().length > 0) return text
  }
  return ""
}

const condense = (raw: string, max: number) => {
  const cleaned = raw
    .replace(REMINDER, " ")
    .replace(CODE_FENCE, " ")
    .replace(HEADING, "")
    .replace(URL, "")
    .replace(WS, " ")
    .trim()
  if (cleaned.length === 0) return ""

  let body = cleaned.replace(NOISE_PREFIX, "").trim()
  if (body.length === 0) body = cleaned

  if (body.length <= max) return trimEnd(body)

  const slice = body.slice(0, max)
  let cut = -1
  for (let i = slice.length - 1; i >= Math.floor(max * 0.5); i--) {
    if (CUT_MARKS.includes(slice[i] as string)) {
      cut = i
      break
    }
  }
  return trimEnd(cut > 0 ? slice.slice(0, cut) : slice)
}

const trimEnd = (text: string) => {
  let out = text.trim()
  while (out.length > 0 && (CUT_MARKS.includes(out[out.length - 1] as string) || out.endsWith("-"))) {
    out = out.slice(0, -1).trim()
  }
  return out
}

export default Plugin.define({
  id: "session-title",
  async setup(ctx) {
    const opt = { ...{ separator: SEPARATOR, prefixFolder: PREFIX_FOLDER, maxSummary: MAX_SUMMARY, debug: false }, ...((ctx.options ?? {}) as Options) }
    const log = (...args: unknown[]) => {
      if (!opt.debug) return
      const line = `${new Date().toISOString()} ${args.map((arg) => String(arg)).join(" ")}\n`
      try {
        appendFileSync("/tmp/session-title.log", line)
      } catch {}
    }

    const registration = await ctx.session.hook("title", async (event) => {
      const info = await ctx.session.get({ sessionID: event.sessionID })
      const directory =
        (info as { location?: { directory?: string }; directory?: string })?.location?.directory ??
        (info as { directory?: string })?.directory ??
        ctx.location?.directory
      if (typeof directory !== "string" || directory.length === 0) return log(event.sessionID, "无目录信息，用内置生成")

      const context = (await ctx.session.context({ sessionID: event.sessionID })) as unknown
      const list: AnyMsg[] = Array.isArray(context)
        ? (context as never)
        : Array.isArray((context as { data?: unknown })?.data)
          ? ((context as { data: never[] }).data)
          : []
      const real = list
        .filter((message) => message?.role === "user" || (message as { type?: string })?.type === "user")
        .map(textOf)
        .map((text) => text.trim())
        .find((text) => text.length > 0 && !TITLE_PROMPT.test(text))
      const folder = folderOf(directory)
      const summary = condense(real ?? firstUserText(event.messages), opt.maxSummary)
      const title = summary.length > 0 ? (opt.prefixFolder ? `${folder}${opt.separator}${summary}` : summary) : folder

      event.result = title
      log(event.sessionID, "->", title)
    })

    return async () => {
      await registration.dispose()
    }
  },
})