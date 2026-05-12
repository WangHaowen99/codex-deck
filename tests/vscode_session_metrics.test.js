const assert = require('node:assert/strict')
const test = require('node:test')

const {
  hydrateTranscriptMetrics,
  transcriptMetricsFromJsonl
} = require('../vscode-extension/out/sessionMetrics')

function jsonl (events) {
  return events.map(event => JSON.stringify(event)).join('\n') + '\n'
}

test('parses transcript metrics from latest token count', () => {
  const transcript = jsonl([
    {
      timestamp: '2026-05-11T08:00:00.000Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: '<environment_context>\n  <cwd>/repo</cwd>\n</environment_context>' }]
      }
    },
    {
      timestamp: '2026-05-11T08:01:00.000Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: '帮我显示指标' }]
      }
    },
    {
      timestamp: '2026-05-11T08:01:00.001Z',
      type: 'event_msg',
      payload: {
        type: 'user_message',
        message: '帮我显示指标'
      }
    },
    {
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: {
          total_token_usage: { total_tokens: 1000 },
          last_token_usage: { total_tokens: 100 },
          model_context_window: 1000
        }
      }
    },
    {
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: {
          total_token_usage: { input_tokens: 1000, cached_input_tokens: 750, output_tokens: 200, total_tokens: 1234567 },
          last_token_usage: { input_tokens: 129000, output_tokens: 200 },
          model_context_window: 258400
        }
      }
    }
  ])

  assert.deepEqual(transcriptMetricsFromJsonl(transcript), {
    total_tokens: 1234567,
    turn_count: 1,
    context_tokens: 129200,
    context_window: 258400,
    context_percent: 50,
    compaction_count: 0,
    tool_call_count: 0,
    cache_hit_percent: 75,
    failure_count: 0,
    shell_command_count: 0,
    web_search_count: 0,
    patch_apply_count: 0,
    subagent_count: 0,
    edited_file_count: 0,
    command_success_percent: null,
    command_duration_seconds: 0,
    last_turn_duration_seconds: null,
    time_to_first_token_ms: null
  })
})

test('parses agent action metrics from transcript events', () => {
  const transcript = jsonl([
    { timestamp: '2026-05-11T08:00:00.000Z', type: 'compacted', payload: { message: 'summary' } },
    { timestamp: '2026-05-11T08:00:00.002Z', type: 'event_msg', payload: { type: 'context_compacted' } },
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', call_id: 'call_ok' } },
    {
      type: 'event_msg',
      payload: {
        type: 'exec_command_end',
        call_id: 'call_ok',
        exit_code: 0,
        status: 'completed',
        duration: { secs: 2, nanos: 500000000 }
      }
    },
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', call_id: 'call_fail' } },
    {
      type: 'event_msg',
      payload: {
        type: 'exec_command_end',
        call_id: 'call_fail',
        exit_code: 1,
        status: 'failed',
        duration: { secs: 3, nanos: 200000000 }
      }
    },
    { type: 'response_item', payload: { type: 'function_call', name: 'spawn_agent', call_id: 'call_agent' } },
    { type: 'response_item', payload: { type: 'custom_tool_call', name: 'apply_patch', call_id: 'call_patch' } },
    {
      type: 'event_msg',
      payload: {
        type: 'patch_apply_end',
        call_id: 'call_patch',
        success: true,
        status: 'completed',
        changes: {
          '/repo/a.py': { type: 'update' },
          '/repo/b.py': { type: 'add' }
        }
      }
    },
    { type: 'response_item', payload: { type: 'web_search_call', status: 'completed' } },
    { type: 'event_msg', payload: { type: 'error', message: 'rate limited' } },
    { type: 'event_msg', payload: { type: 'turn_aborted', reason: 'interrupted', duration_ms: 123456 } },
    { type: 'event_msg', payload: { type: 'task_complete', duration_ms: 42000, time_to_first_token_ms: 789 } },
    {
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: {
          total_token_usage: { input_tokens: 1000, cached_input_tokens: 750, output_tokens: 200, total_tokens: 1200 },
          last_token_usage: { total_tokens: 300 },
          model_context_window: 1000
        }
      }
    }
  ])

  const metrics = transcriptMetricsFromJsonl(transcript)

  assert.equal(metrics.compaction_count, 1)
  assert.equal(metrics.tool_call_count, 5)
  assert.equal(metrics.cache_hit_percent, 75)
  assert.equal(metrics.failure_count, 3)
  assert.equal(metrics.shell_command_count, 2)
  assert.equal(metrics.web_search_count, 1)
  assert.equal(metrics.patch_apply_count, 1)
  assert.equal(metrics.subagent_count, 1)
  assert.equal(metrics.edited_file_count, 2)
  assert.equal(metrics.command_success_percent, 50)
  assert.equal(metrics.command_duration_seconds, 6)
  assert.equal(metrics.last_turn_duration_seconds, 42)
  assert.equal(metrics.time_to_first_token_ms, 789)
})

test('hydrates missing metrics from transcript path', async () => {
  const sessions = [
    {
      id: 'abc',
      name: 'demo',
      transcript_path: '/tmp/demo.jsonl'
    }
  ]
  const hydrated = await hydrateTranscriptMetrics(sessions, async path => {
    assert.equal(path, '/tmp/demo.jsonl')
    return jsonl([
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: '第一轮' }]
        }
      },
      {
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: {
            total_token_usage: { total_tokens: 4096 },
            last_token_usage: { total_tokens: 1024 },
            model_context_window: 4096
          }
        }
      }
    ])
  })

  assert.equal(hydrated[0].total_tokens, 4096)
  assert.equal(hydrated[0].turn_count, 1)
  assert.equal(hydrated[0].context_percent, 25)
  assert.equal(hydrated[0].tool_call_count, 0)
  assert.equal(hydrated[0].failure_count, 0)
  assert.equal(Object.prototype.hasOwnProperty.call(hydrated[0], 'cache_hit_percent'), true)
  assert.equal(hydrated[0].cache_hit_percent, null)
  assert.equal(Object.prototype.hasOwnProperty.call(hydrated[0], 'command_success_percent'), true)
  assert.equal(hydrated[0].command_success_percent, null)
})

test('does not read transcripts when metrics are already present', async () => {
  const sessions = [
    {
      id: 'abc',
      name: 'demo',
      transcript_path: '/tmp/demo.jsonl',
      total_tokens: 4096,
      turn_count: 1,
      context_percent: 25,
      compaction_count: 0,
      tool_call_count: 0,
      cache_hit_percent: 0,
      failure_count: 0
    }
  ]
  const hydrated = await hydrateTranscriptMetrics(sessions, async () => {
    throw new Error('should not read transcript')
  })

  assert.deepEqual(hydrated, sessions)
})
