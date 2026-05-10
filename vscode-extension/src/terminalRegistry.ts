export interface ReusableTerminal {
  readonly exitStatus?: unknown
}

export class TerminalRegistry<Terminal extends ReusableTerminal> {
  private readonly terminals = new Map<string, Terminal>()

  get (key: string): Terminal | undefined {
    const terminal = this.terminals.get(key)
    if (!terminal) {
      return undefined
    }
    if (terminal.exitStatus !== undefined) {
      this.terminals.delete(key)
      return undefined
    }
    return terminal
  }

  set (key: string, terminal: Terminal): void {
    this.terminals.set(key, terminal)
  }

  deleteTerminal (terminal: Terminal): void {
    for (const [key, cached] of this.terminals.entries()) {
      if (cached === terminal) {
        this.terminals.delete(key)
      }
    }
  }
}
