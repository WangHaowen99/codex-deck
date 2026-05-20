import * as vscode from 'vscode'
import { execFile } from 'child_process'
import * as fs from 'fs/promises'
import * as os from 'os'
import {
  cdxCloseArgs,
  cdxForkArgs,
  cdxHistoryArgs,
  cdxReopenArgs,
  historyPickLabel
} from './cdxCommands'
import { TerminalRegistry } from './terminalRegistry'
import {
  renderCompactionDetails,
  renderFailureDetails,
  renderToolDetails,
  transcriptDetailsFromJsonl,
  type TranscriptDetails
} from './sessionDetails'
import { hydrateTranscriptMetrics } from './sessionMetrics'
import {
  formatElapsed,
  isRunning,
  runningElapsedSeconds,
  sessionDescription,
  sessionStatusIcon,
  sessionTooltipMetricLines,
  sortSessionsForSidebar
} from './sessionView'

interface CdxSession {
  id: string
  name: string
  tmux_session: string
  codex_session_id?: string | null
  bound: boolean
  closed?: boolean
  closed_at?: string | null
  unread?: boolean
  activity_state?: string | null
  activity_started_at?: string | null
  activity_elapsed_seconds?: number | null
  last_viewed_at?: string | null
  conversation_updated_at?: string | null
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
  last_cwd?: string | null
  created_at?: string | null
  updated_at?: string | null
  last_used_at?: string | null
  transcript_path?: string | null
  tmux_status?: string
}

interface CdxListResult {
  ok: boolean
  error?: string
  sessions?: CdxSession[]
}

interface CdxSessionResult {
  ok: boolean
  error?: string
  session?: CdxSession
}

class CdxClient {
  constructor (private readonly output: vscode.OutputChannel) {}

  get executable (): string {
    return vscode.workspace.getConfiguration('codexDeck').get<string>('cdxPath') || 'cdx'
  }

  async list (): Promise<CdxSession[]> {
    const stdout = await this.run(['list', '--json'])
    const data = parseJson<CdxListResult>(stdout)
    if (!data.ok) {
      throw new Error(data.error || 'cdx list failed')
    }
    return hydrateTranscriptMetrics(data.sessions || [], path => fs.readFile(path, 'utf8'))
  }

  async create (name: string, cwd: string): Promise<CdxSession> {
    const stdout = await this.run(['new', '--cwd', cwd, '--no-enter', '--json', name])
    const data = parseJson<CdxSessionResult>(stdout)
    if (!data.ok || !data.session) {
      throw new Error(data.error || 'cdx new failed')
    }
    return data.session
  }

  async rename (oldName: string, newName: string): Promise<CdxSession> {
    const stdout = await this.run(['rename', '--json', oldName, newName])
    const data = parseJson<CdxSessionResult>(stdout)
    if (!data.ok || !data.session) {
      throw new Error(data.error || 'cdx rename failed')
    }
    return data.session
  }

  async delete (name: string): Promise<void> {
    const stdout = await this.run(['delete', '--yes', '--json', name])
    const data = parseJson<CdxSessionResult>(stdout)
    if (!data.ok) {
      throw new Error(data.error || 'cdx delete failed')
    }
  }

  async close (name: string): Promise<CdxSession> {
    const stdout = await this.run(cdxCloseArgs(name))
    const data = parseJson<CdxSessionResult>(stdout)
    if (!data.ok || !data.session) {
      throw new Error(data.error || 'cdx close failed')
    }
    return data.session
  }

  async fork (sourceName: string, newName: string): Promise<CdxSession> {
    const stdout = await this.run(cdxForkArgs(sourceName, newName))
    const data = parseJson<CdxSessionResult>(stdout)
    if (!data.ok || !data.session) {
      throw new Error(data.error || 'cdx fork failed')
    }
    return data.session
  }

  async history (): Promise<CdxSession[]> {
    const stdout = await this.run(cdxHistoryArgs())
    const data = parseJson<CdxListResult>(stdout)
    if (!data.ok) {
      throw new Error(data.error || 'cdx history failed')
    }
    return hydrateTranscriptMetrics(data.sessions || [], path => fs.readFile(path, 'utf8'))
  }

  async reopen (name: string): Promise<CdxSession> {
    const stdout = await this.run(cdxReopenArgs(name))
    const data = parseJson<CdxSessionResult>(stdout)
    if (!data.ok || !data.session) {
      throw new Error(data.error || 'cdx reopen failed')
    }
    return data.session
  }

  async markViewed (name: string): Promise<CdxSession> {
    const stdout = await this.run(['mark-viewed', '--json', name])
    const data = parseJson<CdxSessionResult>(stdout)
    if (!data.ok || !data.session) {
      throw new Error(data.error || 'cdx mark-viewed failed')
    }
    return data.session
  }

  private run (args: string[]): Promise<string> {
    this.output.appendLine(`$ ${this.executable} ${args.map(shellQuote).join(' ')}`)
    return new Promise((resolve, reject) => {
      execFile(
        this.executable,
        args,
        {
          encoding: 'utf8',
          maxBuffer: 1024 * 1024
        },
        (error, stdout, stderr) => {
          if (stdout.trim()) {
            this.output.appendLine(stdout.trim())
          }
          if (stderr.trim()) {
            this.output.appendLine(stderr.trim())
          }
          if (error) {
            reject(new Error(stderr.trim() || stdout.trim() || error.message))
            return
          }
          resolve(stdout)
        }
      )
    })
  }
}

class SessionItem extends vscode.TreeItem {
  constructor (
    readonly session: CdxSession
  ) {
    super(session.name, vscode.TreeItemCollapsibleState.None)
    this.contextValue = 'cdxSession'
    this.description = sessionDescription(session) || undefined
    this.tooltip = tooltipFor(session)
    this.iconPath = sessionIcon(session)
    this.command = {
      command: 'codexDeck.openSession',
      title: 'Open Session',
      arguments: [this]
    }
  }
}

class SessionsProvider implements vscode.TreeDataProvider<SessionItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<SessionItem | undefined | null | void>()
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event
  private sessions: CdxSession[] = []

  constructor (readonly client: CdxClient) {}

  getTreeItem (element: SessionItem): vscode.TreeItem {
    return element
  }

  getChildren (): SessionItem[] {
    return this.sessions.map(session => new SessionItem(session))
  }

  async refresh (): Promise<void> {
    this.sessions = sortSessionsForSidebar(await this.client.list())
    this.onDidChangeTreeDataEmitter.fire()
  }

  async pickSession (placeholder: string): Promise<CdxSession | undefined> {
    if (!this.sessions.length) {
      await this.refresh()
    }
    const picked = await vscode.window.showQuickPick(
      this.sessions.map(session => ({
        label: `${sessionIconLabel(session)} ${session.name}`.trim(),
        description: sessionDescription(session) || undefined,
        detail: session.last_cwd || undefined,
        session
      })),
      { placeHolder: placeholder }
    )
    return picked?.session
  }

  async pickHistorySession (placeholder: string): Promise<CdxSession | undefined> {
    const history = await this.client.history()
    if (!history.length) {
      vscode.window.showInformationMessage('没有已关闭的 Codex Deck 历史会话。')
      return undefined
    }
    const picked = await vscode.window.showQuickPick(
      history.map(session => ({
        label: historyPickLabel(session),
        description: sessionDescription(session) || undefined,
        detail: session.last_cwd || undefined,
        session
      })),
      { placeHolder: placeholder }
    )
    return picked?.session
  }
}

export function activate (context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Codex Deck')
  const client = new CdxClient(output)
  const provider = new SessionsProvider(client)
  const terminals = new TerminalRegistry<vscode.Terminal>()

  context.subscriptions.push(
    output,
    vscode.window.registerTreeDataProvider('codexDeck.sessions', provider),
    vscode.commands.registerCommand('codexDeck.refresh', async () => runAction('Refresh Codex Deck', () => provider.refresh())),
    vscode.window.onDidCloseTerminal(terminal => terminals.deleteTerminal(terminal)),
    vscode.commands.registerCommand('codexDeck.newSession', async () => newSession(provider, terminals)),
    vscode.commands.registerCommand('codexDeck.openSession', async item => openSession(provider, terminals, item)),
    vscode.commands.registerCommand('codexDeck.forkSession', async item => forkSession(provider, terminals, item)),
    vscode.commands.registerCommand('codexDeck.renameSession', async item => renameSession(provider, item)),
    vscode.commands.registerCommand('codexDeck.closeSession', async item => closeSession(provider, terminals, item)),
    vscode.commands.registerCommand('codexDeck.openHistorySession', async () => openHistorySession(provider, terminals)),
    vscode.commands.registerCommand('codexDeck.deleteSession', async item => deleteSession(provider, item)),
    vscode.commands.registerCommand('codexDeck.copyUuid', async item => copyUuid(provider, item)),
    vscode.commands.registerCommand('codexDeck.showFailureDetails', async item => showFailureDetails(provider, item)),
    vscode.commands.registerCommand('codexDeck.showToolDetails', async item => showToolDetails(provider, item)),
    vscode.commands.registerCommand('codexDeck.showCompactionDetails', async item => showCompactionDetails(provider, item))
  )

  const refreshTimer = setInterval(() => {
    void provider.refresh().catch(error => output.appendLine(error instanceof Error ? error.message : String(error)))
  }, 5000)
  context.subscriptions.push({ dispose: () => clearInterval(refreshTimer) })

  void provider.refresh().catch(error => showError(error))
}

export function deactivate (): void {}

async function newSession (provider: SessionsProvider, terminals: TerminalRegistry<vscode.Terminal>): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: 'cdx_name',
    ignoreFocusOut: true,
    validateInput: value => value.trim() ? undefined : 'cdx_name is required'
  })
  if (!name) {
    return
  }

  const cwd = await vscode.window.showInputBox({
    prompt: 'Working directory on the remote/workspace host',
    value: defaultCwd(),
    ignoreFocusOut: true,
    validateInput: value => value.trim() ? undefined : 'Working directory is required'
  })
  if (!cwd) {
    return
  }

  const session = await runAction('Create Codex Deck session', async () => {
    const created = await provider.client.create(name.trim(), cwd.trim())
    await provider.refresh()
    return created
  })
  if (session) {
    openTerminalFor(session, provider.client.executable, terminals, { newIfUnbound: true })
  }
}

async function openSession (provider: SessionsProvider, terminals: TerminalRegistry<vscode.Terminal>, item: unknown): Promise<void> {
  const session = await sessionFrom(provider, item, 'Open which Codex Deck session?')
  if (!session) {
    return
  }
  openTerminalFor(session, provider.client.executable, terminals)
  void markSessionViewed(provider, session).catch(error => showError(error))
}

async function renameSession (provider: SessionsProvider, item: unknown): Promise<void> {
  const session = await sessionFrom(provider, item, 'Rename which Codex Deck session?')
  if (!session) {
    return
  }
  const newName = await vscode.window.showInputBox({
    prompt: 'New cdx_name',
    value: session.name,
    ignoreFocusOut: true,
    validateInput: value => value.trim() ? undefined : 'cdx_name is required'
  })
  if (!newName || newName.trim() === session.name) {
    return
  }
  await runAction('Rename Codex Deck session', async () => {
    await provider.client.rename(session.name, newName.trim())
    await provider.refresh()
  })
}

async function forkSession (provider: SessionsProvider, terminals: TerminalRegistry<vscode.Terminal>, item: unknown): Promise<void> {
  const session = await sessionFrom(provider, item, 'Fork which Codex Deck session?')
  if (!session) {
    return
  }
  if (!session.codex_session_id) {
    vscode.window.showInformationMessage(`"${session.name}" is not bound to a Codex session yet.`)
    return
  }
  const newName = await vscode.window.showInputBox({
    prompt: 'New fork cdx_name',
    value: `${session.name} fork`,
    ignoreFocusOut: true,
    validateInput: value => value.trim() ? undefined : 'cdx_name is required'
  })
  if (!newName) {
    return
  }
  const forked = await runAction('Fork Codex Deck session', async () => {
    const created = await provider.client.fork(session.name, newName.trim())
    await provider.refresh()
    return created
  })
  if (forked) {
    openTerminalFor(forked, provider.client.executable, terminals, { newIfUnbound: true })
  }
}

async function deleteSession (provider: SessionsProvider, item: unknown): Promise<void> {
  const session = await sessionFrom(provider, item, 'Delete which Codex Deck session?')
  if (!session) {
    return
  }
  const confirmed = await vscode.window.showWarningMessage(
    `Delete Codex Deck session "${session.name}"? This removes the cdx mapping and kills the tmux session if it is running. Codex history is preserved.`,
    { modal: true },
    'Delete'
  )
  if (confirmed !== 'Delete') {
    return
  }
  await runAction('Delete Codex Deck session', async () => {
    await provider.client.delete(session.name)
    await provider.refresh()
  })
}

async function closeSession (provider: SessionsProvider, terminals: TerminalRegistry<vscode.Terminal>, item: unknown): Promise<void> {
  const session = await sessionFrom(provider, item, 'Close which Codex Deck session?')
  if (!session) {
    return
  }
  const confirmed = await vscode.window.showWarningMessage(
    `Close Codex Deck session "${session.name}"? This hides it from the sidebar, keeps it in history, and closes the tmux session if it is running.`,
    { modal: true },
    'Close'
  )
  if (confirmed !== 'Close') {
    return
  }
  await runAction('Close Codex Deck session', async () => {
    await provider.client.close(session.name)
    terminals.deleteKey(sessionTerminalKey(session))
    await provider.refresh()
  })
}

async function openHistorySession (provider: SessionsProvider, terminals: TerminalRegistry<vscode.Terminal>): Promise<void> {
  const session = await provider.pickHistorySession('Open which closed Codex Deck session?')
  if (!session) {
    return
  }
  const reopened = await runAction('Open Codex Deck history session', async () => {
    const restored = await provider.client.reopen(session.name)
    await provider.refresh()
    return restored
  })
  if (reopened) {
    openTerminalFor(reopened, provider.client.executable, terminals)
  }
}

async function copyUuid (provider: SessionsProvider, item: unknown): Promise<void> {
  const session = await sessionFrom(provider, item, 'Copy UUID for which Codex Deck session?')
  if (!session) {
    return
  }
  if (!session.codex_session_id) {
    vscode.window.showInformationMessage(`"${session.name}" is not bound to a Codex session yet.`)
    return
  }
  await vscode.env.clipboard.writeText(session.codex_session_id)
  vscode.window.showInformationMessage(`Copied UUID for "${session.name}".`)
}

async function showFailureDetails (provider: SessionsProvider, item: unknown): Promise<void> {
  await showTranscriptDetails(
    provider,
    item,
    '查看调用失败原因',
    (session, details) => renderFailureDetails(session.name, details)
  )
}

async function showToolDetails (provider: SessionsProvider, item: unknown): Promise<void> {
  await showTranscriptDetails(
    provider,
    item,
    '查看工具调用详情',
    (session, details) => renderToolDetails(session.name, details)
  )
}

async function showCompactionDetails (provider: SessionsProvider, item: unknown): Promise<void> {
  await showTranscriptDetails(
    provider,
    item,
    '查看压缩详情',
    (session, details) => renderCompactionDetails(session.name, details)
  )
}

async function showTranscriptDetails (
  provider: SessionsProvider,
  item: unknown,
  title: string,
  render: (session: CdxSession, details: TranscriptDetails) => string
): Promise<void> {
  const session = await sessionFrom(provider, item, `${title}：选择 cdx 会话`)
  if (!session) {
    return
  }
  await runAction(title, async () => {
    if (!session.transcript_path) {
      vscode.window.showInformationMessage(`"${session.name}" 还没有可读取的 Codex transcript。`)
      return
    }
    const transcript = await fs.readFile(session.transcript_path, 'utf8')
    const details = transcriptDetailsFromJsonl(transcript)
    const document = await vscode.workspace.openTextDocument({
      content: render(session, details),
      language: 'markdown'
    })
    await vscode.window.showTextDocument(document, { preview: false })
  })
}

async function markSessionViewed (provider: SessionsProvider, session: CdxSession): Promise<void> {
  await provider.client.markViewed(session.name)
  await provider.refresh()
}

async function sessionFrom (provider: SessionsProvider, item: unknown, placeholder: string): Promise<CdxSession | undefined> {
  if (item instanceof SessionItem) {
    return item.session
  }
  if (isSession(item)) {
    return item
  }
  return provider.pickSession(placeholder)
}

function openTerminalFor (
  session: CdxSession,
  cdxPath: string,
  terminals: TerminalRegistry<vscode.Terminal>,
  options: { newIfUnbound?: boolean } = {}
): void {
  const terminalKey = sessionTerminalKey(session)
  const existing = terminals.get(terminalKey)
  if (existing) {
    existing.show()
    return
  }
  const terminal = vscode.window.createTerminal({
    name: session.name,
    cwd: session.last_cwd || undefined
  })
  terminals.set(terminalKey, terminal)
  terminal.show()
  const args = ['enter']
  if (options.newIfUnbound) {
    args.push('--new-if-unbound')
  }
  args.push(session.name)
  terminal.sendText([cdxPath, ...args].map(shellQuote).join(' '))
}

function sessionTerminalKey (session: CdxSession): string {
  return session.id || session.tmux_session || session.name
}

async function runAction<T> (title: string, action: () => Promise<T>): Promise<T | undefined> {
  try {
    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false
      },
      action
    )
  } catch (error) {
    showError(error)
    return undefined
  }
}

function showError (error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  vscode.window.showErrorMessage(message)
}

function parseJson<T> (text: string): T {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('cdx returned empty output')
  }
  const start = trimmed.indexOf('{')
  if (start < 0) {
    throw new Error(`cdx did not return JSON: ${trimmed}`)
  }
  return JSON.parse(trimmed.slice(start)) as T
}

function defaultCwd (): string {
  const configured = vscode.workspace.getConfiguration('codexDeck').get<string>('defaultCwd')?.trim()
  if (configured) {
    return configured
  }
  const folder = vscode.workspace.workspaceFolders?.[0]
  return folder?.uri.fsPath || os.homedir()
}

function tooltipFor (session: CdxSession): string {
  const lines = [
    session.name,
    `状态：${viewState(session)}`
  ]
  if (isRunning(session)) {
    lines.push(`运行时长：${formatElapsed(runningElapsedSeconds(session))}`)
  }
  lines.push(...sessionTooltipMetricLines(session))
  if (session.last_cwd) {
    lines.push(`目录：${session.last_cwd}`)
  }
  if (session.codex_session_id) {
    lines.push(`UUID：${session.codex_session_id}`)
  }
  if (session.last_viewed_at) {
    lines.push(`上次查看：${session.last_viewed_at}`)
  }
  if (session.conversation_updated_at) {
    lines.push(`对话更新：${session.conversation_updated_at}`)
  }
  lines.push('更多详情：右键会话查看失败原因、工具调用详情或压缩详情。')
  return lines.join('\n')
}

function sessionIcon (session: CdxSession): vscode.ThemeIcon {
  const statusIcon = sessionStatusIcon(session)
  if (statusIcon) {
    return new vscode.ThemeIcon(statusIcon.codicon, new vscode.ThemeColor(statusIcon.color))
  }
  return new vscode.ThemeIcon(session.tmux_status === 'live' ? 'debug-console' : 'terminal')
}

function sessionIconLabel (session: CdxSession): string {
  return sessionStatusIcon(session)?.label || ''
}

function viewState (session: CdxSession): string {
  if (session.activity_state) {
    if (session.activity_state === 'running') {
      return '运行中'
    }
    if (session.activity_state === 'unread') {
      return '未读'
    }
    if (session.activity_state === 'read') {
      return '已读'
    }
    return session.activity_state
  }
  return session.unread ? '未读' : '已读'
}

function isSession (value: unknown): value is CdxSession {
  return Boolean(value && typeof value === 'object' && 'name' in value && 'id' in value)
}

function shellQuote (value: string): string {
  if (process.platform === 'win32') {
    return `"${value.replace(/"/g, '\\"')}"`
  }
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
    return value
  }
  return `'${value.replace(/'/g, "'\\''")}'`
}
