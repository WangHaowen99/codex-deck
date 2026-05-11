export interface TranscriptMetrics {
  total_tokens: number | null
  turn_count: number | null
  context_tokens: number | null
  context_window: number | null
  context_percent: number | null
}

export interface TranscriptMetricSession {
  transcript_path?: string | null
  total_tokens?: number | null
  turn_count?: number | null
  context_tokens?: number | null
  context_window?: number | null
  context_percent?: number | null
}

type ReadText = (path: string) => Promise<string>
type MetricKey = keyof TranscriptMetrics

const metricKeys: MetricKey[] = [
  'total_tokens',
  'turn_count',
  'context_tokens',
  'context_window',
  'context_percent'
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

  for (const line of text.split(/\r?\n/)) {
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
    if (item.type === 'response_item' && payload.type === 'message' && payload.role === 'user') {
      addUserTurn(extractMessageContentText(payload.content), stringValue(item.timestamp) || stringValue(payload.timestamp))
    }
    if (item.type !== 'event_msg') {
      continue
    }
    if (payload.type === 'user_message') {
      addUserTurn(stringValue(payload.message), stringValue(item.timestamp) || stringValue(payload.timestamp))
      continue
    }
    if (payload.type !== 'token_count' || !isRecord(payload.info)) {
      continue
    }
    const totalTokens = usageTotalTokens(payload.info.total_token_usage)
    const contextTokens = usageTotalTokens(payload.info.last_token_usage)
    const contextWindow = integerMetric(payload.info.model_context_window)
    metrics.total_tokens = totalTokens
    metrics.context_tokens = contextTokens
    metrics.context_window = contextWindow
    metrics.context_percent = contextTokens !== null && contextWindow !== null && contextWindow > 0
      ? Math.round((contextTokens / contextWindow) * 100)
      : null
  }

  metrics.turn_count = turnCount
  return metrics
}

function emptyTranscriptMetrics (): TranscriptMetrics {
  return {
    total_tokens: null,
    turn_count: null,
    context_tokens: null,
    context_window: null,
    context_percent: null
  }
}

function hasSidebarMetrics (session: TranscriptMetricSession): boolean {
  return hasMetric(session.total_tokens) && hasMetric(session.turn_count) && hasMetric(session.context_percent)
}

function mergeMissingMetrics<T extends TranscriptMetricSession> (session: T, metrics: TranscriptMetrics): T {
  let changed = false
  const next: TranscriptMetricSession = { ...session }
  for (const key of metricKeys) {
    if (!hasMetric(next[key]) && hasMetric(metrics[key])) {
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

function hasMetric (value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function stringValue (value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
