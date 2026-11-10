import { Plugin } from "@opencode/plugin"

type Options = {
  enabled?: boolean
  debug?: boolean
  idleDelayMs?: number
  maxContinuesPerTurn?: number
  maxErrorRetries?: number
  continuePrompt?: string
  errorPrompt?: string
  stopMarkers?: string[]
  blockedMarkers?: string[]
}

const DEFAULTS = {
  enabled: true,
  idleDelayMs: 1500,
  maxContinuesPerTurn: 20,
  maxErrorRetries: 3,
  errorPrompt: [
    "上一轮因为接口报错中断了，任务还没做完。",
    "先确认当前文件与进程的真实状态，再从中断处继续，不要从头重做，也不要只汇报错误就停下。",
    "全部做完时输出 TASK_STATUS: COMPLETE；确实需要我处理时输出 TASK_STATUS: BLOCKED。",
  ].join("\n"),
  stopMarkers: ["TASK_STATUS: COMPLETE"],
  blockedMarkers: ["TASK_STATUS: BLOCKED"],
  continuePrompt: [
    "自动继续指令：上一轮没有输出 TASK_STATUS: COMPLETE，说明清单还没做完。",
    "禁止复述已完成内容，禁止从头重做，禁止只给计划。",
    "立刻从清单里下一个未完成项开始动手，做完更新清单，然后继续下一项，直到全部完成。",
    "只有两种情况可以停：全部完成时输出 TASK_STATUS: COMPLETE；确实缺我必须给的信息或授权时输出 TASK_STATUS: BLOCKED 并写清缺什么。",
  ].join("\n"),
}

const RULE = [
  "# 任务闭环协议",
  "",
  "1. 开工前先列一份可执行清单，逐条推进，每完成一项立刻把该项标记完成，不要攒到最后一起改。",
  "2. 只允许在两种情况下停止：清单全部完成；遇到必须由用户提供信息或授权才能继续的真实阻塞。",
  "3. 禁止把「先做一部分」「接下来我可以继续」当作结束，禁止用反问代替动手，禁止只交计划不落代码。",
  "4. 不允许在清单还有未完成项时宣称完成。",
  "5. 每一轮回复的最后一行必须且只能是一行状态标记，二选一：",
  "   TASK_STATUS: COMPLETE 表示清单全部完成；",
  "   TASK_STATUS: BLOCKED 表示需要我回答或授权，此时正文必须写清缺什么。",
  "6. 调用提问工具等待我回答之前，先输出 TASK_STATUS: BLOCKED。",
].join("\n")

type State = {
  continues: number
  errors: number
  timer?: ReturnType<typeof setTimeout>
  lastText: string
}

export default Plugin.define({
  id: "auto-continue",
  setup(ctx) {
    const opt = { ...DEFAULTS, ...((ctx.options ?? {}) as Options) }
    const log = (...args: unknown[]) => {
      if (opt.debug) console.log("[auto-continue]", ...args)
    }
    if (opt.enabled === false) return
    log("loaded", JSON.stringify(opt))

    const hook = ctx.session.hook("context", (event) => {
      event.system.push({ type: "text", text: RULE })
    })

    const states = new Map<string, State>()
    const state = (sessionID: string) => {
      let s = states.get(sessionID)
      if (!s) {
        s = { continues: 0, errors: 0, lastText: "" }
        states.set(sessionID, s)
      }
      return s
    }

    const lastAssistantText = async (sessionID: string) => {
      const messages = await ctx.session.context({ sessionID })
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i] as any
        if (message.type !== "assistant") continue
        const parts = Array.isArray(message.content) ? message.content : []
        return {
          text: parts
            .filter((part: any) => part.type === "text" && typeof part.text === "string")
            .map((part: any) => part.text)
            .join("\n")
            .trim(),
          finish: message.finish ?? null,
        }
      }
      return { text: "", finish: null }
    }

    const evaluate = async (sessionID: string) => {
      const s = state(sessionID)
      if (s.continues >= opt.maxContinuesPerTurn) return log(sessionID, "达到上限")

      const info = (await ctx.session.get({ sessionID })) as any
      if (info?.parentID) return log(sessionID, "子会话跳过")

      const pending = await ctx.permission.list({ sessionID })
      if (Array.isArray(pending) && pending.length > 0) return log(sessionID, "等待授权")

      const { text, finish } = await lastAssistantText(sessionID)
      log(sessionID, "finish=", finish, "text=", JSON.stringify(text.slice(0, 60)))

      if (finish === "error") {
        if (s.errors >= opt.maxErrorRetries) return log(sessionID, "错误重试到上限")
        s.errors += 1
        s.continues = 0
        log(sessionID, "错误重试", s.errors)
        await ctx.session.synthetic({
          sessionID,
          text: opt.errorPrompt,
          description: `自动重试 ${s.errors}/${opt.maxErrorRetries}`,
        })
        return
      }

      if (!text) return log(sessionID, "无文本")
      if (opt.stopMarkers.some((m) => text.includes(m)) || opt.blockedMarkers.some((m) => text.includes(m))) {
        s.continues = 0
        s.errors = 0
        return log(sessionID, "命中结束标记")
      }
      if (finish === "length" || finish === "max-tokens") {
        log(sessionID, "输出被截断，续跑")
      } else if (text === s.lastText) {
        return log(sessionID, "文本重复")
      }

      s.continues += 1
      s.lastText = text
      log(sessionID, "注入继续", s.continues)
      await ctx.session.synthetic({
        sessionID,
        text: opt.continuePrompt,
        description: `自动继续 ${s.continues}/${opt.maxContinuesPerTurn}`,
      })
    }

    const schedule = (sessionID: string) => {
      const s = state(sessionID)
      if (s.timer) clearTimeout(s.timer)
      s.timer = setTimeout(() => {
        evaluate(sessionID).catch((error) => console.error("[auto-continue]", sessionID, error))
      }, opt.idleDelayMs)
    }

    const controller = new AbortController()
    void (async () => {
      for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
        const data = (event as any).data ?? {}
        const sessionID: string | undefined = data.sessionID
        if (
          event.type !== "session.inbox.enqueued" &&
          event.type !== "session.execution.succeeded" &&
          event.type !== "session.execution.failed"
        )
          continue
        log("event", event.type, sessionID ?? "-")
        if (!sessionID) continue
        if (event.type === "session.inbox.enqueued") {
          if (data.item?.type === "user") {
            const s = state(sessionID)
            s.continues = 0
            s.errors = 0
          }
          continue
        }
        if (event.type === "session.execution.succeeded" || event.type === "session.execution.failed") {
          schedule(sessionID)
        }
      }
    })()

    return async () => {
      controller.abort()
      for (const s of states.values()) if (s.timer) clearTimeout(s.timer)
      states.clear()
      await hook.dispose()
    }
  },
})