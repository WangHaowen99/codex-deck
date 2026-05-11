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
          total_token_usage: { total_tokens: 1234567 },
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
    context_percent: 50
  })
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
})

test('does not read transcripts when metrics are already present', async () => {
  const sessions = [
    {
      id: 'abc',
      name: 'demo',
      transcript_path: '/tmp/demo.jsonl',
      total_tokens: 4096,
      turn_count: 1,
      context_percent: 25
    }
  ]
  const hydrated = await hydrateTranscriptMetrics(sessions, async () => {
    throw new Error('should not read transcript')
  })

  assert.deepEqual(hydrated, sessions)
})
