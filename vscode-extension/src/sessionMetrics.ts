export interface TranscriptMetrics {
  total_tokens: number | null
  turn_count: number | null
  context_tokens: number | null
  context_window: number | null
  context_percent: number | null
  compaction_count: number | null
  tool_call_count: number | null
  cache_hit_percent: number | null
  failure_count: number | null
  shell_command_count: number | null
  web_search_count: number | null
  patch_apply_count: number | null
  subagent_count: number | null
  edited_file_count: number | null
  command_success_percent: number | null
  command_duration_seconds: number | null
  last_turn_duration_seconds: number | null
  time_to_first_token_ms: number | null
}

export interface TranscriptMetricSession {
  transcript_path?: string | null
  total_tokens?: number | null
  turn_count?: number | null
  context_tokens?: number | null
  context_window?: number | null
  context_percent?: number | null
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

type ReadText = (path: string) => Promise<string>
type MetricKey = keyof TranscriptMetrics

const metricKeys: MetricKey[] = [
  'total_tokens',
  'turn_count',
  'context_tokens',
  'context_window',
  'context_percent',
  'compaction_count',
  'tool_call_count',
  'cache_hit_percent',
  'failure_count',
  'shell_command_count',
  'web_search_count',
  'patch_apply_count',
  'subagent_count',
  'edited_file_count',
  'command_success_percent',
  'command_duration_seconds',
  'last_turn_duration_seconds',
  'time_to_first_token_ms'
]

export async function hydrateTranscriptMetrics<T extends TranscriptMetricSession> (
  sessions: T[],
  readText: ReadText
): Promise<T[]> {
  const hydrated = await Promise.all(sessions.map(async session => {
    if (!session.transcript_path || hasSidebarMetrics(session)) {
      return session
    }
    try {
      const metrics = transcriptMetricsFromJsonl(await readText(session.transcript_path))
      return mergeMissingMetrics(session, metrics)
    } catch {
      return session
    }
  }))
  return hydrated
}

export function transcriptMetricsFromJsonl (text: string): TranscriptMetrics {
  const metrics = emptyTranscriptMetrics()
  let turnCount = 0
  let lastTurnText: string | undefined
  let lastTurnTime: number | undefined
  const compactionPositions: Array<{ seconds?: number, lineNo: number }> = []
  const editedFilePaths = new Set<string>()
  let commandCount = 0
  let commandSuccessCount = 0
  let commandDurationTotal = 0

  function addUserTurn (text: string | undefined, timestamp: string | undefined): void {
    const visible = userVisibleConversationText(text)
    if (!visible) {
      return
    }
    const turnTime = timestamp ? Date.parse(timestamp) : Number.NaN
    const hasTurnTime = Number.isFinite(turnTime)
    if (visible === lastTurnText) {
      if (!hasTurnTime || lastTurnTime === undefined) {
        return
      }
      if (Math.abs((turnTime - lastTurnTime) / 1000) <= 2) {
        return
      }
    }
    turnCount += 1
    lastTurnText = visible
    lastTurnTime = hasTurnTime ? turnTime : undefined
  }

  function addCompaction (timestamp: string | undefined, lineNo: number): void {
    const parsed = timestamp ? Date.parse(timestamp) : Number.NaN
    const seconds = Number.isFinite(parsed) ? parsed / 1000 : undefined
    for (const previous of compactionPositions) {
      if (seconds !== undefined && previous.seconds !== undefined) {
        if (Math.abs(seconds - previous.seconds) <= 1) {
          return
        }
      } else if (seconds === undefined && previous.seconds === undefined && Math.abs(lineNo - previous.lineNo) <= 2) {
        return
      }
    }
    compactionPositions.push({ seconds, lineNo })
    metrics.compaction_count = (metrics.compaction_count || 0) + 1
  }

  const lines = text.split(/\r?\n/)
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) {
      continue
    }
    let item: unknown
    try {
      item = JSON.parse(line)
    } catch {
      continue
    }
    if (!isRecord(item)) {
      continue
    }
    const payload = item.payload
    if (!isRecord(payload)) {
      continue
    }
    const lineNo = index + 1
    if (item.type === 'compacted') {
      addCompaction(stringValue(item.timestamp), lineNo)
    }
    if (item.type === 'response_item') {
      if (payload.type === 'function_call' || payload.type === 'custom_tool_call' || payload.type === 'web_search_call') {
        metrics.tool_call_count = (metrics.tool_call_count || 0) + 1
      }
      if (payload.type === 'function_call') {
        if (payload.name === 'exec_command') {
          metrics.shell_command_count = (metrics.shell_command_count || 0) + 1
        } else if (payload.name === 'spawn_agent') {
          metrics.subagent_count = (metrics.subagent_count || 0) + 1
        }
      } else if (payload.type === 'custom_tool_call' && payload.name === 'apply_patch') {
        metrics.patch_apply_count = (metrics.patch_apply_count || 0) + 1
      } else if (payload.type === 'web_search_call') {
        metrics.web_search_count = (metrics.web_search_count || 0) + 1
      }
      if (payload.type === 'message' && payload.role === 'user') {
        addUserTurn(extractMessageContentText(payload.content), stringValue(item.timestamp) || stringValue(payload.timestamp))
      }
    }
    if (item.type !== 'event_msg') {
      continue
    }
    if (payload.type === 'user_message') {
      addUserTurn(stringValue(payload.message), stringValue(item.timestamp) || stringValue(payload.timestamp))
      continue
    }
    if (payload.type === 'context_compacted') {
      addCompaction(stringValue(item.timestamp), lineNo)
      continue
    }
    if (payload.type === 'exec_command_end') {
      commandCount += 1
      const succeeded = payload.status === 'completed' && payload.exit_code === 0
      if (succeeded) {
        commandSuccessCount += 1
      } else {
        metrics.failure_count = (metrics.failure_count || 0) + 1
      }
      const duration = durationSecondsValue(payload.duration)
      if (duration !== null) {
        commandDurationTotal += duration
      }
      continue
    }
    if (payload.type === 'patch_apply_end') {
      if (payload.success === false || (payload.status !== undefined && payload.status !== 'completed')) {
        metrics.failure_count = (metrics.failure_count || 0) + 1
      }
      if (isRecord(payload.changes)) {
        for (const path of Object.keys(payload.changes)) {
          editedFilePaths.add(path)
        }
      }
      continue
    }
    if (payload.type === 'error') {
      metrics.failure_count = (metrics.failure_count || 0) + 1
      continue
    }
    if (payload.type === 'turn_aborted') {
      metrics.failure_count = (metrics.failure_count || 0) + 1
      metrics.last_turn_duration_seconds = millisecondsToSeconds(payload.duration_ms)
      continue
    }
    if (payload.type === 'task_complete') {
      metrics.last_turn_duration_seconds = millisecondsToSeconds(payload.duration_ms)
      metrics.time_to_first_token_ms = integerMetric(payload.time_to_first_token_ms)
      continue
    }
    if (payload.type !== 'token_count' || !isRecord(payload.info)) {
      continue
    }
    const totalUsage = payload.info.total_token_usage
    const totalTokens = usageTotalTokens(payload.info.total_token_usage)
    const contextTokens = usageTotalTokens(payload.info.last_token_usage)
    const contextWindow = integerMetric(payload.info.model_context_window)
    metrics.total_tokens = totalTokens
    metrics.context_tokens = contextTokens
    metrics.context_window = contextWindow
    metrics.context_percent = contextTokens !== null && contextWindow !== null && contextWindow > 0
      ? Math.round((contextTokens / contextWindow) * 100)
      : null
    const inputTokens = usageInputTokens(totalUsage)
    const cachedTokens = usageCachedInputTokens(totalUsage)
    metrics.cache_hit_percent = inputTokens !== null && inputTokens > 0 && cachedTokens !== null
      ? Math.round((cachedTokens / inputTokens) * 100)
      : null
  }

  metrics.turn_count = turnCount
  metrics.edited_file_count = editedFilePaths.size
  metrics.command_duration_seconds = Math.round(commandDurationTotal)
  metrics.command_success_percent = commandCount > 0
    ? Math.round((commandSuccessCount / commandCount) * 100)
    : null
  return metrics
}

function emptyTranscriptMetrics (): TranscriptMetrics {
  return {
    total_tokens: null,
    turn_count: null,
    context_tokens: null,
    context_window: null,
    context_percent: null,
    compaction_count: 0,
    tool_call_count: 0,
    cache_hit_percent: null,
    failure_count: 0,
    shell_command_count: 0,
    web_search_count: 0,
    patch_apply_count: 0,
    subagent_count: 0,
    edited_file_count: 0,
    command_success_percent: null,
    command_duration_seconds: 0,
    last_turn_duration_seconds: null,
    time_to_first_token_ms: null
  }
}

function hasSidebarMetrics (session: TranscriptMetricSession): boolean {
  return metricKeys.every(key => hasOwnProperty(session, key))
}

function mergeMissingMetrics<T extends TranscriptMetricSession> (session: T, metrics: TranscriptMetrics): T {
  let changed = false
  const next: TranscriptMetricSession = { ...session }
  for (const key of metricKeys) {
    if (!hasOwnProperty(next, key) || (!hasMetric(next[key]) && hasMetric(metrics[key]))) {
      next[key] = metrics[key]
      changed = true
    }
  }
  return changed ? next as T : session
}

function usageTotalTokens (usage: unknown): number | null {
  if (!isRecord(usage)) {
    return null
  }
  const total = integerMetric(usage.total_tokens)
  if (total !== null) {
    return total
  }
  const inputTokens = integerMetric(usage.input_tokens)
  const outputTokens = integerMetric(usage.output_tokens)
  if (inputTokens === null && outputTokens === null) {
    return null
  }
  return (inputTokens || 0) + (outputTokens || 0)
}

function usageInputTokens (usage: unknown): number | null {
  if (!isRecord(usage)) {
    return null
  }
  return integerMetric(usage.input_tokens)
}

function usageCachedInputTokens (usage: unknown): number | null {
  if (!isRecord(usage)) {
    return null
  }
  return integerMetric(usage.cached_input_tokens)
}

function durationSecondsValue (duration: unknown): number | null {
  if (!isRecord(duration)) {
    return null
  }
  let total = 0
  let found = false
  const secs = numberMetric(duration.secs)
  if (secs !== null) {
    total += secs
    found = true
  }
  const nanos = numberMetric(duration.nanos)
  if (nanos !== null) {
    total += nanos / 1_000_000_000
    found = true
  }
  return found ? total : null
}

function millisecondsToSeconds (value: unknown): number | null {
  const millis = integerMetric(value)
  return millis === null ? null : Math.round(millis / 1000)
}

function extractMessageContentText (content: unknown): string | undefined {
  if (typeof content === 'string') {
    return content
  }
  if (!Array.isArray(content)) {
    return undefined
  }
  const pieces: string[] = []
  for (const item of content) {
    if (!isRecord(item)) {
      continue
    }
    if (item.type === 'input_text' || item.type === 'output_text' || item.type === 'text') {
      const text = stringValue(item.text)
      if (text) {
        pieces.push(text)
      }
    }
  }
  return pieces.join(' ')
}

function userVisibleConversationText (text: string | undefined): string {
  const cleaned = normalizePreviewText(text)
  if (!cleaned) {
    return ''
  }
  const internalPrefixes = [
    '# AGENTS.md instructions',
    'Another language model started to solve this problem',
    '<environment_context>',
    '<permissions instructions>',
    '<collaboration_mode>',
    '<skills_instructions>',
    '<INSTRUCTIONS>'
  ]
  return internalPrefixes.some(prefix => cleaned.startsWith(prefix)) ? '' : cleaned
}

function normalizePreviewText (text: string | undefined): string {
  return text ? text.replace(/\s+/g, ' ').trim() : ''
}

function integerMetric (value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.floor(value)
}

function numberMetric (value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null
  }
  return value
}

function hasMetric (value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function hasOwnProperty (value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function stringValue (value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
