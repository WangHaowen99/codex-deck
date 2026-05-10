import * as vscode from 'vscode'
import { execFile } from 'child_process'
import * as os from 'os'
import { TerminalRegistry } from './terminalRegistry'
import {
  RUNNING_ICON_FRAME_COUNT,
  formatElapsed,
  isRunning,
  runningElapsedSeconds,
  runningIconFrameFile,
  sessionDescription
} from './sessionView'

interface CdxSession {
  id: string
  name: string
  tmux_session: string
  codex_session_id?: string | null
  bound: boolean
  unread?: boolean
  activity_state?: string | null
  activity_started_at?: string | null
  activity_elapsed_seconds?: number | null
  last_viewed_at?: string | null
  conversation_updated_at?: string | null
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
    return data.sessions || []
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
    readonly session: CdxSession,
    extensionUri: vscode.Uri,
    animationFrame: number
  ) {
    super(session.name, vscode.TreeItemCollapsibleState.None)
    this.contextValue = 'cdxSession'
    this.description = sessionDescription(session) || undefined
    this.tooltip = tooltipFor(session)
    this.iconPath = sessionIcon(session, extensionUri, animationFrame)
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
  private animationFrame = 0

  constructor (
    readonly client: CdxClient,
    private readonly extensionUri: vscode.Uri
  ) {}

  getTreeItem (element: SessionItem): vscode.TreeItem {
    return element
  }

  getChildren (): SessionItem[] {
    return this.sessions.map(session => new SessionItem(session, this.extensionUri, this.animationFrame))
  }

  async refresh (): Promise<void> {
    this.sessions = await this.client.list()
    this.onDidChangeTreeDataEmitter.fire()
  }

  tickAnimation (): void {
    if (!this.sessions.some(isRunning)) {
      return
    }
    this.animationFrame = (this.animationFrame + 1) % RUNNING_ICON_FRAME_COUNT
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
}

export function activate (context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Codex Deck')
  const client = new CdxClient(output)
  const provider = new SessionsProvider(client, context.extensionUri)
  const terminals = new TerminalRegistry<vscode.Terminal>()

  context.subscriptions.push(
    output,
    vscode.window.registerTreeDataProvider('codexDeck.sessions', provider),
    vscode.commands.registerCommand('codexDeck.refresh', async () => runAction('Refresh Codex Deck', () => provider.refresh())),
    vscode.window.onDidCloseTerminal(terminal => terminals.deleteTerminal(terminal)),
    vscode.commands.registerCommand('codexDeck.newSession', async () => newSession(provider, terminals)),
    vscode.commands.registerCommand('codexDeck.openSession', async item => openSession(provider, terminals, item)),
    vscode.commands.registerCommand('codexDeck.renameSession', async item => renameSession(provider, item)),
    vscode.commands.registerCommand('codexDeck.deleteSession', async item => deleteSession(provider, item)),
    vscode.commands.registerCommand('codexDeck.copyUuid', async item => copyUuid(provider, item))
  )

  const refreshTimer = setInterval(() => {
    void provider.refresh().catch(error => output.appendLine(error instanceof Error ? error.message : String(error)))
  }, 5000)
  context.subscriptions.push({ dispose: () => clearInterval(refreshTimer) })

  const animationTimer = setInterval(() => {
    provider.tickAnimation()
  }, 250)
  context.subscriptions.push({ dispose: () => clearInterval(animationTimer) })

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
    `status: ${viewState(session)}`
  ]
  if (isRunning(session)) {
    lines.push(`elapsed: ${formatElapsed(runningElapsedSeconds(session))}`)
  }
  if (session.last_cwd) {
    lines.push(`cwd: ${session.last_cwd}`)
  }
  if (session.codex_session_id) {
    lines.push(`uuid: ${session.codex_session_id}`)
  }
  if (session.last_viewed_at) {
    lines.push(`last viewed: ${session.last_viewed_at}`)
  }
  if (session.conversation_updated_at) {
    lines.push(`conversation updated: ${session.conversation_updated_at}`)
  }
  return lines.join('\n')
}

function sessionIcon (session: CdxSession, extensionUri: vscode.Uri, animationFrame: number): vscode.ThemeIcon | vscode.Uri {
  if (isRunning(session)) {
    return vscode.Uri.joinPath(extensionUri, 'media', runningIconFrameFile(animationFrame))
  }
  if (session.activity_state === 'unread' || session.unread) {
    return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconFailed'))
  }
  if (session.activity_state === 'read' || session.bound) {
    return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed'))
  }
  return new vscode.ThemeIcon(session.tmux_status === 'live' ? 'debug-console' : 'terminal')
}

function sessionIconLabel (session: CdxSession): string {
  if (isRunning(session)) {
    return '$(loading~spin)'
  }
  if (session.activity_state === 'unread' || session.unread) {
    return '$(circle-filled)'
  }
  if (session.activity_state === 'read' || session.bound) {
    return '$(pass-filled)'
  }
  return ''
}

function viewState (session: CdxSession): string {
  if (session.activity_state) {
    return session.activity_state
  }
  return session.unread ? 'unread' : 'viewed'
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
