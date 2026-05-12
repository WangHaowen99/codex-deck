const assert = require('node:assert/strict')
const test = require('node:test')

const {
  renderCompactionDetails,
  renderFailureDetails,
  renderToolDetails,
  transcriptDetailsFromJsonl
} = require('../vscode-extension/out/sessionDetails')

function jsonl (events) {
  return events.map(event => JSON.stringify(event)).join('\n') + '\n'
}

function sampleTranscript () {
  return jsonl([
    {
      timestamp: '2026-05-12T01:00:00.000Z',
      type: 'response_item',
      payload: {
        type: 'function_call',
        name: 'exec_command',
        call_id: 'call_shell_ok',
        arguments: '{"cmd":"rg -n TODO src","workdir":"/repo"}'
      }
    },
    {
      timestamp: '2026-05-12T01:00:01.000Z',
      type: 'event_msg',
      payload: {
        type: 'exec_command_end',
        call_id: 'call_shell_ok',
        command: ['/bin/bash', '-lc', 'rg -n TODO src'],
        cwd: '/repo',
        exit_code: 0,
        status: 'completed',
        duration: { secs: 1, nanos: 500000000 },
        aggregated_output: 'src/a.ts:1:TODO'
      }
    },
    {
      timestamp: '2026-05-12T01:00:02.000Z',
      type: 'response_item',
      payload: {
        type: 'function_call',
        name: 'exec_command',
        call_id: 'call_shell_fail',
        arguments: '{"cmd":"npm test","workdir":"/repo"}'
      }
    },
    {
      timestamp: '2026-05-12T01:00:03.000Z',
      type: 'event_msg',
      payload: {
        type: 'exec_command_end',
        call_id: 'call_shell_fail',
        command: ['/bin/bash', '-lc', 'npm test'],
        cwd: '/repo',
        exit_code: 1,
        status: 'failed',
        duration: { secs: 2, nanos: 0 },
        stderr: 'AssertionError: expected true',
        aggregated_output: 'not ok 1'
      }
    },
    {
      timestamp: '2026-05-12T01:00:04.000Z',
      type: 'response_item',
      payload: {
        type: 'web_search_call',
        status: 'completed',
        action: { type: 'search', queries: ['Codex hooks config', 'VS Code TreeItem tooltip duration'] }
      }
    },
    {
      timestamp: '2026-05-12T01:00:05.000Z',
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        name: 'apply_patch',
        call_id: 'call_patch',
        input: '*** Begin Patch\n*** Update File: src/a.ts\n-old\n+new\n*** End Patch'
      }
    },
    {
      timestamp: '2026-05-12T01:00:06.000Z',
      type: 'event_msg',
      payload: {
        type: 'patch_apply_end',
        call_id: 'call_patch',
        success: true,
        status: 'completed',
        changes: {
          '/repo/src/a.ts': { type: 'update' },
          '/repo/src/b.ts': { type: 'add' }
        },
        stdout: 'Success'
      }
    },
    {
      timestamp: '2026-05-12T01:00:07.000Z',
      type: 'event_msg',
      payload: {
        type: 'error',
        message: 'Selected model is at capacity.'
      }
    },
    {
      timestamp: '2026-05-12T01:00:08.000Z',
      type: 'compacted',
      payload: {
        message: '保留摘要：已经完成测试和打包。',
        replacement_history: [
          { type: 'message', role: 'user', content: [{ type: 'input_text', text: '请继续实现功能' }] },
          { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '已完成核心实现' }] }
        ]
      }
    },
    {
      timestamp: '2026-05-12T01:00:08.100Z',
      type: 'event_msg',
      payload: { type: 'context_compacted' }
    }
  ])
}

test('renders all failure reasons in Chinese markdown', () => {
  const details = transcriptDetailsFromJsonl(sampleTranscript())
  const markdown = renderFailureDetails('demo', details)

  assert.match(markdown, /^# demo - 调用失败原因/m)
  assert.match(markdown, /## 失败 1/)
  assert.match(markdown, /类型：shell/)
  assert.match(markdown, /命令：`npm test`/)
  assert.match(markdown, /退出码：1/)
  assert.match(markdown, /AssertionError: expected true/)
  assert.match(markdown, /## 失败 2/)
  assert.match(markdown, /类型：error/)
  assert.match(markdown, /Selected model is at capacity/)
})

test('renders tool call details with distribution, shell, web, and patch summaries', () => {
  const details = transcriptDetailsFromJsonl(sampleTranscript())
  const markdown = renderToolDetails('demo', details)

  assert.match(markdown, /^# demo - 工具调用详情/m)
  assert.match(markdown, /## 分布/)
  assert.match(markdown, /shell：2/)
  assert.match(markdown, /web：1/)
  assert.match(markdown, /patch：1/)
  assert.match(markdown, /## Shell 命令/)
  assert.match(markdown, /`rg -n TODO src`/)
  assert.match(markdown, /`npm test`/)
  assert.match(markdown, /## Web 搜索/)
  assert.match(markdown, /Codex hooks config/)
  assert.match(markdown, /VS Code TreeItem tooltip duration/)
  assert.match(markdown, /## Patch 修改/)
  assert.match(markdown, /update：`\/repo\/src\/a.ts`/)
  assert.match(markdown, /add：`\/repo\/src\/b.ts`/)
})

test('renders compaction details with summary and retained history', () => {
  const details = transcriptDetailsFromJsonl(sampleTranscript())
  const markdown = renderCompactionDetails('demo', details)

  assert.match(markdown, /^# demo - 压缩详情/m)
  assert.match(markdown, /## 压缩 1/)
  assert.match(markdown, /保留摘要：已经完成测试和打包/)
  assert.match(markdown, /### 保留的历史/)
  assert.match(markdown, /user：请继续实现功能/)
  assert.match(markdown, /assistant：已完成核心实现/)
})
