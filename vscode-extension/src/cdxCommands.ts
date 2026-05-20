export interface HistoryPickSession {
  name: string
  closed_at?: string | null
}

export function cdxCloseArgs (name: string): string[] {
  return ['close', '--yes', '--json', name]
}

export function cdxForkArgs (sourceName: string, newName: string): string[] {
  return ['fork', '--no-enter', '--json', sourceName, newName]
}

export function cdxHistoryArgs (): string[] {
  return ['history', '--json']
}

export function cdxReopenArgs (name: string): string[] {
  return ['reopen', '--json', name]
}

export function historyPickLabel (session: HistoryPickSession): string {
  return session.closed_at ? `${session.name} · closed ${session.closed_at}` : session.name
}
