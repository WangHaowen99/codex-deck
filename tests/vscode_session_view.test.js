const assert = require('node:assert/strict')
const test = require('node:test')

const {
  sessionDescription,
  sessionStatusIcon,
  sortSessionsForSidebar
} = require('../vscode-extension/out/sessionView')

test('running session uses a static orange dot icon', () => {
  assert.deepEqual(sessionStatusIcon({ activity_state: 'running' }), {
    codicon: 'circle-filled',
    color: 'charts.orange',
    label: '$(circle-filled)'
  })
})

test('running session elapsed time advances from activity start time', () => {
  const session = {
    activity_state: 'running',
    activity_started_at: '2026-05-11T02:00:00Z',
    activity_elapsed_seconds: 0
  }

  assert.equal(sessionDescription(session, Date.parse('2026-05-11T02:01:05Z')), '1:05')
})

test('sidebar order is stable by creation time, not last access time', () => {
  const sessions = [
    {
      id: 'old',
      name: 'old session',
      created_at: '2026-05-10T00:00:00Z',
      last_used_at: '2026-05-11T12:00:00Z'
    },
    {
      id: 'new',
      name: 'new session',
      created_at: '2026-05-11T00:00:00Z',
      last_used_at: '2026-05-11T01:00:00Z'
    }
  ]

  assert.deepEqual(sortSessionsForSidebar(sessions).map(session => session.id), ['new', 'old'])
})
