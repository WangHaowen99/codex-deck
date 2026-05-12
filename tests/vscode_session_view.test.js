const assert = require('node:assert/strict')
const test = require('node:test')

const {
  sessionDescription,
  sessionTooltipMetricLines,
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

test('sidebar description includes compact transcript metrics', () => {
  const session = {
    total_tokens: 1400000,
    turn_count: 12,
    context_percent: 74.2,
    compaction_count: 1,
    tool_call_count: 8,
    cache_hit_percent: 82,
    failure_count: 2
  }

  assert.equal(sessionDescription(session), '12轮 · 1.4M · 74% ctx · 压1 · 工具8 · 缓82% · 败2')
})

test('sidebar description omits zero action noise', () => {
  const session = {
    total_tokens: 1400000,
    turn_count: 12,
    context_percent: 74.2,
    compaction_count: 0,
    tool_call_count: 0,
    cache_hit_percent: 0,
    failure_count: 0
  }

  assert.equal(sessionDescription(session), '12轮 · 1.4M · 74% ctx')
})

test('running sidebar description includes elapsed time before metrics', () => {
  const session = {
    activity_state: 'running',
    activity_started_at: '2026-05-11T02:00:00Z',
    activity_elapsed_seconds: 0,
    total_tokens: 1400000,
    turn_count: 12,
    context_percent: 74.2,
    compaction_count: 1,
    tool_call_count: 8,
    cache_hit_percent: 82,
    failure_count: 0
  }

  assert.equal(sessionDescription(session, Date.parse('2026-05-11T02:01:05Z')), '1:05 · 12轮 · 1.4M · 74% ctx · 压1 · 工具8 · 缓82%')
})

test('tooltip metric lines include action analysis details', () => {
  const session = {
    turn_count: 12,
    total_tokens: 1400000,
    context_percent: 74,
    context_tokens: 740,
    context_window: 1000,
    compaction_count: 1,
    tool_call_count: 8,
    cache_hit_percent: 82,
    failure_count: 2,
    shell_command_count: 4,
    web_search_count: 1,
    patch_apply_count: 2,
    subagent_count: 1,
    edited_file_count: 3,
    command_success_percent: 75,
    command_duration_seconds: 65,
    last_turn_duration_seconds: 42,
    time_to_first_token_ms: 789
  }

  assert.deepEqual(sessionTooltipMetricLines(session), [
    '对话轮数：12',
    '总 token：1,400,000',
    '上下文：74% (740 / 1,000)',
    '压缩次数：1',
    '工具调用：8',
    '缓存命中：82%',
    '失败次数：2',
    '工具分布：shell 4, web 1, patch 2, subagent 1',
    '编辑文件：3',
    '命令成功率：75%',
    '命令耗时：1:05',
    '最近一轮：0:42',
    '首 token：789ms'
  ])
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
