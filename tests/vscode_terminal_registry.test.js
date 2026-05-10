const assert = require('node:assert/strict')
const test = require('node:test')

const { TerminalRegistry } = require('../vscode-extension/out/terminalRegistry')

test('reuses an existing active terminal for the same key', () => {
  const registry = new TerminalRegistry()
  const terminal = { showCount: 0, show () { this.showCount += 1 } }

  registry.set('session-1', terminal)

  assert.equal(registry.get('session-1'), terminal)
  assert.equal(registry.get('session-1'), terminal)
})

test('does not reuse a terminal that has exited', () => {
  const registry = new TerminalRegistry()
  const terminal = { exitStatus: { code: 0 }, show () {} }

  registry.set('session-1', terminal)

  assert.equal(registry.get('session-1'), undefined)
  assert.equal(registry.get('session-1'), undefined)
})

test('removes a terminal when VS Code reports it closed', () => {
  const registry = new TerminalRegistry()
  const first = { show () {} }
  const second = { show () {} }

  registry.set('session-1', first)
  registry.set('session-2', second)
  registry.deleteTerminal(first)

  assert.equal(registry.get('session-1'), undefined)
  assert.equal(registry.get('session-2'), second)
})
