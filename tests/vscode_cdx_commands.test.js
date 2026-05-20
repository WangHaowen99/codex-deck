const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  cdxCloseArgs,
  cdxForkArgs,
  cdxHistoryArgs,
  cdxReopenArgs,
  historyPickLabel
} = require('../vscode-extension/out/cdxCommands')

test('builds cdx lifecycle command arguments', () => {
  assert.deepEqual(cdxCloseArgs('demo session'), ['close', '--yes', '--json', 'demo session'])
  assert.deepEqual(cdxForkArgs('source session', 'forked session'), ['fork', '--no-enter', '--json', 'source session', 'forked session'])
  assert.deepEqual(cdxHistoryArgs(), ['history', '--json'])
  assert.deepEqual(cdxReopenArgs('demo session'), ['reopen', '--json', 'demo session'])
})

test('history pick label includes closed timestamp when present', () => {
  assert.equal(
    historyPickLabel({ name: 'archived', closed_at: '2026-05-20T01:02:03Z' }),
    'archived · closed 2026-05-20T01:02:03Z'
  )
  assert.equal(historyPickLabel({ name: 'legacy' }), 'legacy')
})

test('package contributes close and open-history context commands', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../vscode-extension/package.json'), 'utf8'))
  const commands = new Set(manifest.contributes.commands.map(command => command.command))
  const contextItems = manifest.contributes.menus['view/item/context']

  assert.ok(commands.has('codexDeck.closeSession'))
  assert.ok(commands.has('codexDeck.forkSession'))
  assert.ok(commands.has('codexDeck.openHistorySession'))
  assert.ok(contextItems.some(item =>
    item.command === 'codexDeck.forkSession' &&
    item.when === 'view == codexDeck.sessions && viewItem == cdxSession'
  ))
  assert.ok(contextItems.some(item =>
    item.command === 'codexDeck.closeSession' &&
    item.when === 'view == codexDeck.sessions && viewItem == cdxSession'
  ))
  assert.ok(contextItems.some(item =>
    item.command === 'codexDeck.openHistorySession' &&
    item.when === 'view == codexDeck.sessions && !viewItem'
  ))
})
