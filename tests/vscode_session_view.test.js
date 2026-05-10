const assert = require('node:assert/strict')
const test = require('node:test')

const {
  runningIconFrameFile,
  sessionDescription
} = require('../vscode-extension/out/sessionView')

test('uses different icon files for adjacent running animation frames', () => {
  assert.notEqual(runningIconFrameFile(0), runningIconFrameFile(1))
})

test('running session elapsed time advances from activity start time', () => {
  const session = {
    activity_state: 'running',
    activity_started_at: '2026-05-11T02:00:00Z',
    activity_elapsed_seconds: 0
  }

  assert.equal(sessionDescription(session, Date.parse('2026-05-11T02:01:05Z')), '1:05')
})
