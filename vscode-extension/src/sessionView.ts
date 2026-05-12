export interface SessionViewState {
  activity_state?: string | null
  activity_started_at?: string | null
  activity_elapsed_seconds?: number | null
  unread?: boolean
  bound?: boolean
  total_tokens?: number | null
  turn_count?: number | null
  context_percent?: number | null
  context_tokens?: number | null
  context_window?: number | null
  compaction_count?: number | null
  tool_call_count?: number | null
  cache_hit_percent?: number | null
  failure_count?: number | null
  shell_command_count?: number | null
  web_search_count?: number | null
  patch_apply_count?: number | null
  subagent_count?: number | null
  edited_file_count?: number | null
  command_success_percent?: number | null
  command_duration_seconds?: number | null
  last_turn_duration_seconds?: number | null
  time_to_first_token_ms?: number | null
}

export interface SessionSortState {
  id?: string | null
  name?: string | null
  created_at?: string | null
}

export interface SessionStatusIcon {
  codicon: string
  color: string
  label: string
}

export function isRunning (session: SessionViewState): boolean {
  return session.activity_state === 'running'
}

export function sessionStatusIcon (session: SessionViewState): SessionStatusIcon | undefined {
  if (isRunning(session)) {
    return {
      codicon: 'circle-filled',
      color: 'charts.orange',
      label: '$(circle-filled)'
    }
  }
  if (session.activity_state === 'unread' || session.unread) {
    return {
      codicon: 'circle-filled',
      color: 'testing.iconFailed',
      label: '$(circle-filled)'
    }
  }
  if (session.activity_state === 'read' || session.bound) {
    return {
      codicon: 'circle-filled',
      color: 'testing.iconPassed',
      label: '$(pass-filled)'
    }
  }
  return undefined
}

export function sortSessionsForSidebar<T extends SessionSortState> (sessions: T[]): T[] {
  return [...sessions].sort((left, right) => {
    const byCreated = timestamp(right.created_at) - timestamp(left.created_at)
    if (byCreated !== 0) {
      return byCreated
    }
    const byName = String(left.name || '').localeCompare(String(right.name || ''))
    if (byName !== 0) {
      return byName
    }
    return String(left.id || '').localeCompare(String(right.id || ''))
  })
}

export function sessionDescription (session: SessionViewState, nowMs = Date.now()): string {
  const parts: string[] = []
  if (isRunning(session)) {
    parts.push(formatElapsed(runningElapsedSeconds(session, nowMs)))
  }
  parts.push(...sessionMetricParts(session))
  return parts.join(' · ')
}

export function sessionMetricParts (session: SessionViewState): string[] {
  const parts: string[] = []
  const turns = finiteMetric(session.turn_count)
  if (turns !== undefined) {
    const count = Math.max(0, Math.floor(turns))
    parts.push(`${count}轮`)
  }
  const totalTokens = finiteMetric(session.total_tokens)
  if (totalTokens !== undefined) {
    parts.push(formatTokenCount(totalTokens))
  }
  const contextPercent = finiteMetric(session.context_percent)
  if (contextPercent !== undefined) {
    parts.push(`${Math.max(0, Math.round(contextPercent))}% ctx`)
  }
  const compactions = positiveMetric(session.compaction_count)
  if (compactions !== undefined) {
    parts.push(`压${compactions}`)
  }
  const toolCalls = positiveMetric(session.tool_call_count)
  if (toolCalls !== undefined) {
    parts.push(`工具${toolCalls}`)
  }
  const cacheHit = positiveMetric(session.cache_hit_percent)
  if (cacheHit !== undefined) {
    parts.push(`缓${cacheHit}%`)
  }
  const failures = positiveMetric(session.failure_count)
  if (failures !== undefined) {
    parts.push(`败${failures}`)
  }
  return parts
}

export function sessionTooltipMetricLines (session: SessionViewState): string[] {
  const lines: string[] = []
  const turns = finiteMetric(session.turn_count)
  if (turns !== undefined) {
    lines.push(`对话轮数：${formatWholeNumber(turns)}`)
  }
  const totalTokens = finiteMetric(session.total_tokens)
  if (totalTokens !== undefined) {
    lines.push(`总 token：${formatWholeNumber(totalTokens)}`)
  }
  const contextPercent = finiteMetric(session.context_percent)
  if (contextPercent !== undefined) {
    const percent = `${Math.max(0, Math.round(contextPercent))}%`
    const contextTokens = finiteMetric(session.context_tokens)
    const contextWindow = finiteMetric(session.context_window)
    if (contextTokens !== undefined && contextWindow !== undefined) {
      lines.push(`上下文：${percent} (${formatWholeNumber(contextTokens)} / ${formatWholeNumber(contextWindow)})`)
    } else {
      lines.push(`上下文：${percent}`)
    }
  }
  const compactions = finiteMetric(session.compaction_count)
  if (compactions !== undefined) {
    lines.push(`压缩次数：${formatWholeNumber(compactions)}`)
  }
  const toolCalls = finiteMetric(session.tool_call_count)
  if (toolCalls !== undefined) {
    lines.push(`工具调用：${formatWholeNumber(toolCalls)}`)
  }
  const cacheHit = finiteMetric(session.cache_hit_percent)
  if (cacheHit !== undefined) {
    lines.push(`缓存命中：${Math.max(0, Math.round(cacheHit))}%`)
  }
  const failures = finiteMetric(session.failure_count)
  if (failures !== undefined) {
    lines.push(`失败次数：${formatWholeNumber(failures)}`)
  }
  const toolBreakdown = toolBreakdownLine(session)
  if (toolBreakdown) {
    lines.push(toolBreakdown)
  }
  const editedFiles = positiveMetric(session.edited_file_count)
  if (editedFiles !== undefined) {
    lines.push(`编辑文件：${formatWholeNumber(editedFiles)}`)
  }
  const commandSuccess = finiteMetric(session.command_success_percent)
  if (commandSuccess !== undefined) {
    lines.push(`命令成功率：${Math.max(0, Math.round(commandSuccess))}%`)
  }
  const commandDuration = positiveMetric(session.command_duration_seconds)
  if (commandDuration !== undefined) {
    lines.push(`命令耗时：${formatElapsed(commandDuration)}`)
  }
  const lastTurnDuration = positiveMetric(session.last_turn_duration_seconds)
  if (lastTurnDuration !== undefined) {
    lines.push(`最近一轮：${formatElapsed(lastTurnDuration)}`)
  }
  const firstToken = positiveMetric(session.time_to_first_token_ms)
  if (firstToken !== undefined) {
    lines.push(`首 token：${firstToken}ms`)
  }
  return lines
}

export function runningElapsedSeconds (session: SessionViewState, nowMs = Date.now()): number {
  const reported = typeof session.activity_elapsed_seconds === 'number'
    ? session.activity_elapsed_seconds
    : 0
  const startedAt = typeof session.activity_started_at === 'string'
    ? Date.parse(session.activity_started_at)
    : Number.NaN
  if (!Number.isFinite(startedAt)) {
    return Math.max(0, Math.floor(reported))
  }
  const elapsedFromStart = Math.floor((nowMs - startedAt) / 1000)
  return Math.max(0, Math.floor(reported), elapsedFromStart)
}

export function formatElapsed (seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

export function formatTokenCount (tokens: number): string {
  const value = Math.max(0, Math.floor(tokens))
  if (value >= 1_000_000_000) {
    return formatScaledNumber(value, 1_000_000_000, 'B')
  }
  if (value >= 1_000_000) {
    return formatScaledNumber(value, 1_000_000, 'M')
  }
  if (value >= 1_000) {
    return formatScaledNumber(value, 1_000, 'K')
  }
  return String(value)
}

function formatScaledNumber (value: number, unit: number, suffix: string): string {
  const scaled = value / unit
  const precision = scaled < 10 ? 1 : 0
  return `${scaled.toFixed(precision).replace(/\.0$/, '')}${suffix}`
}

function finiteMetric (value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function positiveMetric (value: number | null | undefined): number | undefined {
  const metric = finiteMetric(value)
  if (metric === undefined) {
    return undefined
  }
  const rounded = Math.max(0, Math.round(metric))
  return rounded > 0 ? rounded : undefined
}

function formatWholeNumber (value: number): string {
  return Math.max(0, Math.floor(value)).toLocaleString('en-US')
}

function toolBreakdownLine (session: SessionViewState): string | undefined {
  const parts: string[] = []
  const shell = positiveMetric(session.shell_command_count)
  if (shell !== undefined) {
    parts.push(`shell ${shell}`)
  }
  const web = positiveMetric(session.web_search_count)
  if (web !== undefined) {
    parts.push(`web ${web}`)
  }
  const patch = positiveMetric(session.patch_apply_count)
  if (patch !== undefined) {
    parts.push(`patch ${patch}`)
  }
  const subagents = positiveMetric(session.subagent_count)
  if (subagents !== undefined) {
    parts.push(`subagent ${subagents}`)
  }
  return parts.length ? `工具分布：${parts.join(', ')}` : undefined
}

function timestamp (value: string | null | undefined): number {
  if (!value) {
    return 0
  }
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}
