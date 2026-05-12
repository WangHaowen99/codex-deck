export interface TranscriptDetails {
  failures: FailureDetail[]
  shellCommands: ShellCommandDetail[]
  webSearches: WebSearchDetail[]
  patches: PatchDetail[]
  compactions: CompactionDetail[]
  distribution: ToolDistribution
}

export interface FailureDetail {
  timestamp?: string
  type: string
  reason: string
  command?: string
  cwd?: string
  exitCode?: number
  status?: string
  output?: string
}

export interface ShellCommandDetail {
  timestamp?: string
  callId?: string
  command: string
  cwd?: string
  exitCode?: number
  status?: string
  durationSeconds?: number
  output?: string
}

export interface WebSearchDetail {
  timestamp?: string
  queries: string[]
}

export interface PatchDetail {
  timestamp?: string
  callId?: string
  success?: boolean
  status?: string
  changes: Array<{ path: string, type: string }>
  input?: string
  output?: string
}

export interface CompactionDetail {
  timestamp?: string
  summary?: string
  retainedHistory: Array<{ role: string, text: string }>
}

export interface ToolDistribution {
  shell: number
  web: number
  patch: number
  subagent: number
  other: number
}

interface ToolCallInput {
  name?: string
  arguments?: string
  input?: string
}

export function transcriptDetailsFromJsonl (text: string): TranscriptDetails {
  const details: TranscriptDetails = {
    failures: [],
    shellCommands: [],
    webSearches: [],
    patches: [],
    compactions: [],
    distribution: {
      shell: 0,
      web: 0,
      patch: 0,
      subagent: 0,
      other: 0
    }
  }
  const toolInputs = new Map<string, ToolCallInput>()
  const webCallIds = new Set<string>()

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
    const timestamp = stringValue(item.timestamp)
    if (item.type === 'response_item') {
      parseResponseItem(payload, timestamp, details, toolInputs, webCallIds)
      continue
    }
    if (item.type === 'event_msg') {
      parseEventMessage(payload, timestamp, details, toolInputs, webCallIds)
      continue
    }
    if (item.type === 'compacted') {
      details.compactions.push(compactionFromPayload(payload, timestamp))
    }
  }

  return details
}

export function renderFailureDetails (sessionName: string, details: TranscriptDetails): string {
  const lines = [`# ${sessionName} - 调用失败原因`, '']
  if (!details.failures.length) {
    lines.push('没有记录到调用失败。')
    return lines.join('\n')
  }
  lines.push(`共 ${details.failures.length} 次失败。`, '')
  details.failures.forEach((failure, index) => {
    lines.push(`## 失败 ${index + 1}`)
    addLine(lines, '时间', failure.timestamp)
    addLine(lines, '类型', failure.type)
    addLine(lines, '状态', failure.status)
    if (failure.exitCode !== undefined) {
      lines.push(`- 退出码：${failure.exitCode}`)
    }
    addLine(lines, '命令', failure.command ? `\`${failure.command}\`` : undefined)
    addLine(lines, '目录', failure.cwd ? `\`${failure.cwd}\`` : undefined)
    addLine(lines, '原因', failure.reason)
    if (failure.output) {
      lines.push('', '```text', truncate(failure.output, 4000), '```')
    }
    lines.push('')
  })
  return lines.join('\n')
}

export function renderToolDetails (sessionName: string, details: TranscriptDetails): string {
  const lines = [`# ${sessionName} - 工具调用详情`, '', '## 分布']
  lines.push(`- shell：${details.distribution.shell}`)
  lines.push(`- web：${details.distribution.web}`)
  lines.push(`- patch：${details.distribution.patch}`)
  lines.push(`- subagent：${details.distribution.subagent}`)
  lines.push(`- other：${details.distribution.other}`)
  lines.push('', '## Shell 命令')
  if (!details.shellCommands.length) {
    lines.push('没有 shell 命令。')
  } else {
    details.shellCommands.forEach((command, index) => {
      lines.push(`### Shell ${index + 1}`)
      addLine(lines, '时间', command.timestamp)
      addLine(lines, '命令', `\`${command.command}\``)
      addLine(lines, '目录', command.cwd ? `\`${command.cwd}\`` : undefined)
      addLine(lines, '状态', command.status)
      if (command.exitCode !== undefined) {
        lines.push(`- 退出码：${command.exitCode}`)
      }
      if (command.durationSeconds !== undefined) {
        lines.push(`- 耗时：${formatDuration(command.durationSeconds)}`)
      }
      if (command.output) {
        lines.push('', '```text', truncate(command.output, 1200), '```')
      }
      lines.push('')
    })
  }
  lines.push('', '## Web 搜索')
  if (!details.webSearches.length) {
    lines.push('没有 web 搜索。')
  } else {
    details.webSearches.forEach((search, index) => {
      lines.push(`### Web ${index + 1}`)
      addLine(lines, '时间', search.timestamp)
      for (const query of search.queries) {
        lines.push(`- ${query}`)
      }
      lines.push('')
    })
  }
  lines.push('', '## Patch 修改')
  if (!details.patches.length) {
    lines.push('没有 patch 修改。')
  } else {
    details.patches.forEach((patch, index) => {
      lines.push(`### Patch ${index + 1}`)
      addLine(lines, '时间', patch.timestamp)
      addLine(lines, '状态', patch.status)
      if (patch.success !== undefined) {
        lines.push(`- 成功：${patch.success ? '是' : '否'}`)
      }
      for (const change of patch.changes) {
        lines.push(`- ${change.type}：\`${change.path}\``)
      }
      if (patch.input) {
        lines.push('', '```diff', truncate(patch.input, 2400), '```')
      }
      if (patch.output) {
        lines.push('', '```text', truncate(patch.output, 1200), '```')
      }
      lines.push('')
    })
  }
  return lines.join('\n')
}

export function renderCompactionDetails (sessionName: string, details: TranscriptDetails): string {
  const lines = [`# ${sessionName} - 压缩详情`, '']
  if (!details.compactions.length) {
    lines.push('没有记录到上下文压缩。')
    return lines.join('\n')
  }
  details.compactions.forEach((compaction, index) => {
    lines.push(`## 压缩 ${index + 1}`)
    addLine(lines, '时间', compaction.timestamp)
    lines.push('', '### 压缩后的摘要')
    lines.push(compaction.summary ? truncate(compaction.summary, 6000) : '没有摘要内容。')
    lines.push('', '### 保留的历史')
    if (!compaction.retainedHistory.length) {
      lines.push('没有 replacement_history 记录。')
    } else {
      for (const entry of compaction.retainedHistory) {
        lines.push(`- ${entry.role}：${truncate(entry.text, 600)}`)
      }
    }
    lines.push('')
  })
  return lines.join('\n')
}

function parseResponseItem (
  payload: Record<string, unknown>,
  timestamp: string | undefined,
  details: TranscriptDetails,
  toolInputs: Map<string, ToolCallInput>,
  webCallIds: Set<string>
): void {
  const payloadType = payload.type
  if (payloadType === 'function_call') {
    const name = stringValue(payload.name)
    const callId = stringValue(payload.call_id)
    if (callId) {
      toolInputs.set(callId, { name, arguments: stringValue(payload.arguments) })
    }
    if (name === 'exec_command') {
      details.distribution.shell += 1
    } else if (name === 'spawn_agent') {
      details.distribution.subagent += 1
    } else {
      details.distribution.other += 1
    }
    return
  }
  if (payloadType === 'custom_tool_call') {
    const name = stringValue(payload.name)
    const callId = stringValue(payload.call_id)
    if (callId) {
      toolInputs.set(callId, { name, input: stringValue(payload.input) })
    }
    if (name === 'apply_patch') {
      details.distribution.patch += 1
    } else {
      details.distribution.other += 1
    }
    return
  }
  if (payloadType === 'web_search_call') {
    const callId = stringValue(payload.call_id)
    if (callId) {
      webCallIds.add(callId)
    }
    details.distribution.web += 1
    details.webSearches.push({
      timestamp,
      queries: queriesFromAction(payload.action)
    })
  }
}

function parseEventMessage (
  payload: Record<string, unknown>,
  timestamp: string | undefined,
  details: TranscriptDetails,
  toolInputs: Map<string, ToolCallInput>,
  webCallIds: Set<string>
): void {
  if (payload.type === 'exec_command_end') {
    const callId = stringValue(payload.call_id)
    const input = callId ? toolInputs.get(callId) : undefined
    const command = commandText(payload.command) || commandFromArguments(input?.arguments) || '(unknown command)'
    const output = outputText(payload)
    const exitCode = numberValue(payload.exit_code)
    const status = stringValue(payload.status)
    const detail: ShellCommandDetail = {
      timestamp,
      callId,
      command,
      cwd: stringValue(payload.cwd),
      exitCode,
      status,
      durationSeconds: durationSecondsValue(payload.duration),
      output
    }
    details.shellCommands.push(detail)
    if (status !== 'completed' || exitCode !== 0) {
      details.failures.push({
        timestamp,
        type: 'shell',
        reason: output || status || 'shell 命令失败',
        command,
        cwd: detail.cwd,
        exitCode,
        status,
        output
      })
    }
    return
  }
  if (payload.type === 'web_search_end') {
    const callId = stringValue(payload.call_id)
    if (callId && webCallIds.has(callId)) {
      return
    }
    details.distribution.web += 1
    details.webSearches.push({ timestamp, queries: queriesFromAction(payload.action) })
    return
  }
  if (payload.type === 'patch_apply_end') {
    const callId = stringValue(payload.call_id)
    const input = callId ? toolInputs.get(callId) : undefined
    const output = outputText(payload)
    const patch: PatchDetail = {
      timestamp,
      callId,
      success: booleanValue(payload.success),
      status: stringValue(payload.status),
      changes: changesFromPayload(payload.changes),
      input: input?.input,
      output
    }
    details.patches.push(patch)
    if (patch.success === false || (patch.status !== undefined && patch.status !== 'completed')) {
      details.failures.push({
        timestamp,
        type: 'patch',
        reason: output || patch.status || 'patch 失败',
        status: patch.status,
        output
      })
    }
    return
  }
  if (payload.type === 'error') {
    const reason = stringValue(payload.message) || stringValue(payload.error) || JSON.stringify(payload)
    details.failures.push({ timestamp, type: 'error', reason, output: reason })
    return
  }
  if (payload.type === 'turn_aborted') {
    const reason = stringValue(payload.reason) || 'turn aborted'
    details.failures.push({ timestamp, type: 'turn_aborted', reason })
  }
}

function compactionFromPayload (payload: Record<string, unknown>, timestamp: string | undefined): CompactionDetail {
  return {
    timestamp,
    summary: stringValue(payload.message),
    retainedHistory: retainedHistoryFromPayload(payload.replacement_history)
  }
}

function retainedHistoryFromPayload (value: unknown): Array<{ role: string, text: string }> {
  if (!Array.isArray(value)) {
    return []
  }
  const history: Array<{ role: string, text: string }> = []
  for (const item of value) {
    if (!isRecord(item)) {
      continue
    }
    const role = stringValue(item.role) || stringValue(item.type) || 'unknown'
    const text = extractMessageContentText(item.content) || stringValue(item.text) || stringValue(item.message)
    if (text) {
      history.push({ role, text: normalizeText(text) })
    }
  }
  return history
}

function queriesFromAction (action: unknown): string[] {
  if (!isRecord(action) || !Array.isArray(action.queries)) {
    return []
  }
  return action.queries.filter((query): query is string => typeof query === 'string')
}

function changesFromPayload (changes: unknown): Array<{ path: string, type: string }> {
  if (!isRecord(changes)) {
    return []
  }
  return Object.entries(changes).map(([path, change]) => {
    const type = isRecord(change) ? stringValue(change.type) : undefined
    return { path, type: type || 'change' }
  })
}

function commandText (value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const parts = value.filter((part): part is string => typeof part === 'string')
    if (parts.length >= 3 && parts[0].endsWith('bash') && parts[1] === '-lc') {
      return parts.slice(2).join(' ')
    }
    return parts.join(' ')
  }
  return stringValue(value)
}

function commandFromArguments (text: string | undefined): string | undefined {
  if (!text) {
    return undefined
  }
  try {
    const args = JSON.parse(text)
    if (isRecord(args)) {
      return stringValue(args.cmd)
    }
  } catch {
    return undefined
  }
  return undefined
}

function outputText (payload: Record<string, unknown>): string | undefined {
  return stringValue(payload.stderr) ||
    stringValue(payload.aggregated_output) ||
    stringValue(payload.stdout) ||
    stringValue(payload.formatted_output)
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
    const text = stringValue(item.text)
    if (text) {
      pieces.push(text)
    }
  }
  return pieces.join(' ')
}

function addLine (lines: string[], label: string, value: string | undefined): void {
  if (value) {
    lines.push(`- ${label}：${value}`)
  }
}

function durationSecondsValue (duration: unknown): number | undefined {
  if (!isRecord(duration)) {
    return undefined
  }
  const secs = numberValue(duration.secs) || 0
  const nanos = numberValue(duration.nanos) || 0
  return Math.round(secs + nanos / 1_000_000_000)
}

function formatDuration (seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

function truncate (text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`
}

function normalizeText (text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function stringValue (value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function numberValue (value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function booleanValue (value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
