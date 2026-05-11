export interface SessionViewState {
  activity_state?: string | null
  activity_started_at?: string | null
  activity_elapsed_seconds?: number | null
  unread?: boolean
  bound?: boolean
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
  if (isRunning(session)) {
    return formatElapsed(runningElapsedSeconds(session, nowMs))
  }
  return ''
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

function timestamp (value: string | null | undefined): number {
  if (!value) {
    return 0
  }
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}
