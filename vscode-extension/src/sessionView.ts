export interface SessionViewState {
  activity_state?: string | null
  activity_started_at?: string | null
  activity_elapsed_seconds?: number | null
}

export const RUNNING_ICON_FRAME_FILES = [
  'spinner-0.svg',
  'spinner-1.svg',
  'spinner-2.svg',
  'spinner-3.svg',
  'spinner-4.svg',
  'spinner-5.svg',
  'spinner-6.svg',
  'spinner-7.svg'
]

export const RUNNING_ICON_FRAME_COUNT = RUNNING_ICON_FRAME_FILES.length

export function isRunning (session: SessionViewState): boolean {
  return session.activity_state === 'running'
}

export function runningIconFrameFile (frame: number): string {
  const index = positiveModulo(Math.floor(frame), RUNNING_ICON_FRAME_COUNT)
  return RUNNING_ICON_FRAME_FILES[index]
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

function positiveModulo (value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}
